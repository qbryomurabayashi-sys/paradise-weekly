import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from '../components/ui/GlassCard';
import { Scissors, ArrowRight, AlertCircle, Loader2, Info } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { toJapaneseAuthError } from '../lib/authErrors';
import { safeLocal } from '../lib/safeStorage';

/** iPhone/iPadで、かつホーム画面アプリとして起動していない状態か */
const isIosBrowser = () => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isIos = /iPhone|iPad|iPod/.test(ua);
  const standalone = (window.navigator as any).standalone === true;
  return isIos && !standalone;
};

export const Login = () => {
  const [isSplash, setIsSplash] = useState(true);
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { login } = useAuthStore();

  // アプリ起動時に既に3.5秒のロード画面を通っているため、ここは短く。
  useEffect(() => {
    const timer = setTimeout(() => setIsSplash(false), 400);
    return () => clearTimeout(timer);
  }, []);

  const handleLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError('');
    if (busy) return;

    if (!id.trim()) {
      setError('ユーザーIDを入力してください。');
      document.getElementById('login-id')?.focus();
      return;
    }
    if (!password.trim()) {
      // ID欄でEnter（次へ）を押した場合はエラーではなくパスワードへ送る
      document.getElementById('login-pw')?.focus();
      return;
    }
    if (/[^\x20-\x7E]/.test(password)) {
      setError('パスワードに全角文字が含まれています。半角で入力してください。');
      return;
    }

    setBusy(true);
    try {
      await Promise.race([
        login(id, password),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 20000)),
      ]);
      // 成功時は onAuthStateChanged が画面を切り替える（busyは維持したまま）
    } catch (err: any) {
      setError(toJapaneseAuthError(err));
      setBusy(false);
    }
  };

  const storageBlocked = !safeLocal.isPersistent;

  return (
    <div
      className="login-shell min-h-screen min-h-[100dvh] w-full flex items-center justify-center
                 overflow-y-auto overscroll-contain px-6
                 pt-[calc(env(safe-area-inset-top)+1.5rem)]
                 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]"
    >
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
            className="w-full max-w-md"
          >
            <GlassCard className="text-center space-y-6 py-10 px-8">
              <div className="space-y-3">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-qb-blue-dark to-qb-cyan flex items-center justify-center shadow-md">
                  <Scissors className="text-white" size={30} />
                </div>
                <div>
                  <p className="text-xs font-black tracking-[0.3em] text-qb-blue uppercase">QB HOUSE</p>
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
                    inputMode="email"
                    autoComplete="username"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    enterKeyHint="next"
                    placeholder="例: bm, am1, s1, s2"
                    value={id}
                    onChange={(e) => setId(e.target.value)}
                    className="w-full min-h-[48px] px-4 rounded-xl bg-white/70 border border-line outline-none focus:ring-2 focus:ring-qb-cyan focus:border-qb-cyan transition-all text-base font-bold text-ink"
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
                    onFocus={(e) => {
                      // iOSはキーボードでレイアウトを縮めないため、
                      // フォーカス時にログインボタンまでスクロールしておく
                      const form = e.currentTarget.closest('form');
                      requestAnimationFrame(() => {
                        form?.querySelector('button[type=submit]')?.scrollIntoView({
                          block: 'center',
                          behavior: 'smooth',
                        });
                      });
                    }}
                    className="w-full min-h-[48px] px-4 rounded-xl bg-white/70 border border-line outline-none focus:ring-2 focus:ring-qb-cyan focus:border-qb-cyan transition-all text-base font-bold text-ink"
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
                  disabled={busy}
                  className="w-full min-h-[48px] rounded-full bg-gradient-to-r from-qb-blue to-qb-cyan text-white font-bold shadow-md flex items-center justify-center gap-2 hover:brightness-105 active:translate-y-px transition-all text-base disabled:opacity-70"
                >
                  {busy ? (
                    <>
                      <Loader2 size={18} className="animate-spin" /> ログイン中…
                    </>
                  ) : (
                    <>
                      ログイン <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </form>

              {storageBlocked && (
                <div className="flex items-start gap-2 text-left text-xs font-bold text-ink-soft bg-canvas border border-line rounded-xl px-3 py-2.5">
                  <Info size={14} className="shrink-0 mt-0.5 text-qb-blue" />
                  <span>
                    この端末はブラウザの設定でデータ保存が禁止されています。ログインできない場合は
                    「設定 → Safari → すべてのCookieをブロック」をオフにしてください。
                  </span>
                </div>
              )}

              {!storageBlocked && isIosBrowser() && (
                <p className="text-left text-xs font-bold text-ink-soft leading-relaxed">
                  📱 iPhoneの方は、共有ボタンから「ホーム画面に追加」してアイコンから使うとログインが保持されます
                  （アイコン側では初回に1回だけログインが必要です）。
                </p>
              )}
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
