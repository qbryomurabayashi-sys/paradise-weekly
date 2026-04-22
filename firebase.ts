import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from '../components/ui/GlassCard';
import { Sun, Cloud, ArrowRight } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

export const Login = () => {
  const [isSplash, setIsSplash] = useState(true);
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useAuthStore();

  useEffect(() => {
    const timer = setTimeout(() => setIsSplash(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  const handleLogin = async () => {
    try {
      await login(id, password);
    } catch (error) {
      alert('ログインに失敗しました');
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-hidden">
      <AnimatePresence>
        {isSplash ? (
          <div className="text-white">Loading...</div>
        ) : (
          <motion.div 
            key="login"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md px-6"
          >
            <GlassCard className="text-center space-y-8 py-12">
              <div className="space-y-2">
                <Sun size={48} className="mx-auto text-paradise-sunset" />
                <h2 className="text-2xl font-bold text-gray-800">おかえりなさい 🌴</h2>
              </div>
              <div className="space-y-4">
                <div className="space-y-2 text-left">
                  <label className="text-xs font-bold text-gray-400 ml-4">ID</label>
                  <input 
                    type="text" 
                    value={id}
                    onChange={(e) => setId(e.target.value)}
                    className="w-full p-4 rounded-2xl bg-white/50 border border-white/20 outline-none focus:ring-2 focus:ring-paradise-sunset transition-all"
                  />
                </div>
                <div className="space-y-2 text-left">
                  <label className="text-xs font-bold text-gray-400 ml-4">パスワード</label>
                  <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full p-4 rounded-2xl bg-white/50 border border-white/20 outline-none focus:ring-2 focus:ring-paradise-sunset transition-all"
                  />
                </div>
                <button 
                  onClick={handleLogin}
                  className="w-full py-4 rounded-full bg-gradient-to-r from-paradise-sunset to-orange-400 text-white font-bold shadow-lg shadow-orange-200 flex items-center justify-center gap-2 hover:translate-y-[-2px] active:translate-y-[0px] transition-all"
                >
                  楽園に入る <ArrowRight size={20} />
                </button>
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
