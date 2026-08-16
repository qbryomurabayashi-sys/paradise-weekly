import React, { useState, useRef, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { MainBoard } from './pages/MainBoard';
import { PostReport } from './pages/PostReport';
import { ReportDetail } from './pages/ReportDetail';
import { Login } from './pages/Login';
import { Profile } from './pages/Profile';
import { ProfileEdit } from './pages/ProfileEdit';
import { Achievements } from './pages/Achievements';
import { AdminDashboard } from './pages/AdminDashboard';
import { CalendarView } from './pages/CalendarView';
import { ProjectsView } from './pages/ProjectsView';
import { PostAnnouncement } from './pages/PostAnnouncement';
import { ShiftDashboard } from './pages/ShiftDashboard';
import { StaffShiftRequest } from './pages/StaffShiftRequest';
import { useAuthStore } from './store/useAuthStore';
import { useReportStore } from './store/useReportStore';
import { useNotificationStore } from './store/useNotificationStore';
import { useUsersStore } from './store/useUsersStore';
import { KeyPassManagement } from './pages/KeyPassManagement';
import { LeavePlanDashboard } from './pages/LeavePlanDashboard';
import { StoreMetrics } from './pages/StoreMetrics';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useAppUpdate } from './hooks/useAppUpdate';
import { Home, PlusSquare, User, Bell, Sparkles, MessageCircle, Heart, X, CheckCircle, Calendar, MessageSquare, Key, RefreshCcw, TrendingUp, Lightbulb, ShieldAlert, Lock, Scissors } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from './lib/firebase';

const Header = () => {
  const { user, viewMode } = useAuthStore();
  const { notifications, unreadCount, init: initNotif, markAsRead, markAllAsRead } = useNotificationStore();
  const [tapCount, setTapCount] = useState(0);
  const tapTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const navigate = useNavigate();

  const activeRole = user?.role === 'BM' && viewMode ? viewMode : user?.role;

  useEffect(() => {
    if (user?.uid) {
      const unsubscribe = initNotif(user.uid);
      return () => unsubscribe();
    }
  }, [user?.uid, initNotif]);

  const handleSparkleClick = async () => {
    if (!user || user.role === 'BM') return;
    if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
    
    tapTimeoutRef.current = setTimeout(() => setTapCount(0), 1000);
    const newCount = tapCount + 1;
    setTapCount(newCount);

    if (newCount >= 5) {
        setTapCount(0);
        if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
        // iframe内ではpromptが使えないため、この機能は無効化するか、別のUIを使用する必要があります
        console.error("開発者用パスワードの入力は現在無効化されています。");
    }
  };

  const handleNotificationClick = (notif: any) => {
    if (!user) return;
    markAsRead(user.uid, notif.id);
    setIsNotifOpen(false);
    if (notif.reportId === 'projects') {
      navigate('/projects');
    } else {
      navigate(`/report/${notif.reportId}`);
    }
  };

  return (
    <header className="p-4 sm:p-6 flex justify-between items-center max-w-5xl w-full mx-auto z-50">
      <div className="flex items-center gap-3 relative">
        <div className="relative">
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="w-10 h-10 bg-white/40 rounded-2xl flex flex-col items-center justify-center border border-white/40 shadow-sm cursor-pointer active:scale-95 transition-transform space-y-1"
          >
            <div className={`w-4 h-0.5 bg-paradise-sunset rounded-full transition-transform ${isMenuOpen ? 'rotate-45 translate-y-1.5' : ''}`} />
            <div className={`w-4 h-0.5 bg-paradise-sunset rounded-full transition-opacity ${isMenuOpen ? 'opacity-0' : ''}`} />
            <div className={`w-4 h-0.5 bg-paradise-sunset rounded-full transition-transform ${isMenuOpen ? '-rotate-45 -translate-y-1.5' : ''}`} />
          </button>

          <AnimatePresence>
            {isMenuOpen && (
              <>
                {/* Background overlay */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setIsMenuOpen(false)}
                  className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100]"
                />

                {/* Sidebar Drawer Panel */}
                <motion.div
                  initial={{ x: '-100%', opacity: 0.95 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: '-100%', opacity: 0.95 }}
                  transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                  className="fixed top-0 left-0 bottom-0 w-[280px] sm:w-[320px] bg-white/95 backdrop-blur-2xl shadow-2xl border-r border-white/25 z-[110] flex flex-col p-6 overflow-y-auto no-scrollbar text-left"
                >
                  {/* Drawer Header */}
                  <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-4">
                    <div>
                      <h3 className="font-extrabold text-ink text-lg tracking-wide">メニュー</h3>
                      <p className="text-xs text-ink-soft font-bold tracking-wide">QB HOUSE 管理者共有ツール</p>
                    </div>
                    <button
                      onClick={() => setIsMenuOpen(false)}
                      className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700 flex items-center justify-center transition-all cursor-pointer"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {/* Category 1: Main */}
                  <div className="space-y-1">
                    <span className="text-xs font-black text-qb-cyan bg-qb-cyan/10 px-2.5 py-1 rounded-md tracking-wide inline-block mb-1">メイン</span>
                    <Link to="/" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 p-2.5 rounded-xl text-gray-700 hover:bg-paradise-sunset/10 font-bold transition-all text-sm">
                      <div className="p-1.5 bg-gray-100 text-gray-600 rounded-lg shrink-0"><Home size={16} /></div>
                      <span>ホーム</span>
                    </Link>
                    <Link to="/post" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 p-2.5 rounded-xl text-gray-700 hover:bg-paradise-sunset/10 font-bold transition-all text-sm">
                      <div className="p-1.5 bg-gray-100 text-gray-600 rounded-lg shrink-0"><PlusSquare size={16} /></div>
                      <span>投稿・報告</span>
                    </Link>
                    <Link to="/calendar" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 p-2.5 rounded-xl text-gray-700 hover:bg-paradise-sunset/10 font-bold transition-all text-sm">
                      <div className="p-1.5 bg-gray-100 text-gray-600 rounded-lg shrink-0"><Calendar size={16} /></div>
                      <span>カレンダー</span>
                    </Link>
                  </div>

                  {/* Category 2: Shifts & Planning */}
                  <div className="space-y-1 mt-5">
                    <span className="text-xs font-black text-qb-blue bg-qb-blue/10 px-2.5 py-1 rounded-md tracking-wide inline-block mb-1">シフト・公出有休管理</span>
                    <Link to="/shift" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 p-2.5 rounded-xl text-gray-700 hover:bg-paradise-sunset/10 font-bold transition-all text-sm">
                      <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg shrink-0"><Calendar size={16} /></div>
                      <span>シフト・稼働ダッシュボード</span>
                    </Link>
                    <Link to="/shift/request" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 p-2.5 rounded-xl text-gray-700 hover:bg-paradise-sunset/10 font-bold transition-all text-sm">
                      <div className="p-1.5 bg-sky-50 text-sky-500 rounded-lg shrink-0"><Calendar size={16} /></div>
                      <span>希望休の提出</span>
                    </Link>
                    <Link to="/leave-plans" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 p-2.5 rounded-xl text-gray-700 hover:bg-paradise-sunset/10 font-bold transition-all text-sm">
                      <div className="p-1.5 bg-emerald-50 text-emerald-500 rounded-lg shrink-0"><Calendar size={16} /></div>
                      <span>予定数提出・確認</span>
                    </Link>
                    <Link to="/store-metrics" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 p-2.5 rounded-xl text-gray-700 hover:bg-paradise-sunset/10 font-bold transition-all text-sm">
                      <div className="p-1.5 bg-purple-50 text-purple-500 rounded-lg shrink-0"><TrendingUp size={16} /></div>
                      <span>店舗ランキング</span>
                    </Link>
                  </div>

                  {/* Category 3: Management & Profile */}
                  <div className="space-y-1 mt-5 flex-1">
                    <span className="text-xs font-black text-qb-blue-dark bg-qb-blue-dark/10 px-2.5 py-1 rounded-md tracking-wide inline-block mb-1">管理業務 & 各自設定</span>
                    <Link to="/key-pass" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 p-2.5 rounded-xl text-gray-700 hover:bg-paradise-sunset/10 font-bold transition-all text-sm">
                      <div className="p-1.5 bg-yellow-50 text-yellow-600 rounded-lg shrink-0"><Key size={16} /></div>
                      <span>鍵・入証管理</span>
                    </Link>
                    
                    {(activeRole === 'BM' || activeRole === 'AM') && (
                      <Link to="/post-announcement" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 p-2.5 rounded-xl text-gray-700 hover:bg-paradise-sunset/10 font-bold transition-all text-sm">
                        <div className="p-1.5 bg-pink-50 text-pink-500 rounded-lg shrink-0"><Sparkles size={16} /></div>
                        <span>重要なお知らせ配信</span>
                      </Link>
                    )}

                    <Link to="/profile" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 p-2.5 rounded-xl text-gray-700 hover:bg-paradise-sunset/10 font-bold transition-all text-sm">
                      <div className="p-1.5 bg-indigo-50 text-indigo-500 rounded-lg shrink-0"><User size={16} /></div>
                      <span>プロフィール</span>
                    </Link>
                  </div>

                  {/* Drawer Footer */}
                  <div className="mt-8 border-t border-gray-100 pt-4 space-y-2">
                    <button 
                      onClick={() => {
                        setIsMenuOpen(false);
                        window.location.reload();
                      }} 
                      className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-paradise-sunset/10 text-paradise-ocean font-bold text-left text-xs transition-colors"
                    >
                      <div className="p-1.5 bg-teal-50 text-teal-600 rounded-lg shrink-0"><RefreshCcw size={14} /></div>
                      <span>アプリを強制更新</span>
                    </button>
                    <div className="text-center text-xs text-gray-400 font-extrabold tracking-wide">
                      VERSION 2.0.0
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        <div
          onClick={handleSparkleClick}
          className="w-10 h-10 bg-gradient-to-br from-qb-blue-dark to-qb-cyan rounded-2xl flex items-center justify-center shadow-sm cursor-pointer active:scale-95 transition-transform"
        >
            <Scissors className="text-white" size={20} />
        </div>
        <div>
          <p className="text-[10px] font-black tracking-[0.25em] text-qb-blue uppercase leading-none">QB HOUSE</p>
          <h1 className="text-base sm:text-lg font-black text-ink tracking-wide text-left leading-tight">管理者共有ツール</h1>
        </div>
      </div>

      <div className="relative">
        <button 
          onClick={() => setIsNotifOpen(!isNotifOpen)}
          className="relative p-3 glass rounded-2xl text-ink-soft hover:text-qb-blue transition-all shadow-lg active:scale-95 group tap"
        >
          <Bell size={20} className="group-hover:rotate-12 transition-transform" />
          {unreadCount > 0 && (
            <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-paradise-sunset rounded-full border-2 border-white animate-pulse" />
          )}
        </button>

        <AnimatePresence>
          {isNotifOpen && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              className="absolute top-14 right-0 w-[90vw] sm:w-80 max-h-[400px] overflow-y-auto no-scrollbar bg-white/95 backdrop-blur-xl border border-white/50 rounded-3xl p-4 shadow-2xl space-y-3 z-50 text-left"
            >
              <div className="flex justify-between items-center mb-2 px-1">
                <h3 className="text-base font-black text-gray-800 flex items-center gap-2"><Bell size={16}/> 通知</h3>
                {unreadCount > 0 && (
                  <button onClick={() => user && markAllAsRead(user.uid)} className="text-xs text-paradise-ocean font-bold flex items-center gap-1 hover:underline">
                    <CheckCircle size={10} /> すべて既読にする
                  </button>
                )}
              </div>
              
              {notifications.filter(n => !n.isRead).length === 0 ? (
                <div className="text-center py-6">
                  <Bell size={24} className="mx-auto text-gray-300 mb-2" />
                  <p className="text-gray-400 font-bold text-sm">新しい通知はありません</p>
                </div>
              ) : (
                notifications.filter(n => !n.isRead).map((notif) => (
                  <div 
                    key={notif.id} 
                    onClick={() => handleNotificationClick(notif)}
                    className={`flex items-start gap-3 p-3 rounded-2xl cursor-pointer transition-colors bg-paradise-ocean/5 hover:bg-paradise-ocean/10 border border-paradise-ocean/20`}
                  >
                    <div className={`p-2 rounded-xl mt-1 ${
                      notif.type === 'comment' ? 'bg-blue-100 text-blue-500' : 
                      notif.type === 'read' || notif.type === 'read_announcement' ? 'bg-emerald-100 text-emerald-500' :
                      'bg-pink-100 text-pink-500'
                    }`}>
                      {notif.type === 'comment' ? <MessageCircle size={14} /> : 
                       notif.type === 'read' || notif.type === 'read_announcement' ? <CheckCircle size={14} /> :
                       <Heart size={14} />}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-800 leading-snug">
                         <span className="font-black">{notif.message}</span>
                      </p>
                      <span className="text-[10px] font-bold text-gray-400 mt-1 block">
                        {new Date(notif.createdAt).toLocaleDateString()} {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {!notif.isRead && <div className="w-2 h-2 bg-paradise-sunset rounded-full mt-2" />}
                  </div>
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
};

const SecurityGuard = () => {
  const [windowFocused, setWindowFocused] = useState(true);

  useEffect(() => {
    const isIframe = window.self !== window.top;

    const handleBlur = () => {
      // Blur when windows loses focus / switches tabs in separate tab or standalone environment
      if (!isIframe) {
        setWindowFocused(false);
      }
    };
    const handleFocus = () => setWindowFocused(true);

    const handleVisibilityChange = () => {
      if (!isIframe) {
        if (document.hidden || document.visibilityState === 'hidden') {
          setWindowFocused(false);
        } else {
          setWindowFocused(true);
        }
      }
    };

    // .copy-ok 配下（週次報告のコメント欄のみ）はコピペを許可する例外判定
    const isCopyable = (n: any): boolean => !!(n && typeof n.closest === 'function' && n.closest('.copy-ok'));

    const handleContextMenu = (e: MouseEvent) => {
      // コメント欄内は右クリック（コピー/貼り付けメニュー）を許可
      if (isCopyable(e.target)) return;
      e.preventDefault();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent Print (Ctrl+P, Cmd+P)
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        alert('【セキュリティ警告】印刷およびPDF出力は禁止されています。');
      }
      
      // Screen capture shortcut blocks / PrintScreen alerts
      if (e.key === 'PrintScreen' || e.keyCode === 44) {
        e.preventDefault();
        navigator.clipboard?.writeText?.(" "); // Clear clipboard on PrintScreen
        alert('【セキュリティ警告】スクリーンショット（画面キャプチャ）は禁止されています。');
      }
    };

    const handleCopy = (e: ClipboardEvent) => {
      // コメント欄内の選択テキスト／入力欄からのコピー・カットは許可
      const sel = window.getSelection();
      const selNode = sel && sel.anchorNode
        ? (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement)
        : null;
      if (isCopyable(e.target) || isCopyable(selNode)) return;
      e.preventDefault();
      alert('【セキュリティ警告】コピーアクションは禁止されています。');
    };

    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('cut', handleCopy);

    // Prevent text copying on the body element
    document.body.classList.add('secure-unselectable');

    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('cut', handleCopy);
      document.body.classList.remove('secure-unselectable');
    };
  }, []);

  if (!windowFocused) {
    return (
      <div className="fixed inset-0 bg-slate-950/98 backdrop-blur-3xl z-[99999] flex flex-col items-center justify-center p-6 text-center select-none secure-unselectable">
        <div className="max-w-md p-8 bg-slate-900 border border-slate-800 rounded-[2.5rem] shadow-2xl space-y-6">
          <div className="w-16 h-16 bg-red-500/10 border border-red-500/30 text-red-500 rounded-2xl flex items-center justify-center mx-auto animate-pulse">
            <ShieldAlert size={36} />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-black text-white">🔒 画面保護セキュリティ</h3>
            <p className="text-sm font-bold text-slate-400 leading-relaxed">
              システム情報を保護するため、ウインドウを一時的にブラインド加工しています。<br />
              画面を最前面に戻すことで表示が再開されます。
            </p>
          </div>
          <p className="text-xs text-purple-400 font-bold bg-purple-950/40 py-2 border border-purple-900/30 rounded-lg">
            CONFIDENTIAL MONITOR
          </p>
        </div>
      </div>
    );
  }

  return null;
};

export default function App() {
  const { isAuthenticated, user, viewMode, setViewMode, init: initAuth, isQuotaExceeded } = useAuthStore();
  const { init: initReports } = useReportStore();
  const [isLanding, setIsLanding] = useState(true);
  const [isLineBrowser, setIsLineBrowser] = useState(false);
  const updateAvailable = useAppUpdate();

  useEffect(() => {
    // LINEブラウザの検知
    const ua = navigator.userAgent || navigator.vendor || (window as any).opera;
    const isLine = ua.indexOf('Line') > -1 || ua.indexOf('LINE') > -1;
    setIsLineBrowser(isLine);

    // 3.5秒のロード画面
    const timer = setTimeout(() => setIsLanding(false), 3500);
    
    initAuth();
    
    const handleQuotaExceeded = () => {
      useAuthStore.getState().setQuotaExceeded(true);
    };
    
    document.addEventListener('quota-exceeded', handleQuotaExceeded);
    
    return () => {
      clearTimeout(timer);
      document.removeEventListener('quota-exceeded', handleQuotaExceeded);
    };
  }, [initAuth]);

  useEffect(() => {
    // Only subscribe to auth state, we will conditionally request reports down the view tree
  }, [isAuthenticated]);

  if (isLineBrowser) {
    return (
      <div className="fixed inset-0 bg-paradise-ocean flex items-center justify-center p-8 text-center z-[9999]">
        <div className="glass p-10 rounded-[3rem] border-2 border-white/40 space-y-6 max-w-sm">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-black text-gray-800">ブラウザを変更してください</h2>
          <p className="text-base text-gray-600 font-bold leading-relaxed">
            LINE内ブラウザではログインが正しく動作しない場合があります。<br/><br/>
            画面右上のメニュー（︙）から<br/>
            <span className="text-paradise-sunset font-black">「デフォルトのブラウザで開く」</span><br/>
            または<br/>
            <span className="text-paradise-sunset font-black">「Safari / Chromeで開く」</span><br/>
            を選択してください。
          </p>
        </div>
      </div>
    );
  }

  if (isQuotaExceeded) {
    return (
      <div className="fixed inset-0 bg-red-50 flex items-center justify-center p-8 text-center z-[9999]">
        <div className="bg-white p-10 rounded-[3rem] shadow-2xl border-4 border-red-100 space-y-6 max-w-md">
          <div className="text-6xl mb-4 w-24 h-24 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto">
            <ShieldAlert size={48} />
          </div>
          <h2 className="text-2xl font-black text-red-600">データベースの読み取り制限</h2>
          <p className="text-base text-gray-700 font-bold leading-relaxed">
            システムの1日あたりのデータアクセス上限に達しました。<br/><br/>
            申し訳ありませんが、システムは一時的に利用できなくなっています。制限のリセットをお待ちいただくか、Google Cloudコンソールにて割り当て（Quota）の設定をご確認ください。<br/><br/>
            <span className="text-xs text-gray-500 font-normal">Error: Firestore Quota Exceeded (Resource Exhausted)</span>
          </p>
        </div>
      </div>
    );
  }

  if (isLanding) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-qb-blue-dark via-qb-blue to-qb-cyan flex items-center justify-center z-[9999]">
         <motion.div
           initial={{ opacity: 0, scale: 0.9 }}
           animate={{ opacity: 1, scale: 1 }}
           transition={{ ease: [0.16, 1, 0.3, 1] }}
           className="text-center space-y-6"
         >
           <motion.div
             initial={{ scale: 0.8, opacity: 0 }}
             animate={{ scale: 1, opacity: 1 }}
             transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
             className="w-24 h-24 bg-white rounded-3xl mx-auto shadow-2xl flex items-center justify-center"
           >
             <Scissors className="text-qb-blue" size={44} />
           </motion.div>
           <div className="space-y-1.5">
             <h1 className="text-3xl font-black text-white tracking-[0.25em] uppercase drop-shadow-sm">QB HOUSE</h1>
             <p className="text-sm font-bold text-white/80 tracking-[0.3em] uppercase">管理者共有ツール</p>
           </div>
           <motion.p
             initial={{ opacity: 0, y: 10 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ delay: 0.6 }}
             className="text-xs font-bold text-white/70 mt-10"
           >
             今日も素晴らしい一日になりますように
           </motion.p>
         </motion.div>
      </div>
    );
  }

  if (!isAuthenticated) return <Login />;

  return (
    <BrowserRouter>
      <SecurityGuard />
      <div className="min-h-screen w-full relative flex flex-col">
          {/* 背景は index.css の静的ブランドグラデーションに一本化（常時発光blobは廃止：LESS IS MORE） */}

          {updateAvailable && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] w-full max-w-sm px-4">
              <div className="bg-white/90 backdrop-blur-xl border-2 border-paradise-ocean/50 shadow-2xl p-4 rounded-3xl flex items-center justify-between gap-4">
                <div className="flex-1">
                  <p className="text-sm font-black text-gray-800">新しいバージョンがあります</p>
                  <p className="text-xs font-bold text-gray-500 mt-0.5">最新の機能を使用するには更新してください</p>
                </div>
                <button 
                  onClick={() => window.location.reload()}
                  className="bg-paradise-ocean text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-paradise-ocean/90 transition-colors shadow-lg active:scale-95"
                >
                  <RefreshCcw size={16} /> 更新
                </button>
              </div>
            </div>
          )}

          <Header />
          
          <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 relative z-40">
              {user?.role === 'BM' && (
                <div className="bg-white/60 backdrop-blur-md border border-paradise-ocean/30 p-2 rounded-xl shadow-sm mb-4 flex items-center gap-3 overflow-x-auto no-scrollbar">
                    <span className="text-xs font-bold text-paradise-ocean whitespace-nowrap pl-2 flex items-center gap-1"><Sparkles size={14}/> 権限シミュレーター:</span>
                    <div className="flex bg-white/50 p-1 rounded-lg border border-gray-100 whitespace-nowrap overflow-x-visible">
                        <button
                          onClick={() => setViewMode(null)}
                          className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${!viewMode ? 'bg-paradise-ocean text-white shadow' : 'bg-transparent text-gray-500 hover:bg-white/50'}`}
                        >
                          無効 (本来の権限)
                        </button>
                        <button
                          onClick={() => setViewMode('BM')}
                          className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${viewMode === 'BM' ? 'bg-paradise-ocean text-white shadow' : 'bg-transparent text-gray-500 hover:bg-white/50'}`}
                        >
                          B
                        </button>
                        <button
                          onClick={() => setViewMode('AM')}
                          className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${viewMode === 'AM' ? 'bg-paradise-ocean text-white shadow' : 'bg-transparent text-gray-500 hover:bg-white/50'}`}
                        >
                          A
                        </button>
                        <button
                          onClick={() => setViewMode('店長')}
                          className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${viewMode === '店長' ? 'bg-paradise-ocean text-white shadow' : 'bg-transparent text-gray-500 hover:bg-white/50'}`}
                        >
                          Ｓ
                        </button>
                    </div>
                </div>
              )}
          </div>

          <main className="flex-1 w-full mx-auto relative z-10">
            <AnimatePresence mode="wait">
            <Routes>
              <Route path="/" element={<ErrorBoundary><MainBoard /></ErrorBoundary>} />
              <Route path="/post" element={<ErrorBoundary><PostReport /></ErrorBoundary>} />
              <Route path="/edit/:id" element={<ErrorBoundary><PostReport /></ErrorBoundary>} />
              <Route path="/report/:id" element={<ErrorBoundary><ReportDetail /></ErrorBoundary>} />
              <Route path="/profile" element={<ErrorBoundary><Profile /></ErrorBoundary>} />
              <Route path="/profile/edit" element={<ErrorBoundary><ProfileEdit /></ErrorBoundary>} />
              <Route path="/profile/achievements" element={<ErrorBoundary><Achievements /></ErrorBoundary>} />
              <Route path="/admin" element={<ErrorBoundary><AdminDashboard /></ErrorBoundary>} />
              <Route path="/calendar" element={<ErrorBoundary><CalendarView /></ErrorBoundary>} />
              <Route path="/shift" element={<ErrorBoundary><ShiftDashboard /></ErrorBoundary>} />
              <Route path="/shift/request" element={<ErrorBoundary><StaffShiftRequest /></ErrorBoundary>} />
              <Route path="/leave-plans" element={<ErrorBoundary><LeavePlanDashboard /></ErrorBoundary>} />
              <Route path="/store-metrics" element={<ErrorBoundary><StoreMetrics /></ErrorBoundary>} />
              <Route path="/key-pass" element={<ErrorBoundary><KeyPassManagement /></ErrorBoundary>} />
              <Route path="/projects" element={<ErrorBoundary><ProjectsView /></ErrorBoundary>} />
              <Route path="/post-announcement" element={<ErrorBoundary><PostAnnouncement /></ErrorBoundary>} />
            </Routes>
          </AnimatePresence>
        </main>
      </div>
    </BrowserRouter>
  );
}
