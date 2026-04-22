import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from '../components/ui/GlassCard';
import { useReportStore } from '../store/useReportStore';
import { useAuthStore } from '../store/useAuthStore';
import { MessageCircle, ThumbsUp, Lightbulb, Rocket, Stars, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';

export const MainBoard = () => {
  const { reports, filterRole, setFilterRole } = useReportStore();
  const { user, viewMode, setViewMode } = useAuthStore();
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const navigate = useNavigate();

  const isBM = user?.role === 'BM';

  // 閲覧モードの決定
  const activeRole = isBM && viewMode ? viewMode : user?.role;

  const filteredReports = reports.filter(r => {
    // 役割によるフィルター
    if (filterRole && r.authorRole !== filterRole) return false;
    
    // 権限による閲覧制限: AMレポートはAMとBMのみ
    if (r.authorRole === 'AM' && activeRole !== 'AM' && activeRole !== 'BM') return false;
    // BMのレポートは通常存在しないが念のため
    if (r.authorRole === 'BM' && activeRole !== 'BM') return false;

    return true;
  });

  const toggleExpand = (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // 親のクリックイベント（詳細へ遷移）を防ぐ
    setExpandedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const getReactionIcon = (type: string) => {
    switch (type) {
      case 'like': return <ThumbsUp size={14} className="text-paradise-sunset" />;
      case 'learn': return <Lightbulb size={14} className="text-yellow-500" />;
      case 'copy': return <Rocket size={14} className="text-purple-500" />;
      case 'great': return <Stars size={14} className="text-pink-500" />;
      default: return <ThumbsUp size={14} />;
    }
  };

  return (
    <div className="pb-24 max-w-4xl mx-auto">
      {/* BM用：視点切り替えトグル */}
      {isBM && (
        <div className="mb-6 px-4 py-3 mx-2 bg-gradient-to-r from-paradise-blue/20 to-paradise-lavender/20 border-2 border-white/40 rounded-2xl flex items-center justify-between shadow-sm">
            <span className="text-xs font-black text-gray-600 uppercase tracking-widest flex items-center gap-2"><Stars size={16} className="text-paradise-ocean"/> 【BM専用】視点シミュレーション</span>
            <div className="flex gap-2">
                <button 
                  onClick={() => setViewMode(null)} 
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${!viewMode ? 'bg-paradise-sunset text-white' : 'bg-white/50 text-gray-500 hover:bg-white'}`}
                >
                    BM視点
                </button>
                <button 
                  onClick={() => setViewMode('AM')} 
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${viewMode === 'AM' ? 'bg-paradise-sunset text-white' : 'bg-white/50 text-gray-500 hover:bg-white'}`}
                >
                    AMから見た画面
                </button>
                <button 
                  onClick={() => setViewMode('店長')} 
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${viewMode === '店長' ? 'bg-paradise-sunset text-white' : 'bg-white/50 text-gray-500 hover:bg-white'}`}
                >
                    店長から見た画面
                </button>
            </div>
        </div>
      )}

      {/* フィルタバー */}
      <div className="flex gap-2 mb-8 overflow-x-auto pb-4 no-scrollbar px-2">
        {['すべて', '店長', 'AM'].filter(role => {
          if (role === 'AM' && activeRole === '店長') return false;
          return true;
        }).map((role) => (
          <button
            key={role}
            onClick={() => setFilterRole(role === 'すべて' ? null : role as any)}
            className={`px-6 py-2 rounded-full glass transition-all whitespace-nowrap font-bold text-sm ${
              (filterRole === role || (role === 'すべて' && !filterRole))
                ? 'bg-paradise-sunset text-white border-none shadow-lg'
                : 'text-gray-600 hover:bg-white/60'
            }`}
          >
            {role}
          </button>
        ))}
      </div>

      {/* レポートリスト */}
      <div className="grid gap-3 px-2">
        {filteredReports.map((report, index) => {
          const isExpanded = expandedIds.includes(report.id);
          return (
            <motion.div
              key={report.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => navigate(`/report/${report.id}`)}
              className="cursor-pointer"
            >
            <GlassCard className={`relative overflow-hidden group transition-all duration-300 ${isExpanded ? 'p-6' : 'p-3'} ${!report.readBy?.includes(user?.uid || '') ? 'border-l-4 border-l-paradise-sunset' : ''}`}>
                {/* 投稿日と既読バッジ */}
                <div className="absolute top-2 left-3 flex items-center gap-2 z-10">
                   <span className="text-[8px] font-bold text-gray-400 bg-white/60 px-1.5 py-0.5 rounded-full shadow-sm">
                      {new Date(report.createdAt).toLocaleDateString()}
                   </span>
                   {!report.readBy?.includes(user?.uid || '') && (
                     <span className="flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-paradise-sunset opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-paradise-sunset"></span>
                     </span>
                   )}
                </div>

                {/* 装飾用の光 */}
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-paradise-mint/10 rounded-full blur-3xl group-hover:bg-paradise-mint/20 transition-all duration-700" />
                
                <div className="flex items-center justify-between gap-4 mt-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-white/40 flex items-center justify-center text-xl shadow-inner border border-white/40 overflow-hidden shrink-0">
                      {report.authorPhotoURL ? (
                        <img src={report.authorPhotoURL} alt={report.authorName} className="w-full h-full object-cover" />
                      ) : (
                        report.authorRole === '店長' ? '🏠' : report.authorRole === 'AM' ? '💼' : '🌟'
                      )}
                    </div>
                    <div className="min-w-0 flex flex-col sm:flex-row sm:items-center sm:gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[8px] font-black text-white bg-paradise-ocean/60 px-1.5 py-0.5 rounded shadow-sm uppercase tracking-widest shrink-0">
                          {report.authorRole}
                        </span>
                        <h3 className="text-sm font-bold text-gray-800 truncate">{report.authorName}</h3>
                      </div>
                      <span className="text-[10px] font-bold text-gray-400 truncate sm:border-l sm:pl-3 border-white/40">
                        {report.storeName}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <div className="hidden md:flex gap-1.5">
                      {report.reactions.slice(0, 2).map((reaction, i) => (
                        <div key={i} className="flex items-center gap-1 bg-white/30 px-2 py-0.5 rounded-full border border-white/40">
                          {getReactionIcon(reaction.type)}
                          <span className="text-[10px] font-bold text-gray-600">{reaction.count}</span>
                        </div>
                      ))}
                    </div>
                    <div className="text-right flex flex-col items-end">
                      <span className="text-[8px] font-black text-gray-400 uppercase tracking-tighter">W{report.weekNumber}</span>
                      <button 
                        onClick={(e) => toggleExpand(e, report.id)}
                        className="p-1 hover:bg-white/50 rounded-lg transition-colors text-gray-400 hover:text-paradise-sunset"
                      >
                        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </button>
                    </div>
                  </div>
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-6 pt-6 border-t border-white/20 space-y-6">
                        <section>
                          <label className="text-[10px] font-black text-paradise-sunset uppercase tracking-[0.2em] mb-1.5 block">キープ</label>
                          <p className="text-xs text-gray-700 leading-relaxed font-medium line-clamp-3">{report.keep}</p>
                        </section>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <section className="bg-white/20 p-4 rounded-2xl border border-white/20">
                            <label className="text-[10px] font-black text-red-400 uppercase tracking-[0.2em] mb-1 block">問題点</label>
                            <p className="text-xs text-gray-600 line-clamp-2">{report.problem_gap}</p>
                          </section>
                          <section className="bg-white/20 p-4 rounded-2xl border border-white/20">
                            <label className="text-[10px] font-black text-paradise-mint uppercase tracking-[0.2em] mb-1 block">挑戦</label>
                            <p className="text-xs text-gray-600 line-clamp-2">{report.try_what}</p>
                          </section>
                        </div>

                        <div className="flex justify-between items-center bg-white/10 p-3 rounded-2xl">
                          <div className="flex gap-2">
                             {report.reactions.map((reaction, i) => (
                               <div key={i} className="flex items-center gap-1 bg-white/20 px-2.5 py-1 rounded-full text-[10px] font-bold text-gray-600">
                                 {getReactionIcon(reaction.type)} {reaction.count}
                               </div>
                             ))}
                          </div>
                          <div className="flex items-center gap-1 text-[9px] font-black text-paradise-ocean uppercase">
                            詳細を開く <ChevronRight size={12} />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </GlassCard>
            </motion.div>
          );
        })}
      </div>

      {/* 空の状態 */}
      {filteredReports.length === 0 && (
        <div className="text-center py-20 opacity-50">
          <p className="text-xl font-bold text-gray-400">レポートがまだありません</p>
          <p className="text-sm text-gray-300 mt-2">あなたの体験を最初のレポートにしましょう 🌴</p>
        </div>
      )}

      {/* フローティング投稿ボタン */}
      {(!isBM || activeRole !== 'BM') && (
        <motion.button
          whileHover={{ scale: 1.1, rotate: 5 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate('/post')}
          className="fixed bottom-10 right-10 w-16 h-16 bg-gradient-to-br from-paradise-sunset to-orange-400 rounded-full shadow-2xl shadow-orange-300 flex items-center justify-center text-white z-50 border-4 border-white/50"
        >
          <Stars size={32} />
        </motion.button>
      )}

    </div>
  );
};
