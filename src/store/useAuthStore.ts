import { create } from 'zustand';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged, updatePassword } from 'firebase/auth';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { safeSession } from '../lib/safeStorage';

interface User {
  name: string;
  role: '店長' | 'AM' | 'BM';
  storeName: string;
  uid: string;
  photoURL?: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isQuotaExceeded: boolean;
  /** users/{uid} の取得中（role がまだ確定していない） */
  isProfileLoading: boolean;
  /** users/{uid} の取得に失敗した（role を勝手に決めない） */
  profileError: boolean;
  viewMode: '店長' | 'AM' | 'BM' | null;
  setViewMode: (mode: '店長' | 'AM' | 'BM' | null) => void;
  setQuotaExceeded: (val: boolean) => void;
  login: (id: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  init: () => void;
  reloadProfile: () => Promise<void>;
  updateUserRole: (targetUserId: string, newRole: '店長' | 'AM' | 'BM') => Promise<void>;
  changePassword: (newPassword: string) => Promise<void>;
}

const LOGIN_FLAG = 'session_last_login_recorded';

/**
 * shiftStore 側のキャッシュ所有者を uid に合わせる。
 * uid が変わったとき（別タブでのサインアウト・セッション復元・トークン切替・ログアウト）に
 * 前ユーザーの店舗キャッシュ・データ・エラー表示を捨てる。循環import回避のため動的import。
 */
async function syncShiftCacheUser(uid: string) {
  try {
    const { setShiftCacheUser } = await import('./useShiftStore');
    setShiftCacheUser(uid);
  } catch (e) {
    console.error('shift cache user sync failed', e);
  }
}

/** 沈黙したまま返ってこない通信で画面が固まらないように必ず時間切れを作る */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), ms)),
  ]);
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isQuotaExceeded: false,
  isProfileLoading: false,
  profileError: false,
  viewMode: null,
  setViewMode: (mode) => set({ viewMode: mode }),
  setQuotaExceeded: (val) => set({ isQuotaExceeded: val }),
  login: async (id: string, password: string) => {
    try {
      // ストレージ禁止端末（iPhoneの「すべてのCookieをブロック」等）でも
      // ここで例外を出さない。素の sessionStorage だと signIn に到達せず
      // 「ログインに失敗しました: The operation is insecure.」で詰む。
      safeSession.removeItem(LOGIN_FLAG);
      // iOSの日本語キーボードは全角英数（ｂｍ）や全角スペースを混ぜてくる。
      // NFKC で半角化し、空白を全部落としてからメールアドレスに組む。
      const cleanId = id.normalize('NFKC').replace(/\s+/g, '').toLowerCase();
      const email = cleanId.includes('@') ? cleanId : `${cleanId}@paradise-weekly.app`;
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error('Login failed', error);
      throw error;
    }
  },
  logout: async () => {
    await signOut(auth);
    safeSession.removeItem(LOGIN_FLAG);
    set({ isProfileLoading: false, profileError: false });
    // レポート購読を止めて完全にクリア（別ユーザーへの残存を防止）。
    // 循環import回避のため動的import。
    try {
      const { useReportStore } = await import('./useReportStore');
      useReportStore.getState().reset();
    } catch (e) {
      console.error('reportStore reset on logout failed', e);
    }
    // 店舗マスタのローカルキャッシュとエラー表示も破棄（別ユーザーへの残存を防止）
    await syncShiftCacheUser('');
  },

  updateUserRole: async (targetUserId: string, newRole: '店長' | 'AM' | 'BM') => {
    const { user } = get();
    if (user?.role !== 'BM') throw new Error('BMのみ実行可能です');

    await updateDoc(doc(db, 'users', targetUserId), { role: newRole });
  },

  changePassword: async (newPassword: string) => {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('ログインしていません');
    await updatePassword(currentUser, newPassword);
  },

  /** users/{uid} を取り直す（権限バーの「再読み込み」から呼ぶ） */
  reloadProfile: async () => {
    const fbUser = auth.currentUser;
    if (!fbUser) return;
    await loadProfile(fbUser, set, get, 0);
  },

  init: () => {
    onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        set({ isAuthenticated: false, user: null, isProfileLoading: false, profileError: false });
        await syncShiftCacheUser('');
        return;
      }

      // uid が変わっていたら前ユーザーのキャッシュ・データ・エラーを捨てる（共有端末対策）。
      // 同じ uid なら何もしないので、セッション復元では即描画用キャッシュがそのまま使える。
      await syncShiftCacheUser(fbUser.uid);

      // 【重要】Firestoreの読み取りを待たずに認証は通す。
      // 以前は users/{uid} の getDoc 完了まで isAuthenticated が false のままで、
      // 通信が沈黙するiPhoneでは「サインインは成功しているのにログイン画面のまま」
      // ＝押しても無反応に見える状態になっていた。
      set({
        isAuthenticated: true,
        isProfileLoading: true,
        profileError: false,
        user: {
          name: fbUser.email?.split('@')[0] || '匿名',
          role: null, // 取得できるまで権限は「未確定」。勝手に店長にしない。
          storeName: '',
          uid: fbUser.uid,
        },
      });

      await loadProfile(fbUser, set, get, 0);
    });
  }
}));

/**
 * users/{uid} を取得して role を確定させる。
 * 失敗しても role を捏造しない（BM/AMが黙って店長に降格するのを防ぐ）。
 * 一時的な通信不良は自動リトライで回復させる。
 */
async function loadProfile(fbUser: any, set: any, get: any, attempt: number): Promise<void> {
  try {
    let userDoc = await withTimeout(getDoc(doc(db, 'users', fbUser.uid)), 8000);

    if (!userDoc.exists()) {
      console.log('Initializing new user in Firestore for', fbUser.uid);
      const defaultName = fbUser.email?.split('@')[0] || 'ユーザー';
      await setDoc(doc(db, 'users', fbUser.uid), {
        name: defaultName,
        role: '店長',
        storeName: '未設定の店舗',
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString()
      });
      safeSession.setItem(LOGIN_FLAG, 'true');
      userDoc = await withTimeout(getDoc(doc(db, 'users', fbUser.uid)), 8000);
    } else if (!safeSession.getItem(LOGIN_FLAG)) {
      // 最終ログイン時刻の記録。失敗してもログインは続行する。
      try {
        await updateDoc(doc(db, 'users', fbUser.uid), {
          lastLoginAt: new Date().toISOString()
        });
        safeSession.setItem(LOGIN_FLAG, 'true');
      } catch (e) {
        console.warn('Could not update lastLoginAt, continuing login flow:', e);
      }
    }

    const userData = userDoc.exists() ? userDoc.data() : null;
    if (!userData) throw new Error('PROFILE_EMPTY');

    set({
      isAuthenticated: true,
      isProfileLoading: false,
      profileError: false,
      user: {
        name: userData.name || fbUser.email?.split('@')[0] || '匿名',
        role: userData.role || '店長',
        storeName: userData.storeName || '未設定の店舗',
        uid: fbUser.uid,
        photoURL: userData.photoURL
      }
    });
  } catch (err: any) {
    if (err?.message?.includes('Quota') || err?.code === 'resource-exhausted') {
      set({ isQuotaExceeded: true, isProfileLoading: false });
      return;
    }
    console.error('Firestore profile load error:', err);

    // 一時的な不調なら自動で取り直す（2秒→4秒→8秒）
    if (attempt < 3) {
      const delay = 2000 * Math.pow(2, attempt);
      setTimeout(() => {
        if (auth.currentUser && auth.currentUser.uid === fbUser.uid && !get().user?.role) {
          loadProfile(fbUser, set, get, attempt + 1);
        }
      }, delay);
      return;
    }

    // 諦める。ただし role は決めない（画面側で「権限を取得できませんでした」を出す）
    set({ isProfileLoading: false, profileError: true });
  }
}
