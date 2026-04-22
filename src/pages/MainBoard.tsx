import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GlassCard } from '../components/ui/GlassCard';
import { useReportStore } from '../store/useReportStore';
import { useAuthStore } from '../store/useAuthStore';
import { MessageCircle, ThumbsUp, Lightbulb, Rocket, Stars, ChevronRight } from 'lucide-react';

export const MainBoard = () => {
  const { reports, filterRole, setFilterRole } = useReportStore();
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const isBM = user?.role === 'BM';

  const filteredReports = reports.filter(r => {
    // 役割によるフィルター
    if (filterRole && r.authorRole !== filterRole) return false;
    
    // 権限による閲覧制限: AMレポートはAMとBMのみ
    if (r.authorRole === 'AM' && user?.role !== 'AM' && !isBM) return false;

    return true;
  });

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
      {/* フィルタバー */}
      <div className="flex gap-2 mb-8 overflow-x-auto pb-4 no-scrollbar px-2">
        {['すべて', '店長', 'AM', 'BM'].map((role) => (
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
      <div className="grid gap-6 px-2">
        {filteredReports.map((report, index) => (
          <motion.div
            key={report.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            onClick={() => navigate(`/report/${report.id}`)}
            className="cursor-pointer"
          >
            <GlassCard className="relative overflow-hidden group">
              {/* 装飾用の光 */}
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-paradise-mint/10 rounded-full blur-3xl group-hover:bg-paradise-mint/30 transition-all duration-700" />
              <div className="absolute -bottom-10 -left-10 w-24 h-24 bg-paradise-pink/10 rounded-full blur-3xl group-hover:bg-paradise-pink/30 transition-all duration-700" />
              
              <div className="flex justify-between items-start mb-6">
                <div className="flex gap-4 items-center">
                  <div className="w-12 h-12 rounded-2xl bg-white/40 flex items-center justify-center text-2xl shadow-inner border border-white/40">
                    {report.authorRole === '店長' ? '🏠' : report.authorRole === 'AM' ? '💼' : '🌟'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black text-white bg-paradise-ocean/60 px-2 py-0.5 rounded shadow-sm uppercase tracking-widest">
                        {report.authorRole}
                      </span>
                      <span className="text-xs font-bold text-gray-400">{report.storeName}</span>
                    </div>
                    <h3 className="text-lg font-bold text-gray-800 leading-tight mt-0.5">{report.authorName}</h3>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">{report.weekNumber} 週目</p>
                  <p className="text-[9px] text-gray-300">{new Date(report.createdAt).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="space-y-6">
                <section>
                  <label className="text-[10px] font-black text-paradise-sunset uppercase tracking-[0.2em] mb-1.5 block">キープ</label>
                  <p className="text-gray-700 leading-relaxed font-medium">{report.keep}</p>
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
              </div>

              {/* リアクション & コメント概要 */}
              <div className="mt-6 pt-5 border-t border-white/20 flex justify-between items-center">
                <div className="flex gap-2">
                  {report.reactions.map((reaction, i) => (
                    <div key={i} className="flex items-center gap-1.5 bg-white/30 px-3 py-1.5 rounded-full border border-white/40">
                      {getReactionIcon(reaction.type)}
                      <span className="text-xs font-bold text-gray-600">{reaction.count}</span>
                    </div>
                  ))}
                  {report.commentCount > 0 && (
                    <div className="flex items-center gap-1.5 bg-white/30 px-3 py-1.5 rounded-full border border-white/40">
                      <MessageCircle size={14} className="text-paradise-ocean" />
                      <span className="text-xs font-bold text-gray-600">{report.commentCount}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 text-[10px] font-black text-paradise-ocean group-hover:translate-x-1 transition-transform uppercase tracking-widest">
                  詳細を見る <ChevronRight size={14} />
                </div>
              </div>
            </GlassCard>
          </motion.div>
        ))}
      </div>

      {/* 空の状態 */}
      {filteredReports.length === 0 && (
        <div className="text-center py-20 opacity-50">
          <p className="text-xl font-bold text-gray-400">レポートがまだありません</p>
          <p className="text-sm text-gray-300 mt-2">あなたの体験を最初のレポートにしましょう 🌴</p>
        </div>
      )}

      {/* フローティング投稿ボタン */}
      {!isBM && (
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
