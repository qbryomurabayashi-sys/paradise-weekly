import React, { useState, useRef, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { MainBoard } from './pages/MainBoard';
import { PostReport } from './pages/PostReport';
import { ReportDetail } from './pages/ReportDetail';
import { Login } from './pages/Login';
import { Profile } from './pages/Profile';
import { ProfileEdit } from './pages/ProfileEdit';
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
import { ErrorBoundary } from './components/ErrorBoundary';
import { Home, PlusSquare, User, Bell, Sparkles, MessageCircle, Heart, X, CheckCircle, Calendar, MessageSquare, Key } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from './lib/firebase';

const Header = () => {
  const { user } = useAuthStore();
  const { notifications, unreadCount, init: initNotif, markAsRead, markAllAsRead } = useNotificationStore();
  const [tapCount, setTapCount] = useState(0);
  const tapTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const navigate = useNavigate();

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
        const pwd = window.prompt("開発者用パスワードを入力してください (数字4桁):");
        if (pwd === "9119") {
            try {
                await updateDoc(doc(db, 'users', user.uid), { role: 'BM' });
                alert("認証成功: BM(開発者)権限を取得しました。画面を再読み込みします。");
                window.location.reload();
            } catch (err) {
                console.error(err);
                alert("権限のアップデートに失敗しました。");
            }
        } else if (pwd !== null) {
            alert("パスワードが一致しませんでした。");
        }
    }
  };

  const handleNotificationClick = (notif: any) => {
    if (!user) return;
    markAsRead(user.uid, notif.id);
    setIsNotifOpen(false);
    navigate(`/report/${notif.reportId}`);
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
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, x: -10 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.9, x: -10 }}
                className="absolute top-14 left-0 bg-white/90 backdrop-blur-xl border border-white/50 rounded-3xl p-4 shadow-2xl w-48 space-y-2"
              >
                <Link to="/" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 p-3 rounded-xl hover:bg-paradise-sunset/10 text-gray-700 font-bold">
                  <Home size={20} /> ホーム
                </Link>
                <Link to="/post" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 p-3 rounded-xl hover:bg-paradise-sunset/10 text-gray-700 font-bold">
                  <PlusSquare size={20} /> 投稿
                </Link>
                {(user?.role === 'BM' || user?.role === 'AM') && (
                  <Link to="/post-announcement" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 p-3 rounded-xl hover:bg-paradise-sunset/10 text-gray-700 font-bold">
                    <Sparkles size={20} className="text-paradise-ocean" /> お知らせ作成
                  </Link>
                )}
                <Link to="/shift" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 p-3 rounded-xl hover:bg-paradise-sunset/10 text-gray-700 font-bold">
                  <Calendar size={20} className="text-blue-500" /> シフト・稼働
                </Link>
                <Link to="/shift/request" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 p-3 rounded-xl hover:bg-paradise-sunset/10 text-gray-700 font-bold">
                  <Calendar size={20} className="text-paradise-ocean" /> 希望休の提出
                </Link>
                <Link to="/key-pass" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 p-3 rounded-xl hover:bg-paradise-sunset/10 text-gray-700 font-bold">
                  <Key size={20} className="text-yellow-600" /> 鍵・入館証管理
                </Link>
                <Link to="/leave-plans" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 p-3 rounded-xl hover:bg-paradise-sunset/10 text-gray-700 font-bold">
                  <Calendar size={20} className="text-emerald-500" /> 予定数提出・確認
                </Link>
                <Link to="/calendar" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 p-3 rounded-xl hover:bg-paradise-sunset/10 text-gray-700 font-bold">
                  <Calendar size={20} /> カレンダー
                </Link>
                <Link to="/projects" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 p-3 rounded-xl hover:bg-paradise-sunset/10 text-gray-700 font-bold">
                  <MessageSquare size={20} /> プロジェクト
                </Link>
                <Link to="/profile" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 p-3 rounded-xl hover:bg-paradise-sunset/10 text-gray-700 font-bold">
                  <User size={20} /> プロフィール
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div 
          onClick={handleSparkleClick}
          className="w-10 h-10 bg-white/40 rounded-2xl flex items-center justify-center border border-white/40 shadow-sm cursor-pointer active:scale-95 transition-transform"
        >
            <Sparkles className="text-paradise-sunset" size={20} />
        </div>
        <div>
          <h1 className="text-lg sm:text-xl font-black text-white drop-shadow-md tracking-widest uppercase text-left">管理者共有ツールAPP</h1>
          <div className="h-0.5 w-full bg-gradient-to-r from-paradise-sunset to-transparent rounded-full" />
        </div>
      </div>

      <div className="relative">
        <button 
          onClick={() => setIsNotifOpen(!isNotifOpen)}
          className="relative p-3 glass rounded-2xl text-white/80 hover:text-white transition-all shadow-lg active:scale-95 group"
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

export default function App() {
  const { isAuthenticated, init: initAuth } = useAuthStore();
  const { init: initReports } = useReportStore();
  const [isLanding, setIsLanding] = useState(true);
  const [isLineBrowser, setIsLineBrowser] = useState(false);

  useEffect(() => {
    // LINEブラウザの検知
    const ua = navigator.userAgent || navigator.vendor || (window as any).opera;
    const isLine = ua.indexOf('Line') > -1 || ua.indexOf('LINE') > -1;
    setIsLineBrowser(isLine);

    // 3.5秒のロード画面
    const timer = setTimeout(() => setIsLanding(false), 3500);
    
    initAuth();
    
    return () => clearTimeout(timer);
  }, [initAuth]);

  useEffect(() => {
    if (isAuthenticated) {
      const unsubscribe = initReports();
      const unsubUsers = useUsersStore.getState().init();
      return () => {
        if (unsubscribe) unsubscribe();
        if (unsubUsers) unsubUsers();
      };
    }
  }, [isAuthenticated, initReports]);

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

  if (isLanding) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-paradise-ocean via-white to-paradise-pink flex items-center justify-center z-[9999]">
         <motion.div 
           initial={{ opacity: 0, scale: 0.8 }}
           animate={{ opacity: 1, scale: 1 }}
           className="text-center space-y-6"
         >
           <motion.div 
             animate={{ 
               rotate: 360,
               scale: [1, 1.1, 1]
             }}
             transition={{ duration: 3.5, ease: "linear", repeat: Infinity }}
             className="w-24 h-24 bg-gradient-to-tr from-paradise-sunset to-orange-300 rounded-full mx-auto shadow-2xl shadow-orange-300/40 border-4 border-white flex items-center justify-center"
           >
             <Sparkles className="text-white" size={40} />
           </motion.div>
           <div className="space-y-2">
             <h1 className="text-3xl font-black text-gray-800 tracking-[0.2em] uppercase drop-shadow-sm">Paradise</h1>
             <p className="text-sm font-black text-paradise-sunset tracking-[0.4em] uppercase">Weekly Report</p>
           </div>
           <motion.p 
             initial={{ opacity: 0, y: 10 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ delay: 1 }}
             className="text-xs font-bold text-gray-400 mt-10 italic"
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
      <div className="min-h-screen w-full relative flex flex-col">
        {/* 背景のアニメーション装飾 */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <motion.div 
            animate={{ 
              scale: [1, 1.2, 1],
              x: [0, 50, 0],
              y: [0, 30, 0]
            }}
            transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-paradise-blue/20 blur-[100px] rounded-full" 
          />
          <motion.div 
            animate={{ 
              scale: [1.2, 1, 1.2],
              x: [0, -50, 0],
              y: [0, -30, 0]
            }}
            transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
            className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-paradise-pink/20 blur-[100px] rounded-full" 
          />
        </div>

        <Header />

        <main className="flex-1 w-full mx-auto relative z-10">
          <AnimatePresence mode="wait">
            <Routes>
              <Route path="/" element={<MainBoard />} />
              <Route path="/post" element={<PostReport />} />
              <Route path="/edit/:id" element={<PostReport />} />
              <Route path="/report/:id" element={<ReportDetail />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/profile/edit" element={<ProfileEdit />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/calendar" element={<CalendarView />} />
              <Route path="/shift" element={<ShiftDashboard />} />
              <Route path="/shift/request" element={<StaffShiftRequest />} />
              <Route path="/leave-plans" element={<ErrorBoundary><LeavePlanDashboard /></ErrorBoundary>} />
              <Route path="/key-pass" element={<ErrorBoundary><KeyPassManagement /></ErrorBoundary>} />
              <Route path="/projects" element={<ProjectsView />} />
              <Route path="/post-announcement" element={<PostAnnouncement />} />
            </Routes>
          </AnimatePresence>
        </main>
      </div>
    </BrowserRouter>
  );
}
