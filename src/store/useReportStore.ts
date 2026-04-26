import { create } from 'zustand';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, doc, getDoc, updateDoc } from 'firebase/firestore';

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
  reactions: Reaction[];
  commentCount: number;
  readBy?: string[];
  createdAt: any;
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

interface ReportState {
  reports: Report[];
  filterRole: string | null;
  setFilterRole: (role: string | null) => void;
  addReport: (report: Omit<Report, 'id' | 'reactions' | 'commentCount' | 'createdAt'>) => Promise<void>;
  updateReport: (reportId: string, updates: Partial<Report>) => Promise<void>;
  deleteReport: (reportId: string) => Promise<void>;
  addComment: (reportId: string, comment: Omit<Comment, 'id' | 'createdAt'>) => Promise<void>;
  getComments: (reportId: string, callback: (comments: Comment[]) => void) => () => void;
  addReaction: (reportId: string, reactionType: string, user: { uid: string, name?: string, role?: string }) => Promise<void>;
  addCommentReaction: (reportId: string, commentId: string, reactionType: string, user: { uid: string, name?: string }) => Promise<void>;
  markAsRead: (reportId: string, userId: string) => Promise<void>;
  init: () => () => void;
}

export const useReportStore = create<ReportState>((set) => ({
  reports: [],
  filterRole: null,
  setFilterRole: (role) => set({ filterRole: role }),
  addReport: async (report) => {
    try {
      await addDoc(collection(db, 'reports'), {
        ...report,
        reactions: [],
        commentCount: 0,
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to add report', error);
      throw error;
    }
  },
  updateReport: async (reportId, updates) => {
    try {
      await updateDoc(doc(db, 'reports', reportId), updates);
    } catch (error) {
      console.error('Failed to update report', error);
      throw error;
    }
  },
  deleteReport: async (reportId) => {
    try {
      const { deleteDoc } = await import('firebase/firestore');
      await deleteDoc(doc(db, 'reports', reportId));
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
      console.error('Comments snapshot error:', error);
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
      }
    } catch (error) {
      console.error('Failed to mark as read', error);
    }
  },
  init: () => {
    const q = query(collection(db, 'reports'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const reports = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Report[];
      set({ reports });
    }, (error) => {
      // ログアウト時（許可なし）はエラーを出さずに静かに終了する
      if (error.code === 'permission-denied') {
        console.log('Firebase Listener: Access denied (expected on logout)');
        return;
      }
      console.error('Reports listener error:', error);
    });
    return unsubscribe;
  },
}));
