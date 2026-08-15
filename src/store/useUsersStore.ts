import { create } from 'zustand';
import { db } from '../lib/firebase';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';

export interface AppUser {
  uid: string;
  name: string;
  role: string;
  storeName: string;
  avatarUrl?: string;
}

interface UsersState {
  users: AppUser[];
  hasLoaded: boolean;
  init: () => () => void;
}

export const useUsersStore = create<UsersState>((set, get) => ({
  users: [],
  hasLoaded: false,
  init: () => {
    if (get().hasLoaded) return () => {};

    const loadUsers = async () => {
      try {
        const q = query(collection(db, 'users'), orderBy('name', 'asc'), limit(250));
        const snapshot = await getDocs(q);
        const usersList = snapshot.docs.map((doc) => ({
          uid: doc.id,
          ...doc.data(),
        })) as AppUser[];
        set({ users: usersList, hasLoaded: true });
      } catch (error: any) {
        if (error.code === 'permission-denied') return;
        if (error?.message?.includes('Quota') || error?.code === 'resource-exhausted') {
          document.dispatchEvent(new CustomEvent('quota-exceeded'));
        } else {
          console.error('Users listener error:', error);
        }
      }
    };
    
    loadUsers();
    return () => {};
  },
}));
