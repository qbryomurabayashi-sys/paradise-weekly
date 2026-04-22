import { create } from 'zustand';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged, updatePassword } from 'firebase/auth';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';                
import { auth, db } from '../lib/firebase';

interface User {
  name: string;
  role: '店長' | 'AM' | 'BM';
  storeName: string;
  uid: string;
  photoURL?: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  viewMode: '店長' | 'AM' | 'BM' | null;
  setViewMode: (mode: '店長' | 'AM' | 'BM' | null) => void;
  login: (id: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  init: () => void;
  updateUserRole: (targetUserId: string, newRole: '店長' | 'AM' | 'BM') => Promise<void>;
  changePassword: (newPassword: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  viewMode: null,
  setViewMode: (mode) => set({ viewMode: mode }),
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
  
  updateUserRole: async (targetUserId: string, newRole: '店長' | 'AM' | 'BM') => {
    const { user } = get();
    if (user?.role !== 'BM') throw new Error('BMのみ実行可能です');
    
    await updateDoc(doc(db, 'users', targetUserId), { role: newRole });
  },
  
  changePassword: async (newPassword: string) => {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('ログインしていません');
    await updatePassword(currentUser, newPassword);
  },

  init: () => {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        let userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists()) {
          console.log('Initializing new user in Firestore for', user.uid);
          await setDoc(doc(db, 'users', user.uid), {
            role: '店長',
            storeName: '未設定の店舗',
            createdAt: new Date().toISOString()
          });
          userDoc = await getDoc(doc(db, 'users', user.uid));
        }

        const userData = userDoc.exists() ? userDoc.data() : null;
        
        set({ 
          isAuthenticated: true, 
          user: userData ? { 
            name: userData.name || user.email?.split('@')[0] || '匿名', 
            role: userData.role, 
            storeName: userData.storeName, 
            uid: user.uid,
            photoURL: userData.photoURL
          } : null
        });
      }
 else {
        set({ isAuthenticated: false, user: null });
      }
    });
  }
}));
