import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from '../components/ui/GlassCard';
import { SmoothTextArea } from '../components/ui/SmoothTextArea';
import { auth, db } from '../lib/firebase';
import { doc, deleteDoc } from 'firebase/firestore';
import { useReportStore } from '../store/useReportStore';
import { useAuthStore } from '../store/useAuthStore';
import { displayRole, formatStaffName } from '../lib/formatUtils';
import { ThumbsUp, Lightbulb, Rocket, Stars, Send, ChevronLeft, MessageCircle, Edit, Trash2, Loader2, Trophy, Calendar, Columns, Maximize2, Minimize2, ChevronUp, ChevronDown, Sparkles } from 'lucide-react';

const REACTIONS = [
  { type: 'like', icon: ThumbsUp, label: 'いいね！', color: 'text-blue-500', bg: 'bg-blue-50' },
  { type: 'learn', icon: Lightbulb, label: '学び！', color: 'text-yellow-600', bg: 'bg-yellow-50' },
  { type: 'copy', icon: Rocket, label: '真似る！', color: 'text-purple-500', bg: 'bg-purple-50' },
  { type: 'great', icon: Stars, label: '素敵！', color: 'text-pink-500', bg: 'bg-pink-50' }
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
  const [isGeneratingComment, setIsGeneratingComment] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [layoutMode, setLayoutMode] = useState<'bottom' | 'split'>('bottom');
  const [isMinimized, setIsMinimized] = useState(false);
  const [presetHeight, setPresetHeight] = useState<'compact' | 'normal' | 'large'>('normal');

  // Scroll to top on mount / id change
  useEffect(() => {
    window.scrollTo(0, 0);
    const unsub = init();
    return () => unsub();
  }, [id, init]);

  // Load draft from localStorage on mount
  useEffect(() => {
    if (report?.id) {
      const savedDraft = localStorage.getItem(`kpt_reply_draft_${report.id}`);
      if (savedDraft) {
        setComment(savedDraft);
      } else {
        setComment('');
      }
    }
  }, [report?.id]);

  // Handle comment state change with auto-save (local only)
  const handleCommentChange = (text: string) => {
    setComment(text);
  };

  // Debounced auto-save to localStorage
  useEffect(() => {
    if (!report?.id) return;
    if (comment === '') {
      localStorage.removeItem(`kpt_reply_draft_${report.id}`);
    } else {
      const t = setTimeout(() => {
        localStorage.setItem(`kpt_reply_draft_${report.id}`, comment);
      }, 500);
      return () => clearTimeout(t);
    }
  }, [comment, report?.id]);

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

  // 権限チェック: AMのレポートはAM and BMのみ閲覧可能
  if (report?.authorRole === 'AM' && activeRole !== 'AM' && activeRole !== 'BM') {
    return <div className="text-center py-20 text-ink-soft font-bold">閲覧権限がありません。</div>;
  }

  if (!report) return <div className="text-center py-20 text-ink-soft font-bold">レポートが見つからないか、削除されました。</div>;

  const sameWeekReports = reports.filter(r => r.weekNumber === report.weekNumber && r.year === report.year);
  const maxAmKpt = Math.max(0, ...sameWeekReports.map(r => r.reactions?.find((re: any) => re.type === 'best_kpt_am')?.count || 0));
  const maxSmKpt = Math.max(0, ...sameWeekReports.map(r => r.reactions?.find((re: any) => re.type === 'best_kpt_sm')?.count || 0));

  const hasBestBm = report.reactions?.some((r: any) => r.type === 'best_kpt' && r.count > 0);
  const amCount = report.reactions?.find((r: any) => r.type === 'best_kpt_am')?.count || 0;
  const hasBestAm = maxAmKpt > 0 && amCount === maxAmKpt;
  const smCount = report.reactions?.find((r: any) => r.type === 'best_kpt_sm')?.count || 0;
  const hasBestSm = maxSmKpt > 0 && smCount === maxSmKpt;

  const bestType = hasBestBm ? 'BM' : hasBestAm ? 'AM' : hasBestSm ? 'SM' : null;
  const hasBestKpt = bestType !== null;
  
  const cardBgStyle = bestType === 'BM' ? 'bg-gradient-to-br from-cyan-50 to-white border-2 border-cyan-300 shadow-cyan-200/40 relative overflow-hidden' 
                    : bestType === 'AM' ? 'bg-gradient-to-br from-blue-50 to-white border-2 border-blue-300 shadow-blue-200/40 relative overflow-hidden'
                    : bestType === 'SM' ? 'bg-gradient-to-br from-purple-50 to-white border-2 border-purple-300 shadow-purple-200/40 relative overflow-hidden' : '';
  const topBarStyle = bestType === 'BM' ? 'bg-gradient-to-r from-cyan-300 via-sky-400 to-cyan-500'
                    : bestType === 'AM' ? 'bg-gradient-to-r from-blue-300 via-indigo-400 to-blue-500'
                    : bestType === 'SM' ? 'bg-gradient-to-r from-purple-300 via-fuchsia-400 to-purple-500' : '';

  const handleSendComment = async () => {
    const currentUser = user || auth.currentUser;
    if (!comment.trim() || isSending) { return; }
    if (!currentUser) { return; }
    
    setIsSending(true);
    try {
      await addComment(report.id, {
        authorId: currentUser.uid || currentUser.id,
        authorName: currentUser.name || '名無し',
        authorRole: currentUser.role || '店長',
        authorPhotoURL: currentUser.photoURL || '',
        text: comment
      });
      setComment('');
      if (report?.id) {
        localStorage.removeItem(`kpt_reply_draft_${report.id}`);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSending(false);
    }
  };

  const handleDelete = async () => {
    try {
      await useReportStore.getState().deleteReport(report.id);
      navigate('/');
    } catch (err) {
      console.error('削除に失敗しました', err);
    }
  };

  const handleEdit = () => {
    navigate(`/edit/${report.id}`);
  };

  return (
    <>
      <div className={`mx-auto px-4 pt-4 animate-fade-in pb-32 md:pb-12 ${
        layoutMode === 'split' ? 'max-w-7xl h-screen flex flex-col' : 'max-w-3xl space-y-8'
      }`}>
      {/* 🛠️ Layout Configuration & Draft Options */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={() => navigate('/')}
          className="tap flex items-center gap-2 text-ink-soft font-bold hover:text-ink transition-all group p-2 text-sm"
        >
          <ChevronLeft className="group-hover:-translate-x-1 transition-transform" /> 戻る
        </button>

        {/* Desktop Split Toggle Option */}
        <div className="hidden md:flex items-center gap-2 bg-surface px-3 py-1.5 rounded-full border border-line select-none secure-unselectable text-xs font-black">
          <span className="text-xs text-ink-soft">レイアウト表示スタイル:</span>
          <button
            onClick={() => setLayoutMode('bottom')}
            className={`px-3 py-1 rounded-full transition-all ${
              layoutMode === 'bottom'
                ? 'bg-gradient-to-r from-qb-blue to-qb-cyan text-white shadow'
                : 'text-qb-gray hover:text-ink'
            }`}
          >
            通常 (下に固定)
          </button>
          <button
            onClick={() => setLayoutMode('split')}
            className={`px-3 py-1 rounded-full transition-all ${
              layoutMode === 'split'
                ? 'bg-gradient-to-r from-qb-blue to-qb-cyan text-white shadow'
                : 'text-qb-gray hover:text-ink'
            }`}
          >
            2画面分割 (報告見ながら書く)
          </button>
        </div>
      </div>

      {layoutMode === 'split' ? (
        /* ================= 2画面分割レイアウト (Desktop Side-by-Side Dual-Split) ================= */
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-6 min-h-0 relative select-none secure-unselectable mt-2 overflow-hidden">
          {/* 左カラム: レポート内容スクロール [col-span-7] */}
          <div className="md:col-span-7 flex flex-col min-h-0 select-none secure-unselectable h-full">
            <div className="overflow-y-auto pr-3 space-y-6 flex-1 pb-16 scrollbar-thin scrollbar-thumb-white/20 h-full">
              {/* 本文カード */}
              <GlassCard hoverEffect={false} className={`space-y-10 shadow-3xl ${cardBgStyle}`}>
                {hasBestKpt && (
                   <div className={`absolute top-0 inset-x-0 h-1.5 ${topBarStyle} z-50`}></div>
                )}
                <div className="flex items-center gap-5 border-b border-white/20 pb-6 relative z-10">
                  <div className="w-16 h-16 rounded-[1.5rem] bg-gradient-to-br from-paradise-blue to-paradise-pink flex items-center justify-center text-3xl shadow-xl border-2 border-white/50 overflow-hidden">
                    {report.authorPhotoURL ? (
                      <img src={report.authorPhotoURL} alt={report.authorName} className="w-full h-full object-cover" />
                    ) : (
                      report.authorRole === '店長' ? '🏠' : '👔'
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-2xl font-black text-gray-800">{formatStaffName(report.authorName)}</h2>
                      <span className="text-xs font-black bg-paradise-ocean text-white px-2 py-0.5 rounded uppercase tracking-widest">{displayRole(report.authorRole)}</span>
                      {report.status === 'draft' && (
                         <span className="text-xs font-black text-qb-gray bg-canvas border border-line px-2 py-0.5 rounded-full tracking-wider shrink-0 flex items-center gap-1">下書き <span className="font-normal opacity-80 -ml-0.5">（記入者のみ表示）</span></span>
                      )}
                      {report.status === 'published' && report.scheduledFor && new Date(report.scheduledFor) > new Date() && (
                         <span className="text-xs font-black text-qb-blue bg-qb-blue/10 border border-qb-blue/30 px-2 py-0.5 rounded-full tracking-wider shrink-0 flex items-center gap-1">
                            <Calendar size={10} /> 予約中({new Date(report.scheduledFor).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute:'2-digit' })}) <span className="font-normal opacity-80 -ml-0.5">（記入者のみ表示）</span>
                         </span>
                      )}
                    </div>
                    <p className="text-base font-bold text-gray-400 mt-1">{report.storeName} • 第{report.weekNumber}週</p>
                  </div>
                  {(activeRole === 'BM' || isOwner) && (
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
                          <label className="text-xs font-black text-danger/70 block mb-1">現在の課題</label>
                          <div className="text-sm text-gray-700 leading-relaxed font-bold prose prose-sm max-w-none whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: report.problem_gap }} />
                        </div>
                        <div>
                          <label className="text-xs font-black text-danger/70 block mb-1">あるべき姿</label>
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
                {(activeRole === 'BM' || activeRole === 'AM' || activeRole === '店長') && (() => {
                  const kptType = activeRole === 'BM' ? 'best_kpt' : activeRole === 'AM' ? 'best_kpt_am' : 'best_kpt_sm';
                  const kptLabel = activeRole === 'BM' ? 'B BEST KPT' : activeRole === 'AM' ? 'A BEST KPT' : 'S BEST KPT';
                  const kptBadge = activeRole === 'BM' ? '💎' : activeRole === 'AM' ? '🔷' : '🔮';
                  const hasGiven = report.reactions?.find((r: any) => r.type === kptType)?.userIds?.includes(user?.uid) || false;
                  const kptCount = report.reactions?.find((r: any) => r.type === kptType)?.count || 0;
                  
                  let btnGradient = "";
                  if (hasGiven) {
                     btnGradient = activeRole === 'BM' ? 'bg-gradient-to-r from-cyan-400 via-sky-300 to-cyan-500 border-sky-200 text-cyan-900 shadow-cyan-300/50 scale-105'
                                 : activeRole === 'AM' ? 'bg-gradient-to-r from-blue-400 via-indigo-300 to-blue-500 border-indigo-200 text-blue-900 shadow-blue-300/50 scale-105'
                                 : 'bg-gradient-to-r from-purple-400 via-fuchsia-300 to-purple-500 border-fuchsia-200 text-purple-900 shadow-purple-300/55 scale-105';
                  } else {
                     btnGradient = activeRole === 'BM' ? 'bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200 text-gray-400 hover:border-cyan-300 hover:text-cyan-600'
                                 : activeRole === 'AM' ? 'bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200 text-gray-400 hover:border-blue-300 hover:text-blue-600'
                                 : 'bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200 text-gray-400 hover:border-purple-300 hover:text-purple-600';
                  }

                  return (
                  <div className="py-8 border-t border-white/20 flex justify-center">
                     <button
                        onClick={(e) => {
                           e.preventDefault();
                           if (user) {
                              useReportStore.getState().addReaction(report.id, kptType, {
                                  uid: user.uid || (user as any).id,
                                  name: user.name,
                                  role: user.role
                              });
                           }
                        }}
                        className={`relative group overflow-hidden rounded-[2rem] px-10 py-5 transition-all shadow-2xl border-4 ${btnGradient}`}
                     >
                        <div className="absolute inset-0 bg-white/20 group-hover:translate-x-full duration-1000 skew-x-12 -translate-x-full transition-transform"></div>
                        <div className="flex flex-col items-center gap-2 relative z-10">
                          <motion.div animate={{ rotate: hasGiven ? [0, -10, 10, -10, 10, 0] : 0 }} transition={{ duration: 0.5 }}>
                             <Trophy size={48} className={hasGiven ? "drop-shadow-lg text-white" : ""} fill={hasGiven ? "currentColor" : "none"} />
                          </motion.div>
                          <span className="font-black text-xl uppercase tracking-[0.2em]">{hasGiven ? `${kptBadge} ${kptLabel} に選定済` : `${kptLabel} に選定する`} {kptCount > 0 ? `(${kptCount})` : ''}</span>
                        </div>
                     </button>
                  </div>
                  )
                })()}

                <div className={`flex flex-wrap gap-2 py-6 border-t border-white/20 justify-center`}>
                  {REACTIONS.map((r) => {
                    return (
                    <button 
                      key={r.label} 
                      className="flex flex-col items-center justify-start gap-2 outline-none group cursor-pointer w-[22%]"
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
                        className={`p-3 rounded-2xl transition-all border-2 border-white/10 shadow-lg ${r.bg} ${r.color} group-hover:border-white group-hover:shadow-xl`}
                      >
                        <r.icon size={20} />
                      </motion.div>
                      <span className="text-xs font-black text-ink-soft flex flex-col items-center w-full px-0.5">
                        <span className="whitespace-nowrap flex flex-wrap justify-center gap-1 font-bold"><span>{r.label}</span><span>({report.reactions?.find(react => react.type === r.type)?.count || 0})</span></span>
                      </span>
                    </button>
                  )})}
                </div>
              </GlassCard>
            </div>
          </div>

          {/* 右カラム: コメントリスト & 連動入力エディター [col-span-12 - col-span-5] */}
          <div className="md:col-span-5 flex flex-col h-full bg-surface rounded-[2.5rem] border border-line p-5 shadow-2xl min-h-0 select-none secure-unselectable">
            <div className="flex items-center justify-between border-b border-line pb-4 shrink-0 text-ink font-bold">
              <div className="flex items-center gap-2">
                <MessageCircle className="text-qb-blue" size={20} />
                <h3 className="text-lg font-black">スレッド返信</h3>
              </div>
              <span className="text-xs bg-canvas px-2.5 py-1 rounded-full text-ink-soft font-bold">{comments.length} 件のコメント</span>
            </div>

            {/* コメント一覧 (スクロール) */}
            <div className="flex-1 overflow-y-auto space-y-4 py-4 pr-1 scrollbar-thin scrollbar-thumb-white/20 select-none secure-unselectable">
              {comments.length === 0 ? (
                <div className="text-center py-12 text-ink-soft font-bold text-sm">
                  まだコメントはありません。<br />最初のフィードバックを届けてみましょう！
                </div>
              ) : (
                comments.map((c, idx) => (
                  <motion.div 
                    key={c.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: Math.min(idx * 0.05, 0.3) }}
                    className="flex gap-3 text-semibold font-bold"
                  >
                    <div className="w-8 h-8 rounded-xl bg-white/30 flex-shrink-0 flex items-center justify-center text-sm border border-white/30 shadow-sm overflow-hidden">
                      {c.authorPhotoURL ? (
                        <img src={c.authorPhotoURL} alt={c.authorName} className="w-full h-full object-cover" />
                      ) : (
                        c.authorRole === 'AM' ? '🎩' : '👤'
                      )}
                    </div>
                    <div className="glass rounded-2xl p-4 flex-1 relative text-xs font-bold leading-normal">
                      <div className="flex items-center gap-1.5 mb-1.5 font-bold">
                        <span className="font-black text-gray-800">{formatStaffName(c.authorName)}</span>
                        <span className={`text-xs text-white px-1.5 py-0.5 rounded-full font-black ${c.authorRole === 'AM' ? 'bg-qb-blue' : 'bg-qb-gray'}`}>
                          {displayRole(c.authorRole)}
                        </span>
                        <span className="text-xs text-qb-gray ml-auto tabular">{new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div className="text-sm text-gray-750 leading-relaxed font-semibold whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: c.text }} />

                      <div className="flex justify-end pt-1.5 border-t border-dashed border-gray-255 mt-2 font-bold">
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
                          className="flex flex-col items-end gap-1 group"
                        >
                          <div className={`flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full transition-colors ${
                            c.reactions?.some((r: any) => r.type === 'like' && r.userIds.includes(user?.uid))
                              ? 'bg-qb-blue/10 text-qb-blue'
                              : 'bg-canvas text-qb-gray hover:bg-line'
                          }`}>
                            <ThumbsUp size={10} />
                            <span>{c.reactions?.find((r: any) => r.type === 'like')?.userIds.length || 0}</span>
                          </div>
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>

            {/* 連動エディターエリア (分割用) */}
            <div className="border-t border-white/10 pt-4 shrink-0 flex flex-col gap-3">
              {/* クイック返信定型文 */}
              <div className="flex flex-wrap gap-1.5 select-none secure-unselectable">
                {[
                  "お疲れ様です！",
                  "素晴らしい取り組みですね！",
                  "学びになります！",
                  "次回の挑戦も応援します！",
                  "サポートします！"
                ].map((phrase) => (
                  <button
                    key={phrase}
                    onClick={(e) => {
                      e.preventDefault();
                      handleCommentChange(comment ? `${comment}\n${phrase}` : phrase);
                    }}
                    className="text-xs font-black text-ink-soft bg-canvas hover:bg-line border border-line px-2.5 py-1 rounded-full transition-all active:scale-95"
                  >
                    + {phrase}
                  </button>
                ))}
              </div>

              {/* 打ち込み窓 */}
              <div className="relative flex flex-col bg-white rounded-2xl border-2 border-line focus-within:border-qb-cyan transition-all shadow-xl p-3">
                <SmoothTextArea
                  className="w-full min-h-[120px] max-h-[220px] p-2 bg-transparent outline-none resize-y text-gray-700 font-medium text-sm leading-relaxed"
                  value={comment}
                  id="split-textarea"
                  onValueChange={handleCommentChange}
                  placeholder="チームにポジティブな言葉を届けよう..."
                />
                
                <div className="flex items-center justify-between border-t border-line pt-2.5 mt-2 font-bold">
                  <span className="text-xs font-black text-qb-gray bg-canvas px-2 py-0.5 rounded-full select-none">
                     下書き自動保存済 ({comment.length}文字)
                  </span>

                  <motion.button
                    whileHover={isSending ? {} : { scale: 1.05 }}
                    whileTap={isSending ? {} : { scale: 0.95 }}
                    onClick={handleSendComment}
                    disabled={isSending}
                    className="tap px-5 py-2 bg-gradient-to-r from-qb-blue to-qb-cyan text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-lg disabled:opacity-50"
                  >
                    {isSending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                    <span>{isSending ? '送信中...' : '送信する'}</span>
                  </motion.button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ================= 通常レイアウト (Standard Bottom Floating) ================= */
        <div className="space-y-8 select-none secure-unselectable">
          {/* 本文カード */}
          <GlassCard hoverEffect={false} className={`space-y-10 shadow-3xl ${cardBgStyle}`}>
            {hasBestKpt && (
               <div className={`absolute top-0 inset-x-0 h-1.5 ${topBarStyle} z-50`}></div>
            )}
            <div className="flex items-center gap-5 border-b border-white/20 pb-6 relative z-10">
              <div className="w-16 h-16 rounded-[1.5rem] bg-gradient-to-br from-paradise-blue to-paradise-pink flex items-center justify-center text-3xl shadow-xl border-2 border-white/50 overflow-hidden">
                {report.authorPhotoURL ? (
                  <img src={report.authorPhotoURL} alt={report.authorName} className="w-full h-full object-cover" />
                ) : (
                  report.authorRole === '店長' ? '🏠' : '👔'
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-black text-gray-800">{formatStaffName(report.authorName)}</h2>
                  <span className="text-xs font-black bg-paradise-ocean text-white px-2 py-0.5 rounded uppercase tracking-widest">{displayRole(report.authorRole)}</span>
                  {report.status === 'draft' && (
                     <span className="text-xs font-black text-qb-gray bg-canvas border border-line px-2 py-0.5 rounded-full tracking-wider shrink-0 flex items-center gap-1">下書き <span className="font-normal opacity-80 -ml-0.5">（記入者のみ表示）</span></span>
                  )}
                  {report.status === 'published' && report.scheduledFor && new Date(report.scheduledFor) > new Date() && (
                     <span className="text-xs font-black text-qb-blue bg-qb-blue/10 border border-qb-blue/30 px-2 py-0.5 rounded-full tracking-wider shrink-0 flex items-center gap-1">
                        <Calendar size={10} /> 予約中({new Date(report.scheduledFor).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute:'2-digit' })}) <span className="font-normal opacity-80 -ml-0.5">（記入者のみ表示）</span>
                     </span>
                  )}
                </div>
                <p className="text-base font-bold text-gray-400 mt-1">{report.storeName} • 第{report.weekNumber}週</p>
              </div>
              {(activeRole === 'BM' || isOwner) && (
                <div className="ml-auto flex gap-2">
                  <button onClick={handleEdit} className="text-sm font-bold bg-white/50 text-gray-600 px-3 py-1.5 rounded-full hover:bg-white/80 transition-colors flex items-center gap-1"><Edit size={12}/> 編集</button>
                  <button onClick={handleDelete} className="text-sm font-bold bg-red-100 text-red-600 px-3 py-1.5 rounded-full hover:bg-red-200 transition-colors flex items-center gap-1"><Trash2 size={12}/> 削除</button>
                </div>
              )}
            </div>

            <div className="space-y-10 animate-fade-in">
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
                      <label className="text-xs font-black text-danger/70 block mb-1">現在の課題</label>
                      <div className="text-sm text-gray-700 leading-relaxed font-bold prose prose-sm max-w-none whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: report.problem_gap }} />
                    </div>
                    <div>
                      <label className="text-xs font-black text-danger/70 block mb-1">あるべき姿</label>
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
            {(activeRole === 'BM' || activeRole === 'AM' || activeRole === '店長') && (() => {
              const kptType = activeRole === 'BM' ? 'best_kpt' : activeRole === 'AM' ? 'best_kpt_am' : 'best_kpt_sm';
              const kptLabel = activeRole === 'BM' ? 'B BEST KPT' : activeRole === 'AM' ? 'A BEST KPT' : 'S BEST KPT';
              const kptBadge = activeRole === 'BM' ? '💎' : activeRole === 'AM' ? '🔷' : '🔮';
              const hasGiven = report.reactions?.find((r: any) => r.type === kptType)?.userIds?.includes(user?.uid) || false;
              const kptCount = report.reactions?.find((r: any) => r.type === kptType)?.count || 0;
              
              let btnGradient = "";
              if (hasGiven) {
                 btnGradient = activeRole === 'BM' ? 'bg-gradient-to-r from-cyan-400 via-sky-300 to-cyan-500 border-sky-200 text-cyan-900 shadow-cyan-300/50 scale-105'
                             : activeRole === 'AM' ? 'bg-gradient-to-r from-blue-400 via-indigo-300 to-blue-500 border-indigo-200 text-blue-900 shadow-blue-300/50 scale-105'
                             : 'bg-gradient-to-r from-purple-400 via-fuchsia-300 to-purple-500 border-fuchsia-200 text-purple-900 shadow-purple-300/55 scale-105';
              } else {
                 btnGradient = activeRole === 'BM' ? 'bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200 text-gray-400 hover:border-cyan-300 hover:text-cyan-600'
                             : activeRole === 'AM' ? 'bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200 text-gray-400 hover:border-blue-300 hover:text-blue-600'
                             : 'bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200 text-gray-400 hover:border-purple-300 hover:text-purple-600';
              }

              return (
              <div className="py-8 border-t border-white/20 flex justify-center">
                 <button
                    onClick={(e) => {
                       e.preventDefault();
                       if (user) {
                          useReportStore.getState().addReaction(report.id, kptType, {
                              uid: user.uid || (user as any).id,
                              name: user.name,
                              role: user.role
                          });
                       }
                    }}
                    className={`relative group overflow-hidden rounded-[2rem] px-10 py-5 transition-all shadow-2xl border-4 ${btnGradient}`}
                 >
                    <div className="absolute inset-0 bg-white/20 group-hover:translate-x-full duration-1000 skew-x-12 -translate-x-full transition-transform"></div>
                    <div className="flex flex-col items-center gap-2 relative z-10 font-bold">
                      <motion.div animate={{ rotate: hasGiven ? [0, -10, 10, -10, 10, 0] : 0 }} transition={{ duration: 0.5 }}>
                         <Trophy size={48} className={hasGiven ? "drop-shadow-lg text-white" : ""} fill={hasGiven ? "currentColor" : "none"} />
                      </motion.div>
                      <span className="font-black text-xl uppercase tracking-[0.2em]">{hasGiven ? `${kptBadge} ${kptLabel} に選定済` : `${kptLabel} に選定する`} {kptCount > 0 ? `(${kptCount})` : ''}</span>
                    </div>
                 </button>
              </div>
              )
            })()}
            <div className={`flex flex-wrap sm:grid gap-2 py-6 border-t border-white/20 justify-center sm:grid-cols-4`}>
              {REACTIONS.map((r) => {
                return (
                <button 
                  key={r.label} 
                  className="flex flex-col items-center justify-start gap-2 outline-none h-full w-1/4 sm:w-auto group cursor-pointer"
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
                  <span className="text-xs font-black text-ink-soft flex flex-col items-center w-full px-0.5">
                    <span className="whitespace-nowrap flex flex-wrap justify-center gap-1"><span>{r.label}</span><span>({report.reactions?.find(react => react.type === r.type)?.count || 0})</span></span>
                    {report.reactions?.find(react => react.type === r.type)?.userNames && report.reactions?.find(react => react.type === r.type)!.userNames!.length > 0 && (
                       <span className="text-xs text-qb-gray mt-1 text-center leading-tight whitespace-normal break-words w-full px-0.5">
                         {report.reactions?.find(react => react.type === r.type)?.userNames?.map(name => formatStaffName(name)).join(', ')}
                       </span>
                    )}
                  </span>
                </button>
              )})}
            </div>
          </GlassCard>

          {/* コメントセクション */}
          <div className="space-y-6 pt-6">
            <div className="flex items-center gap-3 ml-4">
              <MessageCircle className="text-qb-blue" size={24} />
              <h3 className="text-xl font-black text-ink">みんなのコメント</h3>
            </div>
            
            <div className="space-y-4 px-2">
              {comments.map((c, idx) => (
                <motion.div 
                  key={c.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="flex gap-4 font-bold"
                >
                  <div className="w-10 h-10 rounded-2xl bg-white/30 flex-shrink-0 flex items-center justify-center text-lg border border-white/30 shadow-sm overflow-hidden animate-fade-in font-bold">
                    {c.authorPhotoURL ? (
                      <img src={c.authorPhotoURL} alt={c.authorName} className="w-full h-full object-cover" />
                    ) : (
                      c.authorRole === 'AM' ? '🎩' : '👤'
                    )}
                  </div>
                  <div className="glass rounded-3xl p-5 flex-1 relative font-bold">
                     {/* 吹き出しのしっぽ */}
                     <div className="absolute left-[-6px] top-6 w-3 h-3 glass rotate-45 border-r-0 border-t-0" />
                     
                    <div className="flex items-center gap-2 mb-2 font-bold">
                      <span className="font-black text-base text-ink">{formatStaffName(c.authorName)}</span>
                      <span className={`text-xs text-white px-2 py-0.5 rounded-full font-black ${c.authorRole === 'AM' ? 'bg-qb-blue' : 'bg-qb-gray'}`}>
                        {displayRole(c.authorRole)}
                      </span>
                      <span className="text-xs text-qb-gray ml-auto tabular">{new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className="text-base text-gray-700 leading-relaxed font-semibold mb-3 prose prose-sm max-w-none whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: c.text }} />
                    
                    <div className="flex justify-end border-t border-white/20 pt-2 text-bold">
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
                        className={`flex flex-col items-end gap-1 group font-bold`}
                      >
                        <div className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full transition-colors ${
                          c.reactions?.some((r: any) => r.type === 'like' && r.userIds.includes(user?.uid)) 
                            ? 'bg-blue-100 text-blue-600' 
                            : 'bg-white/50 text-gray-500 hover:bg-white/80'
                        }`}>
                          <ThumbsUp size={12} />
                          <span>{c.reactions?.find((r: any) => r.type === 'like')?.userIds.length || 0}</span>
                        </div>
                        {c.reactions?.find((r: any) => r.type === 'like')?.userNames && c.reactions?.find((r: any) => r.type === 'like')!.userNames!.length > 0 && (
                          <span className="text-xs text-qb-gray mt-1 text-right whitespace-normal break-words max-w-[200px]">
                            {c.reactions?.find((r: any) => r.type === 'like')?.userNames?.map(name => formatStaffName(name)).join(', ')}
                          </span>
                        )}
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>

    {/* コメント入力 (Sticky bottom floating bar in standard bottom layout) */}
    {layoutMode === 'bottom' && (
      <AnimatePresence>
        {!isMinimized && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-0 left-0 right-0 p-3 sm:p-4 pb-4 sm:pb-5 bg-slate-900/95 backdrop-blur-3xl border-t border-white/20 z-50 select-none secure-unselectable shadow-[0_-10px_35px_rgba(0,0,0,0.45)] duration-200"
          >
            <div className="max-w-3xl mx-auto flex flex-col gap-3 font-bold">
              <div className="flex items-center justify-between font-bold">
                <span className="text-xs font-black text-gray-300 flex items-center gap-1 font-sans">
                  <Sparkles size={12} className="text-qb-cyan" /> コメント下書き
                </span>

                <div className="flex items-center gap-2">
                  {/* Height Preset Selectors */}
                  <div className="flex items-center gap-1 bg-white/5 px-2 py-1 rounded-lg border border-white/10 text-xs font-black text-gray-300">
                    <span>高さ:</span>
                    <button
                      onClick={() => setPresetHeight('compact')}
                      className={`px-2 py-0.5 rounded transition-all ${presetHeight === 'compact' ? 'bg-qb-cyan text-white' : 'hover:text-white'}`}
                    >
                      小
                    </button>
                    <button
                      onClick={() => setPresetHeight('normal')}
                      className={`px-2 py-0.5 rounded transition-all ${presetHeight === 'normal' ? 'bg-qb-cyan text-white' : 'hover:text-white'}`}
                    >
                      中
                    </button>
                    <button
                      onClick={() => setPresetHeight('large')}
                      className={`px-2 py-0.5 rounded transition-all ${presetHeight === 'large' ? 'bg-qb-cyan text-white' : 'hover:text-white'}`}
                    >
                      大
                    </button>
                  </div>

                  {/* Collapse Button */}
                  <button
                    onClick={() => setIsMinimized(true)}
                    className="text-xs font-black text-gray-300 hover:text-white flex items-center gap-0.5 px-2 py-1 rounded-lg bg-white/5 border border-white/10 font-bold"
                    title="入力欄をたたむ"
                  >
                    <Minimize2 size={12} />
                    <span>たたむ</span>
                  </button>
                </div>
              </div>

              {/* Quick Words list */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none select-none secure-unselectable no-scrollbar">
                {[
                  "お疲れ様です！",
                  "素晴らしい取り組みですね！",
                  "学びになります！",
                  "ありがとうございます！",
                  "一緒に頑張りましょう！"
                ].map((phrase) => (
                  <button
                    key={phrase}
                    onClick={(e) => {
                      e.preventDefault();
                      handleCommentChange(comment ? `${comment}\n${phrase}` : phrase);
                    }}
                    className="text-xs font-black text-white/90 bg-white/10 hover:bg-white/20 border border-white/15 px-2.5 py-1 rounded-full whitespace-nowrap transition-all active:scale-95"
                  >
                    + {phrase}
                  </button>
                ))}
              </div>

              <div className="flex gap-3 sm:gap-4 items-end font-bold">
                <div className="flex-1 relative group bg-white rounded-2xl overflow-hidden border-2 border-white/30 focus-within:border-paradise-sunset/50 transition-all shadow-inner font-bold">
                   <SmoothTextArea
                     className={`w-full p-3 sm:p-4 bg-transparent outline-none resize-none text-gray-700 font-medium leading-relaxed transition-all duration-300 text-sm sm:text-base ${
                       presetHeight === 'compact' ? 'min-h-[44px] h-[44px]' : 
                       presetHeight === 'normal' ? 'min-h-[76px] h-[76px] sm:min-h-[110px] sm:h-[110px]' : 'min-h-[160px] h-[160px] sm:min-h-[250px] sm:h-[250px]'
                     }`}
                     value={comment}
                     id="bottom-textarea"
                     onValueChange={handleCommentChange}
                     placeholder="チームにポジティブな言葉を届けよう..."
                   />
                   <span className="absolute bottom-2 right-3 text-xs font-black text-gray-400 pointer-events-none select-none">
                     保存中
                   </span>
                </div>
                <motion.button
                  whileHover={isSending ? {} : { scale: 1.1, rotate: 10 }}
                  whileTap={isSending ? {} : { scale: 0.9 }}
                  onClick={handleSendComment}
                  disabled={isSending}
                  className="w-12 h-12 sm:w-14 sm:h-14 shrink-0 mb-1 bg-gradient-to-br from-qb-blue to-qb-cyan text-white rounded-full flex items-center justify-center shadow-xl shadow-qb-cyan/40 border-2 border-white/40 font-bold disabled:opacity-55"
                >
                  {isSending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    )}

    {/* Minimize toggle overlay button */}
    {layoutMode === 'bottom' && isMinimized && (
      <motion.button
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        onClick={() => setIsMinimized(false)}
        className="tap fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gradient-to-r from-qb-blue to-qb-cyan text-white font-black px-6 py-4 rounded-full shadow-2xl flex items-center gap-2 border-2 border-white/30 hover:scale-105 active:scale-95 transition-all text-sm select-none secure-unselectable font-bold"
      >
        <MessageCircle size={18} fill="currentColor" />
        <span>返信・コメントを入力する</span>
        <ChevronUp size={14} />
      </motion.button>
    )}
  </>
);
};
