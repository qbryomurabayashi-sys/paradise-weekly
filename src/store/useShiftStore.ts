import { create } from 'zustand';
import { db } from '../lib/firebase';
import { collection, query, onSnapshot, doc, setDoc, updateDoc, deleteDoc, where, getDocs } from 'firebase/firestore';

export interface Store {
  id: string;
  name: string;
  requiredStaffing: {
    monday: number;
    weekday: number;
    friday: number;
    saturday: number;
    sundayHoliday: number;
  };
  closedDaysOfWeek?: number[];
  closedDates?: string[];
}

export interface Staff {
  id: string;
  storeId: string;
  employmentType: 'fulltime' | 'parttime';
  defaultPtShiftType?: 'full' | 'short';
  lastName: string;
  firstName: string;
  monthlyOffDays?: number;
  weeklyWorkDays?: number;
  closedDaysOfWeek?: number[];
  closedDates?: string[];
}

export type ShiftRequestType = '希望休' | '有休' | 'フリー有休' | '会議' | '研修' | '特休' | 'その他' | '公出' | '希望休なし';

export interface ShiftRequest {
  id: string;
  staffId: string;
  storeId: string;
  date: string; // YYYY-MM-DD
  type: ShiftRequestType;
  ptShiftType?: 'full' | 'short';
  status: 'pending' | 'approved' | 'rejected';
  submittedBy: string;
  notes?: string;
}

interface ShiftStoreState {
  stores: Store[];
  staffs: Staff[];
  shiftRequests: ShiftRequest[];
  isLoading: boolean;
  hasCleanedUp: boolean;
  
  initStores: () => () => void;
  initStaffs: () => () => void;
  initShiftRequests: (monthPrefix: string) => () => void; // "YYYY-MM"
  
  saveStore: (store: Store) => Promise<void>;
  saveStaff: (staff: Staff) => Promise<void>;
  saveShiftRequest: (req: ShiftRequest) => Promise<void>;
  deleteShiftRequest: (id: string) => Promise<void>;
  deleteStore: (id: string) => Promise<void>;
  deleteStaff: (id: string) => Promise<void>;
  cleanupOldShiftRequests: () => Promise<void>;
}

export const useShiftStore = create<ShiftStoreState>((set, get) => ({
  stores: [],
  staffs: [],
  shiftRequests: [],
  isLoading: false,
  hasCleanedUp: false,

  initStores: () => {
    set({ isLoading: true });
    const q = query(collection(db, 'stores'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const stores = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Store));
      set({ stores, isLoading: false });
    });
    return unsubscribe;
  },

  initStaffs: () => {
    set({ isLoading: true });
    const q = query(collection(db, 'staffs'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const staffs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Staff));
      set({ staffs, isLoading: false });
    });
    return unsubscribe;
  },

  initShiftRequests: (monthPrefix: string) => {
    set({ isLoading: true });
    
    // Auto-cleanup old shift requests
    if (!get().hasCleanedUp) {
      get().cleanupOldShiftRequests();
      set({ hasCleanedUp: true });
    }

    // This query assumes date string is like YYYY-MM-DD, a simple >= and <= is enough, 
    // but firestore string where filter requires fields. Let's just fetch all or filter by greater than start of month and less than end of month
    // since string matching works for YYYY-MM
    const startStr = `${monthPrefix}-01`;
    const endStr = `${monthPrefix}-31`;
    
    const q = query(
      collection(db, 'shift_requests'),
      where('date', '>=', startStr),
      where('date', '<=', endStr)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const shiftRequests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ShiftRequest));
      set({ shiftRequests, isLoading: false });
    });
    return unsubscribe;
  },

  saveStore: async (store: Store) => {
    if (!store.id) store.id = doc(collection(db, 'stores')).id;
    await setDoc(doc(db, 'stores', store.id), store);
  },

  saveStaff: async (staff: Staff) => {
    if (!staff.id) staff.id = doc(collection(db, 'staffs')).id;
    await setDoc(doc(db, 'staffs', staff.id), staff);
  },

  saveShiftRequest: async (req: ShiftRequest) => {
    if (!req.id) req.id = doc(collection(db, 'shift_requests')).id;
    await setDoc(doc(db, 'shift_requests', req.id), req);
  },

  deleteShiftRequest: async (id: string) => {
    if (!id) return;
    await deleteDoc(doc(db, 'shift_requests', id));
  },

  deleteStore: async (id: string) => {
    if (!id) return;
    await deleteDoc(doc(db, 'stores', id));
  },

  deleteStaff: async (id: string) => {
    if (!id) return;
    await deleteDoc(doc(db, 'staffs', id));
  },

  cleanupOldShiftRequests: async () => {
    try {
      const now = new Date();
      now.setMonth(now.getMonth() - 2); // 2 months ago
      const twoMonthsAgoStr = now.toISOString().split('T')[0]; // "YYYY-MM-DD"

      const q = query(
        collection(db, 'shift_requests'),
        where('date', '<', twoMonthsAgoStr)
      );

      const snapshot = await getDocs(q);
      snapshot.forEach((docSnap) => {
        deleteDoc(doc(db, 'shift_requests', docSnap.id)).catch(console.error);
      });
    } catch (err) {
      console.error('Failed to cleanup old shift requests', err);
    }
  }
}));
