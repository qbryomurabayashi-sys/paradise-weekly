import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../store/useAuthStore';
import { useReportStore, getTimestampMillis, type Report } from '../store/useReportStore';
import { db } from '../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { getFiscalWeek, normalizeKptContent } from '../lib/dateUtils';
import { GlassCard } from '../components/ui/GlassCard';
import { displayRole, formatStaffName } from '../lib/formatUtils';
import { ArrowLeft, UserPlus, CheckCircle2, AlertCircle, X, ScanSearch, Trash2, AlertTriangle, Loader2, Copy } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json'; // 階層に注意
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';

// 現在のログイン情報を維持したままユーザー作成を行うためのセカンダリアプリ
const secondaryApp = initializeApp(firebaseConfig, 'SecondaryApp');
const secondaryAuth = getAuth(secondaryApp);

interface AppUser {
    uid: string;
    name: string;
    role: '店長' | 'AM' | 'BM';
    storeName: string;
    lastLoginAt?: string;
    createdAt?: string;
}

type Toast = { id: number; type: 'success' | 'error'; message: string };

// KPT重複クリーンアップ：スキャン結果の型
// 1グループ = 同一 authorId × weekNumber(再計算) × year × 正規化本文 の集合（2件以上のみ）。
interface DupDoc {
    id: string;
    engagement: number;
    isKeep: boolean;
    snippet: string;
}
interface DupGroup {
    key: string;
    authorName: string;
    storeName: string;
    weekNumber: number;
    year: number;
    keepId: string;
    removeIds: string[];
    docs: DupDoc[];
}
interface ScanResult {
    totalGroups: number;
    totalRemove: number;
    groups: DupGroup[];
}

// HTML混じりの本文を安全にプレーンテキスト化して先頭を短縮表示する（dangerouslySetInnerHTML不使用）。
const toSnippet = (html: any, max = 50): string => {
    const raw = String(html ?? '');
    let text = raw;
    try {
        text = new DOMParser().parseFromString(raw, 'text/html').body.textContent || '';
    } catch {
        text = raw.replace(/<[^>]*>/g, '');
    }
    text = text.replace(/\s+/g, ' ').trim();
    return text.length > max ? text.slice(0, max) + '…' : text;
};

export const AdminDashboard = () => {
    const { user, updateUserRole } = useAuthStore();
    const { reports, init } = useReportStore();
    const [users, setUsers] = useState<AppUser[]>([]);
    const [newUserId, setNewUserId] = useState('');
    const [newUserName, setNewUserName] = useState('');
    const [newUserRole, setNewUserRole] = useState<'店長' | 'AM' | 'BM'>('店長');
    const [isCreating, setIsCreating] = useState(false);
    const [toast, setToast] = useState<Toast | null>(null);
    // KPT重複クリーンアップ用の状態
    const [scanResult, setScanResult] = useState<ScanResult | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const navigate = useNavigate();

    const notify = (type: Toast['type'], message: string) => {
        setToast({ id: Date.now(), type, message });
        window.setTimeout(() => setToast(null), 4000);
    };

    const fetchUsers = async () => {
        const querySnapshot = await getDocs(collection(db, 'users'));
        const userList = querySnapshot.docs.map(d => ({
            uid: d.id,
            ...d.data()
        })) as AppUser[];
        setUsers(userList);
    };

    useEffect(() => {
        if (user?.role !== 'BM') {
            navigate('/profile');
            return;
        }
        fetchUsers();
    }, [user, navigate]);

    useEffect(() => {
        const unsub = init();
        return () => unsub();
    }, [init]);

    const handleRoleChange = async (uid: string, newRole: '店長' | 'AM' | 'BM') => {
        try {
            await updateUserRole(uid, newRole);
            setUsers(users.map(u => u.uid === uid ? {...u, role: newRole} : u));
            notify('success', 'ロールを変更しました');
        } catch (e) {
            notify('error', 'ロール変更に失敗しました');
        }
    };

    const handleCreateUser = async () => {
        const cleanId = newUserId.trim().toLowerCase();
        if (!cleanId) {
            notify('error', 'IDを入力してください');
            return;
        }
        setIsCreating(true);
        try {
            const email = `${cleanId}@paradise-weekly.app`;
            const password = 'password'; // デフォルトパスワード
            // セカンダリAuthでユーザー作成 (メインのBMはログアウトされません)
            const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);

            // Firestoreにユーザー情報を書き込む
            await setDoc(doc(db, 'users', cred.user.uid), {
                name: newUserName.trim() || cleanId,
                role: newUserRole,
                storeName: '未設定の店舗',
                createdAt: new Date().toISOString()
            });

            // セカンダリログアウト（クリーンアップ）
            await signOut(secondaryAuth);

            notify('success', `ID: ${cleanId}（初期パスワード: password）を作成しました！`);
            setNewUserId('');
            setNewUserName('');
            fetchUsers(); // リストを更新
        } catch (e: any) {
            let errorMsg = e.message;
            if (e.code === 'auth/email-already-in-use') {
                errorMsg = `このID (${cleanId}) はすでに使われているか、以前作成されたアカウントが残っています。違うIDを指定するか、Firebase管理画面から古いアカウントを削除してください。`;
            }
            notify('error', `作成失敗: ${errorMsg}`);
            console.error(e);
        } finally {
            setIsCreating(false);
        }
    };

    // ===== KPT重複クリーンアップ =====
    // エンゲージメント算出（表示側畳み込みD＝useReportStore.ts と完全一致：
    // reactions の count合計（無ければuserIds長）＋ commentCount。readBy は含めない）。
    const engagementOf = (r: any): number => {
        const reactionSum = Array.isArray(r.reactions)
            ? r.reactions.reduce(
                (s: number, x: any) => s + (Number(x.count) || (Array.isArray(x.userIds) ? x.userIds.length : 0)),
                0
              )
            : 0;
        const comments = Number(r.commentCount) || 0;
        return reactionSum + comments;
    };

    // 重複スキャン（ドライラン：ここでは絶対に削除しない）。
    // reports を全件取得し、Dと同一の判定で「残す1件以外」を削除候補として集計する。
    const handleScanDuplicates = async () => {
        setIsScanning(true);
        try {
            // 全件取得（onSnapshot の limit(150) とは無関係。ここは limit なしの全件）。
            const snapshot = await getDocs(collection(db, 'reports'));
            const rows = snapshot.docs.map((docSnap) => {
                const data = docSnap.data() as any;
                // weekNumber を createdAt から再計算（Dと同一。書き込みは一切しない）。
                let weekNumber = data.weekNumber;
                if (data.createdAt) {
                    let d = data.createdAt;
                    if (typeof data.createdAt === 'object' && data.createdAt.toDate) {
                        d = data.createdAt.toDate();
                    } else {
                        d = new Date(data.createdAt);
                    }
                    if (!isNaN(d.getTime())) {
                        weekNumber = getFiscalWeek(d);
                    }
                }
                return { id: docSnap.id, ...data, weekNumber } as Report;
            });

            // draft は完全対象外（グループ化にも削除候補にも入れない）。
            const groupsMap = new Map<string, Report[]>();
            for (const r of rows) {
                if (r.status === 'draft') continue;
                const key = [r.authorId, r.weekNumber, r.year, normalizeKptContent(r)].join('||');
                const arr = groupsMap.get(key);
                if (arr) arr.push(r);
                else groupsMap.set(key, [r]);
            }

            const resultGroups: DupGroup[] = [];
            let totalRemove = 0;
            for (const [key, arr] of groupsMap) {
                if (arr.length < 2) continue; // 単独は畳まない（削除候補ゼロ）
                // 残す1件を決定（Dと同一：エンゲージメント最大、同点は createdAt 最古）。
                let best = arr[0];
                for (let i = 1; i < arr.length; i++) {
                    const cand = arr[i];
                    const de = engagementOf(cand) - engagementOf(best);
                    if (de > 0) {
                        best = cand;
                    } else if (de === 0) {
                        if (getTimestampMillis(cand.createdAt) < getTimestampMillis(best.createdAt)) best = cand;
                    }
                }
                const removeIds = arr.filter((r) => r.id !== best.id).map((r) => r.id);
                totalRemove += removeIds.length;
                resultGroups.push({
                    key,
                    authorName: best.authorName || '(不明)',
                    storeName: best.storeName || '(不明)',
                    weekNumber: best.weekNumber,
                    year: best.year,
                    keepId: best.id,
                    removeIds,
                    docs: arr.map((r) => ({
                        id: r.id,
                        engagement: engagementOf(r),
                        isKeep: r.id === best.id,
                        snippet: toSnippet(r.keep),
                    })),
                });
            }

            setScanResult({ totalGroups: resultGroups.length, totalRemove, groups: resultGroups });
            if (resultGroups.length === 0) {
                notify('success', '重複は見つかりませんでした（0件）');
            }
        } catch (e) {
            console.error('重複スキャン失敗', e);
            notify('error', 'スキャンに失敗しました');
        } finally {
            setIsScanning(false);
        }
    };

    // 削除実行（確認モーダルで承諾後に呼ばれる）。削除候補を1件ずつ削除し、1件失敗しても継続。
    const handleDeleteDuplicates = async () => {
        if (!scanResult) return;
        setShowDeleteConfirm(false);
        setIsDeleting(true);
        const ids = scanResult.groups.flatMap((g) => g.removeIds);
        let success = 0;
        let failed = 0;
        for (const id of ids) {
            try {
                await deleteDoc(doc(db, 'reports', id));
                success++;
            } catch (e) {
                console.error(`削除失敗 id=${id}`, e);
                failed++;
            }
        }
        setIsDeleting(false);
        setScanResult(null); // 再スキャンで0件を確認できるようクリア
        notify(failed > 0 ? 'error' : 'success', `${success}件削除しました（失敗${failed}件）`);
    };

    return (
        <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6 pb-24">
            {/* Toast */}
            <AnimatePresence>
                {toast && (
                    <motion.div
                        key={toast.id}
                        initial={{ opacity: 0, y: -20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -20, scale: 0.95 }}
                        className={`fixed top-4 inset-x-4 sm:left-auto sm:right-6 sm:w-96 z-50 flex items-start gap-3 p-4 rounded-2xl shadow-2xl text-white ${toast.type === 'success' ? 'bg-success' : 'bg-danger'}`}
                    >
                        {toast.type === 'success' ? <CheckCircle2 size={20} className="shrink-0 mt-0.5" /> : <AlertCircle size={20} className="shrink-0 mt-0.5" />}
                        <p className="flex-1 text-sm font-bold leading-relaxed">{toast.message}</p>
                        <button onClick={() => setToast(null)} className="tap shrink-0 -mr-1 -mt-1 opacity-80 hover:opacity-100"><X size={18} /></button>
                    </motion.div>
                )}
            </AnimatePresence>

            <button onClick={() => navigate('/profile')} className="tap flex items-center text-ink-soft gap-1 font-bold"><ArrowLeft size={16}/> 戻る</button>
            <h2 className="text-2xl font-black text-ink tracking-tight">管理者ダッシュボード</h2>

            <GlassCard className="p-6 space-y-4 shadow-xl border-2 border-qb-cyan/20 bg-surface/70">
                <h3 className="text-lg font-bold flex items-center gap-2 text-ink"><UserPlus size={20} className="text-qb-blue" /> 新規ユーザー個別作成</h3>
                <p className="text-sm text-ink-soft leading-relaxed font-bold">
                    IDを指定してアカウントを作成します。<br/>
                    初期パスワードは全員共通で <span className="bg-canvas px-1.5 py-0.5 rounded font-black text-qb-blue">password</span> に設定されます。
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input
                        type="text"
                        placeholder="ログインID (例: admin_taro)"
                        value={newUserId}
                        onChange={e => setNewUserId(e.target.value)}
                        inputMode="text"
                        autoComplete="off"
                        autoCapitalize="none"
                        enterKeyHint="next"
                        className="min-h-[44px] p-3 rounded-xl bg-surface border border-line outline-none focus:ring-2 focus:ring-qb-cyan focus:border-qb-cyan transition-all text-base text-ink"
                    />
                    <input
                        type="text"
                        placeholder="表示名 (空ならIDと同じ)"
                        value={newUserName}
                        onChange={e => setNewUserName(e.target.value)}
                        autoComplete="off"
                        enterKeyHint="done"
                        className="min-h-[44px] p-3 rounded-xl bg-surface border border-line outline-none focus:ring-2 focus:ring-qb-cyan focus:border-qb-cyan transition-all text-base text-ink"
                    />
                    <select
                        value={newUserRole}
                        onChange={e => setNewUserRole(e.target.value as any)}
                        className="min-h-[44px] p-3 rounded-xl bg-surface border border-line outline-none focus:ring-2 focus:ring-qb-cyan focus:border-qb-cyan transition-all text-base text-ink font-bold"
                    >
                        <option value="店長">Ｓ</option>
                        <option value="AM">A</option>
                        <option value="BM">B</option>
                    </select>
                </div>
                <button
                    onClick={handleCreateUser}
                    disabled={isCreating}
                    className="tap w-full bg-gradient-to-r from-qb-blue to-qb-cyan text-white font-black p-3 rounded-xl shadow-lg shadow-qb-cyan/20 hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
                >
                    {isCreating ? '作成中...' : 'ユーザーを作成する'}
                </button>
            </GlassCard>

            <div className="space-y-4 mt-8">
                <h3 className="font-bold text-ink-soft">登録済みユーザー一覧</h3>
                {users.map(u => {
                    const userReports = reports.filter(r => r.authorId === u.uid);
                    const latestReportDate = userReports.length > 0 ? userReports.reduce((latest, r) => new Date(r.createdAt).getTime() > new Date(latest).getTime() ? r.createdAt : latest, userReports[0].createdAt) : null;
                    const fallbackDate = latestReportDate || u.createdAt;

                    return (
                    <GlassCard key={u.uid} className="p-4 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                            <p className="font-bold text-ink truncate">{formatStaffName(u.name)}</p>
                            <p className="text-sm text-ink-soft truncate">{u.storeName} ({u.uid})</p>
                            {(u.role === 'AM' || u.role === '店長') && (
                                u.lastLoginAt ? (
                                    <p className="text-sm text-qb-blue mt-1 tabular">最終ログイン: {formatDistanceToNow(new Date(u.lastLoginAt), { addSuffix: true, locale: ja })}</p>
                                ) : fallbackDate ? (
                                    <p className="text-sm text-ink-soft mt-1 tabular">最終ログイン: {formatDistanceToNow(new Date(fallbackDate), { addSuffix: true, locale: ja })} (推測)</p>
                                ) : (
                                    <p className="text-sm text-qb-gray mt-1">ログイン履歴なし</p>
                                )
                            )}
                        </div>
                        <select
                            value={u.role}
                            onChange={(e) => handleRoleChange(u.uid, e.target.value as any)}
                            className="tap shrink-0 p-2 rounded-lg bg-surface border border-line text-base font-bold text-ink outline-none focus:ring-2 focus:ring-qb-cyan"
                        >
                            <option value="店長">Ｓ</option>
                            <option value="AM">A</option>
                            <option value="BM">B</option>
                        </select>
                    </GlassCard>
                )})}
            </div>

            {/* KPT重複クリーンアップ（BM限定・二重ガード：JSX側でも role を確認） */}
            {user?.role === 'BM' && (
                <GlassCard className="p-6 space-y-4 shadow-xl border-2 border-danger/20 bg-surface/70 mt-8">
                    <h3 className="text-lg font-bold flex items-center gap-2 text-ink"><ScanSearch size={20} className="text-danger" /> KPT重複クリーンアップ</h3>
                    <p className="text-sm text-ink-soft leading-relaxed font-bold">
                        同一内容の重複KPT（一覧の畳み込みと同じ判定）を洗い出して、残す1件以外を削除します。<br/>
                        まず「重複をスキャン」で対象を確認してください（この時点では削除されません）。
                    </p>

                    <button
                        onClick={handleScanDuplicates}
                        disabled={isScanning || isDeleting}
                        className="tap w-full min-h-[44px] bg-gradient-to-r from-qb-blue to-qb-cyan text-white font-black p-3 rounded-xl shadow-lg shadow-qb-cyan/20 hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2"
                    >
                        {isScanning ? <Loader2 size={18} className="animate-spin" /> : <ScanSearch size={18} />}
                        {isScanning ? 'スキャン中...' : '重複をスキャン'}
                    </button>

                    {scanResult && (
                        <div className="space-y-3">
                            {/* サマリー */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="rounded-2xl bg-canvas border border-line p-4 text-center">
                                    <p className="text-xs font-black text-ink-soft">重複グループ数</p>
                                    <p className="text-3xl font-black text-qb-blue tabular">{scanResult.totalGroups}</p>
                                </div>
                                <div className="rounded-2xl bg-canvas border border-line p-4 text-center">
                                    <p className="text-xs font-black text-ink-soft">削除候補総数</p>
                                    <p className="text-3xl font-black text-danger tabular">{scanResult.totalRemove}</p>
                                </div>
                            </div>

                            {scanResult.totalGroups === 0 ? (
                                <p className="text-center text-sm font-bold text-success py-4 flex items-center justify-center gap-1.5">
                                    <CheckCircle2 size={16} /> 重複はありません
                                </p>
                            ) : (
                                <div className="max-h-[420px] overflow-y-auto space-y-3 pr-1">
                                    {scanResult.groups.map((g) => (
                                        <div key={g.key} className="rounded-2xl border border-line bg-canvas p-3.5 space-y-2">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className="font-black text-sm text-ink truncate">{formatStaffName(g.authorName)}</span>
                                                <span className="text-xs text-ink-soft font-bold">{g.storeName}</span>
                                                <span className="text-xs font-black bg-qb-blue text-white px-1.5 py-0.5 rounded shrink-0">第{g.weekNumber}週</span>
                                                <span className="text-xs font-black bg-danger/10 text-danger px-1.5 py-0.5 rounded shrink-0 ml-auto flex items-center gap-1"><Copy size={11} /> {g.docs.length}件</span>
                                            </div>
                                            <p className="text-xs font-bold text-ink-soft break-all">
                                                <span className="text-success">残す:</span> {g.keepId}
                                            </p>
                                            <p className="text-xs font-bold text-ink-soft break-all">
                                                <span className="text-danger">消す:</span> {g.removeIds.join(', ')}
                                            </p>
                                            <div className="space-y-1 pt-1 border-t border-line">
                                                {g.docs.map((d) => (
                                                    <div key={d.id} className={`text-xs leading-relaxed flex items-start gap-1.5 ${d.isKeep ? 'text-success font-black' : 'text-ink-soft'}`}>
                                                        <span className="shrink-0">{d.isKeep ? '✓残' : '✕消'}</span>
                                                        <span className="shrink-0 tabular opacity-70">(★{d.engagement})</span>
                                                        <span className="truncate">{d.snippet || '(本文なし)'}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {scanResult.totalRemove > 0 && (
                                <button
                                    onClick={() => setShowDeleteConfirm(true)}
                                    disabled={isDeleting}
                                    className="tap w-full min-h-[44px] bg-danger text-white font-black p-3 rounded-xl shadow-md active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {isDeleting ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                                    {isDeleting ? '削除中...' : `削除を実行（${scanResult.totalRemove}件）`}
                                </button>
                            )}
                        </div>
                    )}
                </GlassCard>
            )}

            {/* 削除確認モーダル（native confirm 置換・ReportDetail と同一パターン） */}
            <AnimatePresence>
                {showDeleteConfirm && scanResult && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[125] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
                        onClick={() => setShowDeleteConfirm(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.92, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 16 }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6 border border-line"
                        >
                            <div className="flex flex-col items-center text-center gap-2 mb-5">
                                <span className="grid place-items-center h-12 w-12 rounded-2xl bg-danger/10 text-danger">
                                    <AlertTriangle size={24} />
                                </span>
                                <h3 className="text-lg font-black text-ink">重複KPTを削除しますか？</h3>
                                <p className="text-sm font-bold text-ink-soft leading-relaxed">重複KPT {scanResult.totalRemove}件を完全に削除します。元に戻せません。</p>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setShowDeleteConfirm(false)}
                                    className="tap flex-1 min-h-[44px] rounded-xl bg-canvas text-ink-soft font-bold border border-line active:scale-95 transition-all"
                                >
                                    やめる
                                </button>
                                <button
                                    onClick={handleDeleteDuplicates}
                                    className="tap flex-1 min-h-[44px] rounded-xl bg-danger text-white font-black shadow-md active:scale-95 transition-all flex items-center justify-center gap-1.5"
                                >
                                    <Trash2 size={16} /> 削除する
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
