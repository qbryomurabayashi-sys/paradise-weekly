import { create } from 'zustand';
import { db } from '../lib/firebase';
import { collection, query, onSnapshot, doc, setDoc, updateDoc, deleteDoc, where, getDocs, limit } from 'firebase/firestore';

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
  operatingHoursPerDay?: number;
  availableSeats?: number;
  assignedAM?: string;
  createdAt?: number;
}

export interface Staff {
  id: string;
  storeId: string;
  employmentType: 'fulltime' | 'parttime';
  defaultPtShiftType?: 'full' | 'short';
  lastName: string;
  firstName: string;
  isLogisGrad?: boolean;
  joinedDate?: string;
  assignedDate?: string;
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
  createdAt?: number;
  updatedAt?: number;
}

interface ShiftStoreState {
  stores: Store[];
  staffs: Staff[];
  shiftRequests: ShiftRequest[];
  isLoading: boolean;
  hasCleanedUp: boolean;
  storesLoaded: boolean;
  staffsLoaded: boolean;
  loadedRequestsMonth: string;
  
  initStores: () => () => void;
  initStaffs: () => () => void;
  initShiftRequests: (monthPrefix: string, user?: {role: string, storeName?: string, uid: string}, force?: boolean) => () => void; // "YYYY-MM"
  
  saveStore: (store: Store) => Promise<void>;
  saveStaff: (staff: Staff) => Promise<void>;
  saveShiftRequest: (req: ShiftRequest) => Promise<void>;
  deleteShiftRequest: (id: string) => Promise<void>;
  deleteStore: (id: string) => Promise<void>;
  deleteStaff: (id: string) => Promise<void>;
  cleanupOldShiftRequests: () => Promise<void>;
  deduplicateShiftRequests: (monthPrefix: string) => Promise<void>;
}

let _shiftRequestsUnsub: any = null;
let _shiftRequestsMonth: string = '';

export const useShiftStore = create<ShiftStoreState>((set, get) => ({
  stores: [],
  staffs: [],
  shiftRequests: [],
  isLoading: false,
  hasCleanedUp: false,
  storesLoaded: false,
  staffsLoaded: false,
  loadedRequestsMonth: '',

  initStores: () => {
    if (get().storesLoaded) return () => {};
    set({ isLoading: true });
    
    const loadStores = async () => {
      try {
        const q = query(collection(db, 'stores'), limit(100));
        const snapshot = await getDocs(q);
        let stores = snapshot.docs.map(doc => {
          const data = doc.data() as Store;
          if (data.assignedAM === '越井A') {
            data.assignedAM = ''; // Sanitize removed AM option
            updateDoc(doc.ref, { assignedAM: '' }).catch(console.error);
          } else if (data.assignedAM === '仲原A') {
            data.assignedAM = '仲原AM'; // Normalize legacy short form (M抜け入力ミス)
            updateDoc(doc.ref, { assignedAM: '仲原AM' }).catch(console.error);
          } else if (data.assignedAM === '松阪A') {
            data.assignedAM = '松阪AM'; // Normalize legacy short form
            updateDoc(doc.ref, { assignedAM: '松阪AM' }).catch(console.error);
          }
          return { id: doc.id, ...data };
        });
        
        const STORE_ORDER = [
          '追浜',
          '北口',
          '別所',
          '文庫',
          'MM',
          'ｶﾐｵ',
          '久里',
          '汐入',
          '市役',
          '岡野',
          '保土'
        ];

        stores.sort((a, b) => {
          const indexA = STORE_ORDER.indexOf(a.name);
          const indexB = STORE_ORDER.indexOf(b.name);
          
          if (indexA !== -1 && indexB !== -1) return indexA - indexB;
          if (indexA !== -1) return -1;
          if (indexB !== -1) return 1;
          if (a.createdAt && b.createdAt) return a.createdAt - b.createdAt;
          if (a.createdAt) return 1;
          if (b.createdAt) return -1;
          return a.name.localeCompare(b.name, 'ja');
        });

        set({ stores, isLoading: false, storesLoaded: true });
      } catch (error: any) {
        if (error?.message?.includes('Quota') || error?.code === 'resource-exhausted') {
          document.dispatchEvent(new CustomEvent('quota-exceeded'));
        } else {
          console.error("Stores fetch error:", error);
        }
        set({ isLoading: false });
      }
    };
    
    loadStores();
    return () => {};
  },

  initStaffs: () => {
    if (get().staffsLoaded) return () => {};
    set({ isLoading: true });
    
    const loadStaffs = async () => {
      try {
        const q = query(collection(db, 'staffs'), limit(300));
        const snapshot = await getDocs(q);
        const staffs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Staff));
        set({ staffs, isLoading: false, staffsLoaded: true });
      } catch (error: any) {
        if (error?.message?.includes('Quota') || error?.code === 'resource-exhausted') {
          document.dispatchEvent(new CustomEvent('quota-exceeded'));
        } else {
          console.error("Staffs fetch error:", error);
        }
        set({ isLoading: false });
      }
    };
    
    loadStaffs();
    return () => {};
  },

  initShiftRequests: (monthPrefix: string, user?: {role: string, storeName?: string, uid: string}, force: boolean = false) => {
    if (!force && get().loadedRequestsMonth === monthPrefix) return () => {};
    
    set({ isLoading: true, loadedRequestsMonth: monthPrefix });
    
    // Auto-cleanup old shift requests
    if (!get().hasCleanedUp) {
      get().cleanupOldShiftRequests();
      set({ hasCleanedUp: true });
    }

    const startStr = `${monthPrefix}-01`;
    const endStr = `${monthPrefix}-31`;
    
    // SECURITY FIX: Prevent data leak by fetching only relevant shift requests
    let constraints: any[] = [
      where('date', '>=', startStr),
      where('date', '<=', endStr)
    ];

    if (user && user.role === 'BM') {
      // BM accesses everything
    } else if (user && user.role === 'AM') {
      // AM normally accesses their area
    } else if (user && (user.role === '店長' || user.role === 'スタッフ')) {
        const myStore = get().stores.find(s => s.name === user.storeName);
        if (myStore) {
            constraints.push(where('storeId', '==', myStore.id));
        } else {
            constraints.push(where('submittedBy', '==', user.uid));
        }
    } else {
        if (user?.uid) constraints.push(where('submittedBy', '==', user.uid));
    }

    const loadShiftRequests = async () => {
      try {
        await get().deduplicateShiftRequests(monthPrefix);
        const q = query(collection(db, 'shift_requests'), ...constraints);
        const snapshot = await getDocs(q);
        const shiftRequests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ShiftRequest));
        set({ shiftRequests, isLoading: false });
      } catch (error: any) {
        if (error?.message?.includes('Quota') || error?.code === 'resource-exhausted') {
          document.dispatchEvent(new CustomEvent('quota-exceeded'));
        } else {
          console.error("Shift fetch error", error);
        }
        set({ isLoading: false });
      }
    };
    
    loadShiftRequests();
    return () => {};
  },

  saveStore: async (store: Store) => {
    if (!store.id) store.id = doc(collection(db, 'stores')).id;
    if (!store.createdAt) store.createdAt = Date.now();
    await setDoc(doc(db, 'stores', store.id), store);
  },

  saveStaff: async (staff: Staff) => {
    if (!staff.id) staff.id = doc(collection(db, 'staffs')).id;
    await setDoc(doc(db, 'staffs', staff.id), staff);
  },

  saveShiftRequest: async (req: ShiftRequest) => {
    if (!req.id) {
      req.id = `${req.staffId}_${req.date}`;
      req.createdAt = Date.now();
    } else if (!req.createdAt) {
      // Fix missing createdAt for old existing records
      req.createdAt = Date.now();
    }
    const updatedReq = { ...req, updatedAt: Date.now() };
    await setDoc(doc(db, 'shift_requests', req.id), updatedReq);

    const current = get().shiftRequests;
    const index = current.findIndex(r => r.id === req.id);
    if (index !== -1) {
      const next = [...current];
      next[index] = updatedReq;
      set({ shiftRequests: next });
    } else {
      set({ shiftRequests: [...current, updatedReq] });
    }
  },

  deleteShiftRequest: async (id: string) => {
    if (!id) return;
    await deleteDoc(doc(db, 'shift_requests', id));

    const current = get().shiftRequests;
    set({ shiftRequests: current.filter(r => r.id !== id) });
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
  },

  deduplicateShiftRequests: async (monthPrefix: string) => {
    try {
      const startStr = `${monthPrefix}-01`;
      const endStr = `${monthPrefix}-31`;
      const q = query(
        collection(db, 'shift_requests'),
        where('date', '>=', startStr),
        where('date', '<=', endStr)
      );
      const snapshot = await getDocs(q);
      const allReqs = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as ShiftRequest));
      
      const groups = new Map<string, ShiftRequest[]>();
      allReqs.forEach(r => {
        const key = `${r.staffId}_${r.date}`;
        if (!groups.has(key)) {
          groups.set(key, []);
        }
        groups.get(key)!.push(r);
      });
      
      for (const [key, reqs] of groups.entries()) {
        if (reqs.length > 1) {
          reqs.sort((a, b) => {
            const timeA = a.updatedAt || a.createdAt || 0;
            const timeB = b.updatedAt || b.createdAt || 0;
            return timeB - timeA;
          });
          
          const toDelete = reqs.slice(1);
          for (const d of toDelete) {
            await deleteDoc(doc(db, 'shift_requests', d.id));
          }
        }
      }
    } catch (err) {
      console.error('Failed to deduplicate shift requests:', err);
    }
  }
}));
