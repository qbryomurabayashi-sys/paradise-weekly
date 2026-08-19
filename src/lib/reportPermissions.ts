// レポート閲覧可否の共有述語（UIのfilterRoleとは別概念）
// ルール:
//   - authorRole === 'BM'  → activeRole が 'BM' のときだけ true（店長・AMは不可）
//   - authorRole === 'AM'  → activeRole が 'AM' または 'BM' のとき true（店長は不可）
//   - authorRole === '店長'（またはそれ以外/未定義） → 常に true
export function canViewReport(
  report: { authorRole?: string },
  activeRole?: string | null
): boolean {
  const authorRole = report?.authorRole;
  if (authorRole === 'BM') {
    return activeRole === 'BM';
  }
  if (authorRole === 'AM') {
    return activeRole === 'AM' || activeRole === 'BM';
  }
  // '店長' / その他 / 未定義
  return true;
}

// 一覧・ナビに実際に出してよいか（閲覧ロール可否＋未公開の除外）の共通述語。
// draft / 未来予約(published かつ scheduledFor が未来) は本人だけが見える。
export function isPubliclyVisibleReport(
  report: { authorRole?: string; authorId?: string; status?: string; scheduledFor?: string },
  activeRole?: string | null,
  currentUid?: string | null,
  now: number = Date.now()
): boolean {
  // 1. 閲覧ロール可否
  if (!canViewReport(report, activeRole)) return false;

  const isOwner = !!currentUid && report?.authorId === currentUid;

  // 2. 下書きは本人のみ
  if (report?.status === 'draft' && !isOwner) return false;

  // 3. 未来予約は本人のみ
  const isFutureScheduled =
    report?.status === 'published' &&
    !!report?.scheduledFor &&
    new Date(report.scheduledFor).getTime() > now;
  if (isFutureScheduled && !isOwner) return false;

  return true;
}

// ストア購読を閲覧者ロールで絞るための in 配列を返す。
// BM は全件（絞らない）ため null を返す。
export function visibleAuthorRoles(role?: string | null): string[] | null {
  if (role === 'BM') return null; // 絞らず全件
  if (role === 'AM') return ['店長', 'AM'];
  // 店長 / 未定義 → 安全側で店長のみ
  return ['店長'];
}
