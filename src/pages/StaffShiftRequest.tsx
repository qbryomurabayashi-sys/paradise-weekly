import React, { useState, useEffect, useMemo } from 'react';
import { useShiftStore, ShiftRequestType } from '../store/useShiftStore';
import { useAuthStore } from '../store/useAuthStore';
import { useAnnouncementStore } from '../store/useAnnouncementStore';
import { format, startOfMonth, addMonths, subMonths, eachDayOfInterval, endOfMonth, getDay, isSameDay } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Calendar, ChevronLeft, ChevronRight, CheckCircle, User as UserIcon, Store as StoreIcon, AlertTriangle, AlertCircle, RefreshCw, Info } from 'lucide-react';
import * as JapaneseHolidays from 'japanese-holidays';
import { formatStaffName } from '../lib/formatUtils';
import { safeLocal } from '../lib/safeStorage';

const isHoliday = (date: Date) => getDay(date) === 0 || JapaneseHolidays.isHoliday(date) !== undefined;

/** 読み込み失敗を黙って空にしないための共通表示（メッセージ＋再読込ボタン） */
const LoadFailureNotice = ({ message, onRetry, retrying }: { message: string; onRetry: () => void; retrying: boolean }) => (
    <div className="mt-2 bg-danger/10 border border-danger/20 rounded-xl p-3 flex items-center gap-3">
        <AlertCircle size={18} className="text-danger shrink-0" />
        <p className="flex-1 text-sm font-bold text-danger leading-relaxed">{message}</p>
        <button
            onClick={onRetry}
            disabled={retrying}
            className="min-h-[44px] px-4 rounded-xl bg-surface border border-danger/30 text-danger text-sm font-black flex items-center gap-1.5 active:scale-95 transition disabled:opacity-60"
        >
            <RefreshCw size={16} className={retrying ? 'animate-spin' : ''} />
            {retrying ? '読込中' : '再読込'}
        </button>
    </div>
);

export const StaffShiftRequest = () => {
    const { user } = useAuthStore();
    const { stores, staffs, shiftRequests, storesLoaded, staffsLoaded, storesError, staffsError, requestsError, shiftScopeNotice, loadedRequestsMonth, isLoading, initStores, initStaffs, initShiftRequests, saveShiftRequest, deleteShiftRequest } = useShiftStore();
    const { addAnnouncement } = useAnnouncementStore();
    const [currentDate, setCurrentDate] = useState(addMonths(new Date(), 1));
    
    const [selectedStoreId, setSelectedStoreId] = useState<string>('');
    const [selectedStaffId, setSelectedStaffId] = useState<string>('');
    const [selectedType, setSelectedType] = useState<ShiftRequestType>('希望休');

    // Keyed by staffId -> dateStr -> type
    const [draftRequests, setDraftRequests] = useState<Record<string, Record<string, ShiftRequestType | null>>>({});
    const [isManagerApproved, setIsManagerApproved] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [statusMessage, setStatusMessage] = useState<{type: 'error' | 'success', text: string} | null>(null);

    useEffect(() => {
        const unsubStores = initStores();
        const unsubStaffs = initStaffs();
        return () => {
            unsubStores();
            unsubStaffs();
        };
    }, []);

    // 成功は短く、失敗は読み切れるだけ長く出す（失敗を見落とさせない）
    useEffect(() => {
        if (!statusMessage) return;
        const t = setTimeout(() => setStatusMessage(null), statusMessage.type === 'error' ? 12000 : 4000);
        return () => clearTimeout(t);
    }, [statusMessage]);

    /**
     * 未申請の選択（下書き）を端末に保存する。
     * iPhoneは背景のタブを容赦なく破棄するので、カレンダーをタップした状態で
     * 電話・アプリ切替・画面ロックが入るとReactのstateごと消え、本人は「入れたのに無くなった」になる。
     * 保存するのは店舗ID/日付/種別だけで、氏名などの個人情報は入れない。
     */
    const draftsKey = user?.uid ? `qb_kanri_shift_drafts_v1_${user.uid}` : '';
    const [restoredDrafts, setRestoredDrafts] = useState(false);

    useEffect(() => {
        if (!draftsKey || restoredDrafts) return;
        const saved = safeLocal.getJSON<{ savedAt?: number; drafts?: any }>(draftsKey, {});
        setRestoredDrafts(true);
        if (!saved.savedAt || !saved.drafts) return;
        // 古い下書きを無期限に生き残らせない（先月分の選択が突然復活しないように7日で捨てる）
        if (Date.now() - saved.savedAt > 7 * 24 * 60 * 60 * 1000) {
            safeLocal.removeItem(draftsKey);
            return;
        }
        if (typeof saved.drafts !== 'object' || Object.keys(saved.drafts).length === 0) return;
        setDraftRequests(saved.drafts);
        setStatusMessage({ type: 'success', text: '前回の未申請の選択を復元しました。内容を確認して確定してください。' });
    }, [draftsKey, restoredDrafts]);

    useEffect(() => {
        if (!draftsKey || !restoredDrafts) return;
        const hasDrafts = Object.keys(draftRequests).some(sid => Object.keys(draftRequests[sid] || {}).length > 0);
        if (hasDrafts) safeLocal.setJSON(draftsKey, { savedAt: Date.now(), drafts: draftRequests });
        else safeLocal.removeItem(draftsKey);
    }, [draftRequests, draftsKey, restoredDrafts]);

    useEffect(() => {
        // 店舗マスタが揃うまで投げない（権限分岐が stores 依存なので、黙って別範囲を取るのを防ぐ）
        if (!storesLoaded) return;
        const prefix = format(currentDate, 'yyyy-MM');
        const unsub = initShiftRequests(prefix, user ? {role: user.role, storeName: user.storeName, uid: user.uid} : undefined);
        return () => unsub();
    }, [currentDate, user?.uid, user?.role, storesLoaded]);

    useEffect(() => {
        if (user && stores.length > 0) {
            if (user.role === '店長' || user.role === 'AM') {
                const uStore = stores.find(s => s.name === user.storeName);
                if (uStore && !selectedStoreId) {
                    setSelectedStoreId(uStore.id);
                }
            }
        }
    }, [user, stores, selectedStoreId]);

    const filteredStaffs = staffs.filter(s => s.storeId === selectedStoreId);

    // select は「読み込み中／取得失敗／本当に0件／正常」の4状態を取り違えないこと。
    // 正常以外は disabled にして、空のネイティブピッカーが開くのを防ぐ。
    // （キャッシュから即描画できた場合は length>0 なので 'ready'＝操作可能）
    const selectState = (count: number, loaded: boolean, error: string | null): 'loading' | 'error' | 'empty' | 'ready' => {
        if (count > 0) return 'ready';
        if (error) return 'error';
        if (!loaded) return 'loading';
        return 'empty';
    };
    const storesState = selectState(stores.length, storesLoaded, storesError);
    const staffsState = selectState(filteredStaffs.length, staffsLoaded, staffsError);
    const isStoresPending = storesState === 'loading';
    const isStaffsPending = staffsState === 'loading';

    // 既存申請が届く前のタップは「他人の申請を上書きする」不可逆事故になるので受け付けない
    const monthPrefix = format(currentDate, 'yyyy-MM');
    const isRequestsReady = loadedRequestsMonth === monthPrefix;
    // キャッシュだけで表示している状態（requiredStaffing・定休日が古い可能性がある）。
    // この状態で確定させると誤った不足人数のお知らせが全社配信されるため、申請は止める。
    const isStoresStale = !storesLoaded && stores.length > 0;

    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // Effective requests for the *selected staff*
    const effectiveRequests = useMemo(() => {
        const map = new Map<string, { id?: string; type: ShiftRequestType | null; status?: string; isNew: boolean }>();
        if (!selectedStaffId) return map;
        
        shiftRequests.forEach(r => {
            if (r.staffId === selectedStaffId) {
                map.set(r.date, { id: r.id, type: r.type, status: r.status, isNew: false });
            }
        });

        const drafts = draftRequests[selectedStaffId] || {};
        Object.entries(drafts).forEach(([dateStr, t]) => {
            const reqType = t as ShiftRequestType | null;
            const existing = map.get(dateStr);
            if (existing) {
                map.set(dateStr, { ...existing, type: reqType, isNew: true });
            } else {
                map.set(dateStr, { type: reqType, isNew: true });
            }
        });

        return map;
    }, [shiftRequests, draftRequests, selectedStaffId]);

    const limitTypes = ['希望休', '有休'];
    
    // Count only limited types for the *selected staff*
    const limitCount = useMemo(() => {
        let count = 0;
        effectiveRequests.forEach((val, key) => {
            const dateObj = new Date(key);
            if (dateObj >= monthStart && dateObj <= monthEnd) {
                if (val.type && limitTypes.includes(val.type)) {
                    count++;
                }
            }
        });
        return count;
    }, [effectiveRequests, monthStart, monthEnd]);

    const isOverLimit = limitCount > 3;

    // Helper: calculate available off slots for a store
    const getStoreAvailableOffSlots = (storeId: string, dateObj: Date) => {
        const dateStr = format(dateObj, 'yyyy-MM-dd');
        const dayOfWeek = getDay(dateObj);
        const st = stores.find(s => s.id === storeId);
        if (!st) return { allowed: 0, used: 0, remaining: 0, reqCount: 0 };

        const isClosed = st.closedDaysOfWeek?.includes(dayOfWeek) || st.closedDates?.includes(dateStr);

        const req = st.requiredStaffing;
        let reqCount = 0;
        
        if (isClosed) {
            reqCount = 0;
        } else if (isHoliday(dateObj)) {
            reqCount = req.sundayHoliday || 0;
        } else if (dayOfWeek === 1) {
            reqCount = req.monday || 0;
        } else if (dayOfWeek === 5) {
            reqCount = req.friday || 0;
        } else if (dayOfWeek === 6) {
            reqCount = req.saturday || 0;
        } else {
            reqCount = req.weekday || 0;
        }

        const stStaffs = staffs.filter((s:any) => s.storeId === storeId && (s.employmentType !== 'parttime' || s.defaultPtShiftType !== 'short'));
        let potential = 0;
        let alreadyOff = 0;

        stStaffs.forEach((s:any) => {
            const draftType = draftRequests[s.id]?.[dateStr];
            const existingReq = shiftRequests.find((r:any) => r.staffId === s.id && r.date === dateStr);
            const type = draftType !== undefined ? draftType : existingReq?.type;

            if (type === '公出') {
                potential++; // Always available when 公出
            } else {
                if (s.closedDaysOfWeek?.includes(dayOfWeek) || s.closedDates?.includes(dateStr)) {
                    // native absent
                } else {
                    potential++;
                    if (type && ['希望休', '有休', '特休', 'フリー有休', '会議', '研修', 'その他'].includes(type)) {
                        alreadyOff++;
                    }
                }
            }
        });
        
        return {
            allowed: potential - reqCount,
            used: alreadyOff,
            remaining: potential - reqCount - alreadyOff,
            reqCount
        };
    };

    const getBlockAvailableOffSlots = (dateObj: Date) => {
        let allowed = 0;
        let used = 0;
        stores.forEach(st => {
            const res = getStoreAvailableOffSlots(st.id, dateObj);
            if (res.allowed !== 999) {
                allowed += res.allowed;
                used += res.used;
            }
        });
        return { allowed, used, remaining: allowed - used };
    };

    const handleDateClick = (date: Date) => {
        // 既存申請が未取得のまま下書きを作ると、確定時に existing 無しで setDoc され
        // 他人が入れた申請種別を上書きしてしまう（doc IDは staffId_date 固定）。
        if (!isRequestsReady) return;
        if (!selectedStaffId) {
            setStatusMessage({type: 'error', text: '先にスタッフを選択してください'});
            setTimeout(() => setStatusMessage(null), 3000);
            return;
        }

        const dateStr = format(date, 'yyyy-MM-dd');
        const effective = effectiveRequests.get(dateStr);
        
        let nextType: ShiftRequestType | null = selectedType as ShiftRequestType;
        if (selectedType === '取消(クリア)' as any) {
            nextType = null;
        } else if (effective?.type === selectedType) {
            nextType = null;
        }

        setDraftRequests(prev => ({
            ...prev,
            [selectedStaffId]: {
                ...(prev[selectedStaffId] || {}),
                [dateStr]: nextType
            }
        }));
    };

    const hasAnyChanges = Object.keys(draftRequests).some(sid => Object.keys(draftRequests[sid]).length > 0);

    const handleSubmitAll = async () => {
        // Validation: loop through drafts to see if any staff exceeds limit without approval
        let overLimitStaffName = "";
        for (const [staffId, drafts] of Object.entries(draftRequests)) {
            let count = 0;
            // Existing requests
            const existing = shiftRequests.filter(r => r.staffId === staffId);
            const map = new Map<string, ShiftRequestType | null>();
            existing.forEach(r => map.set(r.date, r.type));
            // Apply drafts
            Object.entries(drafts).forEach(([dStr, t]) => map.set(dStr, t));

            map.forEach((t, dStr) => {
                const dObj = new Date(dStr);
                if (dObj >= monthStart && dObj <= monthEnd) {
                    if (t && limitTypes.includes(t)) count++;
                }
            });

            if (count > 3 && !isManagerApproved) {
                const s = staffs.find(st => st.id === staffId);
                overLimitStaffName = s ? formatStaffName(`${s.lastName} ${s.firstName}`) : staffId;
                break;
            }
        }

        if (overLimitStaffName && !isManagerApproved) {
            setStatusMessage({type: 'error', text: `${overLimitStaffName}さんの希望休・有休が3日を超えています。上長の承認確認にチェックを入れてください。`});
            setTimeout(() => setStatusMessage(null), 5000);
            return;
        }

        setIsSubmitting(true);

        // 【順序が最重要】申請の保存を最初に行う。
        // 以前は「稼働不足のお知らせ配信」を保存より先に await していたため、
        // announcements の create が BM/AM のみ許可（firestore.rules）である店長・スタッフでは
        // permission-denied で例外になり、**申請が1件も保存されないまま** catch に落ちていた。
        // しかもエラー表示はページ上端の通常フローにあり、画面下の確定ボタンを押した本人には見えず、
        // 下書きも消えないのでカレンダーには色が残る＝「送信できたのに反映されない」になっていた。
        const savedKeys: Array<{ staffId: string; dateStr: string }> = [];
        let failedCount = 0;

        // Save requests
        for (const [staffId, drafts] of Object.entries(draftRequests)) {
            const sStoreId = staffs.find(s => s.id === staffId)?.storeId || selectedStoreId;
            for (const [dateStr, type] of Object.entries(drafts)) {
                // 1件ずつ成否を見る。1件の失敗で残りを捨てない（部分成功をそのまま報告する）
                try {
                    const existing = shiftRequests.find(r => r.staffId === staffId && r.date === dateStr);
                    if (type === null) {
                        if (existing) {
                            await deleteShiftRequest(existing.id);
                        } else {
                            await deleteShiftRequest(staffId + '_' + dateStr);
                        }
                    } else if (existing) {
                        if (existing.type !== type) {
                            await saveShiftRequest({ ...existing, type, status: 'pending' });
                        }
                    } else {
                        await saveShiftRequest({
                            id: '',
                            staffId,
                            storeId: sStoreId,
                            date: dateStr,
                            type,
                            status: 'pending',
                            submittedBy: user?.uid || '',
                            notes: ''
                        });
                    }
                    savedKeys.push({ staffId, dateStr });
                } catch (e) {
                    failedCount++;
                    console.error('Shift request save failed', { staffId, dateStr, type }, e);
                }
            }
        }

        // 保存できた分だけ下書きから外す。失敗した分は画面に残して再送できるようにする
        // （成功したのに下書きが残る／失敗したのに消える、のどちらも起こさない）
        if (savedKeys.length > 0) {
            setDraftRequests(prev => {
                const next: typeof prev = {};
                Object.entries(prev).forEach(([sid, drafts]) => {
                    const remain: Record<string, ShiftRequestType | null> = {};
                    Object.entries(drafts).forEach(([dStr, t]) => {
                        if (!savedKeys.some(k => k.staffId === sid && k.dateStr === dStr)) remain[dStr] = t;
                    });
                    if (Object.keys(remain).length > 0) next[sid] = remain;
                });
                return next;
            });
        }

        // Force a re-fetch of shift requests from Firestore to be 100% sure we are in sync
        const prefix = format(currentDate, 'yyyy-MM');
        initShiftRequests(prefix, user ? {role: user.role, storeName: user.storeName, uid: user.uid} : undefined, true);

        if (failedCount > 0) {
            setStatusMessage({
                type: 'error',
                text: savedKeys.length > 0
                    ? savedKeys.length + '件を申請しましたが、' + failedCount + '件は保存できませんでした。残っている分をもう一度確定してください。'
                    : '申請を保存できませんでした（' + failedCount + '件）。通信状況を確認して、もう一度お試しください。'
            });
        } else {
            setStatusMessage({ type: 'success', text: savedKeys.length + '件の申請を保存しました。' });
            setIsManagerApproved(false);
        }

        // 稼働不足のお知らせ配信は**保存のあと**に、失敗しても申請を巻き戻さない形で行う。
        // 店長・スタッフは announcements への create 権限が無いので通常ここは黙って落ちる（＝従来と同じ結果）。
        // 申請そのものは既に保存済みなので、これが失敗しても申請は消えない。
        try {
            const updatedDates = new Set<string>();
            savedKeys.forEach(k => updatedDates.add(k.dateStr));

            for (const dStr of Array.from(updatedDates)) {
                const dayObj = new Date(dStr);
                const blockSlots = getBlockAvailableOffSlots(dayObj);

                // forEach(async ...) は await されず、失敗が未処理のPromise拒否になって消えるので for...of にする
                for (const store of stores) {
                    const stSlots = getStoreAvailableOffSlots(store.id, dayObj);
                    if (stSlots.remaining < 0 && stSlots.allowed !== 999) {
                        // Store is minus
                        const content = '<p><strong>' + store.name + '</strong> にて、<strong>' + format(dayObj, 'M/d (E)', { locale: ja }) + '</strong> の休可枠がマイナス（不足 ' + Math.abs(stSlots.remaining) + '名）になりました。</p><p>他店舗からの応援など調整をお願いします。</p>';
                        try {
                            await addAnnouncement({
                                title: '【警告】' + store.name + 'の稼働不足',
                                content,
                                authorId: user?.uid || 'system',
                                authorName: 'システム自動通知',
                                authorRole: 'system',
                                isImportant: true,
                                displayUntil: new Date(dayObj.getTime() + 86400000).toISOString()
                            });
                        } catch (e) {
                            console.warn('稼働不足のお知らせを配信できませんでした（店舗）', store.name, dStr, e);
                        }
                    }
                }

                if (blockSlots.remaining < 0) {
                    // Block is minus
                    const content = '<p><strong>ブロック全体</strong> にて、<strong>' + format(dayObj, 'M/d (E)', { locale: ja }) + '</strong> の休可枠がマイナス（全体不足 ' + Math.abs(blockSlots.remaining) + '名）になりました。</p><p>全店舗でのシフト再調整が必要です。</p>';
                    try {
                        await addAnnouncement({
                            title: '【緊急】ブロック全体の稼働不足',
                            content,
                            authorId: user?.uid || 'system',
                            authorName: 'システム自動通知',
                            authorRole: 'system',
                            isImportant: true,
                            displayUntil: new Date(dayObj.getTime() + 86400000).toISOString()
                        });
                    } catch (e) {
                        console.warn('稼働不足のお知らせを配信できませんでした（ブロック）', dStr, e);
                    }
                }
            }
        } catch (e) {
            console.warn('稼働不足のお知らせ処理でエラー', e);
        } finally {
            setIsSubmitting(false);
        }
    };

    const getStaffDraftCount = (sId: string) => Object.keys(draftRequests[sId] || {}).length;

    return (
        <div className="max-w-xl mx-auto px-4 py-8 space-y-6">
            <h1 className="text-xl font-black text-ink tracking-wide flex items-center gap-2">
                <span className="w-10 h-10 rounded-2xl bg-gradient-to-br from-qb-blue to-qb-cyan flex items-center justify-center shrink-0">
                    <Calendar size={22} className="text-white"/>
                </span>
                希望休かんたん登録
            </h1>

            {/* 結果表示は画面に固定する。
                以前は通常フローの上端に置いていたため、画面下の確定ボタンを押した本人には
                スクロール外で見えず、失敗しても「送信できた」と思われていた。 */}
            {statusMessage && (
                <div
                    role="status"
                    aria-live="polite"
                    onClick={() => setStatusMessage(null)}
                    className={`fixed left-1/2 -translate-x-1/2 z-[100] w-[calc(100%-2rem)] max-w-md p-4 rounded-2xl shadow-xl flex items-start gap-3 font-bold text-base cursor-pointer
                        top-[calc(1rem+env(safe-area-inset-top))]
                        ${statusMessage.type === 'error' ? 'bg-danger text-white' : 'bg-success text-white'}`}
                >
                    {statusMessage.type === 'error' ? <AlertTriangle size={20} className="shrink-0"/> : <CheckCircle size={20} className="shrink-0"/>}
                    <p className="flex-1 leading-relaxed">{statusMessage.text}</p>
                </div>
            )}

            {requestsError && (
                <LoadFailureNotice
                    message={requestsError}
                    onRetry={() => initShiftRequests(format(currentDate, 'yyyy-MM'), user ? {role: user.role, storeName: user.storeName, uid: user.uid} : undefined, true)}
                    retrying={isLoading}
                />
            )}

            {shiftScopeNotice && (
                <div className="p-4 rounded-2xl flex items-start gap-3 bg-qb-yellow/15 text-ink">
                    <Info size={20} className="shrink-0 text-qb-blue" />
                    <p className="text-sm font-bold leading-relaxed">{shiftScopeNotice}</p>
                </div>
            )}

            <div className="bg-surface p-4 rounded-3xl shadow-sm border border-line space-y-4">
                <div>
                    <label className="text-sm font-bold text-ink-soft mb-1 flex items-center gap-1"><StoreIcon size={14}/> 店舗を選択</label>
                    <select
                        value={selectedStoreId}
                        onChange={(e) => { setSelectedStoreId(e.target.value); setSelectedStaffId(''); }}
                        disabled={storesState !== 'ready'}
                        className="w-full min-h-[44px] px-4 rounded-xl bg-canvas border border-line focus:ring-2 focus:ring-qb-cyan focus:border-qb-cyan focus:outline-none font-bold text-ink text-base disabled:opacity-70"
                    >
                        {/* 空のネイティブピッカーを開かせない：'ready' 以外は disabled のまま状況を文言で出す */}
                        <option value="">
                            {storesState === 'loading' ? '店舗を読み込み中…' : storesState === 'error' ? '店舗を読み込めませんでした' : storesState === 'empty' ? '登録された店舗がありません' : '店舗を選択してください'}
                        </option>
                        {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    {/* キャッシュ表示中であることを必ず知らせる。エラー文だけだと
                        プルダウンに店舗名が並んでいるので大半のユーザーが無視して進んでしまう */}
                    {isStoresStale && (
                        <div className="mt-2 bg-qb-yellow/15 border border-line rounded-xl p-3 flex items-start gap-2">
                            <Info size={18} className="shrink-0 text-qb-blue mt-0.5" />
                            <p className="flex-1 text-sm font-bold text-ink leading-relaxed">
                                保存済みの一覧を表示しています（最新ではない可能性があります）。申請の確定には店舗情報の再読込が必要です。
                            </p>
                        </div>
                    )}
                    {storesError && (
                        <LoadFailureNotice message={storesError} onRetry={() => initStores(true)} retrying={isLoading} />
                    )}
                </div>

                {selectedStoreId && (
                    <div>
                        <label className="text-sm font-bold text-ink-soft mb-1 flex items-center gap-1"><UserIcon size={14}/> スタッフを選択</label>
                        <select
                            value={selectedStaffId}
                            onChange={(e) => setSelectedStaffId(e.target.value)}
                            disabled={staffsState !== 'ready'}
                            className="w-full min-h-[44px] px-4 rounded-xl bg-canvas border border-line focus:ring-2 focus:ring-qb-cyan focus:border-qb-cyan focus:outline-none font-bold text-ink text-base disabled:opacity-70"
                        >
                            <option value="">
                                {staffsState === 'loading' ? 'スタッフを読み込み中…' : staffsState === 'error' ? 'スタッフを読み込めませんでした' : staffsState === 'empty' ? 'この店舗に登録されたスタッフがいません' : 'お名前を選択してください'}
                            </option>
                            {filteredStaffs.map(s => {
                                const draftCount = getStaffDraftCount(s.id);
                                return (
                                    <option key={s.id} value={s.id}>
                                        {formatStaffName(`${s.lastName} ${s.firstName}`)} {draftCount > 0 ? `(未申請 ${draftCount})` : ''}
                                    </option>
                                );
                            })}
                        </select>
                        {staffsError && (
                            <LoadFailureNotice message={staffsError} onRetry={() => initStaffs(true)} retrying={isStaffsPending} />
                        )}
                        {selectedStaffId && (
                            <div className="mt-4 hidden">
                            </div>
                        )}
                    </div>
                )}
            </div>

            {selectedStaffId ? (
                <div className="bg-surface p-5 rounded-3xl shadow-sm border border-line space-y-6 relative overflow-hidden">
                    <div className="flex justify-between items-center relative z-10">
                        <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="tap hover:bg-canvas rounded-full transition flex items-center justify-center text-ink-soft">
                            <ChevronLeft size={20} />
                        </button>
                        <h2 className="text-lg font-black text-ink tracking-wide tabular">
                            {format(currentDate, 'yyyy年 M月', { locale: ja })}
                        </h2>
                        <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="tap hover:bg-canvas rounded-full transition flex items-center justify-center text-ink-soft">
                            <ChevronRight size={20} />
                        </button>
                    </div>

                    <div className="relative z-10">
                        <label className="text-sm font-bold text-ink-soft mb-2 block">登録する種類を選択してカレンダーをタップ</label>
                        <div className="grid grid-cols-3 gap-2 mb-4">
                            {['希望休', '有休', 'フリー有休', '特休', '会議', '研修', 'その他', '公出', '取消(クリア)'].map((type) => (
                                <button
                                    key={type}
                                    onClick={() => setSelectedType(type as any)}
                                    className={`min-h-[44px] px-2 rounded-xl font-bold text-sm transition-all ${
                                        selectedType === (type as any)
                                        ? type === '取消(クリア)' ? 'bg-danger text-white shadow-md scale-105' : 'bg-gradient-to-r from-qb-blue to-qb-cyan text-white shadow-md scale-105'
                                        : 'bg-canvas text-ink-soft hover:bg-line'
                                    }`}
                                >
                                    {type}
                                </button>
                            ))}
                        </div>

                        <div className="mb-4">
                            <button
                                onClick={() => {
                                    if (!isRequestsReady) return;
                                    const dateStr = format(monthStart, 'yyyy-MM-01');
                                    setDraftRequests(prev => ({
                                        ...prev,
                                        [selectedStaffId]: {
                                            // 既存の下書きを丸ごと置き換えない（消失・上書き防止）
                                            ...(prev[selectedStaffId] || {}),
                                            [dateStr]: '希望休なし'
                                        }
                                    }));
                                }}
                                disabled={!isRequestsReady}
                                className="tap w-full bg-qb-blue/5 text-qb-blue text-base font-black rounded-xl border-2 border-qb-blue/20 hover:bg-qb-blue/10 transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-60"
                            >
                                {isRequestsReady ? '「今月は希望休なし」として一括送信リストに追加' : storesError ? '店舗情報の再読込が必要です' : '予定を読み込み中…'}
                            </button>
                        </div>

                        <p className="text-xs text-ink-soft font-bold mb-4 bg-qb-cyan/5 p-2.5 rounded-lg leading-relaxed text-center">
                            日をタップで「{selectedType}」を追加・解除。<br/>全スタッフの編集が終わったら下部から一括申請できます。
                        </p>

                        <div className="relative">
                        {/* 読込中は「押せそうに見えて無反応」を作らないよう、見える形で塞ぐ。
                            店舗情報が取れていないと申請の取得自体が始まらないので、
                            その場合は嘘の「読み込み中」を出さず、原因と再読込を出す */}
                        {!isRequestsReady && (
                            <div className="absolute inset-0 z-20 bg-surface/85 rounded-xl flex items-center justify-center p-3">
                                {storesError ? (
                                    <div className="bg-surface border border-danger/20 shadow-sm rounded-xl p-3 flex flex-col items-center gap-2 max-w-full">
                                        <p className="text-sm font-bold text-danger text-center leading-relaxed">
                                            予定を読み込めていません（店舗情報が取得できていないため）
                                        </p>
                                        <button
                                            onClick={() => initStores(true)}
                                            disabled={isLoading}
                                            className="min-h-[44px] px-4 rounded-xl bg-surface border border-danger/30 text-danger text-sm font-black flex items-center gap-1.5 active:scale-95 transition disabled:opacity-60"
                                        >
                                            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                                            {isLoading ? '読込中' : '再読込'}
                                        </button>
                                    </div>
                                ) : (
                                    <span className="flex items-center gap-2 bg-surface border border-line shadow-sm rounded-xl px-4 py-3 text-base font-black text-qb-blue">
                                        <RefreshCw size={18} className="animate-spin" />
                                        予定を読み込み中…
                                    </span>
                                )}
                            </div>
                        )}
                        <div className="grid grid-cols-7 gap-1">
                            {['日', '月', '火', '水', '木', '金', '土'].map((d, i) => (
                                <div key={d} className={`text-center font-black text-xs py-1 ${i === 0 ? 'text-danger' : i === 6 ? 'text-qb-blue' : 'text-ink-soft'}`}>
                                    {d}
                                </div>
                            ))}

                            {Array.from({ length: getDay(monthStart) }).map((_, i) => (
                                <div key={`empty-${i}`} className="h-14 bg-transparent" />
                            ))}

                            {days.map(day => {
                                const dateStr = format(day, 'yyyy-MM-dd');
                                const effective = effectiveRequests.get(dateStr);
                                const isToday = isSameDay(day, new Date());
                                
                                const stSlots = getStoreAvailableOffSlots(selectedStoreId, day);
                                const bkSlots = getBlockAvailableOffSlots(day);

                                let bgColor = 'bg-gray-50 hover:bg-gray-100';
                                let textColor = 'text-gray-700';
                                let borderColor = 'border-transparent';
                                let shadow = '';
                                
                                if (effective && effective.type) {
                                    if (effective.isNew) {
                                        shadow = 'ring-2 ring-qb-cyan ring-offset-1';
                                    }
                                    if (effective.type === '希望休') { bgColor = 'bg-blue-100'; textColor = 'text-blue-700'; borderColor = 'border-blue-200'; }
                                    else if (effective.type === '有休') { bgColor = 'bg-orange-100'; textColor = 'text-orange-700'; borderColor = 'border-orange-200'; }
                                    else if (effective.type === 'フリー有休') { bgColor = 'bg-green-100'; textColor = 'text-green-700'; borderColor = 'border-green-200'; }
                                    else if (effective.type === '特休') { bgColor = 'bg-purple-100'; textColor = 'text-purple-700'; borderColor = 'border-purple-200'; }
                                    else if (effective.type === '公出') { bgColor = 'bg-pink-100'; textColor = 'text-pink-700'; borderColor = 'border-pink-200'; }
                                    else if (effective.type === '希望休なし') { bgColor = 'bg-canvas'; textColor = 'text-ink-soft'; borderColor = 'border-line'; }
                                    else if (effective.type) { bgColor = 'bg-gray-200'; textColor = 'text-gray-700'; borderColor = 'border-gray-300'; }
                                } else if (isToday) {
                                    borderColor = 'border-qb-cyan/40';
                                }

                                return (
                                    <div key={day.toString()} className="flex flex-col gap-0.5">
                                        <button
                                            onClick={() => handleDateClick(day)}
                                            disabled={!isRequestsReady}
                                            className={`h-14 w-full flex flex-col items-center justify-center rounded-xl border-2 transition-all active:scale-95 ${bgColor} ${textColor} ${borderColor} ${shadow}`}
                                        >
                                            <span className={`text-sm font-black tabular ${isToday ? 'bg-gradient-to-br from-qb-blue to-qb-cyan text-white w-6 h-6 rounded-full flex items-center justify-center' : ''}`}>
                                                {format(day, 'd')}
                                            </span>
                                            {effective?.type && (
                                                <div className="flex items-center gap-0.5 mt-0.5">
                                                    <span className="text-xs font-bold tracking-tighter truncate max-w-full px-1">
                                                        {effective.type === 'フリー有休' ? 'ﾌﾘｰ' : effective.type === '希望休なし' ? 'なし' : (effective.type as string) === '取消(クリア)' ? '' : effective.type.slice(0, 2)}
                                                    </span>
                                                    {!effective.isNew && effective.status === 'pending' && <span className="w-2 h-2 rounded-full bg-qb-yellow" title="承認待ち"></span>}
                                                    {!effective.isNew && effective.status === 'approved' && <span className="w-2 h-2 rounded-full bg-success" title="承認済"></span>}
                                                    {!effective.isNew && effective.status === 'rejected' && <span className="w-2 h-2 rounded-full bg-qb-gray" title="却下"></span>}
                                                </div>
                                            )}
                                        </button>
                                        <div className="flex flex-col leading-tight">
                                            {stSlots.allowed !== 999 && (
                                                <div className={`text-xs text-center font-bold tracking-tighter truncate ${stSlots.remaining < 0 ? 'text-danger' : 'text-qb-gray'}`}>
                                                    店:{stSlots.remaining}
                                                </div>
                                            )}
                                            {bkSlots.allowed !== 999 && stSlots.allowed !== 999 && (
                                                <div className={`text-xs text-center font-bold tracking-tighter truncate ${bkSlots.remaining < 0 ? 'text-danger' : 'text-qb-blue'}`}>
                                                    B:{bkSlots.remaining}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        </div>
                    </div>
                </div>
            ) : null}

            {/* Bottom Action Area (Always visible if any drafts or if staff selected) */}
            <div className="bg-surface p-5 rounded-3xl shadow-sm border border-line space-y-4">
                <div className="flex flex-col gap-2 mb-2">
                    <div className="flex items-center justify-between">
                        <span className="text-base font-bold text-ink-soft">
                            {selectedStaffId && `選択中のスタッフ: 希望休・有休 ${limitCount} 日`}
                            {!selectedStaffId && `一括申請の準備`}
                        </span>
                        {hasAnyChanges && (
                            <span className="bg-qb-yellow/20 text-ink text-sm font-bold px-3 py-1 rounded-full animate-pulse">
                                未申請の項目があります
                            </span>
                        )}
                    </div>
                    {hasAnyChanges && Object.keys(draftRequests).length > 0 && (
                        <div className="bg-canvas p-3 rounded-xl border border-line">
                            <span className="text-sm font-bold text-ink-soft mb-2 block">一括送信対象スタッフ:</span>
                            <div className="flex flex-wrap gap-2">
                                {Object.keys(draftRequests).filter(sid => Object.keys(draftRequests[sid]).length > 0).map(sid => {
                                    const s = staffs.find(st => st.id === sid);
                                    if (!s) return null;
                                    const count = Object.keys(draftRequests[sid]).length;
                                    return (
                                        <span key={sid} className="bg-surface border border-line text-ink px-2 py-1 rounded-lg text-sm font-bold shadow-sm flex items-center gap-1">
                                            {formatStaffName(`${s.lastName} ${s.firstName}`)}
                                            <span className="bg-qb-blue/10 text-qb-blue px-1.5 py-0.5 rounded-md text-xs tabular">{count}変更</span>
                                        </span>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {isOverLimit && selectedStaffId && (
                    <div className="bg-danger/10 text-danger p-4 rounded-xl mb-4 border border-danger/20 hover:border-danger/40 transition-colors cursor-pointer" onClick={() => setIsManagerApproved(!isManagerApproved)}>
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="shrink-0 mt-0.5" size={18} />
                            <div className="flex-1">
                                <p className="text-sm font-bold leading-relaxed">
                                    3日を超過しています。事前に上長の承認が必要です。<br/>
                                    承認を得ている場合は、以下にチェックを入れてください。
                                </p>
                            </div>
                        </div>
                        <label htmlFor="managerApprove" className="mt-3 flex items-center gap-2 bg-surface p-3 rounded-lg border border-danger/20 cursor-pointer min-h-[44px]">
                            <input
                                type="checkbox"
                                id="managerApprove"
                                checked={isManagerApproved}
                                onChange={(e) => setIsManagerApproved(e.target.checked)}
                                className="w-5 h-5 rounded text-danger focus:ring-danger cursor-pointer"
                            />
                            <span className="text-base font-bold select-none">上長の承認確認済み</span>
                        </label>
                    </div>
                )}

                <div className="flex gap-2">
                    {hasAnyChanges && (
                        <button
                            onClick={() => setDraftRequests({})}
                            disabled={isSubmitting}
                            className="tap px-4 rounded-xl font-bold bg-canvas text-ink-soft border border-line hover:bg-line transition-colors whitespace-nowrap"
                        >
                            リセット
                        </button>
                    )}
                    <button
                        onClick={handleSubmitAll}
                        disabled={!hasAnyChanges || isSubmitting || !isRequestsReady || !storesLoaded}
                        className={`flex-1 min-h-[52px] py-4 rounded-xl font-black text-lg flex items-center justify-center gap-2 transition-all shadow-md
                            ${!hasAnyChanges || isSubmitting || !isRequestsReady || !storesLoaded
                                ? 'bg-canvas text-qb-gray cursor-not-allowed shadow-none'
                                : 'bg-gradient-to-r from-qb-blue to-qb-cyan text-white hover:shadow-lg hover:scale-[1.02] active:scale-95'
                            }
                        `}
                    >
                        {!storesLoaded ? '店舗情報の再読込が必要です' : !isRequestsReady ? '予定を読み込み中…' : isSubmitting ? '処理中...' : hasAnyChanges ? '選択した申請・取消を確定する' : '変更がありません'}
                        {hasAnyChanges && !isSubmitting && <CheckCircle size={20} />}
                    </button>
                </div>
            </div>
        </div>
    );
};
