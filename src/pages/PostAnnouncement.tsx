import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GlassCard } from '../components/ui/GlassCard';
import { useAnnouncementStore } from '../store/useAnnouncementStore';
import { useAuthStore } from '../store/useAuthStore';
import { Megaphone, Send, ChevronLeft, BellRing, AlertTriangle, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Editor from 'react-simple-wysiwyg';

export const PostAnnouncement = () => {
  const { user, viewMode } = useAuthStore();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isImportant, setIsImportant] = useState(false);
  const [displayUntil, setDisplayUntil] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const showToast = (msg: string, type: 'success' | 'error' = 'success') => setToast({ msg, type });

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const activeRole = user?.role === 'BM' && viewMode ? viewMode : user?.role;
  const canAnnounce = activeRole === 'BM' || activeRole === 'AM';

  if (!canAnnounce) {
    return (
      <div className="flex justify-center mt-20 text-ink-soft font-bold">
        権限がありません
      </div>
    );
  }

  const handlePost = async () => {
    if (!title || !content || !displayUntil) {
      showToast('タイトル、本文、表示期限は必須です', 'error');
      return;
    }
    if (isPosting) return;

    setIsPosting(true);
    try {
      await useAnnouncementStore.getState().addAnnouncement({
        title,
        content,
        isImportant,
        displayUntil,
        authorId: user!.uid,
        authorName: user!.name,
        authorRole: user!.role
      });
      showToast('全体に公開しました', 'success');
      setTimeout(() => navigate('/'), 900);
    } catch (e) {
      console.error(e);
      showToast('投稿に失敗しました', 'error');
      setIsPosting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto pt-6 pb-24 px-4 space-y-6">

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 px-4 py-3 rounded-2xl shadow-xl font-bold text-sm text-white max-w-[90vw]"
            style={{ background: toast.type === 'error' ? '#E60000' : '#17B26A' }}
          >
            {toast.type === 'error' ? <AlertTriangle size={18} className="shrink-0" /> : <Check size={18} className="shrink-0" />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      <button onClick={() => navigate('/')} className="tap text-ink-soft flex items-center gap-1 font-bold hover:text-ink transition-colors -ml-2">
        <ChevronLeft size={20}/> 戻る
      </button>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <GlassCard className="p-6 space-y-6 shadow-2xl border-t-4 border-t-qb-blue">
          <div className="flex items-center gap-3 border-b border-line pb-4">
            <div className="bg-gradient-to-br from-qb-blue to-qb-cyan p-3 rounded-2xl text-white shrink-0">
              <Megaphone size={28} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-ink">全体お知らせ作成</h2>
              <p className="text-sm font-bold text-ink-soft">全員のトップ画面にポップアップ表示されます</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-bold text-ink-soft tracking-wide block mb-2">タイトル</label>
              <input
                type="text"
                value={title}
                onChange={e=>setTitle(e.target.value)}
                enterKeyHint="next"
                className="w-full min-h-[44px] px-4 py-3 rounded-2xl bg-canvas border-2 border-line focus:ring-2 focus:ring-qb-cyan focus:border-qb-cyan outline-none font-bold text-ink"
                placeholder="（例）春の社内イベントについて"
              />
            </div>

            <div>
              <label className="text-sm font-bold text-ink-soft tracking-wide block mb-2">本文 (色や太字が使えます)</label>
              <div className="bg-canvas rounded-2xl overflow-hidden border-2 border-line focus-within:border-qb-cyan transition-all shadow-inner">
                <Editor
                  containerProps={{ style: { height: '240px', overflowY: 'auto' } }}
                  value={content}
                  onChange={e=>setContent(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-danger/5 p-4 rounded-2xl border border-danger/20 flex items-center justify-between cursor-pointer min-h-[44px]" onClick={() => setIsImportant(!isImportant)}>
                <div className="flex items-center gap-2">
                  <BellRing className={`${isImportant ? 'text-danger animate-pulse' : 'text-qb-gray'}`} size={20}/>
                  <div>
                    <div className="text-base font-bold text-ink">重要フラグ</div>
                    <div className="text-xs text-ink-soft">赤色で目立つように表示</div>
                  </div>
                </div>
                <div className={`w-12 h-6 rounded-full p-1 transition-colors shrink-0 ${isImportant ? 'bg-danger' : 'bg-qb-gray-light'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform ${isImportant ? 'translate-x-6' : 'translate-x-0'}`}/>
                </div>
              </div>

              <div className="bg-canvas p-4 rounded-2xl border border-line">
                <label className="text-sm font-bold text-qb-blue block mb-1 flex items-center gap-1">
                  いつまで表示するか <span className="text-danger text-xs">必須</span>
                </label>
                <input
                  type="datetime-local"
                  value={displayUntil}
                  onChange={e=>setDisplayUntil(e.target.value)}
                  className="w-full min-h-[44px] px-3 bg-surface rounded-xl outline-none text-base font-bold text-ink border border-line focus:ring-2 focus:ring-qb-cyan focus:border-qb-cyan tabular"
                />
              </div>
            </div>
          </div>

          <div className="pt-6">
            <button
              onClick={handlePost}
              disabled={!title || !content || !displayUntil || isPosting}
              className="tap w-full bg-gradient-to-r from-qb-blue to-qb-cyan text-white py-4 rounded-full font-black flex items-center justify-center gap-2 shadow-lg hover:shadow-xl active:scale-95 transition-all disabled:opacity-40 disabled:grayscale"
            >
              <Send size={20} className={isPosting ? "animate-spin" : ""} />
              {isPosting ? '公開中...' : '全体に公開する'}
            </button>
          </div>
        </GlassCard>
      </motion.div>
    </div>
  );
};
