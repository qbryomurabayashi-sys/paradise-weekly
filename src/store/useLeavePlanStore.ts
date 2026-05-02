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
  initLeavePlans: (monthPrefix: string) => () => void;
  saveLeavePlan: (plan: LeavePlan) => Promise<void>;
}

export const useLeavePlanStore = create<LeavePlanState>((set) => ({
  leavePlans: [],
  isLoading: false,

  initLeavePlans: (targetMonth: string) => {
    set({ isLoading: true });
    
    const q = query(
      collection(db, 'leave_plans'),
      where('targetMonth', '==', targetMonth)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const leavePlans = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LeavePlan));
      set({ leavePlans, isLoading: false });
    }, (error) => {
      console.error('Leave plans snapshot error:', error);
      set({ isLoading: false });
    });
    return unsubscribe;
  },

  saveLeavePlan: async (plan: LeavePlan) => {
    // We can use a composite ID to ensure uniqueness per month per staff
    plan.id = `${plan.targetMonth}_${plan.staffId}`;
    plan.updatedAt = new Date().toISOString();
    await setDoc(doc(db, 'leave_plans', plan.id), plan);
  }
}));
