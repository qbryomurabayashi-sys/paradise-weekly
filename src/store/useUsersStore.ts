import { create } from 'zustand';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';

export interface AppUser {
  uid: string;
  name: string;
  role: string;
  storeName: string;
  avatarUrl?: string;
}

interface UsersState {
  users: AppUser[];
  init: () => () => void;
}

export const useUsersStore = create<UsersState>((set) => ({
  users: [],
  init: () => {
    const q = query(collection(db, 'users'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersList = snapshot.docs.map((doc) => ({
        uid: doc.id,
        ...doc.data(),
      })) as AppUser[];
      set({ users: usersList });
    }, (error) => {
      if (error.code === 'permission-denied') return;
      console.error('Users listener error:', error);
    });
    return unsubscribe;
  },
}));
