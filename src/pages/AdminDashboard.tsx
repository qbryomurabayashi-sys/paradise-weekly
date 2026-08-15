import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../store/useAuthStore';
import { useReportStore } from '../store/useReportStore';
import { db } from '../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { GlassCard } from '../components/ui/GlassCard';
import { displayRole, formatStaffName } from '../lib/formatUtils';
import { ArrowLeft, UserPlus, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
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

export const AdminDashboard = () => {
    const { user, updateUserRole } = useAuthStore();
    const { reports, init } = useReportStore();
    const [users, setUsers] = useState<AppUser[]>([]);
    const [newUserId, setNewUserId] = useState('');
    const [newUserName, setNewUserName] = useState('');
    const [newUserRole, setNewUserRole] = useState<'店長' | 'AM' | 'BM'>('店長');
    const [isCreating, setIsCreating] = useState(false);
    const [toast, setToast] = useState<Toast | null>(null);
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
        </div>
    );
};
