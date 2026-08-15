import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../store/useAuthStore';
import { GlassCard } from '../components/ui/GlassCard';
import { Save, ArrowLeft, Camera, User, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

type Toast = { id: number; type: 'success' | 'error'; message: string };

export const ProfileEdit = () => {
    const { user, changePassword } = useAuthStore();
    const [name, setName] = useState(user?.name || '');
    const [password, setPassword] = useState('');
    const [photoURL, setPhotoURL] = useState(user?.photoURL || '');
    const [isSaving, setIsSaving] = useState(false);
    const [toast, setToast] = useState<Toast | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const navigate = useNavigate();

    const notify = (type: Toast['type'], message: string) => {
        setToast({ id: Date.now(), type, message });
        if (type === 'error') window.setTimeout(() => setToast(null), 4000);
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 256;
                const MAX_HEIGHT = 256;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                setPhotoURL(dataUrl);
            };
            img.src = event.target?.result as string;
        };
        reader.readAsDataURL(file);
    };

    const handleSave = async () => {
        if (!user) return;
        setIsSaving(true);
        try {
            if (password) await changePassword(password);

            await updateDoc(doc(db, 'users', user.uid), {
                name,
                photoURL
            });

            notify('success', 'プロフィールを更新しました。反映のため再読み込みします…');
            window.setTimeout(() => window.location.reload(), 1200);
        } catch (e: any) {
            notify('error', `保存に失敗しました: ${e.message}`);
            setIsSaving(false);
        }
    };

    return (
        <div className="max-w-md mx-auto p-4 sm:p-6 space-y-6 pb-24">
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

            <button onClick={() => navigate('/profile')} className="tap flex items-center text-ink-soft gap-1 font-bold">
                <ArrowLeft size={16}/> 戻る
            </button>
            <GlassCard className="p-8 space-y-6 shadow-xl relative top-8 bg-surface/60">
                <h2 className="text-2xl font-black text-ink tracking-tight flex items-center gap-2">
                    アカウント編集
                </h2>

                <div className="flex flex-col items-center gap-4">
                    <div
                        onClick={() => fileInputRef.current?.click()}
                        className="tap w-32 h-32 rounded-full bg-gradient-to-br from-qb-blue-dark via-qb-blue to-qb-cyan border-4 border-surface shadow-lg overflow-hidden cursor-pointer relative group flex items-center justify-center"
                    >
                        {photoURL ? (
                            <img src={photoURL} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                            <User className="text-white" size={48} />
                        )}
                        <div className="absolute inset-0 bg-qb-navy/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Camera className="text-white" size={24} />
                        </div>
                    </div>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleImageChange}
                        accept="image/*"
                        className="hidden"
                    />
                    <p className="text-xs font-bold text-ink-soft">タップしてアイコンを変更</p>
                </div>

                <div>
                    <label className="text-sm font-bold text-qb-blue uppercase tracking-wider block mb-2">表示名</label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        inputMode="text"
                        autoComplete="name"
                        enterKeyHint="next"
                        className="min-h-[44px] w-full p-4 rounded-2xl bg-surface border-2 border-line shadow-inner outline-none focus:ring-2 focus:ring-qb-cyan focus:border-qb-cyan transition-all font-bold text-ink"
                        placeholder="アプリで表示される名前"
                    />
                </div>
                <div>
                    <label className="text-sm font-bold text-qb-blue uppercase tracking-wider block mb-2">新しいパスワード</label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="new-password"
                        enterKeyHint="done"
                        className="min-h-[44px] w-full p-4 rounded-2xl bg-surface border-2 border-line shadow-inner outline-none focus:ring-2 focus:ring-qb-cyan focus:border-qb-cyan transition-all font-bold text-ink"
                        placeholder="変更する場合のみ入力"
                    />
                </div>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="tap w-full p-4 bg-gradient-to-r from-qb-blue to-qb-cyan text-white rounded-2xl flex items-center justify-center gap-2 font-black shadow-lg shadow-qb-cyan/20 hover:translate-y-[-2px] active:translate-y-[0px] transition-all disabled:opacity-50"
                >
                    <Save size={20} /> {isSaving ? '保存中...' : '変更を保存する'}
                </button>
            </GlassCard>
        </div>
    );
};
