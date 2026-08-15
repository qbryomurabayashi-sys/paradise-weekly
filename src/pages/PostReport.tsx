import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from '../components/ui/GlassCard';
import { SmoothTextArea } from '../components/ui/SmoothTextArea';
import { auth, db } from '../lib/firebase';
import { doc, getDoc, collection, addDoc, serverTimestamp, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { useReportStore, Report } from '../store/useReportStore';
import { useAuthStore } from '../store/useAuthStore';
import { ChevronRight, ChevronLeft, Send, Sparkles, Check, Info, Plus, X, Calendar as CalendarIcon, History, Quote, Loader2, RotateCcw, Copy, AlertTriangle } from 'lucide-react';
import { formatStaffName } from '../lib/formatUtils';
import { MultiUserSelect } from '../components/ui/MultiUserSelect';
import { getFiscalWeek } from '../lib/dateUtils';

const STEPS = [
  { id: 'info', title: '【#S週間報告】', desc: '*毎週日曜日18:00まで', fields: ['storeName', 'authorName'] },
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
      { id: 'info', title: '【#S週間報告】', desc: '*毎週日曜日18:00まで', fields: ['storeName', 'authorName'] },
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
    try_who: '',
    try_when: '',
    try_what: '',
    try_why: '',
    tasks: [] // Array of { title, date, assignees, description }
  });
  const [previousReport, setPreviousReport] = useState<Report | null>(null);
  const [showPrevious, setShowPrevious] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const { addReport, updateReport } = useReportStore();

  // インライン通知（ネイティブalert置換）
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);
  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => setToast({ msg, type });
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);
  const [confirmResend, setConfirmResend] = useState(false);

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

  const [isDraftRestored, setIsDraftRestored] = useState(false);

  useEffect(() => {
    if (user?.uid && !isEditMode) {
      const draft = localStorage.getItem(`kpt_draft_${user.uid}`);
      if (draft) {
        try {
          const parsed = JSON.parse(draft);
          if (parsed && typeof parsed === 'object') {
            setFormData(parsed);
          }
        } catch(e) {
          console.error("Failed to parse draft", e);
        }
      }
      setIsDraftRestored(true);
      
      const fetchPreviousReport = async () => {
        let found: any = null;
        try {
          const q = query(
            collection(db, 'reports'),
            where('authorId', '==', user.uid),
            orderBy('createdAt', 'desc'),
            limit(1)
          );
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            const docSnap = querySnapshot.docs[0];
            found = { id: docSnap.id, ...docSnap.data() };
          }
        } catch (e) {
          console.error('Failed to fetch previous report from firestore:', e);
        }

        // Fallback 1: search memory store
        if (!found) {
          const storeReports = useReportStore.getState().reports;
          const userReport = storeReports.find(r => r.authorId === user.uid);
          if (userReport) {
            found = userReport;
          }
        }

        // Fallback 2: search localStorage backup
        if (!found) {
          const localBackup = localStorage.getItem(`kpt_last_submitted_${user.uid}`);
          if (localBackup) {
            try {
              found = JSON.parse(localBackup);
            } catch (err) {
              console.error('Failed to parse local report backup', err);
            }
          }
        }

        if (found) {
          setPreviousReport(found as Report);
        }
      };
      fetchPreviousReport();
    }
  }, [user?.uid, isEditMode]);

  const handleCopyPrevious = () => {
    if (!previousReport) return;
    setFormData((prev: any) => ({
      ...prev,
      storeName: previousReport.storeName || user?.storeName || prev.storeName || '',
      authorName: previousReport.authorName || user?.name || prev.authorName || '',
      keep: previousReport.keep || '',
      problem_gap: previousReport.problem_gap || '',
      problem_ideal: previousReport.problem_ideal || '',
      try_who: previousReport.try_who || '',
      try_when: previousReport.try_when || '',
      try_what: previousReport.try_what || '',
      try_why: previousReport.try_why || '',
      tasks: previousReport.tasks || []
    }));
    showToast('前回の報告内容をフォームに読み込みました。内容を確認して送信してください。', 'success');
  };

  const doResendPrevious = async () => {
    if (!previousReport) return;
    const currentUser = auth.currentUser;
    if (!currentUser) {
      showToast('ログイン状態が無効です。ページをリロードしてください。', 'error');
      return;
    }

    setConfirmResend(false);
    setIsSubmitting(true);
    try {
      const payload = {
        authorId: currentUser.uid,
        authorName: previousReport.authorName || user?.name || '',
        authorRole: activeRole || '店長',
        authorPhotoURL: user?.photoURL || '',
        storeName: previousReport.storeName || user?.storeName || '',
        weekNumber: getFiscalWeek(new Date()),
        year: new Date().getFullYear(),
        keep: previousReport.keep || '',
        problem_gap: previousReport.problem_gap || '',
        problem_ideal: previousReport.problem_ideal || '',
        try_who: previousReport.try_who || '',
        try_when: previousReport.try_when || '',
        try_what: previousReport.try_what || '',
        try_why: previousReport.try_why || '',
        tasks: previousReport.tasks || [],
        status: 'published' as const
      };

      await addReport(payload);

      if (currentUser.uid) {
        localStorage.removeItem(`kpt_draft_${currentUser.uid}`);
        localStorage.setItem(`kpt_last_submitted_${currentUser.uid}`, JSON.stringify(payload));
      }

      showToast('前回の報告内容を今週分として再送信しました。', 'success');
      setTimeout(() => navigate('/'), 700);
    } catch (e) {
      console.error('Direct resend error:', e);
      showToast('再送信に失敗しました: ' + e, 'error');
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (user?.uid && !isEditMode && isDraftRestored) {
      localStorage.setItem(`kpt_draft_${user.uid}`, JSON.stringify(formData));
    }
  }, [formData, user?.uid, isEditMode, isDraftRestored]);

  useEffect(() => {
    if (id) {
      setIsEditMode(true);
      const fetchReport = async () => {
        const reportDoc = await getDoc(doc(db, 'reports', id));
        if (reportDoc.exists()) {
          setFormData(reportDoc.data());
        } else {
          showToast('レポートが見つかりません', 'error');
          setTimeout(() => navigate('/'), 700);
        }
      };
      fetchReport();
    }
  }, [id, navigate]);

  const handleNext = async () => {
    if (step < currentSteps.length - 1) {
      setStep(step + 1);
    } else {
      if (isSubmitting) return;
      const currentUser = auth.currentUser;
      
      if (currentUser) {
        setIsSubmitting(true);
        try {
          if (isEditMode && id) {
            await updateReport(id, { ...formData, status: 'published' });
              
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

            showToast('レポートを更新しました', 'success');
            setTimeout(() => navigate(`/report/${id}`), 700);
          } else {
            await addReport({
              authorId: currentUser.uid,
              authorName: formData.authorName,
              authorRole: activeRole || '店長',
              authorPhotoURL: user?.photoURL || '',
              storeName: formData.storeName,
              weekNumber: getFiscalWeek(new Date()),
              year: new Date().getFullYear(),
              ...formData,
              status: 'published'
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
            if (user?.uid) {
               localStorage.removeItem(`kpt_draft_${user.uid}`);
               localStorage.setItem(`kpt_last_submitted_${user.uid}`, JSON.stringify({
                 authorId: currentUser.uid,
                 authorName: formData.authorName,
                 authorRole: activeRole || '店長',
                 authorPhotoURL: user?.photoURL || '',
                 storeName: formData.storeName,
                 weekNumber: getFiscalWeek(new Date()),
                 year: new Date().getFullYear(),
                 ...formData,
                 status: 'published'
               }));
            }
            navigate('/');
          }
        } catch (e) {
          console.error('Submission error:', e);
          showToast('保存に失敗しました: ' + e, 'error');
          setIsSubmitting(false);
        }
      } else {
        showToast('ログイン状態が無効です。ページをリロードしてください。', 'error');
      }
    }
  };

  const updateData = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleSaveDraft = async () => {
    if (user?.uid) {
      const draftData = {
        authorId: user.uid,
        authorName: formData.authorName || user.name || '',
        authorRole: activeRole || '店長',
        authorPhotoURL: user?.photoURL || '',
        storeName: formData.storeName || user.storeName || '',
        weekNumber: getFiscalWeek(new Date()),
        year: new Date().getFullYear(),
        ...formData,
        status: 'draft'
      };

      try {
        if (isEditMode && id) {
          await updateReport(id, draftData);
          showToast('下書きを更新しました', 'success');
        } else {
          await addReport(draftData);
          if (user?.uid) localStorage.removeItem(`kpt_draft_${user.uid}`);
          showToast('下書き（未公開）としてクラウドに保存しました。一覧から編集できます。', 'success');
        }
        setTimeout(() => navigate('/'), 700);
      } catch (e) {
        console.error(e);
        showToast('下書き保存に失敗しました', 'error');
      }
    }
  };

  const isStepValid = () => {
    // 最終確認ステップは常に有効
    if (step === currentSteps.length - 1) return true;
    
    // タスクステップのバリデーション（タスクが1つ以上登録されていること）
    if (currentSteps[step].id === 'tasks') {
      return formData.tasks && formData.tasks.length > 0;
    }

    const currentFields = currentSteps[step].fields;
    if (currentFields.length === 0) return true;
    return currentFields.every(f => formData[f] && formData[f].trim().length > 0);
  };

  return (
    <div className="max-w-2xl mx-auto pt-4 pb-20 px-4">
      {/* インライン通知トースト */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[130] w-[92%] max-w-sm"
          >
            <div className={`flex items-center gap-2.5 rounded-2xl px-4 py-3 shadow-xl border text-sm font-bold ${
              toast.type === 'success' ? 'bg-white border-success/30 text-ink'
              : toast.type === 'error' ? 'bg-white border-danger/30 text-ink'
              : 'bg-white border-qb-blue/30 text-ink'
            }`}>
              <span className={`grid place-items-center h-7 w-7 shrink-0 rounded-full text-white ${
                toast.type === 'success' ? 'bg-success' : toast.type === 'error' ? 'bg-danger' : 'bg-qb-blue'
              }`}>
                {toast.type === 'success' ? <Check size={16} /> : toast.type === 'error' ? <AlertTriangle size={16} /> : <Info size={16} />}
              </span>
              <span className="flex-1 leading-snug">{toast.msg}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 再送信の確認モーダル（window.confirm置換） */}
      <AnimatePresence>
        {confirmResend && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[125] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={() => setConfirmResend(false)}
          >
            <motion.div
              initial={{ scale: 0.92, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 16 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6 border border-line"
            >
              <div className="flex flex-col items-center text-center gap-2 mb-5">
                <span className="grid place-items-center h-12 w-12 rounded-2xl bg-qb-blue/10 text-qb-blue">
                  <RotateCcw size={24} />
                </span>
                <h3 className="text-lg font-black text-ink">前回分を再送信しますか？</h3>
                <p className="text-sm font-bold text-ink-soft leading-relaxed">前回の報告内容をそのまま今週分として投稿します。</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmResend(false)}
                  className="tap flex-1 rounded-xl bg-canvas text-ink-soft font-bold border border-line active:scale-95 transition-all"
                >
                  やめる
                </button>
                <button
                  onClick={doResendPrevious}
                  disabled={isSubmitting}
                  className="tap flex-1 rounded-xl bg-gradient-to-r from-qb-blue to-qb-cyan text-white font-black shadow-md active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <Send size={16} /> 再送信する
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 前回のレポート参照および再送信・複製ボタン */}
      {previousReport && (
        <div className="mb-6 space-y-3">
          {/* 再送信・フォーム複製クイックカード */}
          <div className="bg-qb-blue/5 border border-qb-blue/20 rounded-2xl p-4 shadow-sm backdrop-blur-md">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-gradient-to-br from-qb-blue to-qb-cyan text-white rounded-xl shadow-md flex-shrink-0">
                  <RotateCcw size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-black text-ink">前回の週次報告を再送信 / 複製</p>
                    <span className="text-xs bg-qb-blue/10 text-qb-blue-dark font-bold px-2 py-0.5 rounded-full">未送信・エラー時補助</span>
                  </div>
                  <p className="text-xs text-ink-soft mt-0.5">前回提出分（またはバックアップ）をフォームにコピーして再利用、またはそのまま今週分として送信できます。</p>
                </div>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleCopyPrevious}
                  className="tap flex-1 sm:flex-none px-3 bg-white hover:bg-canvas active:scale-95 border border-line text-ink-soft text-xs font-black rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5"
                >
                  <Copy size={14} />
                  フォームに複製
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmResend(true)}
                  disabled={isSubmitting}
                  className="tap flex-1 sm:flex-none px-3.5 bg-gradient-to-r from-qb-blue to-qb-cyan hover:brightness-105 active:scale-95 text-white text-xs font-black rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Send size={14} />
                  そのまま再送信
                </button>
              </div>
            </div>
          </div>

          {/* 前回の振り返りアコーディオン */}
          <button
            onClick={() => setShowPrevious(!showPrevious)}
            className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all duration-300 ${
              showPrevious 
                ? 'bg-white/60 border-paradise-ocean/30 shadow-lg' 
                : 'bg-white/30 border-white/20 hover:bg-white/40'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${showPrevious ? 'bg-paradise-ocean text-white' : 'bg-paradise-ocean/10 text-paradise-ocean'}`}>
                <History size={20} />
              </div>
              <div className="text-left">
                <p className="text-sm font-black text-gray-700">前回の振り返り内容を確認</p>
                <p className="text-xs font-bold text-gray-400">前回日時：{previousReport.createdAt ? new Date(previousReport.createdAt).toLocaleDateString() : '保存されたバックアップ'}</p>
              </div>
            </div>
            <motion.div
              animate={{ rotate: showPrevious ? 180 : 0 }}
              transition={{ duration: 0.3 }}
            >
              <ChevronLeft size={20} className="text-gray-400 -rotate-90" />
            </motion.div>
          </button>

          <AnimatePresence>
            {showPrevious && (
              <motion.div
                initial={{ height: 0, opacity: 0, marginTop: 0 }}
                animate={{ height: 'auto', opacity: 1, marginTop: 12 }}
                exit={{ height: 0, opacity: 0, marginTop: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-white/60 backdrop-blur-xl rounded-[2rem] p-6 border-2 border-paradise-ocean/10 shadow-xl space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-4">
                      <div className="bg-white/50 p-4 rounded-2xl border border-white/50">
                        <label className="text-xs font-black text-paradise-sunset uppercase tracking-[0.2em] block mb-2">⭕ 前回のKeep</label>
                        <p className="text-sm text-gray-600 leading-relaxed italic">"{previousReport.keep}"</p>
                      </div>
                      <div className="bg-red-50/50 p-4 rounded-2xl border border-red-100/50">
                        <label className="text-xs font-black text-red-500 uppercase tracking-[0.2em] block mb-2">🔺 前回のProblem</label>
                        <p className="text-sm text-gray-600 leading-relaxed">{previousReport.problem_gap}</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="bg-paradise-blue/10 p-4 rounded-2xl border border-paradise-blue/20">
                        <label className="text-xs font-black text-paradise-ocean uppercase tracking-[0.2em] block mb-2">🏃 前回のTry（来週の行動予定でした）</label>
                        <div className="space-y-2">
                          <p className="text-sm font-bold text-gray-800">{previousReport.try_what}</p>
                          <p className="text-xs text-gray-500">
                             <span className="font-bold">誰が：</span>{previousReport.try_who} / <span className="font-bold">いつ：</span>{previousReport.try_when}
                          </p>
                          {previousReport.try_why && (
                             <p className="text-xs text-gray-400 italic">理由：{previousReport.try_why}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-200/50">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleCopyPrevious}
                        className="px-3 py-1.5 bg-white hover:bg-gray-100 text-gray-700 text-xs font-bold rounded-lg border border-gray-200 shadow-sm transition-all flex items-center gap-1"
                      >
                        <Copy size={13} />
                        フォームに読み込む
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmResend(true)}
                        disabled={isSubmitting}
                        className="px-3 py-2 bg-gradient-to-r from-qb-blue to-qb-cyan hover:brightness-105 text-white text-xs font-bold rounded-lg shadow-sm transition-all flex items-center gap-1 disabled:opacity-50"
                      >
                        <Send size={13} />
                        この内容で今週分を再送信
                      </button>
                    </div>
                    <button 
                      onClick={() => setShowPrevious(false)}
                      className="text-xs font-bold text-paradise-ocean hover:underline"
                    >
                      閉じる
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* プログレスバー */}
      <div className="flex justify-between mb-10">
        {currentSteps.map((s, idx) => (
          <div 
            key={s.id} 
            className={`h-1.5 flex-1 mx-1 rounded-full transition-all duration-700 relative ${
              idx <= step ? 'bg-gradient-to-r from-qb-blue to-qb-cyan shadow-[0_0_10px_rgba(0,165,235,0.6)]' : 'bg-white/20'
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
                      autoComplete="off"
                      enterKeyHint="next"
                      className="w-full p-5 rounded-2xl bg-white/40 border-2 border-white/20 focus:border-qb-cyan focus:bg-white/60 outline-none transition-all text-gray-700"
                      value={formData.storeName}
                      onChange={(e) => updateData('storeName', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-gray-400 mb-2 ml-4 uppercase tracking-widest">氏名：（未入力）</label>
                    <input
                      type="text"
                      autoComplete="name"
                      enterKeyHint="done"
                      className="w-full p-5 rounded-2xl bg-white/40 border-2 border-white/20 focus:border-qb-cyan focus:bg-white/60 outline-none transition-all text-gray-700"
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
                    <SmoothTextArea
                      placeholder="よかった点、続けるべきことを入力してください..."
                      className="w-full h-48 p-4 bg-transparent outline-none resize-none text-gray-700 leading-relaxed font-medium"
                      value={formData.keep}
                      onValueChange={(val) => updateData('keep', val)}
                    />
                  </div>
                </div>
              )}

              {currentSteps[step].id === 'problem' && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-xs font-black text-gray-400 mb-2 ml-4 uppercase tracking-widest">・本来どうあるべきだったか</label>
                    <div className="bg-white/40 rounded-2xl overflow-hidden border-2 border-white/20 focus-within:border-paradise-sunset/50 transition-all">
                      <SmoothTextArea
                        placeholder="本来の目標やあるべき姿を入力..."
                        className="w-full h-24 p-4 bg-transparent outline-none resize-none text-gray-700 leading-relaxed font-medium"
                        value={formData.problem_ideal}
                        onValueChange={(val) => updateData('problem_ideal', val)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-black text-gray-400 mb-2 ml-4 uppercase tracking-widest">・気になった出来事（GAP）</label>
                    <div className="bg-white/40 rounded-2xl overflow-hidden border-2 border-white/20 focus-within:border-paradise-sunset/50 transition-all">
                      <SmoothTextArea
                        placeholder="実際に起きた出来事や問題点を入力..."
                        className="w-full h-24 p-4 bg-transparent outline-none resize-none text-gray-700 leading-relaxed font-medium"
                        value={formData.problem_gap}
                        onValueChange={(val) => updateData('problem_gap', val)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {currentSteps[step].id === 'try' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-black text-gray-400 mb-2 ml-4 uppercase tracking-widest">・誰が</label>
                      <input 
                        type="text" 
                        placeholder="例: 自分とチーム"
                        className="w-full p-4 rounded-2xl bg-white/40 border-none transition-all text-gray-700 text-base placeholder:text-gray-400"
                        value={formData.try_who}
                        onChange={(e) => updateData('try_who', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-gray-400 mb-2 ml-4 uppercase tracking-widest">・いつ</label>
                      <input 
                        type="text" 
                        placeholder="例: 来週の月曜日から"
                        className="w-full p-4 rounded-2xl bg-white/40 border-none transition-all text-gray-700 text-base placeholder:text-gray-400"
                        value={formData.try_when}
                        onChange={(e) => updateData('try_when', e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-black text-gray-400 mb-2 ml-4 uppercase tracking-widest">・何をどうする</label>
                    <div className="bg-white/40 rounded-2xl overflow-hidden border-2 border-white/20 focus-within:border-paradise-sunset/50 transition-all">
                      <SmoothTextArea
                        placeholder="▶（未入力）"
                        className="w-full h-32 p-5 bg-transparent outline-none resize-none text-gray-700 leading-relaxed font-medium"
                        value={formData.try_what}
                        onValueChange={(val) => updateData('try_what', val)}
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
                      <SmoothTextArea 
                        value={newTaskDesc}
                        onValueChange={setNewTaskDesc}
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
                  <div className="bg-paradise-ocean/5 p-6 rounded-[2rem] border border-paradise-ocean/10 shadow-sm">
                    <label className="text-xs font-black text-paradise-ocean block mb-3 uppercase tracking-[0.2em] flex items-center gap-1"><CalendarIcon size={14}/> 予約投稿設定（任意）</label>
                    <p className="text-xs text-gray-500 mb-3 block leading-relaxed">日時を指定すると、その時間までは他の人に公開されず、あなたのダッシュボード上で下書きとして表示されます。（後から編集も可能です）</p>
                    <input 
                      type="datetime-local" 
                      value={formData.scheduledFor || ''} 
                      onChange={(e) => updateData('scheduledFor', e.target.value)}
                      className="w-full bg-white/70 border border-paradise-ocean/20 text-gray-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-paradise-ocean/40 transition-all font-medium appearance-none shadow-inner"
                    />
                  </div>

                  <div className="bg-white/30 p-5 rounded-[2rem] border border-white/40 shadow-inner mt-4">
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-xs font-black text-paradise-sunset uppercase tracking-[0.2em] ml-2">店舗 / 氏名</label>
                      <span className="text-xs text-gray-500 font-bold">※毎週日曜日18:00まで</span>
                    </div>
                    <p className="text-gray-700 font-bold">{formData.storeName} / {formatStaffName(formData.authorName)}</p>
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

            <div className="mt-10 flex flex-wrap sm:flex-nowrap justify-between gap-4 p-2">
              <button
                disabled={step === 0}
                onClick={() => setStep(step - 1)}
                className={`flex-1 sm:order-1 order-2 py-5 rounded-full flex items-center justify-center gap-3 font-bold transition-all ${
                  step === 0 ? 'opacity-0 cursor-default' : 'bg-white/40 text-gray-500 hover:bg-white/60 active:scale-95 shadow-sm'
                }`}
              >
                <ChevronLeft size={20} /> <span className="hidden sm:inline">戻る</span><span className="sm:hidden">戻る</span>
              </button>
              
              {(!isEditMode || formData.status === 'draft') && (
                <button
                  onClick={handleSaveDraft}
                  className="flex-1 sm:order-2 order-3 py-5 rounded-full bg-white/50 text-gray-700 hover:bg-white/70 font-bold transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2 border border-gray-200"
                >
                  <CalendarIcon size={18} /> 一時保存
                </button>
              )}

              <button
                disabled={!isStepValid() || isSubmitting}
                onClick={handleNext}
                className={`flex-[2] sm:order-3 order-1 w-full sm:w-auto py-5 rounded-full text-white font-black flex items-center justify-center gap-3 shadow-xl transition-all active:scale-95 ${
                  (!isStepValid() || isSubmitting) ? 'opacity-50 grayscale cursor-not-allowed' : ''
                } ${
                  step === currentSteps.length - 1
                  ? 'bg-gradient-to-r from-success to-qb-cyan shadow-success/40'
                  : 'bg-gradient-to-r from-qb-blue to-qb-cyan shadow-qb-blue/40'
                }`}
              >
                {isSubmitting ? (
                  <>送信中 <Loader2 className="animate-spin" size={20} /></>
                ) : step === currentSteps.length - 1 ? (
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
