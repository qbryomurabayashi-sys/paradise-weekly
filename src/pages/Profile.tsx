import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from '../components/ui/GlassCard';
import { useAuthStore } from '../store/useAuthStore';
import { useReportStore } from '../store/useReportStore';
import { displayRole } from '../lib/formatUtils';
import { LogOut, Bell, User, ChevronRight, Award, MapPin, Zap, Info } from 'lucide-react';

export const Profile = () => {
  const { user, logout } = useAuthStore();
  const { reports } = useReportStore();
  const navigate = useNavigate();
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleMenuClick = (item: any) => {
    if (item.label === 'アカウント編集') {
      navigate('/profile/edit');
    } else if (item.label === '自分の実績') {
      navigate('/profile/achievements');
    } else {
      setToast(`${item.label}は現在開発中です`);
    }
  };

  // 実績の計算
  const stats = useMemo(() => {
    if (!user) return { reportCount: 0, reactionCount: 0 };
    const myReports = reports.filter(r => r.authorId === user.uid);
    const reactionCount = myReports.reduce((acc, report) => {
      const reportReactions = report.reactions?.reduce((sum, reaction) => sum + reaction.count, 0) || 0;
      return acc + reportReactions;
    }, 0);
    return { reportCount: myReports.length, reactionCount };
  }, [reports, user]);

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-32 px-4 animate-fade-in">

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 px-4 py-3 rounded-2xl shadow-xl font-bold text-sm text-white bg-qb-blue max-w-[90vw]"
          >
            <Info size={18} className="shrink-0" /> {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {user ? (
        <div className="flex flex-col items-center py-12 relative">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative"
          >
            <div className="w-32 h-32 rounded-[2.5rem] bg-gradient-to-br from-qb-blue-dark via-qb-blue to-qb-cyan p-1.5 shadow-2xl relative z-10">
              <div className="w-full h-full rounded-[2.2rem] bg-surface flex items-center justify-center text-5xl font-black text-qb-blue shadow-inner overflow-hidden">
                {user.photoURL ? (
                    <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                    (user.name || '').trim().charAt(0) || <User size={48} className="text-qb-blue" />
                )}
              </div>
            </div>
            <div className="absolute -bottom-2 -right-2 bg-surface w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg border-2 border-qb-cyan z-20">
              <Zap size={20} className="text-qb-cyan" />
            </div>
            <div className="absolute -top-10 -left-10 w-40 h-40 bg-qb-cyan/10 blur-3xl rounded-full" />
            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-qb-blue/20 blur-3xl rounded-full" />
          </motion.div>

          <div className="text-center mt-6 space-y-2">
            <h2 className="text-3xl font-black text-ink tracking-tight">{user.name}</h2>
            <div className="flex flex-wrap justify-center gap-2">
              <span className="text-white font-black text-xs bg-gradient-to-r from-qb-blue to-qb-cyan px-4 py-1.5 rounded-full tracking-[0.2em] shadow-sm">
                {displayRole(user.role)}
              </span>
              <span className="flex items-center gap-1 text-ink-soft font-bold text-xs bg-surface px-3 py-1.5 rounded-full border border-line">
                <MapPin size={10} /> {user.storeName}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="py-20 text-center text-ink-soft font-bold">ユーザー情報を読み込めませんでした。</div>
      )}

      {user && (
        <div className="grid grid-cols-2 gap-4">
          <GlassCard hoverEffect={true} className="text-center p-8 border border-line">
             <div className="text-3xl font-black text-qb-blue tabular">{stats.reportCount}</div>
             <div className="text-xs font-bold text-ink-soft tracking-widest mt-1">週報数</div>
          </GlassCard>
          <GlassCard hoverEffect={true} className="text-center p-8 border border-line">
             <div className="text-3xl font-black text-qb-cyan tabular">{stats.reactionCount}</div>
             <div className="text-xs font-bold text-ink-soft tracking-widest mt-1">もらったリアクション</div>
          </GlassCard>
        </div>
      )}

      <GlassCard className="space-y-1 p-3 border border-line" hoverEffect={false}>
         {user && [
          { icon: Bell, label: '通知設定', color: 'text-qb-cyan', bg: 'bg-qb-cyan/10' },
          { icon: Award, label: '自分の実績', color: 'text-qb-blue', bg: 'bg-qb-blue/10' },
          { icon: User, label: 'アカウント編集', color: 'text-qb-blue-dark', bg: 'bg-qb-blue-dark/10' },
        ].map((item) => (
          <button
            key={item.label}
            onClick={() => handleMenuClick(item)}
            className="w-full min-h-[44px] flex items-center justify-between p-4 hover:bg-canvas rounded-[1.5rem] transition-all group border border-transparent hover:border-line"
          >
            <div className="flex items-center gap-4">
              <div className={`p-2.5 rounded-xl ${item.bg} ${item.color} shadow-sm`}>
                <item.icon size={20} />
              </div>
              <span className="font-bold text-ink">{item.label}</span>
            </div>
            <ChevronRight size={18} className="text-qb-gray-light group-hover:text-ink-soft group-hover:translate-x-1 transition-all" />
          </button>
        ))}

        {user?.role === 'BM' && (
          <div className="pt-6 px-3">
            <button
              onClick={() => navigate('/admin')}
              className="tap w-full flex items-center justify-center gap-3 p-4 text-white bg-gradient-to-r from-qb-blue to-qb-cyan rounded-[2rem] hover:shadow-lg transition-all font-black text-sm tracking-[0.2em] shadow-md"
            >
              <Zap size={18} />
              管理者ダッシュボード
            </button>
          </div>
        )}

        <div className="pt-6 px-3">
          <button
            onClick={handleLogout}
            className="tap w-full flex items-center justify-center gap-3 p-4 text-danger bg-danger/5 rounded-[2rem] border border-danger/20 hover:bg-danger/10 transition-all font-black text-sm tracking-[0.2em]"
          >
            <LogOut size={18} />
            ログアウト
          </button>
        </div>
      </GlassCard>

      <p className="text-center text-xs text-ink-soft font-black tracking-[0.4em] py-10">
        管理者共有ツール バージョン 2.0
      </p>
    </div>
  );
};
