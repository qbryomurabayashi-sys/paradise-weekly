import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from '../components/ui/GlassCard';
import { useReportStore } from '../store/useReportStore';
import { useAuthStore } from '../store/useAuthStore';
import { ThumbsUp, Lightbulb, Rocket, Stars, Send, ChevronLeft, MessageCircle } from 'lucide-react';

const REACTIONS = [
  { type: 'like', icon: ThumbsUp, label: 'いいね！', color: 'text-blue-500', bg: 'bg-blue-50' },
  { type: 'learn', icon: Lightbulb, label: '学び！', color: 'text-yellow-600', bg: 'bg-yellow-50' },
  { type: 'copy', icon: Rocket, label: '真似る！', color: 'text-purple-500', bg: 'bg-purple-50' },
  { type: 'great', icon: Stars, label: '素敵！', color: 'text-pink-500', bg: 'bg-pink-50' },
];

export const ReportDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { reports } = useReportStore();
  const { user } = useAuthStore();
  const report = reports.find(r => r.id === id);

  const [comment, setComment] = useState('');
  const [comments, setComments] = useState([
    { id: 'c1', authorName: '田中 エリアマネージャー', authorRole: 'AM', text: '素晴らしい改善ですね！マニュアルの共有もお願いしたいです。', createdAt: '2026-04-19T10:00:00Z' },
    { id: 'c2', authorName: '斎藤 店長', authorRole: '店長', text: 'これ、真似させていただきます！', createdAt: '2026-04-19T11:30:00Z' }
  ]);

  // BMはマスター権限を持つ
  const isMaster = user?.role === 'BM';

  if (!report) return <div className="text-center py-20 text-white">レポートが見つかりません</div>;

  const handleSendComment = () => {
    if (!comment.trim()) return;
    setComments(prev => [
      ...prev,
      { id: Date.now().toString(), authorName: '佐藤 拓海', authorRole: '店長', text: comment, createdAt: new Date().toISOString() }
    ]);
    setComment('');
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-32 px-4 animate-fade-in">
      <button 
        onClick={() => navigate('/')}
        className="flex items-center gap-2 text-white/80 font-bold hover:text-white transition-all group p-2"
      >
        <ChevronLeft className="group-hover:-translate-x-1 transition-transform" /> 戻る
      </button>

      {/* 本文カード */}
      <GlassCard hoverEffect={false} className="space-y-10 shadow-3xl">
        <div className="flex items-center gap-5 border-b border-white/20 pb-6">
          <div className="w-16 h-16 rounded-[1.5rem] bg-gradient-to-br from-paradise-blue to-paradise-pink flex items-center justify-center text-3xl shadow-xl border-2 border-white/50">
            {report.authorRole === '店長' ? '🏠' : '👔'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-black text-gray-800">{report.authorName}</h2>
              <span className="text-[10px] font-black bg-paradise-ocean text-white px-2 py-0.5 rounded uppercase tracking-widest">{report.authorRole}</span>
            </div>
            <p className="text-sm font-bold text-gray-400 mt-1">{report.storeName} • 第{report.weekNumber}週</p>
          </div>
          {isMaster && (
            <div className="ml-auto flex gap-2">
              <button className="text-xs font-bold bg-white/50 text-gray-600 px-3 py-1.5 rounded-full hover:bg-white/80 transition-colors">編集</button>
              <button className="text-xs font-bold bg-red-100 text-red-600 px-3 py-1.5 rounded-full hover:bg-red-200 transition-colors">削除</button>
            </div>
          )}
        </div>

        <div className="space-y-10">
          <section className="space-y-3">
            <h3 className="text-xs font-black text-paradise-sunset flex items-center gap-3 tracking-[0.3em] uppercase">
              <div className="w-1 h-5 bg-paradise-sunset rounded-full shadow-lg shadow-paradise-sunset/40" /> キープ
            </h3>
            <div className="text-gray-800 leading-relaxed bg-white/40 p-6 rounded-[2rem] border border-white/20 shadow-inner text-lg font-medium">
              {report.keep}
            </div>
          </section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <section className="space-y-3">
              <h3 className="text-xs font-black text-red-400 flex items-center gap-3 tracking-[0.3em] uppercase">
                <div className="w-1 h-5 bg-red-400 rounded-full shadow-lg shadow-red-400/40" /> 問題点
              </h3>
              <div className="bg-red-50/30 p-5 rounded-3xl border border-red-100/30 space-y-4">
                <div>
                  <label className="text-[9px] font-black text-red-400/60 uppercase block mb-1">現在の課題</label>
                  <p className="text-xs text-gray-700 leading-relaxed font-bold">{report.problem_gap}</p>
                </div>
                <div>
                  <label className="text-[9px] font-black text-red-400/60 uppercase block mb-1">あるべき姿</label>
                  <p className="text-xs text-gray-600 italic">理想：{report.problem_ideal}</p>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-xs font-black text-paradise-mint flex items-center gap-3 tracking-[0.3em] uppercase">
                <div className="w-1 h-5 bg-paradise-mint rounded-full shadow-lg shadow-paradise-mint/40" /> 次の挑戦
              </h3>
              <div className="bg-green-50/30 p-5 rounded-3xl border border-green-100/30 space-y-3">
                <p className="text-sm font-black text-gray-800">{report.try_what}</p>
                <div className="flex flex-wrap gap-2">
                   <span className="text-[10px] bg-white/50 px-2 py-1 rounded-full text-gray-500 font-bold">誰が: {report.try_who}</span>
                   <span className="text-[10px] bg-white/50 px-2 py-1 rounded-full text-gray-500 font-bold">いつ: {report.try_when}</span>
                </div>
                <p className="text-[10px] text-gray-400 italic">理由: {report.try_why}</p>
              </div>
            </section>
          </div>
        </div>

        {/* リアクションバー */}
        <div className="flex justify-around py-6 border-t border-white/20">
          {REACTIONS.map((r) => (
            <button key={r.label} className="flex flex-col items-center gap-2 group outline-none">
              <motion.div 
                whileHover={{ scale: 1.2, rotate: 10 }}
                whileTap={{ scale: 0.9 }}
                className={`p-4 rounded-[1.5rem] transition-all border-2 border-white/10 shadow-lg ${r.bg} ${r.color} group-hover:border-white group-hover:shadow-xl`}
              >
                <r.icon size={26} />
              </motion.div>
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{r.label}</span>
            </button>
          ))}
        </div>
      </GlassCard>

      {/* コメントセクション */}
      <div className="space-y-6 pt-6">
        <div className="flex items-center gap-3 ml-4">
          <MessageCircle className="text-white fill-white/20" size={24} />
          <h3 className="text-xl font-black text-white drop-shadow-md">みんなのコメント</h3>
        </div>
        
        <div className="space-y-4 px-2">
          {comments.map((c, idx) => (
            <motion.div 
              key={c.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="flex gap-4"
            >
              <div className="w-10 h-10 rounded-2xl bg-white/30 flex-shrink-0 flex items-center justify-center text-lg border border-white/30 shadow-sm">
                {c.authorRole === 'AM' ? '🎩' : '👤'}
              </div>
              <div className="glass rounded-3xl p-5 flex-1 relative">
                 {/* 吹き出しのしっぽ */}
                 <div className="absolute left-[-6px] top-6 w-3 h-3 glass rotate-45 border-r-0 border-t-0" />
                 
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-black text-sm text-gray-800">{c.authorName}</span>
                  <span className={`text-[9px] text-white px-2 py-0.5 rounded-full font-black uppercase ${c.authorRole === 'AM' ? 'bg-paradise-ocean/80' : 'bg-gray-400/80'}`}>
                    {c.authorRole}
                  </span>
                  <span className="text-[9px] text-gray-400 ml-auto">{new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed font-medium">{c.text}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* コメント入力 */}
        <div className="fixed bottom-0 left-0 right-0 p-6 bg-white/10 backdrop-blur-3xl border-t border-white/20 z-50">
          <div className="max-w-3xl mx-auto flex gap-4 items-center">
            <div className="flex-1 relative group">
              <input 
                type="text" 
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendComment()}
                placeholder="楽園にポジティブな言葉を届けよう..." 
                className="w-full bg-white/60 border-2 border-white/30 rounded-full px-8 py-4 outline-none focus:ring-4 focus:ring-paradise-sunset/20 focus:border-paradise-sunset/50 transition-all text-sm font-bold text-gray-700 shadow-inner placeholder:text-gray-300"
              />
              <div className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-20 pointer-events-none group-focus-within:opacity-0 transition-opacity">
                 <span className="text-[10px] font-black uppercase text-gray-400">楽園の響き</span>
              </div>
            </div>
            <motion.button 
              whileHover={{ scale: 1.1, rotate: 10 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleSendComment}
              className="w-14 h-14 bg-gradient-to-br from-paradise-sunset to-orange-400 text-white rounded-full flex items-center justify-center shadow-xl shadow-orange-300/40 border-2 border-white/40"
            >
              <Send size={24} />
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
};
