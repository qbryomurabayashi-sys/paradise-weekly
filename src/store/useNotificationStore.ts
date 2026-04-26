import { create } from 'zustand';
import { db } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, writeBatch, getDocs, where } from 'firebase/firestore';

export interface AppNotification {
  id: string;
  type: 'comment' | 'reaction' | 'system';
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

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  init: (userId: string) => {
    // Request permission for native notifications
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    const q = query(
      collection(db, 'users', userId, 'notifications'), 
      orderBy('createdAt', 'desc')
    );
    
    let isInitialLoad = true;

    return onSnapshot(q, (snapshot) => {
      const notifs: AppNotification[] = [];
      let unread = 0;
      
      // Handle native notifications for new actual added docs after initial load
      if (!isInitialLoad && 'Notification' in window && Notification.permission === 'granted') {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const data = change.doc.data() as AppNotification;
            // Only notify if it's unread
            if (!data.isRead) {
              const title = data.fromUserName ? `${data.fromUserName}からの通知` : '新しい通知';
              new Notification(title, {
                body: data.message,
                icon: '/vite.svg', // Fallback icon path
              });
            }
          }
        });
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
      console.error('Notifications snapshot error:', error);
    });
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
