import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from '../components/ui/GlassCard';
import { Scissors, ArrowRight, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

export const Login = () => {
  const [isSplash, setIsSplash] = useState(true);
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuthStore();

  useEffect(() => {
    const timer = setTimeout(() => setIsSplash(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  const handleLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError('');
    if (!id.trim() || !password.trim()) {
      setError('IDとパスワードを入力してください。');
      return;
    }
    try {
      await login(id, password);
    } catch (err: any) {
      setError(`ログインに失敗しました: ${err.message}`);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-hidden">
      <AnimatePresence mode="wait">
        {isSplash ? (
          <motion.div
            key="splash"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-4"
          >
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-qb-blue-dark to-qb-cyan flex items-center justify-center shadow-lg">
              <Scissors className="text-white" size={30} />
            </div>
            <p className="text-ink-soft font-bold tracking-wide">読み込み中…</p>
          </motion.div>
        ) : (
          <motion.div
            key="login"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md px-6"
          >
            <GlassCard className="text-center space-y-6 py-10 px-8">
              <div className="space-y-3">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-qb-blue-dark to-qb-cyan flex items-center justify-center shadow-md">
                  <Scissors className="text-white" size={30} />
                </div>
                <div>
                  <p className="text-[11px] font-black tracking-[0.3em] text-qb-blue uppercase">QB HOUSE</p>
                  <h2 className="text-2xl font-bold text-ink mt-1">おかえりなさい</h2>
                  <p className="text-xs text-ink-soft font-bold mt-1">週次本部報告・店舗管理システム</p>
                </div>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5 text-left">
                  <label htmlFor="login-id" className="text-xs font-bold text-ink-soft ml-1">ユーザーID</label>
                  <input
                    id="login-id"
                    type="text"
                    inputMode="text"
                    autoComplete="username"
                    autoCapitalize="off"
                    autoCorrect="off"
                    enterKeyHint="next"
                    placeholder="例: bm, am1, s1, s2"
                    value={id}
                    onChange={(e) => setId(e.target.value)}
                    className="w-full min-h-[48px] px-4 rounded-xl bg-white/70 border border-line outline-none focus:ring-2 focus:ring-qb-cyan focus:border-qb-cyan transition-all text-[15px] font-bold text-ink"
                  />
                </div>
                <div className="space-y-1.5 text-left">
                  <label htmlFor="login-pw" className="text-xs font-bold text-ink-soft ml-1">パスワード</label>
                  <input
                    id="login-pw"
                    type="password"
                    autoComplete="current-password"
                    enterKeyHint="go"
                    placeholder="初期値: password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full min-h-[48px] px-4 rounded-xl bg-white/70 border border-line outline-none focus:ring-2 focus:ring-qb-cyan focus:border-qb-cyan transition-all text-[15px] font-bold text-ink"
                  />
                </div>

                {error && (
                  <div className="flex items-start gap-2 text-left text-[13px] font-bold text-qb-red bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full min-h-[48px] rounded-full bg-gradient-to-r from-qb-blue to-qb-cyan text-white font-bold shadow-md flex items-center justify-center gap-2 hover:brightness-105 active:translate-y-px transition-all text-[15px]"
                >
                  ログイン <ArrowRight size={18} />
                </button>
              </form>

            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
