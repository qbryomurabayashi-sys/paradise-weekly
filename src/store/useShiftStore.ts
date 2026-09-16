import { create } from 'zustand';
import { db } from '../lib/firebase';
import { collection, query, doc, setDoc, updateDoc, deleteDoc, where, getDocs, limit } from 'firebase/firestore';
import { subMonths, format } from 'date-fns';
import { safeLocal } from '../lib/safeStorage';
import { withTimeout } from '../lib/withTimeout';

/**
 * 取得の締め切り。長ポーリング固定＋モバイル回線では getDocs が
 * 例外も返さず解決しないことがあり、そのままだと storesLoaded が永久に false のまま
 * エラーも出ず、確定ボタンが「店舗情報の再読込が必要です」で死ぬ。
 * 締め切りを切って *Error に入れることで、既存の再読込UIを出せるようにする。
 */
const FETCH_TIMEOUT_MS = 30000;
const FETCH_TIMEOUT_MESSAGE = '時間内に読み込めませんでした。通信状況を確認して再読込してください。';

/**
 * 「どの条件で取得した申請データか」を表すキー。
 *
 * なぜ月だけでは足りないか：
 * role が未確定（null）の間に取得すると、下の分岐はどれにも当たらず
 * `where('submittedBy','==',uid)` ＝「自分が出した申請だけ」になる。
 * それでも取得は成功するので、月だけを完了印にしていると
 * role が確定したあとも「この月は読み込み済み」で再取得されず、
 * **他人の申請が見えないまま**カレンダーを操作できてしまう。
 * その状態で確定すると existing が見つからず新規扱いで setDoc され、
 * doc ID が `staffId_date` 固定なので他人の申請を丸ごと置き換える。
 *
 * また `resolvedStoreId`（店舗マスタで実際に解決できた自店の id／解決できなければ 'own'）も含める。
 * 店長・スタッフは自店が店舗マスタに見つからないと `where('submittedBy','==',uid)`＝
 * 「自分が出した申請だけ」にフォールバックする。これを含めないと、
 * 店舗マスタが直った（または改名が届いた）あとも「読み込み済み」のままで取り直されず、
 * 同僚の申請が見えないまま操作でき、サーバで拒否される意味の分からないエラーだけが出る。
 *
 * 変えているのは「読み込み済みの同一性判定」だけで、クエリ条件そのものは変えていない。
 */
export const shiftRequestsScopeKey = (
  monthPrefix: string,
  user?: { role?: string | null; storeName?: string; uid?: string },
  resolvedStoreId?: string
) => `${monthPrefix}|${user?.role || ''}|${user?.uid || ''}|${user?.storeName || ''}|${resolvedStoreId || ''}`;

/** 店長・スタッフが実際にどの店舗idで絞れるか（解決できなければ 'own'＝自分ぶんのみ） */
export const resolveShiftScopeStoreId = (
  stores: Array<{ id: string; name: string }>,
  user?: { role?: string | null; storeName?: string }
): string => {
  if (!user || (user.role !== '店長' && user.role !== 'スタッフ')) return '';
  return stores.find(s => s.name === user.storeName)?.id || 'own';
};

export interface Store {
  id: string;
  name: string;
  requiredStaffing: {
    monday: number;
    weekday: number;
    friday: number;
    saturday: number;
    sundayHoliday: number;
  };
  closedDaysOfWeek?: number[];
  closedDates?: string[];
  operatingHoursPerDay?: number;
  availableSeats?: number;
  assignedAM?: string;
  createdAt?: number;
}

export interface Staff {
  id: string;
  storeId: string;
  employmentType: 'fulltime' | 'parttime';
  defaultPtShiftType?: 'full' | 'short';
  lastName: string;
  firstName: string;
  isLogisGrad?: boolean;
  joinedDate?: string;
  assignedDate?: string;
  monthlyOffDays?: number;
  weeklyWorkDays?: number;
  closedDaysOfWeek?: number[];
  closedDates?: string[];
}

export type ShiftRequestType = '希望休' | '有休' | 'フリー有休' | '会議' | '研修' | '特休' | 'その他' | '公出' | '希望休なし';

export interface ShiftRequest {
  id: string;
  staffId: string;
  storeId: string;
  date: string; // YYYY-MM-DD
  type: ShiftRequestType;
  ptShiftType?: 'full' | 'short';
  status: 'pending' | 'approved' | 'rejected';
  submittedBy: string;
  notes?: string;
  createdAt?: number;
  updatedAt?: number;
}

interface ShiftStoreState {
  stores: Store[];
  staffs: Staff[];
  shiftRequests: ShiftRequest[];
  isLoading: boolean;
  hasCleanedUp: boolean;
  storesLoaded: boolean;
  staffsLoaded: boolean;
  /** 取得に失敗したときだけ文字列が入る（成功・未着手は null）。UIの「再読込」表示用 */
  storesError: string | null;
  staffsError: string | null;
  requestsError: string | null;
  /** 取得範囲が意図的に狭められたときの通知（画面に出して黙らせない） */
  shiftScopeNotice: string | null;
  /** 取得済みデータのスコープキー（shiftRequestsScopeKey の値）。月だけでは足りない理由は同関数のコメント参照 */
  loadedRequestsScope: string;

  initStores: (force?: boolean) => () => void;
  initStaffs: (force?: boolean) => () => void;
  initShiftRequests: (monthPrefix: string, user?: {role: string, storeName?: string, uid: string}, force?: boolean) => () => void; // "YYYY-MM"
  
  saveStore: (store: Store) => Promise<void>;
  saveStaff: (staff: Staff) => Promise<void>;
  saveShiftRequest: (req: ShiftRequest) => Promise<void>;
  deleteShiftRequest: (id: string) => Promise<void>;
  deleteStore: (id: string) => Promise<void>;
  deleteStaff: (id: string) => Promise<void>;
  cleanupOldShiftRequests: () => Promise<void>;
  deduplicateShiftRequests: (monthPrefix: string) => Promise<void>;
}

/**
 * 店舗マスタのローカルキャッシュ（stale-while-revalidate）。
 * 4G/低速回線でも初回描画で店舗プルダウンが埋まるようにする。
 * 店舗名・必要人数は非センシティブなのでキャッシュ可。
 * スタッフ（姓名＝個人情報）は共有端末に平文で残したくないのでキャッシュしない。
 */
const STORES_CACHE_PREFIX = 'qb_kanri_stores_v1_';
// 目的は初回描画だけなので短く。店舗の改名・削除が残る窓を1日に限定する。
const STORES_CACHE_MAX_AGE = 24 * 60 * 60 * 1000; // 24時間

/** キャッシュはユーザー単位。キーに uid を含めて別アカウント混入を構造的に消す */
let _cacheUid = '';
const storesCacheKey = (uid: string) => `${STORES_CACHE_PREFIX}${uid}`;

const readStoresCache = (uid: string): Store[] => {
  if (!uid) return [];
  const cached = safeLocal.getJSON<{ savedAt?: number; stores?: Store[] }>(storesCacheKey(uid), {});
  if (!cached.savedAt || !Array.isArray(cached.stores)) return [];
  if (Date.now() - cached.savedAt > STORES_CACHE_MAX_AGE) return [];
  // 壊れた値でUIが落ちないよう最低限の形だけ検査する。
  //
  // requiredStaffing の有無はここでは見ない（一度入れたが撤回した）。
  // ライブ取得（loadStores）は同じフィルタをしていないため、ここだけで弾くと
  // キャッシュ描画時とライブ取得時で店舗の集合が食い違い、requiredStaffing 未設定の店舗が
  // 「キャッシュ表示中だけプルダウンから消える」＝その店の店長が自店を選べなくなる。
  // 白画面対策は参照側のガード（各所で `store.requiredStaffing || {}`）に寄せている。
  return cached.stores.filter(s => s && typeof s.id === 'string' && typeof s.name === 'string');
};

/** ログアウト時・uid切替時に店舗キャッシュを捨てる（別ユーザーへの残存を防ぐ） */
export const clearShiftCaches = () => {
  if (_cacheUid) safeLocal.removeItem(storesCacheKey(_cacheUid));
};

/**
 * 認証状態が変わるたびに呼ぶ。uid が変わったら前ユーザーのキャッシュと
 * ストア上のデータ・エラー表示を全部捨てる（共有端末での混入防止）。
 * サインアウト時は uid='' で呼ぶ。
 */
export const setShiftCacheUser = (uid: string) => {
  if (_cacheUid === uid) return;
  clearShiftCaches();
  _cacheUid = uid;
  useShiftStore.setState({
    stores: readStoresCache(uid),
    staffs: [],
    shiftRequests: [],
    storesLoaded: false,
    staffsLoaded: false,
    loadedRequestsScope: '',
    storesError: null,
    staffsError: null,
    requestsError: null,
    shiftScopeNotice: null,
    isLoading: false,
  });
};

// 同時多発の init を1本にまとめる in-flight（連打・画面往復で多重フェッチしない）
let _storesInflight: Promise<void> | null = null;
let _staffsInflight: Promise<void> | null = null;
let _requestsInflight: Promise<void> | null = null;
/** in-flight 中のスコープ。同じ条件の要求だけを弾き、条件が違う要求は必ず走らせる */
let _requestsInflightScope: string = '';
/** 要求の世代。最新世代の応答だけが state を更新できる（古い応答は破棄） */
let _requestsSeq = 0;

export const useShiftStore = create<ShiftStoreState>((set, get) => ({
  // uid 確定時に setShiftCacheUser がキャッシュを流し込む（初回描画で店舗名が出る）
  stores: [],
  staffs: [],
  shiftRequests: [],
  isLoading: false,
  hasCleanedUp: false,
  storesLoaded: false,
  staffsLoaded: false,
  storesError: null,
  staffsError: null,
  requestsError: null,
  shiftScopeNotice: null,
  loadedRequestsScope: '',

  initStores: (force: boolean = false) => {
    if (!force && get().storesLoaded) return () => {};
    if (!force && _storesInflight) return () => {};
    set({ isLoading: true, storesError: null });

    const loadStores = async () => {
      try {
        const q = query(collection(db, 'stores'), limit(100));
        const snapshot = await withTimeout(getDocs(q), FETCH_TIMEOUT_MS, '店舗の読み込み');
        let stores = snapshot.docs.map(doc => {
          const data = doc.data() as Store;
          if (data.assignedAM === '越井A') {
            data.assignedAM = ''; // Sanitize removed AM option
            updateDoc(doc.ref, { assignedAM: '' }).catch(console.error);
          } else if (data.assignedAM === '仲原A') {
            data.assignedAM = '仲原AM'; // Normalize legacy short form (M抜け入力ミス)
            updateDoc(doc.ref, { assignedAM: '仲原AM' }).catch(console.error);
          } else if (data.assignedAM === '松阪A') {
            data.assignedAM = '松阪AM'; // Normalize legacy short form
            updateDoc(doc.ref, { assignedAM: '松阪AM' }).catch(console.error);
          }
          return { id: doc.id, ...data };
        });
        
        const STORE_ORDER = [
          '追浜',
          '北口',
          '別所',
          '文庫',
          'MM',
          'ｶﾐｵ',
          '久里',
          '汐入',
          '市役',
          '岡野',
          '保土'
        ];

        stores.sort((a, b) => {
          const indexA = STORE_ORDER.indexOf(a.name);
          const indexB = STORE_ORDER.indexOf(b.name);
          
          if (indexA !== -1 && indexB !== -1) return indexA - indexB;
          if (indexA !== -1) return -1;
          if (indexB !== -1) return 1;
          if (a.createdAt && b.createdAt) return a.createdAt - b.createdAt;
          if (a.createdAt) return 1;
          if (b.createdAt) return -1;
          return a.name.localeCompare(b.name, 'ja');
        });

        set({ stores, isLoading: false, storesLoaded: true, storesError: null });
        if (_cacheUid) safeLocal.setJSON(storesCacheKey(_cacheUid), { savedAt: Date.now(), stores });
      } catch (error: any) {
        if (error?.message?.includes('Quota') || error?.code === 'resource-exhausted') {
          document.dispatchEvent(new CustomEvent('quota-exceeded'));
        } else {
          console.error("Stores fetch error:", error);
        }
        // storesLoaded は false のまま＝再試行できる。エラーはUIに出す（黙って空にしない）
        set({
          isLoading: false,
          storesError: error?.name === 'TimeoutError' ? FETCH_TIMEOUT_MESSAGE : '店舗の読み込みに失敗しました'
        });
      }
    };

    _storesInflight = loadStores().finally(() => { _storesInflight = null; });
    return () => {};
  },

  initStaffs: (force: boolean = false) => {
    if (!force && get().staffsLoaded) return () => {};
    if (!force && _staffsInflight) return () => {};
    set({ isLoading: true, staffsError: null });

    const loadStaffs = async () => {
      try {
        const q = query(collection(db, 'staffs'), limit(300));
        const snapshot = await withTimeout(getDocs(q), FETCH_TIMEOUT_MS, 'スタッフの読み込み');
        const staffs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Staff));
        set({ staffs, isLoading: false, staffsLoaded: true, staffsError: null });
      } catch (error: any) {
        if (error?.message?.includes('Quota') || error?.code === 'resource-exhausted') {
          document.dispatchEvent(new CustomEvent('quota-exceeded'));
        } else {
          console.error("Staffs fetch error:", error);
        }
        set({
          isLoading: false,
          staffsError: error?.name === 'TimeoutError' ? FETCH_TIMEOUT_MESSAGE : 'スタッフの読み込みに失敗しました'
        });
      }
    };

    _staffsInflight = loadStaffs().finally(() => { _staffsInflight = null; });
    return () => {};
  },

  initShiftRequests: (monthPrefix: string, user?: {role: string, storeName?: string, uid: string}, force: boolean = false) => {
    // 解決結果は stores の到着で変わるので、判定のたびに取り直す
    const currentScopeKey = () => shiftRequestsScopeKey(monthPrefix, user, resolveShiftScopeStoreId(get().stores, user));
    const scopeKey = currentScopeKey();
    if (!force && get().loadedRequestsScope === scopeKey) return () => {};
    // 完了フラグは「成功後」に立てる（失敗を読み込み済みにしないため）。
    // in-flight ガードは【同じ月】の二重フェッチだけを弾く。
    // 別の月の要求まで落とすと、月送り中の要求が消えて「読み込み中」で永久固着する。
    if (!force && _requestsInflight && _requestsInflightScope === scopeKey) return () => {};

    // 最新要求だけが state を書けるようにする（古い応答＝stale response は破棄）
    const seq = ++_requestsSeq;
    const isStale = () => seq !== _requestsSeq;
    _requestsInflightScope = scopeKey;

    set({ isLoading: true });

    const startStr = `${monthPrefix}-01`;
    const endStr = `${monthPrefix}-31`;

    const loadShiftRequests = async () => {
      try {
        // SECURITY: 店長/スタッフは自店に絞る。stores 未ロードのまま判定すると
        // 黙って submittedBy フォールバック（＝別範囲のデータ）になるので、
        // ロード完了を待ち、待っても取れなければ「クエリを投げない」。
        if (user && (user.role === '店長' || user.role === 'スタッフ')) {
          if (!get().storesLoaded) {
            get().initStores();
            if (_storesInflight) await _storesInflight;
          }
          if (!get().storesLoaded) {
            // 店舗マスタが取れていない＝絞り込み条件を決められない。クエリは投げない。
            // loadedRequestsScope は立てていないので、stores 復旧後に再試行される。
            if (!isStale()) set({ isLoading: false });
            return;
          }
          // stores を待っている間に別の月が要求されていたら、この要求は用済み
          if (isStale()) return;
        }

        // ここでの絞り込みは【クライアント側だけ】のもの。
        // firestore.rules は shift_requests に `allow read: if isSignedIn()` しか書いておらず、
        // サーバ側の店舗単位の読み取り制限は未実装＝認証済みユーザーは全件読める。
        // したがってこれは情報漏えい対策ではなく「取得範囲を必要分に絞る」だけの実装。
        // ルール強化（自店 / submittedBy / BM・AM に限定）は別案件。
        const constraints: any[] = [
          where('date', '>=', startStr),
          where('date', '<=', endStr)
        ];

        if (user && user.role === 'BM') {
          // BM accesses everything
        } else if (user && user.role === 'AM') {
          // AM normally accesses their area
        // 【論点として残す】'スタッフ' は useAuthStore の User.role 型（店長/AM/BM/null）に無いが、
        // 実データに存在する可能性があるためこの分岐は消さない。消すと最後の else に落ちて
        // 「自分が出した申請だけ」になり、事故が静かに悪化する。型側に足すかは別途判断。
        } else if (user && (user.role === '店長' || user.role === 'スタッフ')) {
            const myStore = get().stores.find(s => s.name === user.storeName);
            if (myStore) {
                constraints.push(where('storeId', '==', myStore.id));
                if (!isStale()) set({ shiftScopeNotice: null });
            } else {
                // 自店が特定できないときは最小権限（自分が出した申請のみ）に絞る。
                // 黙って範囲が変わらないよう、意図的な絞り込みであることを画面に出す。
                constraints.push(where('submittedBy', '==', user.uid));
                if (!isStale()) set({ shiftScopeNotice: `所属店舗（${user.storeName || '未設定'}）が店舗マスタに見つかりませんでした。あなたが登録した申請のみ表示しています。` });
            }
        } else {
            if (user?.uid) constraints.push(where('submittedBy', '==', user.uid));
        }

        const q = query(collection(db, 'shift_requests'), ...constraints);
        const snapshot = await withTimeout(getDocs(q), FETCH_TIMEOUT_MS, '申請データの読み込み');
        const shiftRequests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ShiftRequest));
        // 古い月の応答で新しい月の state を上書きしない
        if (isStale()) return;
        // 成功してから「この月は読み込み済み」にする
        // 実際に絞り込みに使えた店舗まで含めたキーで「読み込み済み」にする
        // （stores を待っている間に解決できるようになった場合を取りこぼさない）
        set({ shiftRequests, isLoading: false, requestsError: null, loadedRequestsScope: currentScopeKey() });

        // ※ deduplicateShiftRequests / cleanupOldShiftRequests の呼び出しはここから外した。
        //   - 画面を開くたびに Firestore を消す（＝不可逆）処理を走らせるべきではない。
        //     rules 上 delete は submittedBy==uid / BM / AM のみなので、店長では他人分が
        //     permission-denied になり「途中まで消えて止まる」非決定的な部分削除になっていた。
        //     逆に AM/BM は画面を開くだけで全店ぶんが無言で消えうる。
        //   - dedupe は Firestore だけ消してメモリの shiftRequests を更新しないので、
        //     非同期化しても幽霊行が残り、タップすると setDoc で復活してしまう。
        //   - saveShiftRequest が doc ID を `${staffId}_${date}` に固定した現行コードでは
        //     重複は原理的に発生しない（対象は乱数ID時代のレガシーのみ＝1回限りの移行処理）。
        //   関数本体は BM 専用の手動移行画面用に残してある（別案件）。
      } catch (error: any) {
        if (error?.message?.includes('Quota') || error?.code === 'resource-exhausted') {
          document.dispatchEvent(new CustomEvent('quota-exceeded'));
          if (!isStale()) set({ isLoading: false });
          return;
        }
        console.error("Shift fetch error", error);
        // 古い月の失敗で、表示中の月をエラー表示にしない
        if (isStale()) return;
        // 複合インデックス未作成（failed-precondition）は quota とは別物。静かに空にしない。
        const isIndexMissing = error?.code === 'failed-precondition';
        set({
          isLoading: false,
          requestsError: error?.name === 'TimeoutError'
            ? FETCH_TIMEOUT_MESSAGE
            : isIndexMissing
              ? '申請データの検索設定（インデックス）が未作成のため読み込めませんでした。管理者に連絡してください。'
              : '申請データの読み込みに失敗しました'
        });
        // 失敗した月は loadedRequestsScope を立てていない＝再試行できる
      }
    };
    
    _requestsInflight = loadShiftRequests().finally(() => {
      // 自分が最新要求だったときだけ in-flight を解除する（新しい要求の目印を消さない）
      if (!isStale()) {
        _requestsInflight = null;
        _requestsInflightScope = '';
      }
    });
    return () => {};
  },

  saveStore: async (store: Store) => {
    if (!store.id) store.id = doc(collection(db, 'stores')).id;
    if (!store.createdAt) store.createdAt = Date.now();
    await setDoc(doc(db, 'stores', store.id), store);
  },

  saveStaff: async (staff: Staff) => {
    if (!staff.id) staff.id = doc(collection(db, 'staffs')).id;
    await setDoc(doc(db, 'staffs', staff.id), staff);
  },

  saveShiftRequest: async (req: ShiftRequest) => {
    if (!req.id) {
      req.id = `${req.staffId}_${req.date}`;
      req.createdAt = Date.now();
    } else if (!req.createdAt) {
      // Fix missing createdAt for old existing records
      req.createdAt = Date.now();
    }
    const updatedReq = { ...req, updatedAt: Date.now() };
    await setDoc(doc(db, 'shift_requests', req.id), updatedReq);

    const current = get().shiftRequests;
    const index = current.findIndex(r => r.id === req.id);
    if (index !== -1) {
      const next = [...current];
      next[index] = updatedReq;
      set({ shiftRequests: next });
    } else {
      set({ shiftRequests: [...current, updatedReq] });
    }
  },

  deleteShiftRequest: async (id: string) => {
    if (!id) return;
    await deleteDoc(doc(db, 'shift_requests', id));

    const current = get().shiftRequests;
    set({ shiftRequests: current.filter(r => r.id !== id) });
  },

  deleteStore: async (id: string) => {
    if (!id) return;
    await deleteDoc(doc(db, 'stores', id));
  },

  deleteStaff: async (id: string) => {
    if (!id) return;
    await deleteDoc(doc(db, 'staffs', id));
  },

  cleanupOldShiftRequests: async () => {
    try {
      // setMonth(-2) は月末日で桁溢れして境界が最大2日ずれる（＝消し過ぎ）ため subMonths を使う
      const twoMonthsAgo = subMonths(new Date(), 2);
      const twoMonthsAgoStr = format(twoMonthsAgo, 'yyyy-MM-dd');

      const q = query(
        collection(db, 'shift_requests'),
        where('date', '<', twoMonthsAgoStr)
      );

      const snapshot = await getDocs(q);
      snapshot.forEach((docSnap) => {
        deleteDoc(doc(db, 'shift_requests', docSnap.id)).catch(console.error);
      });
    } catch (err) {
      console.error('Failed to cleanup old shift requests', err);
    }
  },

  deduplicateShiftRequests: async (monthPrefix: string) => {
    try {
      const startStr = `${monthPrefix}-01`;
      const endStr = `${monthPrefix}-31`;
      const q = query(
        collection(db, 'shift_requests'),
        where('date', '>=', startStr),
        where('date', '<=', endStr)
      );
      const snapshot = await getDocs(q);
      const allReqs = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as ShiftRequest));
      
      const groups = new Map<string, ShiftRequest[]>();
      allReqs.forEach(r => {
        const key = `${r.staffId}_${r.date}`;
        if (!groups.has(key)) {
          groups.set(key, []);
        }
        groups.get(key)!.push(r);
      });
      
      for (const [key, reqs] of groups.entries()) {
        if (reqs.length > 1) {
          reqs.sort((a, b) => {
            const timeA = a.updatedAt || a.createdAt || 0;
            const timeB = b.updatedAt || b.createdAt || 0;
            return timeB - timeA;
          });
          
          const toDelete = reqs.slice(1);
          for (const d of toDelete) {
            await deleteDoc(doc(db, 'shift_requests', d.id));
          }
        }
      }
    } catch (err) {
      console.error('Failed to deduplicate shift requests:', err);
    }
  }
}));
