import React, { useState, useEffect } from 'react';
import { GlassCard } from '../components/ui/GlassCard';
import { MultiUserSelect } from '../components/ui/MultiUserSelect';
import { Calendar as CalendarIcon, Plus, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
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

export const CalendarView = () => {
  const { user, viewMode } = useAuthStore();
  const [tasks, setTasks] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');
  const [selectedAssignees, setSelectedAssignees] = useState<AppUser[]>([]);
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'tasks'), orderBy('date', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      console.error('Calendar tasks snapshot error:', error);
    });
    return () => unsub();
  }, []);

  const handleAddTask = async () => {
    if(!title || !date) return;
    await addDoc(collection(db, 'tasks'), {
      title,
      date,
      description,
      assignees: selectedAssignees.map(u => ({ uid: u.uid, name: u.name })),
      authorId: user?.uid,
      authorRole: user?.role,
      createdAt: new Date().toISOString()
    });
    setShowForm(false);
    setTitle('');
    setDate('');
    setDescription('');
    setSelectedAssignees([]);
  };

  const handleDelete = async (id: string) => {
    if(window.confirm('削除しますか？')) {
      await deleteDoc(doc(db, 'tasks', id));
    }
  };

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

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
        const dayTasks = validTasks.filter(t => t.date === format(cloneDay, 'yyyy-MM-dd'));

        days.push(
          <div
            className={`min-h-[80px] p-1 border-b border-r border-gray-100 relative cursor-pointer hover:bg-white/50 transition-colors ${
              !isSameMonth(day, monthStart)
                ? "bg-gray-50/50 text-gray-300"
                : isSameDay(day, new Date()) ? "bg-paradise-mint/10 text-paradise-ocean font-bold" : "bg-white/30 text-gray-700"
            } ${selectedDate && isSameDay(day, selectedDate) ? 'ring-2 ring-inset ring-paradise-ocean shadow-inner' : ''}`}
            key={day.toString()}
            onClick={() => {
               setSelectedDate(cloneDay);
               setDate(format(cloneDay, 'yyyy-MM-dd'));
            }}
          >
            <div className="text-right text-sm pr-1">{formattedDate}</div>
            <div className="flex flex-col gap-1 mt-1 px-1 overflow-y-auto max-h-[50px] no-scrollbar">
              {dayTasks.map(t => (
                <div key={t.id} className="text-[10px] bg-white border border-paradise-ocean/20 text-paradise-ocean rounded px-1 truncate shadow-sm font-bold" title={t.title}>
                  {t.title}
                </div>
              ))}
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
      days.push(
        <div className="text-center font-bold text-sm py-2 text-gray-500 uppercase tracking-widest bg-white/60" key={i}>
          {format(addDays(startDate, i), "E", { locale: ja })}
        </div>
      );
    }
    return <div className="grid grid-cols-7 rounded-t-2xl overflow-hidden border-b border-gray-100">{days}</div>;
  };

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

  const tasksToDisplay = selectedDate 
    ? validTasks.filter(t => t.date === format(selectedDate, 'yyyy-MM-dd'))
    : validTasks.filter(t => new Date(t.date) >= new Date(new Date().setHours(0,0,0,0))); // upcoming

  return (
    <div className="max-w-5xl mx-auto space-y-6 pt-6 pb-24 px-4 flex flex-col md:flex-row gap-6">
      
      {/* Calendar Area */}
      <div className="flex-[2] space-y-4">
        <div className="flex justify-between items-center bg-white/50 p-4 rounded-3xl border border-white/50 backdrop-blur-md shadow-sm">
           <button onClick={prevMonth} className="p-2 hover:bg-white rounded-full transition-colors text-gray-500"><ChevronLeft/></button>
           <h2 className="text-xl font-black text-gray-800 tracking-widest">
             {format(currentDate, "yyyy年 M月")}
           </h2>
           <button onClick={nextMonth} className="p-2 hover:bg-white rounded-full transition-colors text-gray-500"><ChevronRight/></button>
        </div>

        <GlassCard className="p-0 overflow-hidden border-2 border-white/40 shadow-xl">
          {renderDays()}
          {renderCells()}
        </GlassCard>
      </div>

      {/* Task List / Form Area */}
      <div className="flex-1 space-y-4">
        <div className="flex justify-between items-center bg-white/50 p-4 rounded-3xl border border-white/50 backdrop-blur-md shadow-sm">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
             <CalendarIcon size={18} className="text-paradise-ocean" /> 
             {selectedDate ? format(selectedDate, "M/d のタスク") : "今後のタスク"}
          </h3>
          <button 
            onClick={() => setShowForm(!showForm)}
            className="bg-paradise-ocean text-white p-2 rounded-xl shadow-md active:scale-95"
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
              className="bg-white/80 backdrop-blur-md p-5 rounded-3xl border border-white/50 shadow-xl space-y-3 overflow-hidden"
            >
               <div>
                 <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-1">タイトル</label>
                 <input type="text" value={title} onChange={(e)=>setTitle(e.target.value)} className="w-full p-2 border rounded-xl outline-none focus:border-paradise-ocean text-base" placeholder="イベント名" />
               </div>
               <div className="grid grid-cols-2 gap-2">
                 <div>
                   <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-1">日付</label>
                   <input type="date" value={date} onChange={(e)=>setDate(e.target.value)} className="w-full p-2 border rounded-xl outline-none focus:border-paradise-ocean text-xs" />
                 </div>
                 <div>
                   <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-1">担当</label>
                   <MultiUserSelect selectedUsers={selectedAssignees} onChange={setSelectedAssignees} placeholder="担当者を選択" />
                 </div>
               </div>
               <div>
                 <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-1">詳細・備考</label>
                 <textarea 
                   value={description} 
                   onChange={(e)=>setDescription(e.target.value)} 
                   className="w-full p-2 border rounded-xl outline-none focus:border-paradise-ocean text-sm h-16 resize-none" 
                   placeholder="任意"
                 />
               </div>
               <button onClick={handleAddTask} className="w-full bg-paradise-mint text-white py-2 rounded-xl font-bold text-base shadow-md mt-2">登録</button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-3 max-h-[500px] overflow-y-auto no-scrollbar pb-6">
          {tasksToDisplay.length === 0 ? (
            <div className="text-center p-6 bg-white/30 rounded-3xl border border-white/40 border-dashed text-gray-400 font-bold text-base">
              予定はありません
            </div>
          ) : (
            tasksToDisplay.map(task => (
              <GlassCard key={task.id} className="p-4 border-l-4 border-l-paradise-mint flex flex-col gap-2">
                <div className="flex justify-between items-start">
                  <h4 className="font-bold text-gray-800 text-base leading-tight pr-6">{task.title}</h4>
                  {(user?.role === 'BM' || user?.role === 'AM' || task.authorId === user?.uid) && (
                    <button onClick={() => handleDelete(task.id)} className="text-gray-400 hover:text-red-500 bg-white/50 p-1.5 rounded-full transition-all active:scale-95 shadow-sm -mr-1">
                      <X size={14} />
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
                       <div key={a.uid} className="bg-paradise-ocean/10 text-paradise-ocean px-2 py-0.5 rounded-md shrink-0">{a.name}</div>
                     ))
                   ) : (
                     <div className="bg-paradise-ocean/10 text-paradise-ocean px-2 py-0.5 rounded-md shrink-0">{task.assignee || '全員'}</div>
                   )}
                </div>
              </GlassCard>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
