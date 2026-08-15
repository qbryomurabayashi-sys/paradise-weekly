import { create } from 'zustand';
import { db } from '../lib/firebase';
import { collection, query, onSnapshot, doc, setDoc, limit, getDocs } from 'firebase/firestore';

export interface StoreMetrics {
  id: string; // storeId_yearMonth
  storeId: string;
  yearMonth: string; // YYYY-MM

  googleReviewCurrent: number;

  totalCustomers: number;
  budgetCustomers: number;
  lastYearCustomers: number;
  
  businessDays: number; // 営業日数
  monthlyWorkingStaff: number; // 月間総稼働実績（人工数）

  newCustomers: number;
  regularMonthly: number;
  special: number;

  demographicLadies: number;
  demographicKids: number;
  demographicTeens: number;
  demographic20s: number;
  demographic30s: number;
  demographic40s: number;
  demographic50s: number;
  demographic60sPlus: number;

  avgMon: number;
  avgTue: number;
  avgWed: number;
  avgThu: number;
  avgFri: number;
  avgSat: number;
  avgSunHoliday: number;

  updatedAt?: number;
}

interface StoreMetricsState {
  metrics: StoreMetrics[];
  loading: boolean;
  hasLoaded: boolean;
  subscribe: () => () => void;
  updateMetrics: (storeId: string, yearMonth: string, data: Partial<StoreMetrics>) => Promise<void>;
}

export const useStoreMetricsStore = create<StoreMetricsState>((set, get) => ({
  metrics: [],
  loading: true,
  hasLoaded: false,
  subscribe: () => {
    if (get().hasLoaded) return () => {};
    set({ loading: true });
    
    const loadMetrics = async () => {
      try {
        const q = query(collection(db, 'storeMetrics'), limit(250));
        const snapshot = await getDocs(q);
        const metricsData: StoreMetrics[] = [];
        snapshot.forEach((docSnap) => {
          metricsData.push({ id: docSnap.id, ...docSnap.data() } as StoreMetrics);
        });
        set({ metrics: metricsData, loading: false, hasLoaded: true });
      } catch (error: any) {
        if (error?.message?.includes('Quota') || error?.code === 'resource-exhausted') {
          document.dispatchEvent(new CustomEvent('quota-exceeded'));
        } else {
          console.error('Failed to load store metrics:', error);
        }
        set({ loading: false });
      }
    };

    loadMetrics();
    return () => {};
  },
  updateMetrics: async (storeId, yearMonth, data) => {
    const id = `${storeId}_${yearMonth}`;
    const docRef = doc(db, 'storeMetrics', id);
    await setDoc(docRef, {
      ...data,
      storeId,
      yearMonth,
      updatedAt: Date.now()
    }, { merge: true });
  }
}));
