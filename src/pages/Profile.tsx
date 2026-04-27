import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GlassCard } from '../components/ui/GlassCard';
import { useAuthStore } from '../store/useAuthStore';
import { useReportStore } from '../store/useReportStore';
import { LogOut, Bell, Shield, User, ChevronRight, Award, MapPin, Zap } from 'lucide-react';

export const Profile = () => {
  const { user, logout } = useAuthStore();
  const { reports } = useReportStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleMenuClick = (item: any) => {
    if (item.label === 'アカウント編集') {
      navigate('/profile/edit');
    } else {
      alert(`${item.label}は現在開発中です。`);
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
      {user ? (
        <div className="flex flex-col items-center py-12 relative">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative"
          >
            <div className="w-32 h-32 rounded-[2.5rem] bg-gradient-to-tr from-paradise-blue via-paradise-lavender to-paradise-pink p-1.5 shadow-2xl relative z-10">
              <div className="w-full h-full rounded-[2.2rem] bg-white flex items-center justify-center text-5xl shadow-inner border border-white/20 overflow-hidden">
                {user.photoURL ? (
                    <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                    "🌴"
                )}
              </div>
            </div>
            <div className="absolute -bottom-2 -right-2 bg-white w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg border-2 border-paradise-sunset z-20">
              <Zap size={20} className="text-paradise-sunset" />
            </div>
            <div className="absolute -top-10 -left-10 w-40 h-40 bg-paradise-sunset/10 blur-3xl rounded-full" />
            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-paradise-blue/20 blur-3xl rounded-full" />
          </motion.div>

          <div className="text-center mt-6 space-y-2">
            <h2 className="text-3xl font-black text-gray-800 tracking-tight">{user.name}</h2>
            <div className="flex flex-wrap justify-center gap-2">
              <span className="text-paradise-ocean font-black text-xs bg-paradise-blue/30 px-4 py-1.5 rounded-full uppercase tracking-[0.2em] shadow-sm border border-white/20">
                {user.role}
              </span>
              <span className="flex items-center gap-1 text-gray-400 font-bold text-xs bg-white/40 px-3 py-1.5 rounded-full border border-white/20">
                <MapPin size={10} /> {user.storeName}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="py-20 text-center text-gray-500">ユーザー情報を読み込めませんでした。</div>
      )}

      {user && (
        <div className="grid grid-cols-2 gap-4">
          <GlassCard hoverEffect={true} className="text-center p-8 border-none bg-gradient-to-br from-white/40 to-white/10">
             <div className="text-2xl font-black text-gray-800">{stats.reportCount}</div>
             <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">週報数</div>
          </GlassCard>
          <GlassCard hoverEffect={true} className="text-center p-8 border-none bg-gradient-to-br from-white/40 to-white/10">
             <div className="text-2xl font-black text-gray-800">{stats.reactionCount}</div>
             <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">もらったリアクション</div>
          </GlassCard>
        </div>
      )}

      <GlassCard className="space-y-1 p-3 border-none bg-white/30" hoverEffect={false}>
         {user && [
          { icon: Bell, label: '通知設定', color: 'text-orange-400', bg: 'bg-orange-50' },
          { icon: Award, label: '自分の実績', color: 'text-yellow-500', bg: 'bg-yellow-50' },
          { icon: User, label: 'アカウント編集', color: 'text-purple-400', bg: 'bg-purple-50' },
          { icon: Shield, label: 'プライバシーポリシー', color: 'text-blue-400', bg: 'bg-blue-50' },
        ].map((item, idx) => (
          <button 
            key={item.label} 
            onClick={() => handleMenuClick(item)}
            className="w-full flex items-center justify-between p-5 hover:bg-white/50 rounded-[1.5rem] transition-all group border border-transparent hover:border-white/40"
          >
            <div className="flex items-center gap-4">
              <div className={`p-2.5 rounded-xl ${item.bg} ${item.color} shadow-sm`}>
                <item.icon size={20} />
              </div>
              <span className="font-bold text-gray-700">{item.label}</span>
            </div>
            <ChevronRight size={18} className="text-gray-300 group-hover:text-gray-500 group-hover:translate-x-1 transition-all" />
          </button>
        ))}
        
        {user?.role === 'BM' && (
          <div className="pt-6 px-3">
            <button 
              onClick={() => navigate('/admin')}
              className="w-full flex items-center justify-center gap-3 p-5 text-paradise-sunset bg-paradise-sunset/10 rounded-[2rem] border border-paradise-sunset/20 hover:bg-paradise-sunset/20 transition-all font-black uppercase text-sm tracking-[0.2em] shadow-lg"
            >
              <Zap size={18} />
              管理者ダッシュボード
            </button>
          </div>
        )}

        <div className="pt-6 px-3">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-3 p-5 text-red-500 bg-red-50/40 rounded-[2rem] border border-red-100/40 hover:bg-red-100/60 transition-all font-black uppercase text-sm tracking-[0.2em] shadow-lg shadow-red-100/20"
          >
            <LogOut size={18} />
            ログアウト
          </button>
        </div>
      </GlassCard>
      
      <p className="text-center text-xs text-white/50 font-black uppercase tracking-[0.4em] py-10">
        週次報告 バージョン 1.0.0
      </p>
    </div>
  );
};
