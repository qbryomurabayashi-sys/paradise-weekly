import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from '../components/ui/GlassCard';
import { SmoothTextArea } from '../components/ui/SmoothTextArea';
import { auth, db } from '../lib/firebase';
import { doc, getDoc, collection, addDoc, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { useReportStore, Report } from '../store/useReportStore';
import { useAuthStore } from '../store/useAuthStore';
import { Send, Check, Info, Plus, X, Calendar as CalendarIcon, History, Loader2, RotateCcw, Copy, AlertTriangle, ChevronLeft, ChevronDown, Save, Clock } from 'lucide-react';
import { MultiUserSelect } from '../components/ui/MultiUserSelect';
import { getFiscalWeek } from '../lib/dateUtils';

export const PostReport = () => {
  const { id } = useParams();
  const { user, viewMode } = useAuthStore();
  const isBM = user?.role === 'BM';
  const activeRole = isBM && viewMode ? viewMode : user?.role;
  const isAM = activeRole === 'AM';

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
    scheduledFor: '',
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

  const updateData = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

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
    showToast('タスクを仮追加しました。送信すると反映されます。', 'info');
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

  // 予約送信かどうか（未来日時が指定されているか）
  const isScheduled = !!formData.scheduledFor && new Date(formData.scheduledFor) > new Date();

  const isFormValid = () => {
    const required = ['keep', 'problem_gap', 'problem_ideal', 'try_who', 'try_when', 'try_what'];
    return required.every(f => formData[f] && String(formData[f]).trim().length > 0);
  };

  const persistTasks = async (currentUser: any) => {
    if (formData.tasks && formData.tasks.length > 0) {
      for (const t of formData.tasks) {
        if (t.id && String(t.id).length < 20 && !t.saved) {
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
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    if (!isFormValid()) {
      showToast('未入力の必須項目があります。Keep / Problem / Try をご確認ください。', 'error');
      return;
    }
    const currentUser = auth.currentUser;
    if (!currentUser) {
      showToast('ログイン状態が無効です。ページをリロードしてください。', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEditMode && id) {
        await updateReport(id, { ...formData, status: 'published' });
        await persistTasks(currentUser);
        showToast(isScheduled ? '予約投稿として保存しました' : 'レポートを更新しました', 'success');
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
        await persistTasks(currentUser);
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
        showToast(isScheduled ? '予約投稿を登録しました' : '週次報告を送信しました', 'success');
        setTimeout(() => navigate('/'), 700);
      }
    } catch (e) {
      console.error('Submission error:', e);
      showToast('保存に失敗しました: ' + e, 'error');
      setIsSubmitting(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!user?.uid) return;
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
  };

  const labelCls = "block text-xs font-black text-ink-soft mb-1.5 tracking-wide";
  const inputCls = "w-full p-3.5 rounded-xl bg-white border border-line focus:border-qb-cyan focus:ring-2 focus:ring-qb-cyan/20 outline-none transition-all text-ink font-medium text-base placeholder:text-qb-gray";
  const taCls = "w-full p-3.5 rounded-xl bg-white border border-line focus-within:border-qb-cyan outline-none resize-none text-ink leading-relaxed font-medium text-base";

  return (
    <div className="max-w-2xl mx-auto pt-4 pb-40 px-4">
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

      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => navigate('/')}
          className="tap flex items-center gap-1.5 text-ink-soft font-bold hover:text-ink transition-all text-sm"
        >
          <ChevronLeft size={18} /> 戻る
        </button>
        <span className="text-xs font-black text-qb-blue bg-qb-blue/10 border border-qb-blue/20 px-3 py-1 rounded-full">
          {isEditMode ? 'レポート編集' : '【#S週間報告】'} ・ 毎週日曜 18:00まで
        </span>
      </div>

      {/* 前回のレポート参照および再送信・複製 */}
      {previousReport && !isEditMode && (
        <div className="mb-4">
          <div className="bg-qb-blue/5 border border-qb-blue/20 rounded-2xl p-3.5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-qb-blue to-qb-cyan text-white rounded-xl shadow-md shrink-0">
                <RotateCcw size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-ink">前回の週次報告を再利用</p>
                <p className="text-xs text-ink-soft mt-0.5 truncate">フォームに複製して手直し、またはそのまま今週分として送信できます。</p>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <button
                type="button"
                onClick={handleCopyPrevious}
                className="tap flex-1 bg-white active:scale-95 border border-line text-ink-soft text-xs font-black rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5"
              >
                <Copy size={14} /> フォームに複製
              </button>
              <button
                type="button"
                onClick={() => setConfirmResend(true)}
                disabled={isSubmitting}
                className="tap flex-1 bg-gradient-to-r from-qb-blue to-qb-cyan active:scale-95 text-white text-xs font-black rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Send size={14} /> そのまま再送信
              </button>
            </div>

            {/* 前回内容の確認アコーディオン */}
            <button
              onClick={() => setShowPrevious(!showPrevious)}
              className="tap w-full mt-2 flex items-center justify-center gap-1.5 text-xs font-bold text-qb-blue"
            >
              <History size={13} /> 前回の内容を{showPrevious ? '閉じる' : '確認する'}
              <motion.span animate={{ rotate: showPrevious ? 180 : 0 }}><ChevronDown size={14} /></motion.span>
            </button>
            <AnimatePresence>
              {showPrevious && (
                <motion.div
                  initial={{ height: 0, opacity: 0, marginTop: 0 }}
                  animate={{ height: 'auto', opacity: 1, marginTop: 8 }}
                  exit={{ height: 0, opacity: 0, marginTop: 0 }}
                  className="overflow-hidden"
                >
                  <div className="bg-white rounded-xl p-3 border border-line space-y-2 text-sm">
                    <div><span className="font-black text-qb-cyan">Keep：</span><span className="text-ink-soft">{previousReport.keep || '—'}</span></div>
                    <div><span className="font-black text-danger">Problem：</span><span className="text-ink-soft">{previousReport.problem_gap || '—'}</span></div>
                    <div><span className="font-black text-success">Try：</span><span className="text-ink-soft">{previousReport.try_what || '—'}</span></div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* 1画面入力フォーム */}
      <div className="space-y-4">
        {/* 店舗 / 氏名 */}
        <GlassCard className="p-5 shadow-lg">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>店舗</label>
              <input
                type="text"
                autoComplete="off"
                enterKeyHint="next"
                className={inputCls}
                placeholder="店舗名"
                value={formData.storeName}
                onChange={(e) => updateData('storeName', e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>氏名</label>
              <input
                type="text"
                autoComplete="name"
                enterKeyHint="next"
                className={inputCls}
                placeholder="氏名"
                value={formData.authorName}
                onChange={(e) => updateData('authorName', e.target.value)}
              />
            </div>
          </div>
        </GlassCard>

        {/* Keep */}
        <GlassCard className="p-5 shadow-lg">
          <h2 className="text-lg font-black text-ink flex items-center gap-2 mb-1">
            <span className="grid place-items-center h-6 w-6 rounded-lg bg-qb-cyan/15 text-qb-cyan text-sm">⭕</span>
            Keep（続けること）
          </h2>
          <p className="text-xs font-bold text-ink-soft mb-3">今週「おっ、いい感じだな」と思った小さな成功や工夫は？</p>
          <SmoothTextArea
            placeholder="よかった点・続けるべきことを入力…"
            className={`${taCls} h-28`}
            value={formData.keep}
            onValueChange={(val) => updateData('keep', val)}
          />
        </GlassCard>

        {/* Problem */}
        <GlassCard className="p-5 shadow-lg">
          <h2 className="text-lg font-black text-ink flex items-center gap-2 mb-1">
            <span className="grid place-items-center h-6 w-6 rounded-lg bg-danger/10 text-danger text-sm">🔺</span>
            Problem（問題）
          </h2>
          <p className="text-xs font-bold text-ink-soft mb-3">気になった出来事（GAP）と、本来どうあるべきだったかをセットで。</p>
          <div className="space-y-3">
            <div>
              <label className={labelCls}>本来どうあるべきだったか</label>
              <SmoothTextArea
                placeholder="本来の目標・あるべき姿…"
                className={`${taCls} h-20`}
                value={formData.problem_ideal}
                onValueChange={(val) => updateData('problem_ideal', val)}
              />
            </div>
            <div>
              <label className={labelCls}>気になった出来事（GAP）</label>
              <SmoothTextArea
                placeholder="実際に起きた出来事・問題点…"
                className={`${taCls} h-20`}
                value={formData.problem_gap}
                onValueChange={(val) => updateData('problem_gap', val)}
              />
            </div>
          </div>
        </GlassCard>

        {/* Try */}
        <GlassCard className="p-5 shadow-lg">
          <h2 className="text-lg font-black text-ink flex items-center gap-2 mb-1">
            <span className="grid place-items-center h-6 w-6 rounded-lg bg-success/10 text-success text-sm">🏃</span>
            Try（来週の実験）
          </h2>
          <p className="text-xs font-bold text-ink-soft mb-3">GAPを埋めるために来週やること。「誰が・いつ・何を」を具体的に。</p>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>誰が</label>
                <input
                  type="text"
                  placeholder="例: 自分とチーム"
                  className={inputCls}
                  value={formData.try_who}
                  onChange={(e) => updateData('try_who', e.target.value)}
                />
              </div>
              <div>
                <label className={labelCls}>いつ</label>
                <input
                  type="text"
                  placeholder="例: 来週の月曜から"
                  className={inputCls}
                  value={formData.try_when}
                  onChange={(e) => updateData('try_when', e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className={labelCls}>何をどうする</label>
              <SmoothTextArea
                placeholder="具体的な行動…"
                className={`${taCls} h-24`}
                value={formData.try_what}
                onValueChange={(val) => updateData('try_what', val)}
              />
            </div>
            <div>
              <label className={labelCls}>なぜそれをするか（理由・任意）</label>
              <input
                type="text"
                placeholder="理由…"
                className={inputCls}
                value={formData.try_why}
                onChange={(e) => updateData('try_why', e.target.value)}
              />
            </div>
          </div>
        </GlassCard>

        {/* タスク（AMのみ） */}
        {isAM && (
          <GlassCard className="p-5 shadow-lg">
            <h2 className="text-lg font-black text-ink flex items-center gap-2 mb-1">
              <span className="grid place-items-center h-6 w-6 rounded-lg bg-qb-blue/10 text-qb-blue text-sm">📝</span>
              翌週のタスク洗い出し
            </h2>
            <p className="text-xs font-bold text-ink-soft mb-3">誰が・何を・いつまでに。送信するとカレンダーに反映されます。</p>

            <div className="bg-canvas p-3.5 rounded-2xl border border-line space-y-3">
              <div>
                <label className={labelCls}>タスク名（何を）</label>
                <input
                  type="text"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="例：在庫チェック"
                  className={inputCls}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>期日（いつまでに）</label>
                  <input
                    type="date"
                    value={newTaskDate}
                    onChange={(e) => setNewTaskDate(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>担当者（複数可）</label>
                  <MultiUserSelect
                    selectedUsers={newTaskAssignees}
                    onChange={setNewTaskAssignees}
                    placeholder="担当者を選択…"
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>詳細・備考（任意）</label>
                <SmoothTextArea
                  value={newTaskDesc}
                  onValueChange={setNewTaskDesc}
                  placeholder="任意"
                  className={`${taCls} h-16`}
                />
              </div>
              <button
                onClick={handleAddTask}
                disabled={!newTaskTitle || !newTaskDate}
                className="tap w-full flex items-center justify-center gap-2 bg-qb-blue/10 text-qb-blue border border-qb-blue/20 rounded-xl font-black disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all"
              >
                <Plus size={18} /> タスクを仮追加
              </button>
            </div>

            {formData.tasks && formData.tasks.length > 0 && (
              <div className="space-y-2 mt-3">
                <p className="text-xs font-black text-ink-soft">仮追加リスト（{formData.tasks.length}件）</p>
                {formData.tasks.map((task: any) => (
                  <div key={task.id} className="flex items-start justify-between bg-white border border-line p-3 rounded-xl shadow-sm">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-black text-ink text-sm truncate">{task.title}</h4>
                      <p className="text-xs text-qb-blue font-bold mt-0.5 truncate">{task.assignees.map((u: any) => u.name).join(', ')}</p>
                      <p className="text-xs text-ink-soft mt-0.5"><CalendarIcon size={11} className="inline mr-1"/>{task.date}</p>
                    </div>
                    <button type="button" onClick={() => handleRemoveTask(task.id)} className="tap grid place-items-center text-qb-gray hover:text-danger transition-colors shrink-0">
                      <X size={18} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        )}

        {/* 予約送信 */}
        <GlassCard className="p-5 shadow-lg">
          <h2 className="text-base font-black text-ink flex items-center gap-2 mb-1">
            <Clock size={18} className="text-qb-blue" /> 予約送信（任意）
          </h2>
          <p className="text-xs font-bold text-ink-soft mb-3">日時を指定すると、その時刻まで他の人には表示されず、記入者だけが確認できます（後から編集可）。</p>
          <div className="flex items-center gap-2">
            <input
              type="datetime-local"
              value={formData.scheduledFor || ''}
              onChange={(e) => updateData('scheduledFor', e.target.value)}
              className={inputCls}
            />
            {formData.scheduledFor && (
              <button
                onClick={() => updateData('scheduledFor', '')}
                className="tap grid place-items-center text-qb-gray hover:text-danger shrink-0"
                title="予約を解除"
              >
                <X size={18} />
              </button>
            )}
          </div>
          {isScheduled && (
            <p className="text-xs font-black text-qb-blue mt-2 flex items-center gap-1">
              <Info size={12} /> {new Date(formData.scheduledFor).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} に公開予約されます
            </p>
          )}
        </GlassCard>
      </div>

      {/* 固定アクションバー：一時保存 / 送信・予約送信 */}
      <div className="fixed bottom-0 left-0 right-0 z-[60] bg-white/95 backdrop-blur-xl border-t border-line shadow-[0_-6px_24px_rgba(0,0,75,0.08)]">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          {(!isEditMode || formData.status === 'draft') && (
            <button
              onClick={handleSaveDraft}
              disabled={isSubmitting}
              className="tap flex-1 rounded-2xl bg-canvas text-ink font-black border border-line active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Save size={18} /> 一時保存
            </button>
          )}
          <button
            onClick={handleSubmit}
            disabled={!isFormValid() || isSubmitting}
            className={`tap flex-[2] rounded-2xl text-white font-black flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 ${
              (!isFormValid() || isSubmitting) ? 'opacity-50 grayscale cursor-not-allowed' : ''
            } ${isScheduled ? 'bg-gradient-to-r from-qb-blue-dark to-qb-blue' : 'bg-gradient-to-r from-success to-qb-cyan'}`}
          >
            {isSubmitting ? (
              <><Loader2 className="animate-spin" size={18} /> 送信中</>
            ) : isScheduled ? (
              <><Clock size={18} /> {isEditMode ? '予約を保存' : '予約送信'}</>
            ) : (
              <><Send size={18} /> {isEditMode ? '上書き保存' : '送信する'}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
