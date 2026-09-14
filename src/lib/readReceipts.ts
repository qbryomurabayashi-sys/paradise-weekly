/**
 * 「誰がいいねしたか」「誰が見たか / まだ届いていないか」を、
 * 既にFirestoreにあるデータ（reactions / readBy / seenBy）から組み立てる。
 *
 * ■ 設計上の禁止事項（守ること）
 *   - 既読率・未読件数のランキングや累積スコアは作らない。並び順は固定（人を序列化しない）。
 *   - 記録するのは「初回に開いた」の1点だけ。滞在時間・開いた回数・端末情報は取らない。
 *   - 「未読者」ではなく「まだ届いていない人」として扱う。評価対象は人ではなく投稿。
 */

import type { AppUser } from '../store/useUsersStore';
import type { Person } from '../components/ui/PeopleSheet';

type ReactionLike = {
  type?: string;
  count?: number;
  userIds?: string[];
  userNames?: string[];
};

const findUser = (users: AppUser[] | undefined, uid: string) =>
  Array.isArray(users) ? users.find((u) => u.uid === uid) : undefined;

const userToPerson = (u: AppUser | undefined, uid: string, fallbackName?: string): Person => ({
  uid,
  name: (u && u.name) || fallbackName || '（名前未登録）',
  role: u ? u.role : undefined,
  storeName: u ? u.storeName : undefined,
  photoURL: u ? (u as any).photoURL || u.avatarUrl : undefined,
});

/**
 * リアクション1種類の実施者一覧。
 * userNames は過去のトグル処理で userIds と添字がずれ得るため、
 * 「同じ長さのときだけ」名前の対応を信じ、原則は users マスタから解決する。
 */
export function reactionPeople(rc: ReactionLike | undefined, users: AppUser[] | undefined): Person[] {
  const ids = Array.isArray(rc?.userIds) ? rc!.userIds! : [];
  const names = Array.isArray(rc?.userNames) ? rc!.userNames! : [];
  const trustIndex = names.length === ids.length;
  return ids.map((uid, i) => userToPerson(findUser(users, uid), uid, trustIndex ? names[i] : undefined));
}

/**
 * 閲覧者（足跡）一覧。readBy の並び順＝初回に開いた順。
 * 時刻は readAt（あれば）を使い、無ければ times で補完する（著者の通知由来など）。
 */
export function readerPeople(
  readBy: string[] | undefined,
  users: AppUser[] | undefined,
  readAt?: Record<string, string> | undefined,
  times?: Map<string, string> | undefined
): Person[] {
  const ids = Array.isArray(readBy) ? readBy : [];
  return ids.map((uid) => {
    const p = userToPerson(findUser(users, uid), uid);
    const at = (readAt && readAt[uid]) || (times && times.get(uid)) || undefined;
    return { ...p, at };
  });
}

/**
 * この投稿が「届くべき人」のロール集合。visibleAuthorRoles の逆写像。
 *   - 店長の投稿 → 店長・AM・BM が見られる
 *   - AMの投稿   → AM・BM
 *   - BMの投稿   → BM のみ
 */
export function expectedReaderRoles(authorRole?: string): string[] {
  if (authorRole === 'BM') return ['BM'];
  if (authorRole === 'AM') return ['AM', 'BM'];
  return ['店長', 'AM', 'BM'];
}

/**
 * 「まだ届いていない人」一覧。
 * 見せる相手は投稿者本人・AM・BM に限る（店長同士の相互監視を作らない）。
 * 並び順は名前の昇順で固定する。
 */
export function pendingReaderPeople(
  report: { authorRole?: string; authorId?: string; readBy?: string[] } | undefined,
  users: AppUser[] | undefined
): Person[] {
  if (!report) return [];
  const roles = expectedReaderRoles(report.authorRole);
  const readBy = Array.isArray(report.readBy) ? report.readBy : [];
  const list = Array.isArray(users) ? users : [];
  return list
    .filter((u) => roles.indexOf(u.role) !== -1)
    .filter((u) => u.uid !== report.authorId)
    .filter((u) => readBy.indexOf(u.uid) === -1)
    .slice()
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ja'))
    .map((u) => userToPerson(u, u.uid));
}

/** 「届くべき人」の総数（分母）。著者本人は除く。 */
export function expectedReaderCount(
  report: { authorRole?: string; authorId?: string } | undefined,
  users: AppUser[] | undefined
): number {
  if (!report) return 0;
  const roles = expectedReaderRoles(report.authorRole);
  const list = Array.isArray(users) ? users : [];
  return list.filter((u) => roles.indexOf(u.role) !== -1 && u.uid !== report.authorId).length;
}

/** uid配列（お知らせの seenBy / hiddenBy 等）をそのまま人リストにする */
export function uidsToPeople(uids: string[] | undefined, users: AppUser[] | undefined): Person[] {
  const ids = Array.isArray(uids) ? uids : [];
  return ids.map((uid) => userToPerson(findUser(users, uid), uid));
}
