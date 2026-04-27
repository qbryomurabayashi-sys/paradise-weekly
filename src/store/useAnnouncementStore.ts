import { create } from 'zustand';
import { db } from '../lib/firebase';
import { collection, addDoc, onSnapshot, query, orderBy, doc, updateDoc, deleteDoc } from 'firebase/firestore';

export interface Announcement {
  id: string;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  createdAt: string;
  seenBy: string[];
  hiddenBy: string[];
  isImportant: boolean;
  displayUntil: string;
}

interface AnnouncementState {
  announcements: Announcement[];
  init: () => () => void;
  addAnnouncement: (data: Omit<Announcement, 'id' | 'createdAt' | 'seenBy' | 'hiddenBy'>) => Promise<void>;
  markAsSeen: (id: string, userId: string) => Promise<void>;
  hideAnnouncement: (id: string, userId: string) => Promise<void>;
  deleteAnnouncement: (id: string) => Promise<void>;
}

export const useAnnouncementStore = create<AnnouncementState>((set, get) => ({
  announcements: [],
  init: () => {
    const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const now = new Date();
      const activeAnnouncements: Announcement[] = [];

      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data() as Omit<Announcement, 'id'>;
        const ann = { id: docSnap.id, ...data };
        
        // Auto-delete if expired
        if (ann.displayUntil && new Date(ann.displayUntil) < now) {
          if (ann.id && typeof ann.id === 'string' && ann.id.trim().length > 0) {
            deleteDoc(doc(db, 'announcements', ann.id)).catch(console.error);
          }
        } else {
          activeAnnouncements.push(ann);
        }
      });
      set({ announcements: activeAnnouncements });
    }, (error) => {
      console.error('Announcements snapshot error:', error);
    });
    return unsubscribe;
  },
  addAnnouncement: async (data) => {
    await addDoc(collection(db, 'announcements'), {
      ...data,
      createdAt: new Date().toISOString(),
      seenBy: [],
      hiddenBy: [],
    });
  },
  markAsSeen: async (id, userId) => {
    if (!id || typeof id !== 'string' || id.trim().length === 0) return;
    const { announcements } = get();
    const ann = announcements.find(a => a.id === id);
    if (!ann) return;
    
    if (!ann.seenBy?.includes(userId)) {
      const newSeenBy = [...(ann.seenBy || []), userId];
      await updateDoc(doc(db, 'announcements', id), { seenBy: newSeenBy });
    }
  },
  hideAnnouncement: async (id, userId) => {
    if (!id || typeof id !== 'string' || id.trim().length === 0) return;
    const { announcements } = get();
    const ann = announcements.find(a => a.id === id);
    if (!ann) return;
    
    if (!ann.hiddenBy?.includes(userId)) {
      const newHiddenBy = [...(ann.hiddenBy || []), userId];
      await updateDoc(doc(db, 'announcements', id), { hiddenBy: newHiddenBy });
    }
  },
  deleteAnnouncement: async (id) => {
    if (!id || typeof id !== 'string' || id.trim().length === 0) return;
    await deleteDoc(doc(db, 'announcements', id));
  }
}));
