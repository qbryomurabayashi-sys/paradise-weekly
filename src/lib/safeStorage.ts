/**
 * 例外を投げないストレージラッパ。
 *
 * iPhone(Safari/iOS Chrome)は「設定 > Safari > すべてのCookieをブロック」や
 * プライベートブラウズ、ストレージ制限下で
 *   window.localStorage / window.sessionStorage の **参照そのもの** が
 *   SecurityError（The operation is insecure.）を投げる。
 * さらに容量枯渇時は setItem が QuotaExceededError を投げる。
 *
 * 素の localStorage.getItem() をレンダー中やイベントハンドラで呼ぶと、
 * その画面が丸ごと ErrorBoundary に落ちる（＝iPhoneだけ動かない）ため、
 * アプリ内のストレージアクセスは必ずこのラッパ経由にする。
 *
 * 保存できない端末ではメモリ上のMapに退避するので、同一起動中は値が保たれる。
 */

type Kind = 'local' | 'session';

const memory: Record<Kind, Map<string, string>> = {
  local: new Map(),
  session: new Map(),
};

const probed: Record<string, Storage | null> = {};

function probe(kind: Kind): Storage | null {
  try {
    const s = kind === 'local' ? window.localStorage : window.sessionStorage;
    if (!s) return null;
    // 参照だけでなく書き込みまで検査する（Quota 0 の端末を弾くため）
    const probeKey = '__qb_probe__';
    s.setItem(probeKey, '1');
    s.removeItem(probeKey);
    return s;
  } catch {
    return null;
  }
}

function backend(kind: Kind): Storage | null {
  if (!(kind in probed)) probed[kind] = probe(kind);
  return probed[kind];
}

function make(kind: Kind) {
  return {
    getItem(key: string): string | null {
      const s = backend(kind);
      if (s) {
        try {
          return s.getItem(key);
        } catch {
          probed[kind] = null;
        }
      }
      const v = memory[kind].get(key);
      return v === undefined ? null : v;
    },

    /** 保存できたら true。失敗しても例外は出さない（メモリには必ず載る） */
    setItem(key: string, value: string): boolean {
      memory[kind].set(key, value);
      const s = backend(kind);
      if (!s) return false;
      try {
        s.setItem(key, value);
        return true;
      } catch {
        // 容量超過などで以降も失敗し続けるので、メモリ運用へ切り替える
        probed[kind] = null;
        return false;
      }
    },

    removeItem(key: string): void {
      memory[kind].delete(key);
      const s = backend(kind);
      if (!s) return;
      try {
        s.removeItem(key);
      } catch {
        probed[kind] = null;
      }
    },

    /** JSON.parse も失敗させない。壊れた値・オブジェクト以外は fallback を返す */
    getJSON<T>(key: string, fallback: T): T {
      const raw = this.getItem(key);
      if (!raw) return fallback;
      try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? (parsed as T) : fallback;
      } catch {
        return fallback;
      }
    },

    setJSON(key: string, value: unknown): boolean {
      try {
        return this.setItem(key, JSON.stringify(value));
      } catch {
        return false;
      }
    },

    /** この端末で本当に永続化できるか（false のときは案内を出す用） */
    get isPersistent(): boolean {
      return backend(kind) !== null;
    },
  };
}

export const safeLocal = make('local');
export const safeSession = make('session');
