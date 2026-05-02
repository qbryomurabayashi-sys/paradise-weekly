import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from '../components/ui/GlassCard';
import { auth, db } from '../lib/firebase';
import { doc, getDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useReportStore } from '../store/useReportStore';
import { useAuthStore } from '../store/useAuthStore';
import { ChevronRight, ChevronLeft, Send, Sparkles, Check, Info, Plus, X, Calendar as CalendarIcon } from 'lucide-react';
import { MultiUserSelect } from '../components/ui/MultiUserSelect';
import { getFiscalWeek } from '../lib/dateUtils';

const STEPS = [
  { id: 'info', title: '【#店長週間報告】', desc: '*毎週日曜日18:00まで', fields: ['storeName', 'authorName'] },
  { id: 'keep', title: '⭕ Keep（続けること）', desc: '今週「おっ、いい感じだな」と思った小さな成功や工夫は何ですか？', fields: ['keep'] },
  { id: 'problem', title: '🔺 Problem（問題）', desc: '今週「あれ？」と気になった出来事（GAP）は何ですか？ ※「本来どうあるべきだったか」もセットで書いてください', fields: ['problem_gap', 'problem_ideal'] },
  { id: 'try', title: '🏃 Try（来週の実験）', desc: 'そのGAPを埋めるために、来週はどんな行動をしてみますか？ ※失敗してもOK！「誰が・いつ・どうする」だけ具体的に決めてみましょう', fields: ['try_who', 'try_when', 'try_what'] },
  { id: 'confirm', title: '最終確認', desc: '最後に見直しましょう', fields: [] },
];

export const PostReport = () => {
  const { id } = useParams();
  const [step, setStep] = useState(0);
  const { user, viewMode } = useAuthStore();
  const isBM = user?.role === 'BM';
  const activeRole = isBM && viewMode ? viewMode : user?.role;

  const getSteps = () => {
    const base = [
      { id: 'info', title: '【#店長週間報告】', desc: '*毎週日曜日18:00まで', fields: ['storeName', 'authorName'] },
      { id: 'keep', title: '⭕ Keep（続けること）', desc: '今週「おっ、いい感じだな」と思った小さな成功や工夫は何ですか？', fields: ['keep'] },
      { id: 'problem', title: '🔺 Problem（問題）', desc: '今週「あれ？」と気になった出来事（GAP）は何ですか？ ※「本来どうあるべきだったか」もセットで書いてください', fields: ['problem_gap', 'problem_ideal'] },
      { id: 'try', title: '🏃 Try（来週の実験）', desc: 'そのGAPを埋めるために、来週はどんな行動をしてみますか？ ※失敗してもOK！「誰が・いつ・どうする」だけ具体的に決めてみましょう', fields: ['try_who', 'try_when', 'try_what'] },
    ];
    if (activeRole === 'AM') {
      base.push({ id: 'tasks', title: '📝 翌週のタスク洗い出し', desc: '誰が、何を、いつまでにやるか、複数登録できます（カレンダーに反映されます）', fields: [] });
    }
    base.push({ id: 'confirm', title: '最終確認', desc: '最後に見直しましょう', fields: [] });
    return base;
  };

  const currentSteps = getSteps();

  const [formData, setFormData] = useState<any>({
    storeName: user?.storeName || '',
    authorName: user?.name || '',
    keep: '',
    problem_gap: '',
    problem_ideal: '',
    try_who: '自分とチーム',
    try_when: '来週の月曜日から',
    try_what: '',
    try_why: '',
    tasks: [] // Array of { title, date, assignees, description }
  });
  const [isEditMode, setIsEditMode] = useState(false);
  const navigate = useNavigate();
  const { addReport, updateReport } = useReportStore();

  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDate, setNewTaskDate] = useState('');
  const [newTaskAssignees, setNewTaskAssignees] = useState<any[]>([]);
  const [newTaskDesc, setNewTaskDesc] = useState('');

  const handleAddTask = () => {
    if (!newTaskTitle || !newTaskDate) return;
    const newTask = {
      id: Math.random().toString(36).substr(2, 9),
      title: newTaskTitle,
      date: newTaskDate,
      assignees: newTaskAssignees,
      description: newTaskDesc
    };
    updateData('tasks', [...(formData.tasks || []), newTask]);
    setNewTaskTitle('');
    setNewTaskDate('');
    setNewTaskAssignees([]);
    setNewTaskDesc('');
  };

  const handleRemoveTask = (taskId: string) => {
    setFormData((prev: any) => ({
      ...prev,
      tasks: (prev.tasks || []).filter((t: any) => t.id !== taskId)
    }));
  };

  useEffect(() => {
    if (id) {
      setIsEditMode(true);
      const fetchReport = async () => {
        const reportDoc = await getDoc(doc(db, 'reports', id));
        if (reportDoc.exists()) {
          setFormData(reportDoc.data());
        } else {
          alert('レポートが見つかりません');
          navigate('/');
        }
      };
      fetchReport();
    }
  }, [id, navigate]);

  const handleNext = async () => {
    if (step < currentSteps.length - 1) {
      setStep(step + 1);
    } else {
      const currentUser = auth.currentUser;
      
      if (currentUser) {
        try {
          if (isEditMode && id) {
            await updateReport(id, formData);
              
            // Add new tasks during edit (simple logic)
            if (formData.tasks && formData.tasks.length > 0) {
              for (const t of formData.tasks) {
                // Only add those without firebase-like IDs (we used a short ID)
                if (t.id && t.id.length < 20 && !t.saved) {
                   await addDoc(collection(db, 'tasks'), {
                      title: t.title,
                      date: t.date,
                      assignees: t.assignees,
                      description: t.description || '',
                      authorId: currentUser.uid,
                      authorRole: activeRole || '店長',
                      createdAt: new Date().toISOString()
                   });
                   t.saved = true;
                }
              }
            }

            alert('レポートを更新しました');
            navigate(`/report/${id}`);
          } else {
            await addReport({
              authorId: currentUser.uid,
              authorName: formData.authorName,
              authorRole: activeRole || '店長',
              authorPhotoURL: user?.photoURL || '',
              storeName: formData.storeName,
              weekNumber: getFiscalWeek(new Date()),
              year: new Date().getFullYear(),
              ...formData
            });

            if (formData.tasks && formData.tasks.length > 0) {
              for (const t of formData.tasks) {
                await addDoc(collection(db, 'tasks'), {
                    title: t.title,
                    date: t.date,
                    assignees: t.assignees,
                    description: t.description || '',
                    authorId: currentUser.uid,
                    authorRole: activeRole || '店長',
                    createdAt: new Date().toISOString()
                });
              }
            }
            navigate('/');
          }
        } catch (e) {
          console.error('Submission error:', e);
          alert('保存に失敗しました: ' + e);
        }
      } else {
        alert('ログイン状態が無効です。ページをリロードしてください。');
      }
    }
  };

  const updateData = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  const isStepValid = () => {
    // 最終確認ステップは常に有効
    if (step === currentSteps.length - 1) return true;
    
    const currentFields = currentSteps[step].fields;
    if (currentFields.length === 0) return true;
    return currentFields.every(f => formData[f] && formData[f].trim().length > 0);
  };

  return (
    <div className="max-w-2xl mx-auto pt-4 pb-20 px-4">
      {/* プログレスバー */}
      <div className="flex justify-between mb-10">
        {currentSteps.map((s, idx) => (
          <div 
            key={s.id} 
            className={`h-1.5 flex-1 mx-1 rounded-full transition-all duration-700 relative ${
              idx <= step ? 'bg-paradise-sunset shadow-[0_0_10px_rgba(255,158,125,0.8)]' : 'bg-white/20'
            }`}
          >
             {idx === step && (
               <motion.div 
                 layoutId="active-dot"
                 className="absolute -top-1 -left-1 w-3 h-3 bg-white rounded-full shadow-lg"
               />
             )}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20, rotateY: 10 }}
          animate={{ opacity: 1, x: 0, rotateY: 0 }}
          exit={{ opacity: 0, x: -20, rotateY: -10 }}
          transition={{ duration: 0.5, ease: "circOut" }}
        >
          <GlassCard className="min-h-[500px] flex flex-col shadow-2xl">
            <div className="mb-8 p-2">
              <h2 className="text-3xl font-black text-gray-800 flex items-center gap-3">
                {step === 3 ? (
                  <Check className="text-paradise-mint bg-paradise-mint/20 p-1.5 rounded-xl" size={36} />
                ) : (
                  <Sparkles className="text-paradise-sunset bg-paradise-sunset/20 p-1.5 rounded-xl" size={36} />
                )}
                {currentSteps[step].title}
              </h2>
              <p className="text-base font-bold text-gray-400 mt-2 ml-1">{currentSteps[step].desc}</p>
            </div>

            <div className="flex-1 px-2">
              {currentSteps[step].id === 'info' && (
                <div className="space-y-6">
                  <div className="bg-paradise-blue/10 p-4 rounded-xl border border-paradise-blue/20">
                    <p className="text-sm font-bold text-paradise-ocean/80 text-center">※毎週日曜日18:00まで</p>
                  </div>
                  <div>
                    <label className="block text-xs font-black text-gray-400 mb-2 ml-4 uppercase tracking-widest">店舗：（未入力）</label>
                    <input 
                      type="text"
                      className="w-full p-5 rounded-2xl bg-white/40 border-2 border-white/20 focus:border-paradise-sunset/50 focus:bg-white/60 outline-none transition-all text-gray-700"
                      value={formData.storeName}
                      onChange={(e) => updateData('storeName', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-gray-400 mb-2 ml-4 uppercase tracking-widest">氏名：（未入力）</label>
                    <input 
                      type="text"
                      className="w-full p-5 rounded-2xl bg-white/40 border-2 border-white/20 focus:border-paradise-sunset/50 focus:bg-white/60 outline-none transition-all text-gray-700"
                      value={formData.authorName}
                      onChange={(e) => updateData('authorName', e.target.value)}
                    />
                  </div>
                </div>
              )}

              {currentSteps[step].id === 'keep' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-paradise-ocean/80 bg-paradise-blue/20 p-3 rounded-xl">
                    <Info size={16} />
                    <span>今週「おっ、いい感じだな」と思った小さな成功や工夫は何ですか？</span>
                  </div>
                  <div className="bg-white/40 rounded-3xl overflow-hidden border-2 border-white/20 focus-within:border-paradise-sunset/50 transition-all">
                    <textarea
                      placeholder="よかった点、続けるべきことを入力してください..."
                      className="w-full h-48 p-4 bg-transparent outline-none resize-none text-gray-700 leading-relaxed font-medium"
                      value={formData.keep}
                      onChange={(e) => updateData('keep', e.target.value)}
                    />
                  </div>
                </div>
              )}

              {currentSteps[step].id === 'problem' && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-xs font-black text-gray-400 mb-2 ml-4 uppercase tracking-widest">・本来どうあるべきだったか</label>
                    <div className="bg-white/40 rounded-2xl overflow-hidden border-2 border-white/20 focus-within:border-paradise-sunset/50 transition-all">
                      <textarea
                        placeholder="本来の目標やあるべき姿を入力..."
                        className="w-full h-24 p-4 bg-transparent outline-none resize-none text-gray-700 leading-relaxed font-medium"
                        value={formData.problem_ideal}
                        onChange={(e) => updateData('problem_ideal', e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-black text-gray-400 mb-2 ml-4 uppercase tracking-widest">・気になった出来事（GAP）</label>
                    <div className="bg-white/40 rounded-2xl overflow-hidden border-2 border-white/20 focus-within:border-paradise-sunset/50 transition-all">
                      <textarea
                        placeholder="実際に起きた出来事や問題点を入力..."
                        className="w-full h-24 p-4 bg-transparent outline-none resize-none text-gray-700 leading-relaxed font-medium"
                        value={formData.problem_gap}
                        onChange={(e) => updateData('problem_gap', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {currentSteps[step].id === 'try' && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-xs font-black text-gray-400 mb-2 ml-4 uppercase tracking-widest">・誰が・いつ</label>
                    <input 
                      type="text" 
                      placeholder="▶（未入力）"
                      className="w-full p-4 rounded-2xl bg-white/40 border-none transition-all text-gray-700 text-base"
                      value={formData.try_who + (formData.try_when ? ' / ' + formData.try_when : '')}
                      onChange={(e) => {
                        const parts = e.target.value.split(' / ');
                        updateData('try_who', parts[0] || '');
                        updateData('try_when', parts[1] || '');
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-gray-400 mb-2 ml-4 uppercase tracking-widest">・何をどうする</label>
                    <div className="bg-white/40 rounded-2xl overflow-hidden border-2 border-white/20 focus-within:border-paradise-sunset/50 transition-all">
                      <textarea
                        placeholder="▶（未入力）"
                        className="w-full h-32 p-5 bg-transparent outline-none resize-none text-gray-700 leading-relaxed font-medium"
                        value={formData.try_what}
                        onChange={(e) => updateData('try_what', e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-black text-gray-400 mb-2 ml-4 uppercase tracking-widest">・なぜそれをするか（理由）</label>
                    <input 
                      type="text" 
                      placeholder="▶（未入力）"
                      className="w-full p-4 rounded-2xl bg-white/40 border-none transition-all text-gray-700 text-base"
                      value={formData.try_why}
                      onChange={(e) => updateData('try_why', e.target.value)}
                    />
                  </div>
                </div>
              )}

              {currentSteps[step].id === 'tasks' && (
                <div className="space-y-6">
                  <div className="bg-white/40 p-4 rounded-3xl border border-white/40 shadow-inner space-y-4">
                    <div>
                      <label className="block text-xs font-black text-gray-500 mb-2 ml-2">タスク名 (何を)</label>
                      <input 
                        type="text" 
                        value={newTaskTitle}
                        onChange={(e) => setNewTaskTitle(e.target.value)}
                        placeholder="例：在庫チェック"
                        className="w-full p-4 rounded-xl bg-white/60 border-none transition-all text-gray-700 font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-gray-500 mb-2 ml-2">期日 (いつまでに)</label>
                      <input 
                        type="date" 
                        value={newTaskDate}
                        onChange={(e) => setNewTaskDate(e.target.value)}
                        className="w-full p-4 rounded-xl bg-white/60 border-none transition-all text-gray-700 font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-gray-500 mb-2 ml-2">担当者 (複数可)</label>
                      <MultiUserSelect 
                        selectedUsers={newTaskAssignees}
                        onChange={setNewTaskAssignees}
                        placeholder="担当者を選択..."
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-gray-500 mb-2 ml-2">詳細・備考</label>
                      <textarea 
                        value={newTaskDesc}
                        onChange={(e) => setNewTaskDesc(e.target.value)}
                        placeholder="任意"
                        className="w-full p-4 rounded-xl bg-white/60 border-none transition-all text-gray-700 h-24 resize-none"
                      />
                    </div>
                    
                    <button 
                      onClick={handleAddTask}
                      disabled={!newTaskTitle || !newTaskDate}
                      className="w-full flex items-center justify-center gap-2 py-4 bg-paradise-ocean/10 text-paradise-ocean border-2 border-paradise-ocean/20 rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-paradise-ocean/20 active:scale-95 transition-all"
                    >
                      <Plus size={20} /> カレンダーに仮追加する
                    </button>
                  </div>

                  {formData.tasks && formData.tasks.length > 0 && (
                    <div className="space-y-3 mt-6">
                      <div className="bg-blue-50/80 p-4 rounded-xl border border-blue-200 shadow-sm flex gap-3 text-sm font-bold text-blue-700 leading-relaxed">
                        <Info size={18} className="shrink-0 mt-0.5" />
                        <p>このタスクはまだ保存されていません。「最終確認」で「登録する」を押すと、まとめてカレンダーに反映されます。</p>
                      </div>
                      <h3 className="font-bold text-gray-600 mb-2 mt-4 block">仮追加リスト ({formData.tasks.length}件)</h3>
                      {formData.tasks.map((task: any) => (
                        <div key={task.id} className="flex items-start justify-between bg-white border border-gray-100 p-4 rounded-2xl shadow-sm">
                          <div className="flex-1">
                            <h4 className="font-bold text-gray-800">{task.title}</h4>
                            <p className="text-sm text-paradise-ocean font-bold mt-1 max-w-[200px] sm:max-w-none truncate">{task.assignees.map((u: any) => u.name).join(', ')}</p>
                            <p className="text-xs text-gray-500 mt-1"><CalendarIcon size={12} className="inline mr-1"/>{task.date}</p>
                          </div>
                          <button type="button" onClick={() => handleRemoveTask(task.id)} className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                            <X size={20} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Step: 確認画面 */}
              {currentSteps[step].id === 'confirm' && (
                <div className="space-y-6 animate-fade-in text-base max-h-[500px] overflow-y-auto no-scrollbar pb-10">
                  <div className="bg-white/30 p-5 rounded-[2rem] border border-white/40 shadow-inner">
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-xs font-black text-paradise-sunset uppercase tracking-[0.2em] ml-2">店舗 / 氏名</label>
                      <span className="text-xs text-gray-500 font-bold">※毎週日曜日18:00まで</span>
                    </div>
                    <p className="text-gray-700 font-bold">{formData.storeName} / {formData.authorName}</p>
                  </div>
                  <div className="bg-white/30 p-5 rounded-[2rem] border border-white/40 shadow-inner">
                    <label className="text-xs font-black text-paradise-sunset block mb-2 uppercase tracking-[0.2em] ml-2">キープ</label>
                    <p className="text-gray-700 font-medium leading-relaxed italic">"{formData.keep || '未入力'}"</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-red-50/40 p-5 rounded-3xl border border-red-100/40 shadow-sm">
                      <label className="text-xs font-black text-red-400 block mb-2 uppercase tracking-[0.2em] ml-1">問題点 (ギャップ)</label>
                      <p className="text-gray-600 text-sm leading-relaxed">{formData.problem_gap || '未入力'}</p>
                    </div>
                    <div className="bg-green-50/40 p-5 rounded-3xl border border-green-100/40 shadow-sm">
                      <label className="text-xs font-black text-green-500 block mb-2 uppercase tracking-[0.2em] ml-1">理想の姿</label>
                      <p className="text-gray-600 text-sm leading-relaxed">{formData.problem_ideal || '未入力'}</p>
                    </div>
                  </div>

                  <div className="bg-blue-50/40 p-6 rounded-[2rem] border border-blue-100/40 shadow-sm">
                    <label className="text-xs font-black text-paradise-ocean block mb-3 uppercase tracking-[0.2em] ml-1">アクションプラン</label>
                    <div className="space-y-3">
                      <div className="flex items-start gap-2">
                        <span className="text-xs font-bold text-gray-400 w-12 pt-1 uppercase">何を:</span>
                        <p className="text-base font-bold text-gray-700">{formData.try_what}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-start gap-2">
                          <span className="text-xs font-bold text-gray-400 w-12 pt-1 uppercase">誰が:</span>
                          <p className="text-sm text-gray-600 font-medium">{formData.try_who}</p>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-xs font-bold text-gray-400 w-12 pt-1 uppercase">いつ:</span>
                          <p className="text-sm text-gray-600 font-medium">{formData.try_when}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2 border-t border-white/20 pt-3">
                        <span className="text-xs font-bold text-gray-400 w-12 pt-1 uppercase">なぜ:</span>
                        <p className="text-sm text-gray-500 italic">{formData.try_why}</p>
                      </div>
                    </div>
                  </div>
                  
                  {currentSteps.some(s => s.id === 'tasks') && formData.tasks && formData.tasks.length > 0 && (
                    <div className="mt-4 bg-gray-50/50 p-6 rounded-[2rem] border border-gray-100 shadow-sm">
                      <label className="text-xs font-black text-gray-500 block mb-3 uppercase tracking-[0.2em] ml-1">翌週のタスク</label>
                      <div className="space-y-3">
                        {formData.tasks.map((t: any) => (
                           <div key={t.id} className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                             <div className="font-bold text-gray-700">{t.title}</div>
                             <div className="text-xs text-gray-500 mt-1"><CalendarIcon size={12} className="inline mr-1"/>{t.date}</div>
                             <div className="text-xs text-paradise-ocean font-bold mt-1">担当: {t.assignees.map((u: any)=>u.name).join(', ')}</div>
                           </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col items-center gap-2 pt-6 opacity-60">
                    <Sparkles className="text-paradise-sunset animate-pulse" size={16} />
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest text-center">
                      この内容はチーム全体にポジティブな光として共有されます
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-10 flex justify-between gap-4 p-2">
              <button
                disabled={step === 0}
                onClick={() => setStep(step - 1)}
                className={`flex-1 py-5 rounded-full flex items-center justify-center gap-3 font-bold transition-all ${
                  step === 0 ? 'opacity-0 cursor-default' : 'bg-white/40 text-gray-500 hover:bg-white/60 active:scale-95 shadow-sm'
                }`}
              >
                <ChevronLeft size={20} /> <span className="hidden sm:inline">戻って修正</span><span className="sm:hidden">戻る</span>
              </button>
              <button
                disabled={!isStepValid()}
                onClick={handleNext}
                className={`flex-[2] py-5 rounded-full text-white font-black flex items-center justify-center gap-3 shadow-xl transition-all active:scale-95 ${
                  !isStepValid() ? 'opacity-50 grayscale cursor-not-allowed' : ''
                } ${
                  step === 3 
                  ? 'bg-gradient-to-r from-paradise-mint via-paradise-ocean to-blue-500 shadow-paradise-blue/50' 
                  : 'bg-gradient-to-r from-paradise-sunset via-orange-400 to-red-400 shadow-paradise-sunset/50'
                }`}
              >
                {step === currentSteps.length - 1 ? (
                  <>{isEditMode ? '上書き保存する' : '送信'} <Send size={20} className="animate-bounce" /></>
                ) : (
                  <>次に進む <ChevronRight size={20} /></>
                )}
              </button>
            </div>
          </GlassCard>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
