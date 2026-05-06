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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-paradise-ocean"></div>
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

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-32 px-4 pt-4">
      <div className="flex items-center gap-4 mb-2">
        <button 
          onClick={() => navigate('/profile')}
          className="p-2 hover:bg-white/40 rounded-xl transition-colors"
        >
          <ChevronLeft className="text-gray-600" />
        </button>
        <h1 className="text-2xl font-black text-gray-800 flex items-center gap-3">
          <Trophy className="text-paradise-sunset" />
          自分の実績
        </h1>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {achievementItems.map((item, idx) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
          >
            <GlassCard className="p-6 border-none bg-white/40 overflow-hidden relative group" hoverEffect={true}>
              <div className="flex items-center gap-5 relative z-10">
                <div className={`p-4 rounded-2xl ${item.bg} ${item.color} shadow-sm group-hover:scale-110 transition-transform duration-300`}>
                  <item.icon size={28} />
                </div>
                <div className="flex-1">
                  <div className="flex items-baseline justify-between">
                    <h3 className="text-sm font-black text-gray-500 uppercase tracking-widest">{item.label}</h3>
                    <div className="text-3xl font-black text-gray-800 tracking-tighter">
                      {item.value}
                      <span className="text-xs ml-1 text-gray-400">回</span>
                    </div>
                  </div>
                  <p className="text-xs font-bold text-gray-400 mt-1">{item.description}</p>
                </div>
              </div>
              <div className={`absolute top-0 right-0 w-32 h-32 ${item.bg} opacity-[0.03] rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700`} />
            </GlassCard>
          </motion.div>
        ))}
      </div>

      <GlassCard className="p-8 text-center bg-gradient-to-tr from-paradise-blue/20 via-white/40 to-paradise-pink/20 border-none shadow-xl">
        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner border border-white/50">
          <Award className="text-paradise-sunset" size={32} />
        </div>
        <h2 className="text-lg font-black text-gray-800 mb-2">素晴らしい貢献です！</h2>
        <p className="text-xs font-bold text-gray-500 leading-relaxed max-w-xs mx-auto">
          みんなへのリアクションやコメントが、チームをより良くする大きな力になっています。
        </p>
      </GlassCard>
    </div>
  );
};
