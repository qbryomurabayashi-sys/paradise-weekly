import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { GlassCard } from '../components/ui/GlassCard';
import { Save, ArrowLeft, Camera } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export const ProfileEdit = () => {
    const { user, changePassword } = useAuthStore();
    const [name, setName] = useState(user?.name || '');
    const [password, setPassword] = useState('');
    const [photoURL, setPhotoURL] = useState(user?.photoURL || '');
    const [isSaving, setIsSaving] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const navigate = useNavigate();

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
            
            alert('プロフィールを更新しました。反映のためのリロードを行います。');
            window.location.reload(); 
        } catch (e: any) {
            alert(`保存に失敗しました: ${e.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="max-w-md mx-auto p-6 space-y-6 pb-24">
            <button onClick={() => navigate('/profile')} className="flex items-center text-gray-500 gap-1 font-bold">
                <ArrowLeft size={16}/> 戻る
            </button>
            <GlassCard className="p-8 space-y-6 shadow-xl relative top-8 bg-white/60">
                <h2 className="text-2xl font-black text-gray-800 tracking-tight flex items-center gap-2">
                    アカウント編集
                </h2>
                
                <div className="flex flex-col items-center gap-4">
                    <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="w-32 h-32 rounded-full bg-gray-200 border-4 border-white shadow-lg overflow-hidden cursor-pointer relative group flex items-center justify-center"
                    >
                        {photoURL ? (
                            <img src={photoURL} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                            <span className="text-5xl">🌴</span>
                        )}
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
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
                    <p className="text-[10px] font-bold text-gray-400">タップしてアイコンを変更</p>
                </div>

                <div>
                    <label className="text-xs font-bold text-paradise-sunset uppercase tracking-wider block mb-2">表示名</label>
                    <input 
                        type="text" 
                        value={name} 
                        onChange={(e) => setName(e.target.value)} 
                        className="w-full p-4 rounded-2xl bg-white border-2 border-white/40 shadow-inner outline-none focus:ring-2 focus:ring-paradise-sunset focus:border-transparent transition-all font-bold text-gray-800" 
                        placeholder="アプリで表示される名前"
                    />
                </div>
                <div>
                    <label className="text-xs font-bold text-paradise-sunset uppercase tracking-wider block mb-2">新しいパスワード</label>
                    <input 
                        type="password" 
                        value={password} 
                        onChange={(e) => setPassword(e.target.value)} 
                        className="w-full p-4 rounded-2xl bg-white border-2 border-white/40 shadow-inner outline-none focus:ring-2 focus:ring-paradise-sunset focus:border-transparent transition-all font-bold text-gray-800" 
                        placeholder="変更する場合のみ入力" 
                    />
                </div>
                <button 
                    onClick={handleSave} 
                    disabled={isSaving}
                    className="w-full p-4 bg-gradient-to-r from-paradise-sunset to-orange-400 text-white rounded-2xl flex items-center justify-center gap-2 font-black shadow-lg shadow-orange-200/50 hover:translate-y-[-2px] active:translate-y-[0px] transition-all disabled:opacity-50"
                >
                    <Save size={20} /> {isSaving ? '保存中...' : '変更を保存する'}
                </button>
            </GlassCard>
        </div>
    );
};
