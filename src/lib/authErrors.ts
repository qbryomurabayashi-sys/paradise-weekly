/**
 * Firebase Auth のエラーを、現場の誰でも次の行動が分かる日本語にする。
 * 英文の "Firebase: Error (auth/invalid-credential)." をそのまま出すと
 * 利用者は原因を切り分けられず、BMへの問い合わせになる。
 */

const MESSAGES: Record<string, string> = {
  'auth/invalid-credential': 'IDまたはパスワードが違います。半角で入力されているかご確認ください。',
  'auth/wrong-password': 'パスワードが違います。',
  'auth/user-not-found': 'このIDは登録されていません。',
  'auth/invalid-email': 'IDに使えない文字が含まれています（全角文字・記号・スペース）。半角英数で入力してください。',
  'auth/missing-password': 'パスワードを入力してください。',
  'auth/too-many-requests':
    '入力を何度も間違えたため、一時的にロックされています。15分ほど待ってからもう一度お試しください。',
  'auth/network-request-failed':
    '通信できませんでした。電波状況をご確認ください。機内モードや広告ブロック機能が原因の場合もあります。',
  'auth/user-disabled': 'このアカウントは停止されています。BMへご連絡ください。',
  'auth/operation-not-allowed': 'この認証方法は現在無効です。BMへご連絡ください。',
  'auth/web-storage-unsupported':
    'ブラウザの設定でデータの保存が禁止されているため、ログインできません。設定 → Safari → 「すべてのCookieをブロック」をオフにしてください。',
  'auth/quota-exceeded': 'システムの利用上限に達しました。時間をおいてお試しください。',
  'auth/internal-error': '認証サーバーでエラーが発生しました。時間をおいてお試しください。',
};

/** ストレージ禁止（SecurityError）の案内文。iPhoneで最も多い詰まり方。 */
export const STORAGE_BLOCKED_MESSAGE =
  'ブラウザの設定（Cookieのブロック）が原因でログインできません。設定 → Safari → 「すべてのCookieをブロック」をオフにしてから、もう一度お試しください。';

export function toJapaneseAuthError(error: any): string {
  if (!error) return 'ログインに失敗しました。もう一度お試しください。';

  const code: string = error.code || '';
  if (MESSAGES[code]) return MESSAGES[code];

  // Cookie/サイトデータのブロックでストレージ参照が失敗したケース
  if (error.name === 'SecurityError' || /operation is insecure/i.test(error.message || '')) {
    return STORAGE_BLOCKED_MESSAGE;
  }

  if (error.message === 'TIMEOUT') {
    return '通信に時間がかかっています。電波の良い場所で、もう一度お試しください。';
  }

  const hint = code || error.name || '不明';
  return `ログインに失敗しました（${hint}）。この画面をBMにお伝えください。`;
}
