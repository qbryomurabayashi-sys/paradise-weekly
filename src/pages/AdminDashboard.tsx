import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { useReportStore } from '../store/useReportStore';
import { db } from '../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { GlassCard } from '../components/ui/GlassCard';
import { ArrowLeft, UserPlus } from 'lucide-react';
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

export const AdminDashboard = () => {
    const { user, updateUserRole } = useAuthStore();
    const { reports, init } = useReportStore();
    const [users, setUsers] = useState<AppUser[]>([]);
    const [newUserId, setNewUserId] = useState('');
    const [newUserName, setNewUserName] = useState('');
    const [newUserRole, setNewUserRole] = useState<'店長' | 'AM' | 'BM'>('店長');
    const [isCreating, setIsCreating] = useState(false);
    const navigate = useNavigate();

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
        } catch (e) {
            alert('ロール変更に失敗しました');
        }
    };

    const handleCreateUser = async () => {
        if (!newUserId.trim()) {
            alert('IDを入力してください');
            return;
        }
        setIsCreating(true);
        try {
            const email = `${newUserId}@paradise-weekly.app`;
            const password = 'password'; // デフォルトパスワード
            // セカンダリAuthでユーザー作成 (メインのBMはログアウトされません)
            const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
            
            // Firestoreにユーザー情報を書き込む
            await setDoc(doc(db, 'users', cred.user.uid), {
                name: newUserName || newUserId,
                role: newUserRole,
                storeName: '未設定の店舗',
                createdAt: new Date().toISOString()
            });

            // セカンダリログアウト（クリーンアップ）
            await signOut(secondaryAuth);
            
            alert(`ID: ${newUserId} (初期パスワード: password) を作成しました！`);
            setNewUserId('');
            setNewUserName('');
            fetchUsers(); // リストを更新
        } catch (e: any) {
            let errorMsg = e.message;
            if (e.code === 'auth/email-already-in-use') {
                errorMsg = `このID (${newUserId}) はすでに誰かに使われているか、以前作成されたアカウントが残っています。違うIDを指定するか、Firebase管理画面から古いアカウントを削除してください。`;
            }
            alert(`作成失敗: ${errorMsg}`);
            console.error(e);
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto p-6 space-y-6 pb-20">
            <button onClick={() => navigate('/profile')} className="flex items-center text-gray-500 gap-1"><ArrowLeft size={16}/> 戻る</button>
            <h2 className="text-2xl font-black text-gray-800">管理者ダッシュボード</h2>
            
            <GlassCard className="p-6 space-y-4 shadow-xl border-2 border-paradise-sunset/20 bg-white/50">
                <h3 className="text-lg font-bold flex items-center gap-2"><UserPlus size={20} className="text-paradise-sunset" /> 新規ユーザー一括・個別作成</h3>
                <p className="text-sm text-gray-500 leading-relaxed font-bold">
                    IDを指定してアカウントを作成します。<br/>
                    初期パスワードは全員共通で <span className="bg-gray-100 px-1 rounded">password</span> に設定されます。
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input 
                        type="text" 
                        placeholder="ログインID (例: admin_taro)"
                        value={newUserId}
                        onChange={e => setNewUserId(e.target.value)}
                        className="p-3 rounded-xl bg-white border outline-none focus:ring-2 focus:ring-paradise-sunset text-base"
                    />
                    <input 
                        type="text" 
                        placeholder="表示名 (空ならIDと同じ)"
                        value={newUserName}
                        onChange={e => setNewUserName(e.target.value)}
                        className="p-3 rounded-xl bg-white border outline-none focus:ring-2 focus:ring-paradise-sunset text-base"
                    />
                    <select 
                        value={newUserRole}
                        onChange={e => setNewUserRole(e.target.value as any)}
                        className="p-3 rounded-xl bg-white border outline-none focus:ring-2 focus:ring-paradise-sunset text-base"
                    >
                        <option value="店長">店長</option>
                        <option value="AM">AM</option>
                        <option value="BM">BM</option>
                    </select>
                </div>
                <button 
                    onClick={handleCreateUser}
                    disabled={isCreating}
                    className="w-full bg-paradise-ocean text-white font-black p-3 rounded-xl shadow-lg hover:bg-blue-500 transition-colors disabled:opacity-50"
                >
                    {isCreating ? '作成中...' : 'ユーザーを作成する'}
                </button>
            </GlassCard>

            <div className="space-y-4 mt-8">
                <h3 className="font-bold text-gray-600">登録済みユーザー一覧</h3>
                {users.map(u => {
                    const userReports = reports.filter(r => r.authorId === u.uid);
                    const latestReportDate = userReports.length > 0 ? userReports.reduce((latest, r) => new Date(r.createdAt).getTime() > new Date(latest).getTime() ? r.createdAt : latest, userReports[0].createdAt) : null;
                    const fallbackDate = latestReportDate || u.createdAt;

                    return (
                    <GlassCard key={u.uid} className="p-4 flex items-center justify-between">
                        <div>
                            <p className="font-bold">{u.name}</p>
                            <p className="text-sm text-gray-500">{u.storeName} ({u.uid})</p>
                            {(u.role === 'AM' || u.role === '店長') && (
                                u.lastLoginAt ? (
                                    <p className="text-sm text-blue-500 mt-1">最終ログイン: {formatDistanceToNow(new Date(u.lastLoginAt), { addSuffix: true, locale: ja })}</p>
                                ) : fallbackDate ? (
                                    <p className="text-sm text-gray-500 mt-1">最終ログイン: {formatDistanceToNow(new Date(fallbackDate), { addSuffix: true, locale: ja })} (推測)</p>
                                ) : (
                                    <p className="text-sm text-gray-400 mt-1">ログイン履歴なし</p>
                                )
                            )}
                        </div>
                        <select 
                            value={u.role} 
                            onChange={(e) => handleRoleChange(u.uid, e.target.value as any)}
                            className="p-2 rounded bg-white border text-base font-bold"
                        >
                            <option value="店長">店長</option>
                            <option value="AM">AM</option>
                            <option value="BM">BM</option>
                        </select>
                    </GlassCard>
                )})}
            </div>
        </div>
    );
};

