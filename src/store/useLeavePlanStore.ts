import { create } from 'zustand';
import { db } from '../lib/firebase';
import { collection, query, onSnapshot, doc, setDoc, where } from 'firebase/firestore';

export interface LeavePlan {
  id: string; // "YYYY-MM_staffId"
  staffId: string;
  storeId: string;
  targetMonth: string; // "YYYY-MM"
  paidLeave: number; // 有休
  publicWork: number; // 公出
  training: number; // 研修
  meeting: number; // 会議
  updatedAt: string;
}

interface LeavePlanState {
  leavePlans: LeavePlan[];
  isLoading: boolean;
  loadedMonth: string;
  initLeavePlans: (monthPrefix: string) => () => void;
  saveLeavePlan: (plan: LeavePlan) => Promise<void>;
}

let _leavePlansUnsub: any = null;
let _leavePlansMonth: string = '';

export const useLeavePlanStore = create<LeavePlanState>((set, get) => ({
  leavePlans: [],
  isLoading: false,
  loadedMonth: '',

  initLeavePlans: (targetMonth: string) => {
    if (get().loadedMonth === targetMonth) return () => {};
    
    set({ isLoading: true });
    
    const loadLeavePlans = async () => {
      try {
        const { getDocs } = await import('firebase/firestore');
        const q = query(
          collection(db, 'leave_plans'),
          where('targetMonth', '==', targetMonth)
        );
        const snapshot = await getDocs(q);
        const leavePlans = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LeavePlan));
        set({ leavePlans, isLoading: false, loadedMonth: targetMonth });
      } catch (error: any) {
        if (error?.message?.includes('Quota') || error?.code === 'resource-exhausted') {
          document.dispatchEvent(new CustomEvent('quota-exceeded'));
        } else {
          console.error('Leave plans fetch error:', error);
        }
        set({ isLoading: false });
      }
    };
    
    loadLeavePlans();
    return () => {};
  },

  saveLeavePlan: async (plan: LeavePlan) => {
    // We can use a composite ID to ensure uniqueness per month per staff
    plan.id = `${plan.targetMonth}_${plan.staffId}`;
    plan.updatedAt = new Date().toISOString();
    await setDoc(doc(db, 'leave_plans', plan.id), plan);
  }
}));
