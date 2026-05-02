import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from '../components/ui/GlassCard';
import { useReportStore } from '../store/useReportStore';
import { useAuthStore } from '../store/useAuthStore';
import { MessageCircle, ThumbsUp, Lightbulb, Rocket, Stars, ChevronRight, ChevronDown, ChevronUp, Megaphone, Check } from 'lucide-react';
import { useAnnouncementStore } from '../store/useAnnouncementStore';

export const MainBoard = () => {
  const { reports, filterRole, setFilterRole } = useReportStore();
  const { user, viewMode, setViewMode } = useAuthStore();
  const { announcements, markAsSeen, hideAnnouncement, init: initAnnounce, deleteAnnouncement } = useAnnouncementStore();
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [sessionHiddenAnns, setSessionHiddenAnns] = useState<string[]>([]);
  const navigate = useNavigate();

  const isBM = user?.role === 'BM';
  const isAM = user?.role === 'AM';
  const canAnnounce = isBM || isAM;

  useEffect(() => {
    const unsub = initAnnounce();
    return () => unsub();
  }, [initAnnounce]);
  
  const activeAnnouncements = announcements.filter(a => {
    const uid = user?.uid || '';
    return !a.hiddenBy?.includes(uid) && !a.seenBy?.includes(uid) && !sessionHiddenAnns.includes(a.id);
  });

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

  const getReactionIcon = (type: string, size = 14) => {
    switch (type) {
      case 'like': return <ThumbsUp size={size} className="text-paradise-sunset" />;
      case 'learn': return <Lightbulb size={size} className="text-yellow-500" />;
      case 'copy': return <Rocket size={size} className="text-purple-500" />;
      case 'great': return <Stars size={size} className="text-pink-500" />;
      default: return <ThumbsUp size={size} />;
    }
  };

  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDate = (date: Date) => {
    const y = date.getFullYear();
    const m = date.getMonth() + 1;
    const d = date.getDate();
    const h = date.getHours().toString().padStart(2, '0');
    const min = date.getMinutes().toString().padStart(2, '0');
    const s = date.getSeconds().toString().padStart(2, '0');
    return `${y}年${m}月${d}日 ${h}:${min}:${s}`;
  };

  const getActiveReminders = (now: Date) => {
    const reminders = [];
    const dayOfWeek = now.getDay();
    const hours = now.getHours();
    const date = now.getDate();
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    if (dayOfWeek === 6 || (dayOfWeek === 0 && hours < 18)) {
      reminders.push({ id: 'weekly', title: '週次報告', time: '日曜日 18:00まで', icon: '📝' });
    }
    if (date === 14 || (date === 15 && hours < 18)) {
      reminders.push({ id: 'keypass', title: '鍵・入館証の所持確認', time: '15日 18:00まで', icon: '🔑' });
      reminders.push({ id: 'shift', title: 'シフトの提出', time: '15日 18:00まで', icon: '📅' });
    }
    if (date === lastDayOfMonth - 1 || (date === lastDayOfMonth && hours < 18)) {
      reminders.push({ id: 'leaveplan', title: '有休・公出などの予定数提出', time: '月末日 18:00まで', icon: '🏖️' });
    }
    return reminders;
  };

  const activeReminders = getActiveReminders(currentTime);
  const todayStr = currentTime.toLocaleDateString();
  const [showReminderPopup, setShowReminderPopup] = useState(() => {
    return sessionStorage.getItem('reminder_dismissed_date') !== todayStr;
  });

  const dismissReminder = () => {
    sessionStorage.setItem('reminder_dismissed_date', todayStr);
    setShowReminderPopup(false);
  };

  // Available months initialization
  const availableMonths = React.useMemo(() => {
    const months = new Set<string>();
    reports.forEach(r => {
      const d = new Date(r.createdAt);
      months.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    });
    const sorted = Array.from(months).sort().reverse();
    // 常に現在の月がない場合は追加しておく（レポートがゼロでも当月は出したい場合があるため）
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    if (!sorted.includes(currentMonthStr)) {
        sorted.unshift(currentMonthStr);
        sorted.sort().reverse();
    }
    return sorted;
  }, [reports]);

  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
     const d = new Date();
     return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  // Calculate grouped and filtered reports
  const displayReports = React.useMemo(() => {
    const [year, month] = selectedMonth.split('-');
    return reports.filter(r => {
      const d = new Date(r.createdAt);
      return d.getFullYear().toString() === year && String(d.getMonth() + 1).padStart(2, '0') === month;
    }).filter(r => {
       // 役割によるフィルター
       if (filterRole && r.authorRole !== filterRole) return false;
       // 権限による閲覧制限: AMレポートはAMとBMのみ
       if (r.authorRole === 'AM' && activeRole !== 'AM' && activeRole !== 'BM') return false;
       // BMのレポートは通常存在しないが念のため
       if (r.authorRole === 'BM' && activeRole !== 'BM') return false;
       return true;
    });
  }, [reports, selectedMonth, filterRole, activeRole]);

  // Group by week
  const groupedByWeek = React.useMemo(() => {
    const groups: { [week: number]: typeof reports } = {};
    displayReports.forEach(r => {
       if (!groups[r.weekNumber]) {
          groups[r.weekNumber] = [];
       }
       groups[r.weekNumber].push(r);
    });
    return groups;
  }, [displayReports]);

  return (
    <div className="pb-24 max-w-4xl mx-auto">
      <div className="text-center mb-6">
        <span className="inline-block bg-white/70 backdrop-blur-md px-6 py-2 rounded-full shadow-sm border border-white/50 text-gray-700 font-bold tracking-wider">
          {formatDate(currentTime)}
        </span>
        {activeReminders.length > 0 && (
          <div className="mt-4 flex flex-col items-center gap-2">
            {activeReminders.map(rem => (
              <div key={rem.id} className="inline-flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 px-4 py-1.5 rounded-full text-sm font-bold shadow-sm animate-pulse">
                <span>{rem.icon}</span>
                <span>{rem.title}の期限が迫っています ({rem.time})</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* BM用：視点切り替えトグル */}
      {isBM && (
        <div className="mb-6 px-4 py-3 mx-2 bg-gradient-to-r from-paradise-blue/20 to-paradise-lavender/20 border-2 border-white/40 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
            <span className="text-sm font-black text-gray-600 uppercase tracking-widest flex items-center gap-2"><Stars size={16} className="text-paradise-ocean"/> 【BM専用】視点シミュレーション</span>
            <div className="flex flex-wrap justify-center gap-2">
                <button 
                  onClick={() => setViewMode(null)} 
                  className={`px-3 py-1.5 text-sm font-bold rounded-lg transition-colors ${!viewMode ? 'bg-paradise-sunset text-white shadow' : 'bg-white/50 text-gray-500 hover:bg-white'}`}
                >
                    BM
                </button>
                <button 
                  onClick={() => setViewMode('AM')} 
                  className={`px-3 py-1.5 text-sm font-bold rounded-lg transition-colors ${viewMode === 'AM' ? 'bg-paradise-sunset text-white shadow' : 'bg-white/50 text-gray-500 hover:bg-white'}`}
                >
                    AM<span className="hidden sm:inline">から見た画面</span>
                </button>
                <button 
                  onClick={() => setViewMode('店長')} 
                  className={`px-3 py-1.5 text-sm font-bold rounded-lg transition-colors ${viewMode === '店長' ? 'bg-paradise-sunset text-white shadow' : 'bg-white/50 text-gray-500 hover:bg-white'}`}
                >
                    店長<span className="hidden sm:inline">から見た画面</span>
                </button>
            </div>
        </div>
      )}

      {/* リマインダーポップアップ */}
      <AnimatePresence>
        {showReminderPopup && activeReminders.length > 0 && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-sm bg-white/95 backdrop-blur-xl p-6 rounded-[2rem] shadow-2xl border-4 border-red-400"
            >
              <div className="flex flex-col items-center text-center gap-2 mb-4">
                <div className="bg-red-100 text-red-500 p-3 rounded-full mb-2 animate-bounce">
                  <Megaphone size={32} />
                </div>
                <h3 className="text-xl font-black text-gray-800">提出期限のお知らせ</h3>
                <p className="text-sm font-bold text-gray-500">以下の項目がもうすぐ提出期限です</p>
              </div>

              <div className="space-y-3 my-6">
                {activeReminders.map(rem => (
                  <div key={rem.id} className="bg-red-50 border border-red-100 rounded-xl p-3 flex items-center gap-3">
                    <span className="text-2xl">{rem.icon}</span>
                    <div className="text-left">
                      <div className="text-sm font-black text-gray-800">{rem.title}</div>
                      <div className="text-xs font-bold text-red-500">{rem.time}</div>
                    </div>
                  </div>
                ))}
              </div>

              <button 
                onClick={dismissReminder}
                className="w-full bg-paradise-sunset text-white font-bold py-3 rounded-full shadow-lg hover:shadow-paradise-sunset/50 transition-all active:scale-95"
              >
                確認しました
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* お知らせポップアップ */}
      <AnimatePresence>
        {activeAnnouncements.length > 0 && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className={`w-full max-w-lg bg-white/95 backdrop-blur-xl p-6 rounded-[2rem] shadow-2xl border-4 ${activeAnnouncements[0].isImportant ? 'border-red-400' : 'border-paradise-ocean/50'}`}
            >
              <div className="flex items-center gap-3 mb-4 border-b border-gray-100 pb-4">
                {activeAnnouncements[0].isImportant ? (
                  <div className="bg-red-500 text-white p-2 rounded-xl animate-pulse">
                     <Megaphone size={24} />
                  </div>
                ) : (
                  <div className="bg-paradise-ocean/10 text-paradise-ocean p-2 rounded-xl">
                     <Megaphone size={24} />
                  </div>
                )}
                <div className="flex-1">
                  {activeAnnouncements[0].isImportant && <span className="text-xs font-black text-red-500 bg-red-100 px-2 py-0.5 rounded-full mb-1 inline-block uppercase">重要</span>}
                  <h3 className="text-xl font-black text-gray-800">{activeAnnouncements[0].title}</h3>
                  <div className="text-xs font-bold text-gray-400 mt-1">
                    {activeAnnouncements[0].authorName} ({activeAnnouncements[0].authorRole})
                  </div>
                </div>
              </div>

              <div className="max-h-[50vh] overflow-y-auto no-scrollbar prose prose-sm max-w-none text-gray-700 bg-white p-4 rounded-xl shadow-inner border border-gray-100 whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: activeAnnouncements[0].content }} />

              <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                {/* 見たよ以外にも直接「今後表示しない」を押せるようにする */}
                <button 
                  onClick={() => {
                    if (user) {
                      hideAnnouncement(activeAnnouncements[0].id, user.uid);
                      setSessionHiddenAnns(prev => [...prev, activeAnnouncements[0].id]);
                    }
                  }}
                  className="text-sm font-bold text-gray-400 hover:text-gray-600 underline underline-offset-2 w-full sm:w-auto text-center order-2 sm:order-1 active:scale-95 transition-transform"
                >
                  今後表示しない
                </button>
                
                <div className="flex gap-2 w-full sm:w-auto order-1 sm:order-2">
                  <button 
                    onClick={() => {
                        if (user) {
                           markAsSeen(activeAnnouncements[0].id, user.uid);
                           setSessionHiddenAnns(prev => [...prev, activeAnnouncements[0].id]);
                        }
                    }}
                    disabled={activeAnnouncements[0].seenBy?.includes(user?.uid || '')}
                    className={`flex-1 sm:flex-none px-6 py-3 rounded-full text-base font-bold flex items-center justify-center gap-2 transition-all ${
                      activeAnnouncements[0].seenBy?.includes(user?.uid || '') 
                        ? 'bg-gray-200 text-gray-500' 
                        : 'bg-paradise-sunset text-white shadow-xl hover:shadow-paradise-sunset/50 active:scale-95'
                    }`}
                  >
                    {activeAnnouncements[0].seenBy?.includes(user?.uid || '') ? <><Check size={16}/> みたよ済</> : '🏝️ みたよ！'}
                  </button>

                  {/* 「みたよ」を押した後、または一時的に閉じたい場合 */}
                  <button 
                    onClick={() => {
                        setSessionHiddenAnns(prev => [...prev, activeAnnouncements[0].id]);
                    }} 
                    className="flex-1 sm:flex-none bg-gray-100 text-gray-600 px-6 py-3 rounded-full text-base font-bold hover:bg-gray-200 transition-colors active:scale-95"
                  >
                    今は閉じる
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* フィルタバー */}

      <div className="flex gap-2 mb-8 overflow-x-auto pb-4 no-scrollbar px-2">
        {['すべて', '店長', 'AM'].filter(role => {
          if (role === 'AM' && activeRole === '店長') return false;
          return true;
        }).map((role) => (
          <button
            key={role}
            onClick={() => setFilterRole(role === 'すべて' ? null : role as any)}
            className={`px-6 py-2 rounded-full glass transition-all whitespace-nowrap font-bold text-base ${
              (filterRole === role || (role === 'すべて' && !filterRole))
                ? 'bg-paradise-sunset text-white border-none shadow-lg'
                : 'text-gray-600 hover:bg-white/60'
            }`}
          >
            {role}
          </button>
        ))}
      </div>

      {/* 月変更タブ */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2 no-scrollbar px-2">
        {availableMonths.map(month => {
          const [y, m] = month.split('-');
          return (
            <button
              key={month}
              onClick={() => setSelectedMonth(month)}
              className={`px-4 py-2 rounded-full border-2 transition-all whitespace-nowrap font-bold text-sm ${
                selectedMonth === month
                  ? 'border-paradise-ocean bg-paradise-ocean/10 text-paradise-ocean font-black'
                  : 'border-transparent bg-white/50 text-gray-500 hover:bg-white/80'
              }`}
            >
              {y}年{parseInt(m)}月
            </button>
          )
        })}
      </div>

      {/* レポートリスト - 月ごと・週ごとのツリー型表示 */}
      <div className="space-y-8 px-2">
         {Object.entries(groupedByWeek as Record<string, any[]>).sort((a, b) => Number(b[0]) - Number(a[0])).map(([weekNum, weekReports]) => (
            <div key={weekNum} className="space-y-4">
               {/* ツリー型の親（週）の表示 */}
               <div className="flex items-center gap-2 text-paradise-ocean font-black border-b-2 border-paradise-ocean/20 pb-2">
                  <div className="w-6 h-6 rounded-md bg-paradise-ocean/20 flex items-center justify-center text-xs">W</div>
                  <h3 className="text-lg text-gray-700">第 {weekNum} 週</h3>
                  <span className="text-xs bg-paradise-ocean text-white px-2 py-0.5 rounded-full">{weekReports.length} 件</span>
               </div>
               
               <div className="grid gap-4 ml-3 border-l-2 border-paradise-ocean/20 pl-4 py-2 relative">
                 {weekReports.map((report, index) => {
                    const isExpanded = expandedIds.includes(report.id);
                    return (
                        <div key={report.id} className="relative">
                            {/* ツリーの枝の線 */}
                            <div className="absolute -left-4 top-10 w-4 h-[2px] bg-paradise-ocean/20"></div>
                            
                            <motion.div
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.05 }}
                              onClick={() => navigate(`/report/${report.id}`)}
                              className="cursor-pointer"
                            >
                            <GlassCard className={`relative overflow-hidden group transition-all duration-300 shadow-sm hover:shadow-md ${isExpanded ? 'p-6' : 'p-3'} ${!report.readBy?.includes(user?.uid || '') ? 'border-l-4 border-l-paradise-sunset' : 'border-gray-200/50'}`}>
                                {/* 投稿日と既読バッジとリアクション */}
                                <div className="flex items-center justify-between z-10 mb-2">
                                  <div className="flex items-center gap-2 flex-wrap">
                                     <span className="text-[10px] font-bold text-gray-500 bg-white/80 px-1.5 py-0.5 rounded-full shadow-sm">
                                        {new Date(report.createdAt).toLocaleDateString()}
                                     </span>
                                     {!report.readBy?.includes(user?.uid || '') && (
                                       <span className="flex h-2 w-2 shrink-0">
                                          <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-paradise-sunset opacity-75"></span>
                                          <span className="relative inline-flex rounded-full h-2 w-2 bg-paradise-sunset"></span>
                                       </span>
                                     )}
                                     {report.reactions.map((reaction, i) => (
                                       <div key={i} className="flex items-center gap-1 bg-white/80 px-1.5 py-0.5 rounded-full shadow-sm border border-gray-100/50">
                                         {getReactionIcon(reaction.type, 12)}
                                         <span className="text-[10px] font-bold text-gray-600">{reaction.count}</span>
                                       </div>
                                     ))}
                                     {report.commentCount > 0 && (
                                       <div className="flex items-center gap-1 bg-white/80 px-1.5 py-0.5 rounded-full shadow-sm border border-gray-100/50">
                                         <MessageCircle size={12} className="text-blue-400" />
                                         <span className="text-[10px] font-bold text-gray-600">{report.commentCount}</span>
                                       </div>
                                     )}
                                  </div>
                                </div>

                                {/* 装飾用の光 */}
                                <div className="absolute -top-10 -right-10 w-32 h-32 bg-paradise-mint/5 rounded-full blur-3xl group-hover:bg-paradise-mint/10 transition-all duration-700" />
                                
                                <div className="flex items-center justify-between gap-4">
                                  <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <div className="w-10 h-10 rounded-xl bg-white/60 flex items-center justify-center text-xl shadow-inner border border-white/60 overflow-hidden shrink-0">
                                      {report.authorPhotoURL ? (
                                        <img src={report.authorPhotoURL} alt={report.authorName} className="w-full h-full object-cover" />
                                      ) : (
                                        report.authorRole === '店長' ? '🏠' : report.authorRole === 'AM' ? '💼' : '🌟'
                                      )}
                                    </div>
                                    <div className="min-w-0 flex flex-col sm:flex-row sm:items-center sm:gap-3">
                                      <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-black text-white bg-paradise-ocean/60 px-1.5 py-0.5 rounded shadow-sm uppercase tracking-widest shrink-0">
                                          {report.authorRole}
                                        </span>
                                        <h3 className="text-base font-bold text-gray-800 truncate">{report.authorName}</h3>
                                      </div>
                                      <span className="text-xs font-bold text-gray-500 truncate sm:border-l sm:pl-3 border-gray-200">
                                        {report.storeName}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-4 shrink-0">
                                    <div className="text-right flex flex-col items-end">
                                      <button 
                                        onClick={(e) => toggleExpand(e, report.id)}
                                        className="p-1 hover:bg-white/50 rounded-lg transition-colors text-gray-400 hover:text-paradise-ocean mt-1"
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
                                      <div className="mt-6 pt-6 border-t border-gray-100/50 space-y-6">
                                        <section>
                                          <label className="text-xs font-black text-paradise-sunset uppercase tracking-[0.2em] mb-1.5 block">キープ</label>
                                          <div className="text-sm text-gray-700 leading-relaxed font-medium line-clamp-3 prose prose-sm max-w-none whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: report.keep }} />
                                        </section>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                          <section className="bg-white/40 p-4 rounded-2xl border border-white/40">
                                            <label className="text-xs font-black text-red-500 uppercase tracking-[0.2em] mb-1 block">問題点</label>
                                            <div className="text-sm text-gray-700 line-clamp-2 prose prose-sm max-w-none whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: report.problem_gap }} />
                                          </section>
                                          <section className="bg-white/40 p-4 rounded-2xl border border-white/40">
                                            <label className="text-xs font-black text-paradise-ocean uppercase tracking-[0.2em] mb-1 block">挑戦</label>
                                            <p className="text-sm text-gray-700 line-clamp-2">{report.try_what}</p>
                                          </section>
                                        </div>

                                        <div className="flex justify-between items-center bg-white/40 p-3 rounded-2xl border border-white/50">
                                          <div className="flex gap-2">
                                             {report.reactions.map((reaction, i) => (
                                               <div key={i} className="flex items-center gap-1 bg-white/60 px-2.5 py-1 rounded-full text-xs font-bold text-gray-600 border border-gray-100">
                                                 {getReactionIcon(reaction.type)} {reaction.count}
                                               </div>
                                             ))}
                                             {report.commentCount > 0 && (
                                               <div className="flex items-center gap-1 bg-white/60 px-2.5 py-1 rounded-full text-xs font-bold text-gray-600 border border-gray-100">
                                                 <MessageCircle size={14} className="text-blue-400" /> {report.commentCount}
                                               </div>
                                             )}
                                          </div>
                                          <div className="flex items-center gap-1 text-[10px] font-black text-paradise-ocean uppercase bg-white/50 px-3 py-1.5 rounded-full hover:bg-white transition-colors">
                                            詳細を開く <ChevronRight size={12} />
                                          </div>
                                        </div>
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </GlassCard>
                            </motion.div>
                        </div>
                    );
                 })}
               </div>
            </div>
         ))}
      </div>

      {/* 空の状態 */}
      {Object.keys(groupedByWeek).length === 0 && (
        <div className="text-center py-20 opacity-50">
          <p className="text-xl font-bold text-gray-400">レポートがまだありません</p>
          <p className="text-base text-gray-300 mt-2">あなたの体験を最初のレポートにしましょう 🌴</p>
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
