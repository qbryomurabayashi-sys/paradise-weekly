import React, { useState, useEffect } from 'react';
import { GlassCard } from '../components/ui/GlassCard';
import { MultiUserSelect } from '../components/ui/MultiUserSelect';
import { Calendar as CalendarIcon, Plus, X, ChevronLeft, ChevronRight, Check, AlertTriangle } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, limit } from 'firebase/firestore';
import { useAuthStore } from '../store/useAuthStore';
import { motion, AnimatePresence } from 'framer-motion';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameMonth, isSameDay, addDays, parseISO } from 'date-fns';
import { ja } from 'date-fns/locale';

interface AppUser {
  uid: string;
  name: string;
  role: string;
  storeName: string;
}

import { useUsersStore } from '../store/useUsersStore';
import { displayRole, formatStaffName } from '../lib/formatUtils';

let _calendarTasksUnsub: any = null;
let _cachedCalendarTasks: any[] = [];

export const CalendarView = () => {
  const { user, viewMode } = useAuthStore();
  const { users } = useUsersStore();
  const [tasks, setTasks] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');
  const [selectedAssignees, setSelectedAssignees] = useState<AppUser[]>([]);
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedAuthorFilter, setSelectedAuthorFilter] = useState<string>('all');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);
  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => setToast({ msg, type });
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!_calendarTasksUnsub) {
      _calendarTasksUnsub = true;
      const loadTasks = async () => {
        try {
          const { getDocs } = await import('firebase/firestore');
          const q = query(collection(db, 'tasks'), orderBy('date', 'asc'), limit(500));
          const snap = await getDocs(q);
          _cachedCalendarTasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          setTasks(_cachedCalendarTasks);
        } catch (error: any) {
          if (error?.message?.includes('Quota') || error?.code === 'resource-exhausted') {
            document.dispatchEvent(new CustomEvent('quota-exceeded'));
          } else {
            console.error('Calendar tasks fetch error:', error);
          }
        }
      };
      loadTasks();
    } else {
      setTasks(_cachedCalendarTasks);
    }
    return () => {};
  }, []);

  const getUserColor = (userId: string) => {
    if (!userId) return { bg: 'bg-paradise-ocean/10', border: 'border-paradise-ocean/20', text: 'text-paradise-ocean', solid: 'bg-paradise-ocean', borderL: 'border-l-paradise-ocean' };
    
    // Check if the user is Matsusaka (松阪 or 松坂)
    const matchedUser = users.find(u => u.uid === userId);
    const matchedTask = tasks.find(t => t.authorId === userId);
    const userName = (matchedUser?.name || matchedTask?.authorName || '').trim();

    if (
      userName.includes('松阪') ||
      userName.includes('松坂') ||
      userId.includes('松阪') ||
      userId.includes('松坂')
    ) {
      return { 
        bg: 'bg-paradise-pink/10', 
        border: 'border-paradise-pink/20', 
        text: 'text-paradise-pink', 
        solid: 'bg-paradise-pink', 
        borderL: 'border-l-paradise-pink' 
      };
    }

    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colorSchemes = [
      { bg: 'bg-paradise-ocean/10', border: 'border-paradise-ocean/20', text: 'text-paradise-ocean', solid: 'bg-paradise-ocean', borderL: 'border-l-paradise-ocean' },
      { bg: 'bg-paradise-pink/10', border: 'border-paradise-pink/20', text: 'text-paradise-pink', solid: 'bg-paradise-pink', borderL: 'border-l-paradise-pink' },
      { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-600', solid: 'bg-emerald-500', borderL: 'border-l-emerald-500' },
      { bg: 'bg-orange-500/10', border: 'border-orange-500/20', text: 'text-orange-600', solid: 'bg-orange-500', borderL: 'border-l-orange-500' },
      { bg: 'bg-purple-500/10', border: 'border-purple-500/20', text: 'text-purple-600', solid: 'bg-purple-500', borderL: 'border-l-purple-500' },
      { bg: 'bg-indigo-500/10', border: 'border-indigo-500/20', text: 'text-indigo-600', solid: 'bg-indigo-500', borderL: 'border-l-indigo-500' },
      { bg: 'bg-rose-500/10', border: 'border-rose-500/20', text: 'text-rose-600', solid: 'bg-rose-500', borderL: 'border-l-rose-500' },
      { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-600', solid: 'bg-amber-500', borderL: 'border-l-amber-500' },
      { bg: 'bg-lime-500/10', border: 'border-lime-500/20', text: 'text-lime-600', solid: 'bg-lime-500', borderL: 'border-l-lime-500' },
      { bg: 'bg-cyan-500/10', border: 'border-cyan-500/20', text: 'text-cyan-600', solid: 'bg-cyan-500', borderL: 'border-l-cyan-500' },
      { bg: 'bg-fuchsia-500/10', border: 'border-fuchsia-500/20', text: 'text-fuchsia-600', solid: 'bg-fuchsia-500', borderL: 'border-l-fuchsia-500' },
      { bg: 'bg-pink-500/10', border: 'border-pink-500/20', text: 'text-pink-600', solid: 'bg-pink-500', borderL: 'border-l-pink-500' },
      { bg: 'bg-sky-500/10', border: 'border-sky-500/20', text: 'text-sky-600', solid: 'bg-sky-500', borderL: 'border-l-sky-500' },
      { bg: 'bg-violet-500/10', border: 'border-violet-500/20', text: 'text-violet-600', solid: 'bg-violet-500', borderL: 'border-l-violet-500' },
      { bg: 'bg-teal-500/10', border: 'border-teal-500/20', text: 'text-teal-600', solid: 'bg-teal-500', borderL: 'border-l-teal-500' },
      { bg: 'bg-blue-600/10', border: 'border-blue-600/20', text: 'text-blue-700', solid: 'bg-blue-600', borderL: 'border-l-blue-600' }
    ];
    return colorSchemes[Math.abs(hash) % colorSchemes.length];
  };

  const handleAddTask = async () => {
    if(!title || !date) return;
    await addDoc(collection(db, 'tasks'), {
      title,
      date,
      description,
      assignees: selectedAssignees.map(u => ({ uid: u.uid, name: u.name })),
      authorId: user?.uid,
      authorRole: user?.role,
      authorName: user?.name,
      createdAt: new Date().toISOString()
    });
    setShowForm(false);
    setTitle('');
    setDate('');
    setDescription('');
    setSelectedAssignees([]);
    showToast('予定を登録しました', 'success');
  };

  const doDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'tasks', id));
      showToast('予定を削除しました', 'success');
    } catch {
      showToast('削除に失敗しました', 'error');
    } finally {
      setConfirmDelete(null);
    }
  };

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  const isBM = user?.role === 'BM';
  const activeRole = isBM && viewMode ? viewMode : user?.role;

  const validTasks = tasks.filter(t => {
    if (t.authorRole === 'AM') {
      if (activeRole === 'AM' || activeRole === 'BM') return true;
      if (t.assignees?.some((a: any) => a.uid === user?.uid)) return true;
      return false;
    }
    return true;
  });

  const filteredValidTasks = selectedAuthorFilter === 'all' 
    ? validTasks 
    : validTasks.filter(t => t.authorId === selectedAuthorFilter);

  const uniqueAuthors = Array.from(
    new Map(
      validTasks.filter(t => t.authorId).map(t => [
        t.authorId, 
        { 
          uid: t.authorId, 
          name: t.authorName || users.find(u => u.uid === t.authorId)?.name 
        }
      ])
    ).values()
  );

  const tasksToDisplay = selectedDate 
    ? filteredValidTasks.filter(t => t.date === format(selectedDate, 'yyyy-MM-dd'))
    : filteredValidTasks.filter(t => new Date(t.date) >= new Date(new Date().setHours(0,0,0,0))); // upcoming

  const renderCells = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const dateFormat = "d";
    const rows = [];
    let days = [];
    let day = startDate;
    let formattedDate = "";

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        formattedDate = format(day, dateFormat);
        const cloneDay = day;
        
        // Find tasks for this day
        const dayTasks = filteredValidTasks.filter(t => t.date === format(cloneDay, 'yyyy-MM-dd'));

        const isToday = isSameDay(day, new Date());
        const isSelected = selectedDate && isSameDay(day, selectedDate);
        days.push(
          <div
            className={`min-h-[72px] sm:min-h-[88px] p-1 border-b border-r border-line relative cursor-pointer transition-colors ${
              !isSameMonth(day, monthStart)
                ? "bg-canvas/60 text-qb-gray-light"
                : "bg-surface text-ink hover:bg-canvas"
            } ${isSelected ? 'ring-2 ring-inset ring-qb-cyan bg-qb-cyan/5' : ''}`}
            key={day.toString()}
            onClick={() => {
               setSelectedDate(cloneDay);
               setDate(format(cloneDay, 'yyyy-MM-dd'));
            }}
          >
            <div className="flex items-center justify-between px-0.5">
              <span className="flex-1">
                {dayTasks.length > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-qb-blue text-white text-[11px] font-black tabular">
                    {dayTasks.length}
                  </span>
                )}
              </span>
              <span className={`text-sm font-bold tabular ${isToday ? 'inline-flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br from-qb-blue to-qb-cyan text-white' : ''}`}>
                {formattedDate}
              </span>
            </div>
            <div className="flex flex-col gap-0.5 mt-1 overflow-hidden max-h-[46px] sm:max-h-[52px]">
              {dayTasks.slice(0, 3).map(t => {
                const colors = getUserColor(t.authorId);
                return (
                  <div key={t.id} className={`flex items-center gap-1 rounded px-1 py-0.5 ${colors.bg}`} title={t.title}>
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${colors.solid}`}></span>
                    <span className={`text-xs ${colors.text} truncate font-bold leading-none`}>{t.title}</span>
                  </div>
                );
              })}
              {dayTasks.length > 3 && (
                <span className="text-xs text-qb-gray font-bold pl-1 leading-none">＋{dayTasks.length - 3}件</span>
              )}
            </div>
          </div>
        );
        day = addDays(day, 1);
      }
      rows.push(
        <div className="grid grid-cols-7" key={day.toString()}>
          {days}
        </div>
      );
      days = [];
    }
    return <div className="border-l border-t border-gray-100 rounded-b-2xl overflow-hidden bg-white/40 backdrop-blur-md">{rows}</div>;
  };

  const renderDays = () => {
    const days = [];
    const startDate = startOfWeek(currentDate);
    for (let i = 0; i < 7; i++) {
      const dow = addDays(startDate, i).getDay();
      const color = dow === 0 ? 'text-danger' : dow === 6 ? 'text-qb-blue' : 'text-ink-soft';
      days.push(
        <div className={`text-center font-black text-sm py-2 tracking-wide bg-canvas ${color}`} key={i}>
          {format(addDays(startDate, i), "E", { locale: ja })}
        </div>
      );
    }
    return <div className="grid grid-cols-7 rounded-t-2xl overflow-hidden border-b border-line">{days}</div>;
  };

  return (
    <div className="max-w-5xl mx-auto pt-6 pb-24 px-4 flex flex-col md:flex-row gap-6">

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 px-4 py-3 rounded-2xl shadow-xl font-bold text-sm text-white"
            style={{ background: toast.type === 'error' ? '#E60000' : toast.type === 'info' ? '#005AAF' : '#17B26A' }}
          >
            {toast.type === 'error' ? <AlertTriangle size={18} /> : <Check size={18} />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete confirm */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/40 backdrop-blur-sm px-6"
            onClick={() => setConfirmDelete(null)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
              className="bg-surface rounded-3xl p-6 w-full max-w-xs shadow-2xl text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-12 mx-auto rounded-2xl bg-danger/10 flex items-center justify-center mb-3">
                <AlertTriangle size={24} className="text-danger" />
              </div>
              <p className="font-black text-ink text-base mb-1">予定を削除しますか？</p>
              <p className="text-xs text-ink-soft mb-5">この操作は取り消せません</p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmDelete(null)} className="tap flex-1 bg-canvas text-ink-soft rounded-xl font-bold border border-line">やめる</button>
                <button onClick={() => doDelete(confirmDelete)} className="tap flex-1 bg-danger text-white rounded-xl font-black shadow-md">削除する</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>


      {/* Calendar Area */}
      <div className="flex-[2] space-y-4">
        <div className="flex justify-between items-center bg-surface p-3 rounded-3xl border border-line shadow-sm">
           <button onClick={prevMonth} className="tap hover:bg-canvas rounded-full transition-colors text-ink-soft flex items-center justify-center"><ChevronLeft/></button>
           <h2 className="text-xl font-black text-ink tracking-wide tabular">
             {format(currentDate, "yyyy年 M月")}
           </h2>
           <button onClick={nextMonth} className="tap hover:bg-canvas rounded-full transition-colors text-ink-soft flex items-center justify-center"><ChevronRight/></button>
        </div>

        {uniqueAuthors.length > 0 && (
          <div className="flex bg-surface p-2 rounded-2xl border border-line shadow-sm overflow-x-auto no-scrollbar gap-2 items-center">
            <span className="text-xs font-bold text-ink-soft tracking-wide whitespace-nowrap pl-2">フィルター</span>
            <button
              onClick={() => setSelectedAuthorFilter('all')}
              className={`min-h-[36px] px-3 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                selectedAuthorFilter === 'all'
                  ? 'bg-gradient-to-r from-qb-blue to-qb-cyan text-white shadow-md'
                  : 'bg-canvas hover:bg-line text-ink-soft'
              }`}
            >
              すべて
            </button>
            {uniqueAuthors.map(author => {
              const colors = getUserColor(author.uid);
              const isActive = selectedAuthorFilter === author.uid;
              return (
                <button
                  key={author.uid}
                  onClick={() => setSelectedAuthorFilter(isActive ? 'all' : author.uid)}
                  className={`min-h-[36px] px-3 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center justify-center border ${
                    isActive
                      ? `${colors.bg} ${colors.text} ${colors.border} shadow-md ring-2 ${colors.solid.replace('bg-', 'ring-')}/50`
                      : `bg-canvas hover:bg-line text-ink-soft border-transparent`
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full mr-1.5 ${colors.solid}`}></div>
                  {author.name ? formatStaffName(author.name) : 'メンバー'}
                </button>
              );
            })}
          </div>
        )}

        <GlassCard className="p-0 overflow-hidden border border-line shadow-xl">
          {renderDays()}
          {renderCells()}
        </GlassCard>
      </div>

      {/* Task List / Form Area */}
      <div className="flex-1 space-y-4">
        <div className="flex justify-between items-center bg-surface p-3 rounded-3xl border border-line shadow-sm">
          <h3 className="font-black text-ink flex items-center gap-2 text-base">
             <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-qb-blue to-qb-cyan flex items-center justify-center shrink-0">
               <CalendarIcon size={18} className="text-white" />
             </span>
             {selectedDate ? format(selectedDate, "M/d のタスク") : "今後のタスク"}
          </h3>
          <button
            onClick={() => setShowForm(!showForm)}
            className="tap bg-gradient-to-br from-qb-blue to-qb-cyan text-white rounded-xl shadow-md active:scale-95 flex items-center justify-center"
          >
            {showForm ? <X size={18} /> : <Plus size={18} />}
          </button>
        </div>

        <AnimatePresence>
          {showForm && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-surface p-5 rounded-3xl border border-line shadow-xl space-y-3 overflow-hidden"
            >
               <div>
                 <label className="text-xs font-bold text-ink-soft tracking-wide block mb-1">タイトル</label>
                 <input type="text" value={title} onChange={(e)=>setTitle(e.target.value)} enterKeyHint="next" autoComplete="off" className="w-full min-h-[44px] px-3 border border-line rounded-xl outline-none focus:ring-2 focus:ring-qb-cyan focus:border-qb-cyan text-base bg-canvas" placeholder="イベント名" />
               </div>
               <div className="grid grid-cols-2 gap-2">
                 <div>
                   <label className="text-xs font-bold text-ink-soft tracking-wide block mb-1">日付</label>
                   <input type="date" value={date} onChange={(e)=>setDate(e.target.value)} className="w-full min-h-[44px] px-3 border border-line rounded-xl outline-none focus:ring-2 focus:ring-qb-cyan focus:border-qb-cyan text-sm bg-canvas tabular" />
                 </div>
                 <div>
                   <label className="text-xs font-bold text-ink-soft tracking-wide block mb-1">担当</label>
                   <MultiUserSelect selectedUsers={selectedAssignees} onChange={setSelectedAssignees} placeholder="担当者を選択" />
                 </div>
               </div>
               <div>
                 <label className="text-xs font-bold text-ink-soft tracking-wide block mb-1">詳細・備考</label>
                 <textarea
                   value={description}
                   onChange={(e)=>setDescription(e.target.value)}
                   enterKeyHint="done"
                   className="w-full p-3 border border-line rounded-xl outline-none focus:ring-2 focus:ring-qb-cyan focus:border-qb-cyan text-sm h-16 resize-none bg-canvas"
                   placeholder="任意"
                 />
               </div>
               <button onClick={handleAddTask} disabled={!title || !date} className="tap w-full bg-gradient-to-r from-qb-blue to-qb-cyan text-white rounded-xl font-black text-base shadow-md mt-2 disabled:opacity-40 disabled:grayscale">登録</button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-3 max-h-[500px] overflow-y-auto no-scrollbar pb-6">
          {tasksToDisplay.length === 0 ? (
            <div className="text-center p-6 bg-canvas rounded-3xl border border-line border-dashed text-qb-gray font-bold text-base">
              予定はありません
            </div>
          ) : (
            tasksToDisplay.map(task => {
              const colors = getUserColor(task.authorId);
              const rawAuthorName = task.authorName || users.find(u => u.uid === task.authorId)?.name || 'メンバー';
              const authorName = rawAuthorName === 'メンバー' ? 'メンバー' : formatStaffName(rawAuthorName);
              return (
              <GlassCard key={task.id} className={`p-4 border-l-4 ${colors.borderL} flex flex-col gap-2 relative overflow-hidden`}>
                <div className={`absolute top-0 right-0 px-2 py-0.5 text-xs font-bold ${colors.bg} ${colors.text} rounded-bl-lg`}>
                  @{authorName}
                </div>
                <div className="flex justify-between items-start mt-2">
                  <h4 className="font-bold text-gray-800 text-base leading-tight pr-6">{task.title}</h4>
                  {(user?.role === 'BM' || user?.role === 'AM' || task.authorId === user?.uid) && (
                    <button onClick={() => setConfirmDelete(task.id)} className="tap text-qb-gray hover:text-danger bg-canvas rounded-full transition-all active:scale-95 shadow-sm -mr-1 flex items-center justify-center">
                      <X size={16} />
                    </button>
                  )}
                </div>
                {task.description && (
                  <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{task.description}</p>
                )}
                <div className="flex items-center gap-2 text-xs font-bold text-gray-500 overflow-x-auto no-scrollbar py-1">
                   <div className="bg-white/60 px-2 py-0.5 rounded-md border border-gray-100 shrink-0">{task.date}</div>
                   {task.assignees && task.assignees.length > 0 ? (
                     task.assignees.map((a: any) => (
                       <div key={a.uid} className={`${colors.bg} ${colors.text} px-2 py-0.5 rounded-md shrink-0 flex items-center`}>{formatStaffName(a.name)}</div>
                     ))
                   ) : (
                     <div className={`${colors.bg} ${colors.text} px-2 py-0.5 rounded-md shrink-0`}>{task.assignee ? formatStaffName(task.assignee) : '全員'}</div>
                   )}
                </div>
              </GlassCard>
            )})
          )}
        </div>
      </div>
    </div>
  );
};
