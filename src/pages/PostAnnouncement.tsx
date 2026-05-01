import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GlassCard } from '../components/ui/GlassCard';
import { useAnnouncementStore } from '../store/useAnnouncementStore';
import { useAuthStore } from '../store/useAuthStore';
import { Megaphone, Send, ChevronLeft, BellRing } from 'lucide-react';
import { motion } from 'framer-motion';
import Editor from 'react-simple-wysiwyg';

export const PostAnnouncement = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isImportant, setIsImportant] = useState(false);
  const [displayUntil, setDisplayUntil] = useState('');

  const canAnnounce = user?.role === 'BM' || user?.role === 'AM';

  if (!canAnnounce) {
    return (
      <div className="flex justify-center mt-20 text-gray-500 font-bold">
        権限がありません
      </div>
    );
  }

  const handlePost = async () => {
    if (!title || !content || !displayUntil) {
      alert('タイトル、本文、表示期限は必須です');
      return;
    }
    
    await useAnnouncementStore.getState().addAnnouncement({
      title,
      content,
      isImportant,
      displayUntil,
      authorId: user!.uid,
      authorName: user!.name,
      authorRole: user!.role
    });
    
    navigate('/');
  };

  return (
    <div className="max-w-2xl mx-auto pt-6 pb-24 px-4 space-y-6">
      <button onClick={() => navigate('/')} className="text-gray-500 flex items-center gap-1 font-bold hover:text-paradise-ocean transition-colors">
        <ChevronLeft size={20}/> 戻る
      </button>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <GlassCard className="p-6 space-y-6 shadow-2xl border-t-4 border-t-paradise-ocean">
          <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
            <div className="bg-paradise-ocean/10 p-3 rounded-2xl text-paradise-ocean">
              <Megaphone size={28} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-gray-800">全体お知らせ作成</h2>
              <p className="text-sm font-bold text-gray-400">全員のトップ画面にポップアップ表示されます</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-bold text-gray-500 uppercase tracking-widest block mb-2">タイトル</label>
              <input 
                type="text" 
                value={title} 
                onChange={e=>setTitle(e.target.value)} 
                className="w-full p-4 rounded-2xl bg-white/50 border-2 border-white/40 focus:border-paradise-ocean outline-none font-bold text-gray-700"
                placeholder="（例）春の社内イベントについて"
              />
            </div>

            <div>
              <label className="text-sm font-bold text-gray-500 uppercase tracking-widest block mb-2">本文 (色や太字が使えます)</label>
              <div className="bg-white/60 rounded-2xl overflow-hidden border-2 border-white/40 focus-within:border-paradise-ocean transition-all shadow-inner">
                <Editor 
                  containerProps={{ style: { height: '240px', overflowY: 'auto' } }}
                  value={content} 
                  onChange={e=>setContent(e.target.value)} 
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-red-50/50 p-4 rounded-2xl border border-red-100 flex items-center justify-between cursor-pointer" onClick={() => setIsImportant(!isImportant)}>
                <div className="flex items-center gap-2">
                  <BellRing className={`${isImportant ? 'text-red-500 animate-pulse' : 'text-gray-400'}`} size={20}/>
                  <div>
                    <div className="text-base font-bold text-gray-700">重要フラグ</div>
                    <div className="text-xs text-gray-500">赤色で目立つように表示</div>
                  </div>
                </div>
                <div className={`w-12 h-6 rounded-full p-1 transition-colors ${isImportant ? 'bg-red-400' : 'bg-gray-300'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform ${isImportant ? 'translate-x-6' : 'translate-x-0'}`}/>
                </div>
              </div>

              <div className="bg-white/50 p-4 rounded-2xl border border-white/40">
                <label className="text-sm font-bold text-paradise-ocean block mb-1 flex items-center gap-1">
                  いつまで表示するか <span className="text-red-400 text-xs">必須</span>
                </label>
                <input 
                  type="datetime-local" 
                  value={displayUntil} 
                  onChange={e=>setDisplayUntil(e.target.value)} 
                  className="w-full p-2 bg-white/50 rounded-xl outline-none text-base font-bold text-gray-700 border border-gray-100"
                />
              </div>
            </div>
          </div>

          <div className="pt-6">
            <button 
              onClick={handlePost}
              disabled={!title || !content || !displayUntil}
              className="w-full bg-paradise-ocean text-white py-4 rounded-full font-black flex items-center justify-center gap-2 shadow-lg hover:shadow-xl active:scale-95 transition-all disabled:opacity-50 disabled:grayscale"
            >
              <Send size={20} /> 全体に公開する
            </button>
          </div>
        </GlassCard>
      </motion.div>
    </div>
  );
};
