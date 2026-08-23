import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { SmoothTextArea } from '../components/ui/SmoothTextArea';
import { getDoc, doc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { useReportStore, type Report } from '../store/useReportStore';
import { useAuthStore } from '../store/useAuthStore';
import { displayRole, formatStaffName } from '../lib/formatUtils';
import { isPubliclyVisibleReport } from '../lib/reportPermissions';
import { ThumbsUp, Lightbulb, Rocket, Stars, Send, ChevronLeft, MessageCircle, Edit, Trash2, Loader2, Trophy, Calendar, Minimize2, ChevronUp, ChevronDown, Sparkles, AlertTriangle, X, Columns, Rows } from 'lucide-react';

const REACTIONS = [
  { type: 'like', icon: ThumbsUp, label: 'いいね', color: 'text-qb-blue', bg: 'bg-qb-blue/10' },
  { type: 'learn', icon: Lightbulb, label: '学び', color: 'text-qb-yellow', bg: 'bg-qb-yellow/10' },
  { type: 'copy', icon: Rocket, label: '真似る', color: 'text-qb-cyan', bg: 'bg-qb-cyan/10' },
  { type: 'great', icon: Stars, label: '素敵', color: 'text-success', bg: 'bg-success/10' }
];

export const ReportDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { reports, addComment, getComments, markAsRead, init } = useReportStore();
  const { user: authUser } = useAuthStore();
  // D（表示側畳み込み）で store から重複docが除外され、ディープリンク先の id が
  // store に無いことがある。その場合 Firestore から単発 getDoc して表示する（読み取りのみ・非破壊）。
  const [fallbackReport, setFallbackReport] = useState<Report | null>(null);
  const [resolving, setResolving] = useState(false);
  const storeReport = reports.find(r => r.id === id);
  const report = storeReport || (fallbackReport && fallbackReport.id === id ? fallbackReport : null);

  const user = authUser || (typeof window !== 'undefined' ? (window as any).currentUser : null);

  const [comment, setComment] = useState('');
  const [comments, setComments] = useState<any[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [layoutMode, setLayoutMode] = useState<'bottom' | 'split'>('bottom');
  const [isMinimized, setIsMinimized] = useState(false);
  const [presetHeight, setPresetHeight] = useState<'compact' | 'normal' | 'large'>('normal');
  const [confirmDelete, setConfirmDelete] = useState(false);

  // 下部固定バーの実高を測って本文の余白を動的追従させる（被り解消）
  const bottomBarRef = useRef<HTMLDivElement>(null);
  const [bottomBarHeight, setBottomBarHeight] = useState(0);

  // Scroll to top on mount / id change
  useEffect(() => {
    window.scrollTo(0, 0);
    const unsub = init();
    return () => unsub();
  }, [id, init]);

  // store に無い id は Firestore から単発取得してフォールバック表示（読み取りのみ・書き込みしない）。
  useEffect(() => {
    if (storeReport) {
      // store が最優先。見つかったらフォールバックは破棄し、resolving も残さない。
      setFallbackReport(null);
      setResolving(false);
      return;
    }
    if (!id) return;
    let cancelled = false;
    setResolving(true);
    getDoc(doc(db, 'reports', id))
      .then((snap) => {
        if (cancelled) return;
        if (snap.exists()) {
          // 表示専用：weekNumber は data をそのまま採用（自動補正・updateDoc はしない）。
          setFallbackReport({ id: snap.id, ...snap.data() } as Report);
        } else {
          setFallbackReport(null);
        }
      })
      .catch((e) => {
        console.error('ReportDetail fallback getDoc failed:', e);
      })
      .finally(() => {
        if (!cancelled) setResolving(false);
      });
    return () => { cancelled = true; };
  }, [id, storeReport]);

  // Load draft from localStorage on mount
  useEffect(() => {
    if (report?.id) {
      const savedDraft = localStorage.getItem(`kpt_reply_draft_${report.id}`);
      if (savedDraft) {
        setComment(savedDraft);
      } else {
        setComment('');
      }
    }
  }, [report?.id]);

  // Handle comment state change with auto-save (local only)
  const handleCommentChange = (text: string) => {
    setComment(text);
  };

  // Debounced auto-save to localStorage
  useEffect(() => {
    if (!report?.id) return;
    if (comment === '') {
      localStorage.removeItem(`kpt_reply_draft_${report.id}`);
    } else {
      const t = setTimeout(() => {
        localStorage.setItem(`kpt_reply_draft_${report.id}`, comment);
      }, 500);
      return () => clearTimeout(t);
    }
  }, [comment, report?.id]);

  useEffect(() => {
    if (report && user?.uid) {
      // 「見たよ」の書き込み（readBy updateDoc＋著者通知）は store 由来のレポートだけに限定。
      // fallback getDoc で開いた（storeに無い＝畳み込みで隠れたdoc/直リンク）レポートは読み取り専用。
      if (storeReport) markAsRead(report.id, user.uid);
      const unsubscribe = getComments(report.id, (cmts) => setComments(cmts));
      return () => unsubscribe();
    }
  }, [report, storeReport, user?.uid, getComments, markAsRead]);

  // 下部固定バーの実高を ResizeObserver で追従（bottomレイアウト・非たたみ時のみ）
  useEffect(() => {
    if (layoutMode !== 'bottom' || isMinimized) {
      setBottomBarHeight(0);
      return;
    }
    const el = bottomBarRef.current;
    if (!el) return;
    const measure = () => setBottomBarHeight(el.getBoundingClientRect().height);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [layoutMode, isMinimized, presetHeight]);

  const isMaster = user?.role === 'BM';
  const isOwner = user?.uid === report?.authorId;
  const { viewMode } = useAuthStore();
  const activeRole = isMaster && viewMode ? viewMode : user?.role;
  const currentUid = user?.uid || (user as any)?.id || null;

  // 権限チェック（共有述語に集約）: authorRole だけでなく draft/未来予約も判定する
  // isPubliclyVisibleReport に統一。fallback getDoc は status 無関係に取得するため、
  // 他人の下書き・他人の未来予約の直リンク露出をここで塞ぐ（自分のものは isOwner で従来どおり閲覧可）。
  if (report && !isPubliclyVisibleReport(report, activeRole, currentUid)) {
    return <div className="text-center py-20 text-ink-soft font-bold">閲覧権限がありません。</div>;
  }

  if (!report) return resolving
    ? <div className="text-center py-20 text-ink-soft font-bold">読み込み中…</div>
    : <div className="text-center py-20 text-ink-soft font-bold">レポートが見つからないか、削除されました。</div>;

  const sameWeekReports = reports.filter(r => r.weekNumber === report.weekNumber && r.year === report.year);
  const maxAmKpt = Math.max(0, ...sameWeekReports.map(r => r.reactions?.find((re: any) => re.type === 'best_kpt_am')?.count || 0));
  const maxSmKpt = Math.max(0, ...sameWeekReports.map(r => r.reactions?.find((re: any) => re.type === 'best_kpt_sm')?.count || 0));

  const hasBestBm = report.reactions?.some((r: any) => r.type === 'best_kpt' && r.count > 0);
  const amCount = report.reactions?.find((r: any) => r.type === 'best_kpt_am')?.count || 0;
  const hasBestAm = maxAmKpt > 0 && amCount === maxAmKpt;
  const smCount = report.reactions?.find((r: any) => r.type === 'best_kpt_sm')?.count || 0;
  const hasBestSm = maxSmKpt > 0 && smCount === maxSmKpt;

  const bestType = hasBestBm ? 'BM' : hasBestAm ? 'AM' : hasBestSm ? 'SM' : null;
  const hasBestKpt = bestType !== null;

  const cardBgStyle = bestType === 'BM' ? 'ring-2 ring-qb-cyan/50 bg-gradient-to-br from-qb-cyan/5 to-white'
                    : bestType === 'AM' ? 'ring-2 ring-qb-blue/50 bg-gradient-to-br from-qb-blue/5 to-white'
                    : bestType === 'SM' ? 'ring-2 ring-purple-400/50 bg-gradient-to-br from-purple-50 to-white' : '';
  const topBarStyle = bestType === 'BM' ? 'bg-gradient-to-r from-qb-cyan to-qb-blue'
                    : bestType === 'AM' ? 'bg-gradient-to-r from-qb-blue to-qb-blue-dark'
                    : bestType === 'SM' ? 'bg-gradient-to-r from-purple-400 to-fuchsia-500' : '';

  // ↑↓ 他スタッフKPT横断ナビ用リスト（ストアは createdAt 降順ソート済み＝一覧と同じ並び）。
  // 公開可否述語で一覧(MainBoard)と集合を一致させ、他人の下書き/未来予約には飛べないようにする。
  // ※月(selectedMonth)/filterRole は MainBoard 固有のローカルUIのため、別画面のここには持ち込まない。
  // currentUid / activeRole は描画ゲートより前で算出済み（二重定義しない）。
  const viewableReports = reports.filter(r => isPubliclyVisibleReport(r, activeRole, currentUid));
  const currentIndex = viewableReports.findIndex(r => r.id === report.id);
  const prevReport = currentIndex > 0 ? viewableReports[currentIndex - 1] : null;
  const nextReport = currentIndex >= 0 && currentIndex < viewableReports.length - 1 ? viewableReports[currentIndex + 1] : null;

  // 下部固定バーの被り解消：bottomレイアウト時のみ本文の下余白をバー実高に追従
  const bottomContentPadding =
    layoutMode !== 'bottom'
      ? undefined
      : isMinimized
        ? 'calc(env(safe-area-inset-bottom) + 88px)' // たたみ時＝再表示ボタン分の余白
        : `calc(${bottomBarHeight}px + env(safe-area-inset-bottom) + 16px)`;

  const handleSendComment = async () => {
    const currentUser = user || auth.currentUser;
    if (!comment.trim() || isSending) { return; }
    if (!currentUser) { return; }

    setIsSending(true);
    try {
      await addComment(report.id, {
        authorId: currentUser.uid || currentUser.id,
        authorName: currentUser.name || '名無し',
        authorRole: currentUser.role || '店長',
        authorPhotoURL: currentUser.photoURL || '',
        text: comment
      });
      setComment('');
      if (report?.id) {
        localStorage.removeItem(`kpt_reply_draft_${report.id}`);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSending(false);
    }
  };

  const handleDelete = async () => {
    try {
      await useReportStore.getState().deleteReport(report.id);
      navigate('/');
    } catch (err) {
      console.error('削除に失敗しました', err);
    }
  };

  const handleEdit = () => {
    navigate(`/edit/${report.id}`);
  };

  const quickPhrases = [
    'お疲れ様です！',
    '素晴らしい取り組みですね！',
    '学びになります！',
    '次回の挑戦も応援します！',
    'サポートします！'
  ];

  // ============ 共有パーツ（両レイアウトで使用） ============

  const StatusBadges = () => (
    <>
      {report.status === 'draft' && (
        <span className="text-xs font-black text-qb-gray bg-canvas border border-line px-1.5 py-0.5 rounded shrink-0 flex items-center gap-1">下書き<span className="font-bold opacity-70">（本人のみ）</span></span>
      )}
      {report.status === 'published' && report.scheduledFor && new Date(report.scheduledFor) > new Date() && (
        <span className="text-xs font-black text-qb-blue bg-qb-blue/10 border border-qb-blue/30 px-1.5 py-0.5 rounded shrink-0 flex items-center gap-1">
          <Calendar size={10} /> 予約 {new Date(report.scheduledFor).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </span>
      )}
    </>
  );

  // BEST KPT 選定ボタン（整列・コンパクト）
  const renderBestKpt = () => {
    if (!(activeRole === 'BM' || activeRole === 'AM' || activeRole === '店長')) return null;
    const kptType = activeRole === 'BM' ? 'best_kpt' : activeRole === 'AM' ? 'best_kpt_am' : 'best_kpt_sm';
    const kptLabel = activeRole === 'BM' ? 'BM BEST KPT' : activeRole === 'AM' ? 'AM BEST KPT' : '店長 BEST KPT';
    const hasGiven = report.reactions?.find((r: any) => r.type === kptType)?.userIds?.includes(user?.uid) || false;
    const kptCount = report.reactions?.find((r: any) => r.type === kptType)?.count || 0;

    const givenStyle = activeRole === 'BM' ? 'bg-gradient-to-r from-qb-cyan to-qb-blue text-white border-transparent shadow-md'
                     : activeRole === 'AM' ? 'bg-gradient-to-r from-qb-blue to-qb-blue-dark text-white border-transparent shadow-md'
                     : 'bg-gradient-to-r from-purple-500 to-fuchsia-500 text-white border-transparent shadow-md';
    // 未選定でも「押せるボタン」だと分かるよう、色付き背景+枠線+影で明確なアフォーダンスを持たせる
    const idleStyle = activeRole === 'BM' ? 'bg-qb-cyan/10 text-qb-blue border-qb-cyan/40 shadow-sm hover:bg-qb-cyan/20 hover:border-qb-cyan hover:shadow-md'
                     : activeRole === 'AM' ? 'bg-qb-blue/10 text-qb-blue-dark border-qb-blue/40 shadow-sm hover:bg-qb-blue/20 hover:border-qb-blue hover:shadow-md'
                     : 'bg-purple-50 text-purple-600 border-purple-300 shadow-sm hover:bg-purple-100 hover:border-purple-400 hover:shadow-md';

    return (
      <div className="pt-3 border-t border-line">
        <button
          onClick={(e) => {
            e.preventDefault();
            if (user) {
              useReportStore.getState().addReaction(report.id, kptType, {
                uid: user.uid || (user as any).id,
                name: user.name,
                role: user.role
              });
            }
          }}
          className={`tap w-full rounded-2xl px-4 min-h-[52px] flex items-center justify-center gap-2 font-black border-2 transition-all active:scale-95 ${hasGiven ? givenStyle : idleStyle}`}
        >
          <motion.span animate={{ rotate: hasGiven ? [0, -12, 12, -8, 0] : 0 }} transition={{ duration: 0.5 }}>
            <Trophy size={22} fill={hasGiven ? 'currentColor' : 'none'} />
          </motion.span>
          <span className="text-sm">{hasGiven ? `${kptLabel} 選定済` : `${kptLabel} に選定`}</span>
          {kptCount > 0 && <span className="text-sm tabular">({kptCount})</span>}
        </button>
      </div>
    );
  };

  // リアクション4種（整列グリッド）
  const renderReactions = () => (
    <div className="grid grid-cols-4 gap-2 pt-3 border-t border-line">
      {REACTIONS.map((r) => {
        const rc = report.reactions?.find(react => react.type === r.type);
        const count = rc?.count || 0;
        const mine = rc?.userIds?.includes(user?.uid) || false;
        const names = (rc?.userNames || []).map(n => formatStaffName(n)).join('、');
        return (
          <button
            key={r.type}
            title={names || undefined}
            onClick={(e) => {
              e.preventDefault();
              if (user) {
                useReportStore.getState().addReaction(report.id, r.type, {
                  uid: user.uid || (user as any).id,
                  name: user.name,
                  role: user.role
                });
              }
            }}
            className={`tap flex flex-col items-center justify-start gap-1 rounded-2xl py-2.5 px-1 min-h-[86px] border transition-all active:scale-95 ${mine ? 'border-qb-cyan bg-qb-cyan/10' : 'border-line bg-white hover:border-qb-cyan/40'}`}
          >
            <span className={`grid place-items-center h-9 w-9 rounded-xl ${r.bg} ${r.color}`}>
              <r.icon size={18} />
            </span>
            <span className="text-xs font-black text-ink leading-none">{r.label}</span>
            <span className="text-xs font-black text-ink-soft tabular leading-none">{count}</span>
            {names && <span className="text-xs text-qb-gray leading-tight text-center line-clamp-1 w-full px-0.5">{names}</span>}
          </button>
        );
      })}
    </div>
  );

  // レポート本文カード（見出し＋KEEP/Problem/Try＋BEST KPT＋リアクション）
  const renderReportCard = () => (
    <div className={`relative glass rounded-3xl p-4 sm:p-5 shadow-sm overflow-hidden space-y-4 ${cardBgStyle}`}>
      {hasBestKpt && <div className={`absolute top-0 inset-x-0 h-1.5 ${topBarStyle} z-10`} />}

      {/* ヘッダー */}
      <div className="flex items-center gap-3 border-b border-line pb-3">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-qb-blue to-qb-cyan flex items-center justify-center text-xl shadow-md overflow-hidden shrink-0">
          {report.authorPhotoURL ? (
            <img src={report.authorPhotoURL} alt={report.authorName} className="w-full h-full object-cover" />
          ) : (
            report.authorRole === '店長' ? '🏠' : '👔'
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h2 className="text-lg font-black text-ink truncate">{formatStaffName(report.authorName)}</h2>
            <span className="text-xs font-black bg-qb-blue text-white px-1.5 py-0.5 rounded shrink-0">{displayRole(report.authorRole)}</span>
            <StatusBadges />
          </div>
          <p className="text-xs font-bold text-ink-soft mt-0.5">{report.storeName} • 第{report.weekNumber}週</p>
        </div>
        {(activeRole === 'BM' || isOwner) && (
          <div className="flex gap-1.5 shrink-0">
            <button onClick={handleEdit} className="tap grid place-items-center rounded-xl bg-canvas text-ink-soft border border-line hover:text-qb-blue transition-colors" title="編集"><Edit size={16} /></button>
            <button onClick={() => setConfirmDelete(true)} className="tap grid place-items-center rounded-xl bg-danger/10 text-danger border border-danger/20 hover:bg-danger/20 transition-colors" title="削除"><Trash2 size={16} /></button>
          </div>
        )}
      </div>

      {/* KEEP */}
      <section>
        <h3 className="text-xs font-black tracking-wider flex items-center gap-2 mb-1.5 text-qb-cyan">
          <span className="w-1 h-4 rounded-full bg-qb-cyan" /> KEEP（続けること）
        </h3>
        <div className="text-ink leading-relaxed bg-canvas p-3.5 rounded-2xl border border-line text-[15px] font-medium prose prose-sm max-w-none whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: report.keep }} />
      </section>

      {/* Problem / Try */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <section>
          <h3 className="text-xs font-black tracking-wider flex items-center gap-2 mb-1.5 text-danger">
            <span className="w-1 h-4 rounded-full bg-danger" /> PROBLEM（問題点）
          </h3>
          <div className="bg-danger/5 p-3.5 rounded-2xl border border-danger/10 space-y-2.5 h-full">
            <div>
              <label className="text-xs font-black text-danger/80 block mb-0.5">気になった出来事（GAP）</label>
              <div className="text-sm text-ink leading-relaxed font-medium prose prose-sm max-w-none whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: report.problem_gap }} />
            </div>
            <div>
              <label className="text-xs font-black text-danger/80 block mb-0.5">本来あるべき姿</label>
              <div className="text-sm text-ink-soft leading-relaxed prose prose-sm max-w-none whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: report.problem_ideal }} />
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-xs font-black tracking-wider flex items-center gap-2 mb-1.5 text-success">
            <span className="w-1 h-4 rounded-full bg-success" /> TRY（次の挑戦）
          </h3>
          <div className="bg-success/5 p-3.5 rounded-2xl border border-success/10 space-y-2 h-full">
            <p className="text-sm font-black text-ink leading-relaxed whitespace-pre-wrap">{report.try_what}</p>
            <div className="flex flex-wrap gap-1.5">
              <span className="text-xs bg-white border border-line px-2 py-0.5 rounded-full text-ink-soft font-bold">誰が: {report.try_who}</span>
              <span className="text-xs bg-white border border-line px-2 py-0.5 rounded-full text-ink-soft font-bold">いつ: {report.try_when}</span>
            </div>
            {report.try_why && <p className="text-xs text-qb-gray">理由: {report.try_why}</p>}
          </div>
        </section>
      </div>

      {/* BEST KPT + リアクション */}
      {renderBestKpt()}
      {renderReactions()}
    </div>
  );

  // コメント1件（いいね整列）
  const renderComment = (c: any, idx: number) => {
    const likeRc = c.reactions?.find((r: any) => r.type === 'like');
    const likeCount = likeRc?.userIds?.length || 0;
    const mine = likeRc?.userIds?.includes(user?.uid) || false;
    const names = (likeRc?.userNames || []).map((n: string) => formatStaffName(n)).join('、');
    return (
      <motion.div
        key={c.id}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: Math.min(idx * 0.04, 0.3) }}
        className="flex gap-2.5"
      >
        <div className="w-9 h-9 rounded-xl bg-canvas border border-line flex items-center justify-center text-base shrink-0 overflow-hidden">
          {c.authorPhotoURL ? (
            <img src={c.authorPhotoURL} alt={c.authorName} className="w-full h-full object-cover" />
          ) : (
            c.authorRole === 'AM' ? '🎩' : '👤'
          )}
        </div>
        <div className="glass rounded-2xl p-3 flex-1 min-w-0 copy-ok">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="font-black text-sm text-ink truncate">{formatStaffName(c.authorName)}</span>
            <span className={`text-xs text-white px-1.5 py-0.5 rounded-full font-black shrink-0 ${c.authorRole === 'AM' ? 'bg-qb-blue' : 'bg-qb-gray'}`}>
              {displayRole(c.authorRole)}
            </span>
            <span className="text-xs text-qb-gray ml-auto tabular shrink-0">{new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <div className="text-sm text-ink leading-relaxed font-medium prose prose-sm max-w-none whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: c.text }} />
          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-line">
            {names && <span className="text-xs text-qb-gray truncate flex-1">{names}</span>}
            <button
              onClick={(e) => {
                e.preventDefault();
                if (user) {
                  useReportStore.getState().addCommentReaction(report.id, c.id, 'like', {
                    uid: user.uid || (user as any).id,
                    name: user.name
                  });
                }
              }}
              className={`tap ml-auto inline-flex items-center gap-1 px-3 rounded-full text-xs font-black transition-colors ${mine ? 'bg-qb-blue/10 text-qb-blue' : 'bg-canvas text-qb-gray hover:bg-line'}`}
            >
              <ThumbsUp size={12} /> {likeCount}
            </button>
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <>
      <div
        className={`mx-auto px-4 pt-4 animate-fade-in ${layoutMode === 'split' ? 'max-w-7xl h-screen flex flex-col pb-4' : 'max-w-3xl space-y-5'}`}
        style={bottomContentPadding ? { paddingBottom: bottomContentPadding } : undefined}
      >
        {/* ヘッダーバー */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <button
              onClick={() => navigate('/')}
              className="tap flex items-center gap-1 text-ink-soft font-bold hover:text-ink transition-all text-sm min-h-[44px] shrink-0"
            >
              <ChevronLeft size={18} /> 戻る
            </button>

            {/* ↑↓ 他スタッフKPT横断ナビ */}
            <div className="flex items-center gap-1 min-w-0">
              <button
                onClick={() => prevReport && navigate(`/report/${prevReport.id}`)}
                disabled={!prevReport}
                title={prevReport ? `前へ: ${formatStaffName(prevReport.authorName)}` : '前のKPTはありません'}
                className="tap flex items-center gap-1 rounded-xl border border-line bg-white px-2 min-h-[44px] text-qb-blue transition-all active:scale-95 hover:border-qb-cyan disabled:opacity-40 disabled:pointer-events-none"
              >
                <ChevronUp size={16} className="shrink-0" />
                <span className="flex flex-col items-start leading-none min-w-0">
                  <span className="text-[10px] font-black text-qb-gray">前へ</span>
                  {prevReport && (
                    <span className="text-[11px] font-bold text-ink truncate max-w-[64px]">
                      {formatStaffName(prevReport.authorName)}
                      <span className="text-qb-gray">・{displayRole(prevReport.authorRole)}</span>
                    </span>
                  )}
                </span>
              </button>
              <button
                onClick={() => nextReport && navigate(`/report/${nextReport.id}`)}
                disabled={!nextReport}
                title={nextReport ? `次へ: ${formatStaffName(nextReport.authorName)}` : '次のKPTはありません'}
                className="tap flex items-center gap-1 rounded-xl border border-line bg-white px-2 min-h-[44px] text-qb-blue transition-all active:scale-95 hover:border-qb-cyan disabled:opacity-40 disabled:pointer-events-none"
              >
                <ChevronDown size={16} className="shrink-0" />
                <span className="flex flex-col items-start leading-none min-w-0">
                  <span className="text-[10px] font-black text-qb-gray">次へ</span>
                  {nextReport && (
                    <span className="text-[11px] font-bold text-ink truncate max-w-[64px]">
                      {formatStaffName(nextReport.authorName)}
                      <span className="text-qb-gray">・{displayRole(nextReport.authorRole)}</span>
                    </span>
                  )}
                </span>
              </button>
            </div>
          </div>

          {/* デスクトップ用レイアウト切替 */}
          <div className="hidden md:flex items-center gap-1 bg-surface p-1 rounded-full border border-line text-xs font-black">
            <button
              onClick={() => setLayoutMode('bottom')}
              className={`tap px-3 rounded-full transition-all flex items-center gap-1.5 ${layoutMode === 'bottom' ? 'bg-gradient-to-r from-qb-blue to-qb-cyan text-white shadow' : 'text-qb-gray hover:text-ink'}`}
            >
              <Rows size={13} /> 通常
            </button>
            <button
              onClick={() => setLayoutMode('split')}
              className={`tap px-3 rounded-full transition-all flex items-center gap-1.5 ${layoutMode === 'split' ? 'bg-gradient-to-r from-qb-blue to-qb-cyan text-white shadow' : 'text-qb-gray hover:text-ink'}`}
            >
              <Columns size={13} /> 2画面
            </button>
          </div>
        </div>

        {layoutMode === 'split' ? (
          /* ============ 2画面分割（デスクトップ） ============ */
          <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-5 min-h-0 mt-3 overflow-hidden">
            {/* 左: レポート */}
            <div className="md:col-span-7 flex flex-col min-h-0 h-full">
              <div className="overflow-y-auto pr-2 flex-1 pb-6 no-scrollbar h-full">
                {renderReportCard()}
              </div>
            </div>

            {/* 右: コメント + エディター */}
            <div className="md:col-span-5 flex flex-col h-full bg-surface rounded-3xl border border-line p-4 shadow-sm min-h-0">
              <div className="flex items-center justify-between border-b border-line pb-3 shrink-0">
                <div className="flex items-center gap-2">
                  <MessageCircle className="text-qb-blue" size={18} />
                  <h3 className="text-base font-black text-ink">スレッド返信</h3>
                </div>
                <span className="text-xs bg-canvas px-2.5 py-1 rounded-full text-ink-soft font-bold tabular">{comments.length} 件</span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 py-3 pr-1 no-scrollbar">
                {comments.length === 0 ? (
                  <div className="text-center py-12 text-ink-soft font-bold text-sm">
                    まだコメントはありません。<br />最初のフィードバックを届けてみましょう！
                  </div>
                ) : (
                  comments.map((c, idx) => renderComment(c, idx))
                )}
              </div>

              {/* エディター */}
              <div className="border-t border-line pt-3 shrink-0 flex flex-col gap-2.5">
                <div className="flex flex-wrap gap-1.5">
                  {quickPhrases.map((phrase) => (
                    <button
                      key={phrase}
                      onClick={(e) => { e.preventDefault(); handleCommentChange(comment ? `${comment}\n${phrase}` : phrase); }}
                      className="tap text-xs font-black text-ink-soft bg-canvas hover:bg-line border border-line px-2.5 rounded-full transition-all active:scale-95"
                    >
                      + {phrase}
                    </button>
                  ))}
                </div>

                <div className="relative flex flex-col bg-white rounded-2xl border-2 border-line focus-within:border-qb-cyan transition-all shadow-sm p-3">
                  <SmoothTextArea
                    className="copy-ok w-full min-h-[110px] max-h-[220px] p-2 bg-transparent outline-none resize-y text-ink font-medium text-sm leading-relaxed"
                    value={comment}
                    id="split-textarea"
                    onValueChange={handleCommentChange}
                    placeholder="チームにポジティブな言葉を届けよう..."
                  />
                  <div className="flex items-center justify-between border-t border-line pt-2.5 mt-2">
                    <span className="text-xs font-black text-qb-gray bg-canvas px-2 py-0.5 rounded-full tabular">下書き保存済 ({comment.length}文字)</span>
                    <motion.button
                      whileHover={isSending ? {} : { scale: 1.05 }}
                      whileTap={isSending ? {} : { scale: 0.95 }}
                      onClick={handleSendComment}
                      disabled={isSending}
                      className="tap px-5 bg-gradient-to-r from-qb-blue to-qb-cyan text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md disabled:opacity-50"
                    >
                      {isSending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                      <span>{isSending ? '送信中...' : '送信する'}</span>
                    </motion.button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ============ 通常レイアウト（モバイル既定） ============ */
          <>
            {renderReportCard()}

            {/* コメント */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <MessageCircle className="text-qb-blue" size={20} />
                <h3 className="text-base font-black text-ink">みんなのコメント</h3>
                <span className="text-xs bg-canvas border border-line px-2 py-0.5 rounded-full text-ink-soft font-bold tabular ml-auto">{comments.length} 件</span>
              </div>
              <div className="space-y-3">
                {comments.length === 0 ? (
                  <div className="text-center py-10 text-ink-soft font-bold text-sm glass rounded-3xl">
                    まだコメントはありません。<br />最初のフィードバックを届けてみましょう！
                  </div>
                ) : (
                  comments.map((c, idx) => renderComment(c, idx))
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* コメント入力（通常レイアウトの下部固定バー） */}
      {layoutMode === 'bottom' && (
        <AnimatePresence>
          {!isMinimized && (
            <motion.div
              ref={bottomBarRef}
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="fixed bottom-0 left-0 right-0 p-3 pb-4 bg-white/95 backdrop-blur-xl border-t border-line z-50 shadow-[0_-6px_24px_rgba(0,0,75,0.10)]"
            >
              <div className="max-w-3xl mx-auto flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-ink-soft flex items-center gap-1">
                    <Sparkles size={12} className="text-qb-cyan" /> コメント下書き
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 bg-canvas px-2 py-1 rounded-lg border border-line text-xs font-black text-ink-soft">
                      <span>高さ:</span>
                      <button onClick={() => setPresetHeight('compact')} className={`px-2 rounded transition-all ${presetHeight === 'compact' ? 'bg-qb-cyan text-white' : 'hover:text-ink'}`}>小</button>
                      <button onClick={() => setPresetHeight('normal')} className={`px-2 rounded transition-all ${presetHeight === 'normal' ? 'bg-qb-cyan text-white' : 'hover:text-ink'}`}>中</button>
                      <button onClick={() => setPresetHeight('large')} className={`px-2 rounded transition-all ${presetHeight === 'large' ? 'bg-qb-cyan text-white' : 'hover:text-ink'}`}>大</button>
                    </div>
                    <button
                      onClick={() => setIsMinimized(true)}
                      className="tap text-xs font-black text-ink-soft hover:text-ink flex items-center gap-0.5 px-2 rounded-lg bg-canvas border border-line"
                      title="入力欄をたたむ"
                    >
                      <Minimize2 size={12} /> <span>たたむ</span>
                    </button>
                  </div>
                </div>

                <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                  {quickPhrases.map((phrase) => (
                    <button
                      key={phrase}
                      onClick={(e) => { e.preventDefault(); handleCommentChange(comment ? `${comment}\n${phrase}` : phrase); }}
                      className="tap text-xs font-black text-ink-soft bg-canvas hover:bg-line border border-line px-2.5 rounded-full whitespace-nowrap transition-all active:scale-95"
                    >
                      + {phrase}
                    </button>
                  ))}
                </div>

                <div className="flex gap-2.5 items-end">
                  <div className="flex-1 relative bg-white rounded-2xl overflow-hidden border-2 border-line focus-within:border-qb-cyan transition-all shadow-sm">
                    <SmoothTextArea
                      className={`copy-ok w-full p-3 bg-transparent outline-none resize-none text-ink font-medium leading-relaxed transition-all text-sm ${
                        presetHeight === 'compact' ? 'min-h-[44px] h-[44px]' :
                        presetHeight === 'normal' ? 'min-h-[76px] h-[76px] sm:min-h-[110px] sm:h-[110px]' : 'min-h-[160px] h-[160px] sm:min-h-[240px] sm:h-[240px]'
                      }`}
                      value={comment}
                      id="bottom-textarea"
                      onValueChange={handleCommentChange}
                      placeholder="チームにポジティブな言葉を届けよう..."
                    />
                    <span className="absolute bottom-2 right-3 text-xs font-black text-qb-gray pointer-events-none tabular">{comment.length}字</span>
                  </div>
                  <motion.button
                    whileHover={isSending ? {} : { scale: 1.08 }}
                    whileTap={isSending ? {} : { scale: 0.92 }}
                    onClick={handleSendComment}
                    disabled={isSending}
                    className="tap w-12 h-12 shrink-0 bg-gradient-to-br from-qb-blue to-qb-cyan text-white rounded-2xl flex items-center justify-center shadow-lg disabled:opacity-50"
                  >
                    {isSending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* たたむ→再表示ボタン */}
      {layoutMode === 'bottom' && isMinimized && (
        <motion.button
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          onClick={() => setIsMinimized(false)}
          className="tap fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gradient-to-r from-qb-blue to-qb-cyan text-white font-black px-6 rounded-full shadow-xl flex items-center gap-2 hover:scale-105 active:scale-95 transition-all text-sm"
        >
          <MessageCircle size={18} fill="currentColor" />
          <span>返信・コメントを入力する</span>
          <ChevronUp size={14} />
        </motion.button>
      )}

      {/* 削除確認モーダル（confirm置換） */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[125] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={() => setConfirmDelete(false)}
          >
            <motion.div
              initial={{ scale: 0.92, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 16 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6 border border-line"
            >
              <div className="flex flex-col items-center text-center gap-2 mb-5">
                <span className="grid place-items-center h-12 w-12 rounded-2xl bg-danger/10 text-danger">
                  <AlertTriangle size={24} />
                </span>
                <h3 className="text-lg font-black text-ink">この報告を削除しますか？</h3>
                <p className="text-sm font-bold text-ink-soft leading-relaxed">削除すると元に戻せません。コメントも一緒に見えなくなります。</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="tap flex-1 rounded-xl bg-canvas text-ink-soft font-bold border border-line active:scale-95 transition-all"
                >
                  やめる
                </button>
                <button
                  onClick={() => { setConfirmDelete(false); handleDelete(); }}
                  className="tap flex-1 rounded-xl bg-danger text-white font-black shadow-md active:scale-95 transition-all flex items-center justify-center gap-1.5"
                >
                  <Trash2 size={16} /> 削除する
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
