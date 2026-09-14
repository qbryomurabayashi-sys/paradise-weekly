import { create } from 'zustand';
import { db } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, writeBatch, getDocs, where, limit } from 'firebase/firestore';

export interface AppNotification {
  id: string;
  type: 'comment' | 'reaction' | 'system' | 'read' | 'read_announcement';
  fromUserId: string;
  fromUserName: string;
  reportId: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

interface NotificationState {
  notifications: AppNotification[];
  unreadCount: number;
  init: (userId: string) => () => void;
  markAsRead: (userId: string, notificationId: string) => Promise<void>;
  markAllAsRead: (userId: string) => Promise<void>;
}

let _notifUnsub: any = null;
let _notifUserId: string = '';

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  init: (userId: string) => {
    // Request permission for native notifications
    // iOSはユーザー操作なしの requestPermission を拒否する（例外/rejectになる）ので必ず包む
    try {
      if ('Notification' in window && Notification.permission === 'default') {
        const p: any = Notification.requestPermission();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      }
    } catch {
      /* iOS Safari など未対応環境は何もしない */
    }

    if (_notifUnsub && _notifUserId === userId) return () => {};
    if (_notifUnsub) _notifUnsub();
    _notifUserId = userId;

    const q = query(
      collection(db, 'users', userId, 'notifications'), 
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    
    let isInitialLoad = true;

    _notifUnsub = onSnapshot(q, (snapshot) => {
      const notifs: AppNotification[] = [];
      let unread = 0;
      
      // Handle native notifications for new actual added docs after initial load
      // iOS Safari は new Notification() 自体が使えず TypeError を投げる。
      // ここで例外が漏れると以下の set() に到達せず、通知一覧が永久に更新されなくなるため必ず包む。
      try {
        if (!isInitialLoad && 'Notification' in window && Notification.permission === 'granted') {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
              const data = change.doc.data() as AppNotification;
              // Only notify if it's unread
              if (!data.isRead) {
                const title = data.fromUserName ? `${data.fromUserName}からの通知` : '新しい通知';
                new Notification(title, {
                  body: data.message,
                  icon: '/apple-touch-icon.png',
                });
              }
            }
          });
        }
      } catch (e) {
        console.warn('Native notification unsupported on this browser:', e);
      }

      snapshot.forEach((doc) => {
        const data = doc.data() as Omit<AppNotification, 'id'>;
        notifs.push({ id: doc.id, ...data });
        if (!data.isRead) {
          unread++;
        }
      });
      
      set({ notifications: notifs, unreadCount: unread });
      isInitialLoad = false;
    }, (error) => {
      if (error?.message?.includes('Quota') || error?.code === 'resource-exhausted') {
        document.dispatchEvent(new CustomEvent('quota-exceeded'));
      } else {
      console.error('Notifications snapshot error:', error);
      }
    });
    return () => {};
  },
  markAsRead: async (userId, notificationId) => {
    try {
      const ref = doc(db, 'users', userId, 'notifications', notificationId);
      await updateDoc(ref, { isRead: true });
    } catch (e) {
      console.error('Failed to mark notification as read:', e);
    }
  },
  markAllAsRead: async (userId) => {
    try {
      const q = query(
        collection(db, 'users', userId, 'notifications'),
        where('isRead', '==', false)
      );
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) return;

      const batch = writeBatch(db);
      snapshot.forEach((d) => {
        batch.update(d.ref, { isRead: true });
      });
      await batch.commit();
    } catch (e) {
      console.error('Failed to mark all as read:', e);
    }
  }
}));
