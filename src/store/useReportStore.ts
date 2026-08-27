import { create } from 'zustand';
import { auth, db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, doc, getDoc, updateDoc, where, limit } from 'firebase/firestore';
import { getFiscalWeek, normalizeKptContent } from '../lib/dateUtils';
import { useAuthStore } from './useAuthStore';
import { visibleAuthorRoles } from '../lib/reportPermissions';

export interface Reaction {
  type: string;
  count: number;
  userIds: string[];
  userNames?: string[];
}

export interface Report {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: '店長' | 'AM' | 'BM';
  authorPhotoURL?: string;
  storeName: string;
  weekNumber: number;
  year: number;
  keep: string;
  problem_gap: string;
  problem_ideal: string;
  try_who: string;
  try_when: string;
  try_what: string;
  try_why: string;
  mvpStaffId?: string;
  mvpStaffName?: string;
  mvpDetail?: string;
  concernStaffId?: string;
  concernStaffName?: string;
  concernDetail?: string;
  reactions: Reaction[];
  commentCount: number;
  readBy?: string[];
  createdAt: any;
  status?: 'draft' | 'published';
  scheduledFor?: string;
  tasks?: any[];
}

export interface CommentReaction {
  type: string;
  userIds: string[];
  userNames?: string[];
}

export interface Comment {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: '店長' | 'AM' | 'BM';
  authorPhotoURL?: string;
  text: string;
  reactions?: CommentReaction[];
  createdAt: string;
}

export function getTimestampMillis(createdAt: any): number {
  if (!createdAt) return 0;
  if (typeof createdAt === 'number') return createdAt;
  if (typeof createdAt === 'object' && typeof createdAt.toDate === 'function') {
    return createdAt.toDate().getTime();
  }
  if (typeof createdAt === 'object' && typeof createdAt.seconds === 'number') {
    return createdAt.seconds * 1000;
  }
  if (typeof createdAt === 'string') {
    const parsed = new Date(createdAt).getTime();
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

interface ReportState {
  reports: Report[];
  filterRole: string | null;
  setFilterRole: (role: string | null) => void;
  addReport: (report: Omit<Report, 'id' | 'reactions' | 'commentCount' | 'createdAt'> & { status?: 'draft' | 'published' }) => Promise<void>;
  updateReport: (reportId: string, updates: Partial<Report>) => Promise<void>;
  deleteReport: (reportId: string) => Promise<void>;
  addComment: (reportId: string, comment: Omit<Comment, 'id' | 'createdAt'>) => Promise<void>;
  getComments: (reportId: string, callback: (comments: Comment[]) => void) => () => void;
  addReaction: (reportId: string, reactionType: string, user: { uid: string, name?: string, role?: string }) => Promise<void>;
  addCommentReaction: (reportId: string, commentId: string, reactionType: string, user: { uid: string, name?: string }) => Promise<void>;
  markAsRead: (reportId: string, userId: string) => Promise<void>;
  init: () => () => void;
  reset: () => void;
}

let _reportsUnsub: any = null;
let _reportsUnsubRole: string | null = null;

export const useReportStore = create<ReportState>((set, get) => ({
  reports: [],
  filterRole: null,
  setFilterRole: (role) => set({ filterRole: role }),
  addReport: async (report) => {
    try {
      const nowIso = new Date().toISOString();
      const reportPayload = {
        ...report,
        status: report.status || 'published',
        reactions: [],
        commentCount: 0,
        createdAt: nowIso
      };
      const docRef = await addDoc(collection(db, 'reports'), reportPayload);
      
      const newReport: Report = {
        id: docRef.id,
        ...reportPayload
      };
      
      const current = get().reports;
      if (!current.some(r => r.id === newReport.id)) {
        const next = [newReport, ...current];
        next.sort((a, b) => getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt));
        set({ reports: next });
      }
    } catch (error) {
      console.error('Failed to add report', error);
      throw error;
    }
  },
  updateReport: async (reportId, updates) => {
    try {
      await updateDoc(doc(db, 'reports', reportId), updates);
      const current = get().reports;
      const idx = current.findIndex(r => r.id === reportId);
      if (idx !== -1) {
        const next = [...current];
        next[idx] = { ...next[idx], ...updates };
        next.sort((a, b) => getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt));
        set({ reports: next });
      }
    } catch (error) {
      console.error('Failed to update report', error);
      throw error;
    }
  },
  deleteReport: async (reportId) => {
    try {
      const { deleteDoc } = await import('firebase/firestore');
      await deleteDoc(doc(db, 'reports', reportId));
      const current = get().reports;
      set({ reports: current.filter(r => r.id !== reportId) });
    } catch (error) {
      console.error('Failed to delete report', error);
      throw error;
    }
  },
  addComment: async (reportId, comment) => {
    try {
      const dbCommentsRef = collection(db, 'reports', reportId, 'comments');
      await addDoc(dbCommentsRef, {
        ...comment,
        createdAt: new Date().toISOString()
      });
      // Increment comment count
      const reportRef = doc(db, 'reports', reportId);
      const reportDoc = await getDoc(reportRef);
      if (reportDoc.exists()) {
        const data = reportDoc.data() as Report;
        const currentCount = data.commentCount || 0;
        await updateDoc(reportRef, { commentCount: currentCount + 1 });
        
        // Add Notification
        if (data.authorId !== comment.authorId) {
          const { auth: authObj } = await import('../lib/firebase');
          await addDoc(collection(db, 'users', data.authorId, 'notifications'), {
            type: 'comment',
            fromUserId: comment.authorId,
            fromUserName: comment.authorName,
            reportId: reportId,
            message: `${comment.authorName || '誰か'}さんがコメントしました`,
            isRead: false,
            createdAt: new Date().toISOString()
          });
        }
      }
    } catch (e) {
      console.error('Comment error:', e);
      alert('コメントの投稿に失敗しました');
    }
  },
  getComments: (reportId, callback) => {
    const q = query(collection(db, 'reports', reportId, 'comments'), orderBy('createdAt', 'asc'));
    return onSnapshot(q, (snapshot) => {
      const cmts = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Comment[];
      callback(cmts);
    }, (error) => {
      if (error?.message?.includes('Quota') || error?.code === 'resource-exhausted') {
        document.dispatchEvent(new CustomEvent('quota-exceeded'));
      } else {
      console.error('Comments snapshot error:', error);
      }
    });
  },
  addReaction: async (reportId: string, reactionType: string, user: { uid: string, name?: string, role?: string }) => {
    try {
      const reportRef = doc(db, 'reports', reportId);
      const reportDoc = await getDoc(reportRef);
      if (!reportDoc.exists()) throw new Error('Report not found');

      const report = reportDoc.data() as Report;
      const reactions = [...(report.reactions || [])];
      const existingReactionIndex = reactions.findIndex(r => r.type === reactionType);

      let wasAdded = false;
      const userId = user.uid;
      
      if (existingReactionIndex > -1) {
        const userIds = [...reactions[existingReactionIndex].userIds];
        const userNames = [...(reactions[existingReactionIndex].userNames || [])];
        const userIndex = userIds.indexOf(userId);
        
        if (userIndex > -1) {
          // Remove reaction (toggle off)
          userIds.splice(userIndex, 1);
          if (userNames[userIndex]) userNames.splice(userIndex, 1);
          reactions[existingReactionIndex] = {
            ...reactions[existingReactionIndex],
            userIds,
            userNames,
            count: Math.max(0, reactions[existingReactionIndex].count - 1)
          };
          // Remove the reaction type if count is 0
          if (reactions[existingReactionIndex].count === 0) {
            reactions.splice(existingReactionIndex, 1);
          }
        } else {
          // Add reaction
          userIds.push(userId);
          userNames.push(user.name || '匿名');
          reactions[existingReactionIndex] = {
            ...reactions[existingReactionIndex],
            userIds,
            userNames,
            count: reactions[existingReactionIndex].count + 1
          };
          wasAdded = true;
        }
      } else {
        reactions.push({ type: reactionType, count: 1, userIds: [userId], userNames: [user.name || '匿名'] });
        wasAdded = true;
      }

      await updateDoc(reportRef, { reactions });
      
      if (wasAdded && report.authorId !== userId) {
        await addDoc(collection(db, 'users', report.authorId, 'notifications'), {
           type: 'reaction',
           fromUserId: userId,
           fromUserName: user.name || '誰か',
           reportId: reportId,
           message: `${user.name || '誰か'}さんがリアクションしました`,
           isRead: false,
           createdAt: new Date().toISOString()
        });
      }
    } catch (error: any) {
      console.error('Reaction error:', error);
      if (error.code === 'permission-denied') {
        alert('データを更新する権限がありません。管理者にお問い合わせください。');
      } else {
        alert('エラーが発生しました: ' + (error instanceof Error ? error.message : 'Unknown error'));
      }
      throw error;
    }
  },
  addCommentReaction: async (reportId: string, commentId: string, reactionType: string, user: { uid: string, name?: string }) => {
    try {
      const commentRef = doc(db, 'reports', reportId, 'comments', commentId);
      const commentDoc = await getDoc(commentRef);
      if (!commentDoc.exists()) throw new Error('Comment not found');

      const comment = commentDoc.data() as Comment;
      const reactions = [...(comment.reactions || [])];
      const existingReactionIndex = reactions.findIndex(r => r.type === reactionType);

      let wasAdded = false;
      const userId = user.uid;
      
      if (existingReactionIndex > -1) {
        const userIds = [...reactions[existingReactionIndex].userIds];
        const userNames = [...(reactions[existingReactionIndex].userNames || [])];
        const userIndex = userIds.indexOf(userId);

        if (userIndex > -1) {
          // Toggle off
          userIds.splice(userIndex, 1);
          if (userNames[userIndex]) userNames.splice(userIndex, 1);
          reactions[existingReactionIndex] = { ...reactions[existingReactionIndex], userIds, userNames };
        } else {
          userIds.push(userId);
          userNames.push(user.name || '匿名');
          reactions[existingReactionIndex] = { ...reactions[existingReactionIndex], userIds, userNames };
          wasAdded = true;
        }
      } else {
        reactions.push({ type: reactionType, userIds: [userId], userNames: [user.name || '匿名'] });
        wasAdded = true;
      }

      await updateDoc(commentRef, { reactions });
      
      if (wasAdded && comment.authorId !== userId) {
        await addDoc(collection(db, 'users', comment.authorId, 'notifications'), {
           type: 'reaction',
           fromUserId: userId,
           fromUserName: user.name || '誰か',
           reportId: reportId,
           message: `${user.name || '誰か'}さんがあなたのコメントにいいねしました`,
           isRead: false,
           createdAt: new Date().toISOString()
        });
      }
    } catch (error: any) {
      console.error('Comment reaction error:', error);
      if (error.code === 'permission-denied') {
        alert('コメントに反応する権限がありません。');
      } else {
        alert('エラーが発生しました: ' + (error instanceof Error ? error.message : 'Unknown error'));
      }
      throw error;
    }
  },
  markAsRead: async (reportId, userId) => {
    try {
      const reportRef = doc(db, 'reports', reportId);
      const reportDoc = await getDoc(reportRef);
      if (!reportDoc.exists()) return;

      const data = reportDoc.data() as Report;
      const readBy = [...(data.readBy || [])];
      
      if (!readBy.includes(userId)) {
        readBy.push(userId);
        await updateDoc(reportRef, { readBy });
        
        // Notify Author
        if (data.authorId !== userId) {
          try {
            const userDoc = await getDoc(doc(db, 'users', userId));
            const userName = userDoc.exists() ? userDoc.data()?.name || '誰か' : '誰か';
            await addDoc(collection(db, 'users', data.authorId, 'notifications'), {
               type: 'read',
               fromUserId: userId,
               fromUserName: userName,
               reportId: reportId,
               message: `${userName}さんがあなたのレポートを「見たよ」しました`,
               isRead: false,
               createdAt: new Date().toISOString()
            });
          } catch(e) { console.error('notify seen error', e); }
        }
      }
    } catch (error) {
      console.error('Failed to mark as read', error);
    }
  },
  init: () => {
    // 閲覧者ロールを確定させてから購読する。取れなければ購読を張らず後続呼び出しに委ねる。
    // （MainBoard の useEffect は依存配列に user?.role を含むため、ロール確定時に再度 init が呼ばれる）
    const role = useAuthStore.getState().user?.role ?? null;
    if (!role) return () => {};

    // 同じロールで購読済みなら何もしない。ロールが変わったら張り直す。
    if (_reportsUnsub && _reportsUnsubRole === role) return () => {};
    if (_reportsUnsub) {
      _reportsUnsub();
      _reportsUnsub = null;
      // 権限降格(AM→店長)等で旧ロールのデータが一瞬残らないよう即クリア
      set({ reports: [] });
    }
    _reportsUnsubRole = role;

    // ロール別に authorRole を絞る（BM は null＝全件）。
    // createdAt 降順の orderBy を付け、limit(150) の切り出しをサーバ側で時系列保証する
    // （createdAt は ISO 文字列保存なので辞書順＝時系列で正しく降順になる）。
    const roles = visibleAuthorRoles(role);
    const qReports = roles
      ? query(collection(db, 'reports'), where('authorRole', 'in', roles), orderBy('createdAt', 'desc'), limit(150))
      : query(collection(db, 'reports'), orderBy('createdAt', 'desc'), limit(150));

    {
      _reportsUnsub = onSnapshot(qReports, (snapshot) => {
        const rawReports = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          let weekNumber = data.weekNumber;
          if (data.createdAt) {
             let d = data.createdAt;
             if (typeof data.createdAt === 'object' && data.createdAt.toDate) {
               d = data.createdAt.toDate();
             } else {
               d = new Date(data.createdAt);
             }
             
             if (!isNaN(d.getTime())) {
               const correctWeek = getFiscalWeek(d);
               
               if (weekNumber !== correctWeek && data.authorId === auth.currentUser?.uid) {
                 updateDoc(doc(db, 'reports', docSnap.id), { weekNumber: correctWeek }).catch(e => console.error("Auto update failed:", e));
                 weekNumber = correctWeek;
               } else if (weekNumber !== correctWeek) {
                 weekNumber = correctWeek;
               }
             }
          }
          return { id: docSnap.id, ...data, weekNumber } as Report;
        });

        // Filter out drafts that don't belong to the current logged in user
        const currentUid = auth.currentUser?.uid;
        const validReports = rawReports.filter(r => r.status !== 'draft' || r.authorId === currentUid);

        // Sort properly using timestamp milliseconds
        validReports.sort((a, b) => getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt));

        // 防御的 dedupe：万一同一 id が混入しても最初の1件だけ残す（並び順は維持）。
        const seenIds = new Set<string>();
        const uniqueReports = validReports.filter((r) => {
          if (seenIds.has(r.id)) return false;
          seenIds.add(r.id);
          return true;
        });

        // 内容重複の表示側畳み込み（非破壊）：
        // Firestore の実データは一切消さず、画面上で「同一内容の重複KPT」を1枚に見せる。
        // 対象は status !== 'draft' のみ。draft は判定に入れず素通しでそのまま残す。
        // 同一グループ = authorId × weekNumber × year × 正規化本文（KPT内容フィールド全部。B と同一ロジック）。
        // 各グループで残す1件 = エンゲージメント（reactions.count 合計 + commentCount。readBy は含めない）最大、
        //   同点は createdAt 最古（getTimestampMillis 最小）。単独グループは畳まない。
        // 元の createdAt 降順の並びは維持したまま、除外対象の id を落とすだけ。
        const engagementOf = (r: Report): number => {
          const reactionSum = Array.isArray(r.reactions)
            ? r.reactions.reduce(
                (s, x: any) => s + (Number(x.count) || (Array.isArray(x.userIds) ? x.userIds.length : 0)),
                0
              )
            : 0;
          const comments = Number(r.commentCount) || 0;
          return reactionSum + comments;
        };

        // グループごとに「残す1件の id」を決める（draft はグループ化しない）。
        const groups = new Map<string, Report[]>();
        for (const r of uniqueReports) {
          if (r.status === 'draft') continue;
          const key = [
            r.authorId,
            r.weekNumber,
            r.year,
            normalizeKptContent(r),
          ].join('||');
          const arr = groups.get(key);
          if (arr) arr.push(r);
          else groups.set(key, [r]);
        }
        const keepIds = new Set<string>();
        for (const [, arr] of groups) {
          if (arr.length < 2) {
            keepIds.add(arr[0].id); // 単独は畳まない（そのまま残す）
            continue;
          }
          let best = arr[0];
          for (let i = 1; i < arr.length; i++) {
            const cand = arr[i];
            const de = engagementOf(cand) - engagementOf(best);
            if (de > 0) {
              best = cand;
            } else if (de === 0) {
              // 同点は createdAt 最古を残す（決定的）
              if (getTimestampMillis(cand.createdAt) < getTimestampMillis(best.createdAt)) best = cand;
            }
          }
          keepIds.add(best.id);
        }
        // 元の並び（createdAt 降順）を保ったまま、畳み込み対象の重複だけ除外する。
        // draft は上でグループ化していないので keepIds に無いが、ここで常に素通しで残す。
        const collapsedReports = uniqueReports.filter(
          (r) => r.status === 'draft' || keepIds.has(r.id)
        );

        set({ reports: collapsedReports });
      }, (error) => {
      if (error?.message?.includes('Quota') || error?.code === 'resource-exhausted') {
        document.dispatchEvent(new CustomEvent('quota-exceeded'));
      } else {
      if (error.code !== 'permission-denied') console.error('Reports listener error:', error);
      }
    });
    }

    return () => {};
  },
  // ログアウト/ロール切替時に購読を止めてレポートを完全にクリアする
  reset: () => {
    if (_reportsUnsub) {
      _reportsUnsub();
      _reportsUnsub = null;
    }
    _reportsUnsubRole = null;
    set({ reports: [] });
  },
}));
