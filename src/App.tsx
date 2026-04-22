import React from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { MainBoard } from './pages/MainBoard';
import { PostReport } from './pages/PostReport';
import { ReportDetail } from './pages/ReportDetail';
import { Login } from './pages/Login';
import { Profile } from './pages/Profile';
import { useAuthStore } from './store/useAuthStore';
import { Home, PlusSquare, User, Bell, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Navigation = () => {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="fixed bottom-0 left-0 right-0 glass-dark border-t border-white/20 px-6 py-4 flex justify-around items-center z-50 transition-all">
      <Link to="/" className="relative flex flex-col items-center">
        <div className={`p-3 rounded-2xl transition-all duration-500 ${isActive('/') ? 'bg-white shadow-xl text-paradise-sunset' : 'text-white/60 hover:text-white'}`}>
          <Home size={24} />
        </div>
        {isActive('/') && <motion.div layoutId="nav-dot" className="w-1 h-1 bg-paradise-sunset rounded-full mt-1" />}
      </Link>

      <Link to="/post" className="relative -top-8">
        <div className="w-16 h-16 bg-gradient-to-br from-paradise-sunset to-orange-400 rounded-full flex items-center justify-center text-white shadow-2xl border-4 border-white/60 hover:scale-110 transition-transform active:scale-95 group">
          <PlusSquare size={28} className="group-hover:rotate-90 transition-transform duration-500" />
        </div>
      </Link>

      <Link to="/profile" className="relative flex flex-col items-center">
        <div className={`p-3 rounded-2xl transition-all duration-500 ${isActive('/profile') ? 'bg-white shadow-xl text-paradise-ocean' : 'text-white/60 hover:text-white'}`}>
          <User size={24} />
        </div>
        {isActive('/profile') && <motion.div layoutId="nav-dot" className="w-1 h-1 bg-paradise-ocean rounded-full mt-1" />}
      </Link>
    </nav>
  );
};

export default function App() {
  const { isAuthenticated } = useAuthStore();

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

        <header className="p-6 flex justify-between items-center max-w-5xl w-full mx-auto z-10">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-white/40 rounded-2xl flex items-center justify-center border border-white/40 shadow-sm">
               <Sparkles className="text-paradise-sunset" size={20} />
            </div>
            <div>
              <h1 className="text-xl font-black text-white drop-shadow-md tracking-widest uppercase text-left">楽園週報</h1>
              <div className="h-0.5 w-full bg-gradient-to-r from-paradise-sunset to-transparent rounded-full" />
            </div>
          </div>
          <button className="relative p-3 glass rounded-2xl text-white/80 hover:text-white transition-all shadow-lg active:scale-95 group">
            <Bell size={20} className="group-hover:rotate-12 transition-transform" />
            <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-paradise-sunset rounded-full border-2 border-white animate-pulse" />
          </button>
        </header>

        <main className="flex-1 w-full mx-auto relative z-10">
          <AnimatePresence mode="wait">
            <Routes>
              <Route path="/" element={<MainBoard />} />
              <Route path="/post" element={<PostReport />} />
              <Route path="/report/:id" element={<ReportDetail />} />
              <Route path="/profile" element={<Profile />} />
            </Routes>
          </AnimatePresence>
        </main>
        
        <Navigation />
      </div>
    </BrowserRouter>
  );
}
