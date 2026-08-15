import React, { useMemo, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GlassCard } from '../components/ui/GlassCard';
import { useAuthStore } from '../store/useAuthStore';
import { useReportStore } from '../store/useReportStore';
import { collectionGroup, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ChevronLeft, Award, MessageCircle, Heart, FileText, Zap, Star, Trophy } from 'lucide-react';

export const Achievements = () => {
  const { user } = useAuthStore();
  const { reports } = useReportStore();
  const navigate = useNavigate();
  const [commentsMadeCount, setCommentsMadeCount] = useState<number | null>(null);

  useEffect(() => {
    if (user) {
      const fetchCommentsMade = async () => {
        try {
          // collectionGroup 'comments' queries all subcollections named 'comments'
          const q = query(collectionGroup(db, 'comments'), where('authorId', '==', user.uid));
          const snapshot = await getDocs(q);
          setCommentsMadeCount(snapshot.size);
        } catch (error) {
          console.error('Failed to fetch comments made:', error);
          setCommentsMadeCount(0); // Fallback
        }
      };
      fetchCommentsMade();
    }
  }, [user]);

  const stats = useMemo(() => {
    if (!user) return null;
    
    const myReports = reports.filter(r => r.authorId === user.uid);
    const reactionsReceived = myReports.reduce((acc, report) => {
      return acc + (report.reactions?.reduce((sum, r) => sum + r.count, 0) || 0);
    }, 0);

    const commentsReceived = myReports.reduce((acc, report) => {
      return acc + (report.commentCount || 0);
    }, 0);

    const reactionsGiven = reports.reduce((acc, report) => {
      const givenCount = report.reactions?.filter(r => r.userIds.includes(user.uid)).length || 0;
      return acc + givenCount;
    }, 0);

    return {
      reportCount: myReports.length,
      reactionsReceived,
      commentsReceived,
      reactionsGiven,
      commentsMade: commentsMadeCount ?? 0
    };
  }, [reports, user, commentsMadeCount]);

  if (!user || !stats) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-qb-blue"></div>
      </div>
    );
  }

  const achievementItems = [
    {
      label: '週報数',
      value: stats.reportCount,
      icon: FileText,
      color: 'text-blue-500',
      bg: 'bg-blue-50',
      description: 'これまでに投稿したレポートの総数'
    },
    {
      label: 'もらったいいね',
      value: stats.reactionsReceived,
      icon: Heart,
      color: 'text-pink-500',
      bg: 'bg-pink-50',
      description: 'あなたのレポートに届いたみんなからの反応'
    },
    {
      label: 'いいねした回数',
      value: stats.reactionsGiven,
      icon: Star,
      color: 'text-yellow-500',
      bg: 'bg-yellow-50',
      description: 'あなたが仲間に送ったエールの数'
    },
    {
      label: 'もらったコメント',
      value: stats.commentsReceived,
      icon: MessageCircle,
      color: 'text-emerald-500',
      bg: 'bg-emerald-50',
      description: 'あなたのレポートに寄せられた仲間の声'
    },
    {
      label: 'コメントした回数',
      value: stats.commentsMade,
      icon: Zap,
      color: 'text-purple-500',
      bg: 'bg-purple-50',
      description: 'あなたが仲間のレポートに送った一言'
    }
  ];

  const maxValue = Math.max(1, ...achievementItems.map(i => i.value));

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-32 px-4 pt-4">
      <div className="flex items-center gap-4 mb-2">
        <button
          onClick={() => navigate('/profile')}
          className="tap p-2 hover:bg-surface/60 rounded-xl transition-colors"
        >
          <ChevronLeft className="text-ink-soft" />
        </button>
        <h1 className="text-2xl font-black text-ink flex items-center gap-3">
          <Trophy className="text-qb-cyan" />
          自分の実績
        </h1>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {achievementItems.map((item, idx) => {
          const barPct = Math.max(4, Math.round((item.value / maxValue) * 100));
          return (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
          >
            <GlassCard className="p-6 border-none bg-surface/40 overflow-hidden relative group" hoverEffect={true}>
              <div className="flex items-center gap-5 relative z-10">
                <div className={`p-4 rounded-2xl ${item.bg} ${item.color} shadow-sm group-hover:scale-110 transition-transform duration-300`}>
                  <item.icon size={28} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between">
                    <h3 className="text-sm font-black text-ink-soft uppercase tracking-widest">{item.label}</h3>
                    <div className="text-3xl font-black text-ink tracking-tighter tabular">
                      {item.value}
                      <span className="text-xs ml-1 text-qb-gray">回</span>
                    </div>
                  </div>
                  {/* 相対バー：5指標の中での大きさを可視化 */}
                  <div className="mt-2 h-2 w-full rounded-full bg-[#EAF0F7] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-qb-blue to-qb-cyan"
                      style={{ width: `${barPct}%`, transition: 'width 0.6s cubic-bezier(0.16,1,0.3,1)' }}
                    />
                  </div>
                  <p className="text-xs font-bold text-ink-soft mt-1.5">{item.description}</p>
                </div>
              </div>
              <div className={`absolute top-0 right-0 w-32 h-32 ${item.bg} opacity-[0.03] rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700`} />
            </GlassCard>
          </motion.div>
          );
        })}
      </div>

      <GlassCard className="p-8 text-center bg-gradient-to-tr from-qb-blue/15 via-surface/40 to-qb-cyan/15 border-none shadow-xl">
        <div className="w-16 h-16 bg-surface rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner border border-line">
          <Award className="text-qb-cyan" size={32} />
        </div>
        <h2 className="text-lg font-black text-ink mb-2">素晴らしい貢献です！</h2>
        <p className="text-xs font-bold text-ink-soft leading-relaxed max-w-xs mx-auto">
          みんなへのリアクションやコメントが、チームをより良くする大きな力になっています。
        </p>
      </GlassCard>
    </div>
  );
};
