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
  isQuotaExceeded: boolean;
  viewMode: '店長' | 'AM' | 'BM' | null;
  setViewMode: (mode: '店長' | 'AM' | 'BM' | null) => void;
  setQuotaExceeded: (val: boolean) => void;
  login: (id: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  init: () => void;
  updateUserRole: (targetUserId: string, newRole: '店長' | 'AM' | 'BM') => Promise<void>;
  changePassword: (newPassword: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isQuotaExceeded: false,
  viewMode: null,
  setViewMode: (mode) => set({ viewMode: mode }),
  setQuotaExceeded: (val) => set({ isQuotaExceeded: val }),
  login: async (id: string, password: string) => {
    try {
      sessionStorage.removeItem('session_last_login_recorded');
      const cleanId = id.trim().toLowerCase();
      const email = cleanId.includes('@') ? cleanId : `${cleanId}@paradise-weekly.app`;
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error('Login failed', error);
      throw error;
    }
  },
  logout: async () => {
    await signOut(auth);
    sessionStorage.removeItem('session_last_login_recorded');
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
        try {
          let userDoc = await getDoc(doc(db, 'users', user.uid));
          if (!userDoc.exists()) {
            console.log('Initializing new user in Firestore for', user.uid);
            const defaultName = user.email?.split('@')[0] || 'ユーザー';
            await setDoc(doc(db, 'users', user.uid), {
              name: defaultName,
              role: '店長',
              storeName: '未設定の店舗',
              createdAt: new Date().toISOString(),
              lastLoginAt: new Date().toISOString()
            });
            sessionStorage.setItem('session_last_login_recorded', 'true');
            userDoc = await getDoc(doc(db, 'users', user.uid));
          } else {
            // Update last login time once per session safely
            if (!sessionStorage.getItem('session_last_login_recorded')) {
              try {
                await updateDoc(doc(db, 'users', user.uid), {
                  lastLoginAt: new Date().toISOString()
                });
                sessionStorage.setItem('session_last_login_recorded', 'true');
              } catch (e) {
                console.warn("Could not update lastLoginAt, continuing login flow:", e);
              }
            }
          }

          const userData = userDoc.exists() ? userDoc.data() : null;
          
          set({ 
            isAuthenticated: true, 
            user: userData ? { 
              name: userData.name || user.email?.split('@')[0] || '匿名', 
              role: userData.role || '店長', 
              storeName: userData.storeName || '未設定の店舗', 
              uid: user.uid,
              photoURL: userData.photoURL
            } : {
              name: user.email?.split('@')[0] || '匿名',
              role: '店長',
              storeName: '未設定の店舗',
              uid: user.uid,
            }
          });
        } catch (err: any) {
          if (err?.message?.includes('Quota') || err?.code === 'resource-exhausted') {
            set({ isQuotaExceeded: true });
          } else {
            console.error("Firestore authentication init error:", err);
          }
          
          // Fallback if we can't reach Firestore but we know who is logged in
          set({
            isAuthenticated: true,
            user: {
              name: user.email?.split('@')[0] || '匿名',
              role: '店長', // Fallback role
              storeName: '未設定の店舗',
              uid: user.uid,
            }
          });
        }
      } else {
        set({ isAuthenticated: false, user: null });
      }
    });
  }
}));
