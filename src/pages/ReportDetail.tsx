import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from '../components/ui/GlassCard';
import { auth, db } from '../lib/firebase';
import { doc, deleteDoc } from 'firebase/firestore';
import { useReportStore } from '../store/useReportStore';
import { useAuthStore } from '../store/useAuthStore';
import { ThumbsUp, Lightbulb, Rocket, Stars, Send, ChevronLeft, MessageCircle, Edit, Trash2 } from 'lucide-react';

const REACTIONS = [
  { type: 'like', icon: ThumbsUp, label: 'いいね！', color: 'text-blue-500', bg: 'bg-blue-50' },
  { type: 'learn', icon: Lightbulb, label: '学び！', color: 'text-yellow-600', bg: 'bg-yellow-50' },
  { type: 'copy', icon: Rocket, label: '真似る！', color: 'text-purple-500', bg: 'bg-purple-50' },
  { type: 'great', icon: Stars, label: '素敵！', color: 'text-pink-500', bg: 'bg-pink-50' },
];

export const ReportDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { reports, addComment, getComments, markAsRead, init } = useReportStore();
  const { user: authUser } = useAuthStore();
  const report = reports.find(r => r.id === id);

  const user = authUser || (typeof window !== 'undefined' ? (window as any).currentUser : null); 

  const [comment, setComment] = useState('');
  const [comments, setComments] = useState<any[]>([]); 

  useEffect(() => {
    if (report && user?.uid) {
      markAsRead(report.id, user.uid);
      const unsubscribe = getComments(report.id, (cmts) => setComments(cmts));
      return () => unsubscribe();
    }
  }, [report, user?.uid, getComments, markAsRead]);

  const isMaster = user?.role === 'BM';
  const isOwner = user?.uid === report?.authorId;
  const { viewMode } = useAuthStore();
  const activeRole = isMaster && viewMode ? viewMode : user?.role;

  // 権限チェック: AMのレポートはAMとBMのみ閲覧可能
  if (report?.authorRole === 'AM' && activeRole !== 'AM' && activeRole !== 'BM') {
    return <div className="text-center py-20 text-white font-bold">閲覧権限がありません。</div>;
  }

  if (!report) return <div className="text-center py-20 text-white font-bold">レポートが見つからないか、削除されました。</div>;

  const handleSendComment = async () => {
    const currentUser = user || auth.currentUser;
    if (!comment.trim()) { alert("コメントを入力してください"); return; }
    if (!currentUser) { alert("ユーザー情報が取得できていません。再ログインしてください。"); return; }
    
    await addComment(report.id, {
      authorId: currentUser.uid || currentUser.id,
      authorName: currentUser.name || '名無し',
      authorRole: currentUser.role || '店長',
      authorPhotoURL: currentUser.photoURL || '',
      text: comment
    });
    setComment('');
  };

  const handleDelete = async () => {
    if (window.confirm('本当にこのレポートを削除しますか？\n（この操作は取り消せません）')) {
      try {
        await useReportStore.getState().deleteReport(report.id);
        alert('レポートを削除しました。');
        navigate('/');
      } catch (err) {
        console.error(err);
        alert('削除に失敗しましたが、権限の問題の可能性があります。 (' + err + ')');
      }
    }
  };

  const handleEdit = () => {
    navigate(`/edit/${report.id}`);
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
          <div className="w-16 h-16 rounded-[1.5rem] bg-gradient-to-br from-paradise-blue to-paradise-pink flex items-center justify-center text-3xl shadow-xl border-2 border-white/50 overflow-hidden">
            {report.authorPhotoURL ? (
              <img src={report.authorPhotoURL} alt={report.authorName} className="w-full h-full object-cover" />
            ) : (
              report.authorRole === '店長' ? '🏠' : '👔'
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-black text-gray-800">{report.authorName}</h2>
              <span className="text-xs font-black bg-paradise-ocean text-white px-2 py-0.5 rounded uppercase tracking-widest">{report.authorRole}</span>
            </div>
            <p className="text-base font-bold text-gray-400 mt-1">{report.storeName} • 第{report.weekNumber}週</p>
          </div>
          {(isMaster || isOwner) && (
            <div className="ml-auto flex gap-2">
              <button onClick={handleEdit} className="text-sm font-bold bg-white/50 text-gray-600 px-3 py-1.5 rounded-full hover:bg-white/80 transition-colors flex items-center gap-1"><Edit size={12}/> 編集</button>
              <button onClick={handleDelete} className="text-sm font-bold bg-red-100 text-red-600 px-3 py-1.5 rounded-full hover:bg-red-200 transition-colors flex items-center gap-1"><Trash2 size={12}/> 削除</button>
            </div>
          )}
        </div>

        <div className="space-y-10">
          <section className="space-y-3">
            <h3 className="text-sm font-black text-paradise-sunset flex items-center gap-3 tracking-[0.3em] uppercase">
              <div className="w-1 h-5 bg-paradise-sunset rounded-full shadow-lg shadow-paradise-sunset/40" /> キープ
            </h3>
            <div className="text-gray-800 leading-relaxed bg-white/40 p-6 rounded-[2rem] border border-white/20 shadow-inner text-lg font-medium prose prose-sm max-w-none whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: report.keep }} />
          </section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <section className="space-y-3">
              <h3 className="text-sm font-black text-red-400 flex items-center gap-3 tracking-[0.3em] uppercase">
                <div className="w-1 h-5 bg-red-400 rounded-full shadow-lg shadow-red-400/40" /> 問題点
              </h3>
              <div className="bg-red-50/30 p-5 rounded-3xl border border-red-100/30 space-y-4">
                <div>
                  <label className="text-[10px] font-black text-red-400/60 uppercase block mb-1">現在の課題</label>
                  <div className="text-sm text-gray-700 leading-relaxed font-bold prose prose-sm max-w-none whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: report.problem_gap }} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-red-400/60 uppercase block mb-1">あるべき姿</label>
                  <div className="text-sm text-gray-600 italic prose prose-sm max-w-none whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: report.problem_ideal }} />
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-black text-paradise-mint flex items-center gap-3 tracking-[0.3em] uppercase">
                <div className="w-1 h-5 bg-paradise-mint rounded-full shadow-lg shadow-paradise-mint/40" /> 次の挑戦
              </h3>
              <div className="bg-green-50/30 p-5 rounded-3xl border border-green-100/30 space-y-3">
                <p className="text-base font-black text-gray-800">{report.try_what}</p>
                <div className="flex flex-wrap gap-2">
                   <span className="text-xs bg-white/50 px-2 py-1 rounded-full text-gray-500 font-bold">誰が: {report.try_who}</span>
                   <span className="text-xs bg-white/50 px-2 py-1 rounded-full text-gray-500 font-bold">いつ: {report.try_when}</span>
                </div>
                <p className="text-xs text-gray-400 italic">理由: {report.try_why}</p>
              </div>
            </section>
          </div>
        </div>

        {/* リアクションバー */}
        <div className="flex justify-around py-6 border-t border-white/20">
          {REACTIONS.map((r) => (
            <button 
              key={r.label} 
              className="flex flex-col items-center gap-2 group outline-none"
              onClick={(e) => {
                e.preventDefault();
                if (user) {
                   useReportStore.getState().addReaction(report.id, r.type, {
                       uid: user.uid || (user as any).id,
                       name: user.name,
                       role: user.role
                   });
                }
              }}
            >
              <motion.div 
                whileHover={{ scale: 1.2, rotate: 10 }}
                whileTap={{ scale: 0.9 }}
                className={`p-4 rounded-[1.5rem] transition-all border-2 border-white/10 shadow-lg ${r.bg} ${r.color} group-hover:border-white group-hover:shadow-xl`}
              >
                <r.icon size={26} />
              </motion.div>
              <span className="text-xs font-black text-gray-500 uppercase tracking-widest flex flex-col items-center">
                <span>{r.label} ({report.reactions?.find(react => react.type === r.type)?.count || 0})</span>
                {report.reactions?.find(react => react.type === r.type)?.userNames && (
                   <span className="text-[10px] text-gray-400 normal-case mt-0.5 line-clamp-1 max-w-[80px]">
                     {report.reactions?.find(react => react.type === r.type)?.userNames?.join(', ')}
                   </span>
                )}
              </span>
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
              <div className="w-10 h-10 rounded-2xl bg-white/30 flex-shrink-0 flex items-center justify-center text-lg border border-white/30 shadow-sm overflow-hidden">
                {c.authorPhotoURL ? (
                  <img src={c.authorPhotoURL} alt={c.authorName} className="w-full h-full object-cover" />
                ) : (
                  c.authorRole === 'AM' ? '🎩' : '👤'
                )}
              </div>
              <div className="glass rounded-3xl p-5 flex-1 relative">
                 {/* 吹き出しのしっぽ */}
                 <div className="absolute left-[-6px] top-6 w-3 h-3 glass rotate-45 border-r-0 border-t-0" />
                 
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-black text-base text-gray-800">{c.authorName}</span>
                  <span className={`text-[10px] text-white px-2 py-0.5 rounded-full font-black uppercase ${c.authorRole === 'AM' ? 'bg-paradise-ocean/80' : 'bg-gray-400/80'}`}>
                    {c.authorRole}
                  </span>
                  <span className="text-[10px] text-gray-400 ml-auto">{new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="text-base text-gray-700 leading-relaxed font-medium mb-3 prose prose-sm max-w-none whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: c.text }} />
                
                <div className="flex justify-end border-t border-white/20 pt-2">
                  <button 
                    onClick={(e) => {
                        e.preventDefault();
                        if (user) {
                           useReportStore.getState().addCommentReaction(report.id, c.id, 'like', {
                             uid: user.uid || (user as any).id,
                             name: user.name
                           });
                        }
                    }}
                    className={`flex flex-col items-end gap-1 group`}
                  >
                    <div className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full transition-colors ${
                      c.reactions?.some((r: any) => r.type === 'like' && r.userIds.includes(user?.uid)) 
                        ? 'bg-blue-100 text-blue-600' 
                        : 'bg-white/50 text-gray-500 hover:bg-white/80'
                    }`}>
                      <ThumbsUp size={12} />
                      <span>{c.reactions?.find((r: any) => r.type === 'like')?.userIds.length || 0}</span>
                    </div>
                    {c.reactions?.find((r: any) => r.type === 'like')?.userNames && (
                      <span className="text-[10px] text-gray-400 line-clamp-1 max-w-[150px]">
                        {c.reactions?.find((r: any) => r.type === 'like')?.userNames?.join(', ')}
                      </span>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* コメント入力 */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/10 backdrop-blur-3xl border-t border-white/20 z-50">
          <div className="max-w-3xl mx-auto flex gap-4 items-end">
            <div className="flex-1 relative group bg-white/80 rounded-2xl overflow-hidden border-2 border-white/30 focus-within:border-paradise-sunset/50 transition-all shadow-inner">
               <textarea
                 className="w-full min-h-[60px] max-h-[150px] p-4 bg-transparent outline-none resize-none text-gray-700 font-medium leading-relaxed"
                 value={comment}
                 onChange={(e) => setComment(e.target.value)}
                 placeholder="チームにポジティブな言葉を届けよう..."
               />
            </div>
            <motion.button 
              whileHover={{ scale: 1.1, rotate: 10 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleSendComment}
              className="w-14 h-14 shrink-0 mb-1 bg-gradient-to-br from-paradise-sunset to-orange-400 text-white rounded-full flex items-center justify-center shadow-xl shadow-orange-300/40 border-2 border-white/40"
            >
              <Send size={24} />
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
};
