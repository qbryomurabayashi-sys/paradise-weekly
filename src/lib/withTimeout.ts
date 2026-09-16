/**
 * Promise に締め切りを付ける。
 *
 * なぜ必要か：
 * - Firestore の setDoc / deleteDoc の Promise は、永続キャッシュに書けても
 *   **サーバーの ack が返るまで解決しない**。iPhone で Wi-Fi⇄モバイル切替・圏外・
 *   低電力モード・地下に入ると、例外も出ず永久に pending のまま残る。
 * - getDocs も同様に、長ポーリング固定＋不安定な回線では無言でハングしうる。
 * どちらも「エラーも出ない・進捗も動かない」ので、UIは押せないボタンを見せ続ける。
 * 呼び出し側で必ず締め切りを切って、利用者に状況を返せるようにする。
 *
 * 注意：タイムアウトしても**元の Promise は裏で継続しうる**（＝あとから成功して
 * サーバーに書き込まれる可能性がある）。したがって「失敗」ではなく
 * 「保存できたか確認できなかった」として扱い、再送しても壊れない設計と組み合わせること。
 */
export class TimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(`${label} が ${ms}ms 以内に完了しませんでした`);
    this.name = 'TimeoutError';
  }
}

export const withTimeout = <T,>(p: Promise<T>, ms: number, label: string): Promise<T> => {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(label, ms)), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer)) as Promise<T>;
};
