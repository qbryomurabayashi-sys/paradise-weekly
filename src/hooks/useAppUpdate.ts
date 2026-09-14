import { useState, useEffect } from 'react';

/**
 * 新しいバージョンが出ているかを監視する。
 *
 * iPhone向けの配慮:
 *  - バックグラウンドでは叩かない（iOSはsetIntervalを止め、復帰時に一括発火してムダな通信になる）
 *  - 機内モード・オフラインでは叩かない
 *  - fetchにタイムアウトを付ける（圏外で宙ぶらりんにならないように）
 *  - 復帰トリガに visibilitychange / pageshow / online を足す
 *    （standaloneのホーム画面アプリでは window focus が来ないことがある）
 */
const POLL_MS = 5 * 60 * 1000; // 5分（旧: 10秒＝1人あたり日8,640リクエスト）
const MIN_GAP_MS = 30 * 1000; // 復帰イベントの連打を間引く

export const useAppUpdate = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    let initialVersion: number | null = null;
    let lastCheckedAt = 0;
    let disposed = false;

    const checkUpdate = async () => {
      if (disposed) return;
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

      const now = Date.now();
      if (now - lastCheckedAt < MIN_GAP_MS) return;
      lastCheckedAt = now;

      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = controller ? setTimeout(() => controller.abort(), 8000) : null;

      try {
        const res = await fetch('/version.json?t=' + now, {
          cache: 'no-store',
          signal: controller ? controller.signal : undefined,
        });
        if (!res.ok) return;

        // SPAフォールバックが index.html を返してくるケースを弾く
        const contentType = res.headers.get('content-type') || '';
        const text = await res.text();
        if (!text || text.trim().startsWith('<')) return;
        if (contentType && contentType.indexOf('json') === -1 && text.trim().charAt(0) !== '{') return;

        let data: any;
        try {
          data = JSON.parse(text);
        } catch {
          return;
        }
        if (!data || typeof data.version === 'undefined') return;

        if (initialVersion === null) {
          initialVersion = data.version;
        } else if (data.version !== initialVersion) {
          setUpdateAvailable(true);
        }
      } catch {
        // 通信失敗は次回に任せる
      } finally {
        if (timer) clearTimeout(timer);
      }
    };

    checkUpdate();
    const interval = setInterval(checkUpdate, POLL_MS);

    const onWake = () => {
      checkUpdate();
    };
    window.addEventListener('focus', onWake);
    window.addEventListener('pageshow', onWake);
    window.addEventListener('online', onWake);
    document.addEventListener('visibilitychange', onWake);

    return () => {
      disposed = true;
      clearInterval(interval);
      window.removeEventListener('focus', onWake);
      window.removeEventListener('pageshow', onWake);
      window.removeEventListener('online', onWake);
      document.removeEventListener('visibilitychange', onWake);
    };
  }, []);

  return updateAvailable;
};

/**
 * 確実に最新版を取り直す。
 * iOS standalone では location.reload() がサブリソースを再取得しないことがあるため、
 * URLにバージョンクエリを付けて別URL扱いにしてから遷移する。
 */
export const applyAppUpdate = () => {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('v', String(Date.now()));
    window.location.replace(url.toString());
  } catch {
    window.location.reload();
  }
};
