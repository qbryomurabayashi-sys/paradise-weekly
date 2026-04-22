import { create } from 'zustand';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';                
import { auth, db } from '../lib/firebase';

interface User {
  name: string;
  role: '店長' | 'AM' | 'BM';
  storeName: string;
  uid: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  login: (id: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  init: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  login: async (id: string, password: string) => {
    try {
      const email = `${id}@paradise-weekly.app`;
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error('Login failed', error);
      throw error;
    }
  },
  logout: async () => {
    await signOut(auth);
  },
  changePassword: async (currentPassword: string, newPassword: string) => {
     // ... 今回の修正範囲外だが構造を整える
  },
  init: () => {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const userData = userDoc.data();
        
        set({ 
          isAuthenticated: true, 
          user: { 
            name: user.email?.split('@')[0] || '匿名', 
            role: userData?.role || '店長', 
            storeName: userData?.storeName || '未所属', 
            uid: user.uid 
          } 
        });
      } else {
        set({ isAuthenticated: false, user: null });
      }
    });
  }
}));
