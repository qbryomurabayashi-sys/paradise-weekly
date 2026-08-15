import { createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, setDoc, getDoc, collection, writeBatch } from 'firebase/firestore';
import { auth, db } from './firebase';

export const SEED_STORES = [
  { id: 'store_kitaguchi', name: '北口', operatingHoursPerDay: 8, availableSeats: 40, closedDaysOfWeek: [2], closedDates: [], requiredStaffing: { monday: 4, weekday: 3, friday: 4, saturday: 5, sundayHoliday: 5 } },
  { id: 'store_bessho', name: '別所', operatingHoursPerDay: 8, availableSeats: 35, closedDaysOfWeek: [], closedDates: [], requiredStaffing: { monday: 3, weekday: 3, friday: 4, saturday: 5, sundayHoliday: 5 } },
  { id: 'store_bunko', name: '文庫', operatingHoursPerDay: 8, availableSeats: 50, closedDaysOfWeek: [], closedDates: [], requiredStaffing: { monday: 5, weekday: 4, friday: 5, saturday: 6, sundayHoliday: 6 } },
  { id: 'store_mm', name: 'MM', operatingHoursPerDay: 8, availableSeats: 60, closedDaysOfWeek: [3], closedDates: [], requiredStaffing: { monday: 5, weekday: 5, friday: 6, saturday: 8, sundayHoliday: 8 } },
  { id: 'store_kamio', name: 'ｶﾐｵ', operatingHoursPerDay: 8, availableSeats: 30, closedDaysOfWeek: [], closedDates: [], requiredStaffing: { monday: 3, weekday: 3, friday: 4, saturday: 4, sundayHoliday: 4 } },
  { id: 'store_kuri', name: '久里', operatingHoursPerDay: 8, availableSeats: 45, closedDaysOfWeek: [], closedDates: [], requiredStaffing: { monday: 4, weekday: 3, friday: 4, saturday: 5, sundayHoliday: 5 } },
  { id: 'store_shioiri', name: '汐入', operatingHoursPerDay: 8, availableSeats: 40, closedDaysOfWeek: [], closedDates: [], requiredStaffing: { monday: 4, weekday: 4, friday: 5, saturday: 5, sundayHoliday: 5 } },
  { id: 'store_shiyaku', name: '市役', operatingHoursPerDay: 8, availableSeats: 25, closedDaysOfWeek: [0, 6], closedDates: [], requiredStaffing: { monday: 3, weekday: 3, friday: 3, saturday: 0, sundayHoliday: 0 } },
  { id: 'store_okano', name: '岡野', operatingHoursPerDay: 8, availableSeats: 35, closedDaysOfWeek: [], closedDates: [], requiredStaffing: { monday: 3, weekday: 3, friday: 4, saturday: 5, sundayHoliday: 5 } },
  { id: 'store_hodo', name: '保土', operatingHoursPerDay: 8, availableSeats: 30, closedDaysOfWeek: [], closedDates: [], requiredStaffing: { monday: 3, weekday: 3, friday: 4, saturday: 4, sundayHoliday: 4 } },
];

export const SEED_STAFFS = [
  { id: 'staff_1', storeId: 'store_kitaguchi', lastName: '山田', firstName: '太郎', employmentType: 'fulltime', defaultPtShiftType: 'full', isLogisGrad: true, joinedDate: '2023-01-15', assignedDate: '2023-01-15', monthlyOffDays: 8, weeklyWorkDays: 5 },
  { id: 'staff_2', storeId: 'store_kitaguchi', lastName: '佐藤', firstName: '花子', employmentType: 'parttime', defaultPtShiftType: 'short', isLogisGrad: false, joinedDate: '2024-03-01', assignedDate: '2024-03-01', monthlyOffDays: 12, weeklyWorkDays: 3 },
  { id: 'staff_3', storeId: 'store_kitaguchi', lastName: '鈴木', firstName: '一郎', employmentType: 'parttime', defaultPtShiftType: 'full', isLogisGrad: false, joinedDate: '2024-05-10', assignedDate: '2024-05-10', monthlyOffDays: 15, weeklyWorkDays: 2 },
  { id: 'staff_4', storeId: 'store_bessho', lastName: '高橋', firstName: '健一', employmentType: 'fulltime', defaultPtShiftType: 'full', isLogisGrad: false, joinedDate: '2022-08-20', assignedDate: '2022-08-20', monthlyOffDays: 8, weeklyWorkDays: 5 },
  { id: 'staff_5', storeId: 'store_bessho', lastName: '田中', firstName: '美咲', employmentType: 'parttime', defaultPtShiftType: 'short', isLogisGrad: false, joinedDate: '2024-02-15', assignedDate: '2024-02-15', monthlyOffDays: 10, weeklyWorkDays: 4 },
  { id: 'staff_6', storeId: 'store_mm', lastName: '渡辺', firstName: '直樹', employmentType: 'fulltime', defaultPtShiftType: 'full', isLogisGrad: true, joinedDate: '2021-04-01', assignedDate: '2021-04-01', monthlyOffDays: 8, weeklyWorkDays: 5 },
  { id: 'staff_7', storeId: 'store_mm', lastName: '伊藤', firstName: '拓也', employmentType: 'parttime', defaultPtShiftType: 'full', isLogisGrad: false, joinedDate: '2023-11-01', assignedDate: '2023-11-01', monthlyOffDays: 14, weeklyWorkDays: 3 },
];

export const SEED_METRICS = [
  {
    id: 'metric_kitaguchi_2026-05',
    storeId: 'store_kitaguchi',
    yearMonth: '2026-05',
    googleReviewCurrent: 4.4,
    totalCustomers: 1200,
    budgetCustomers: 1100,
    lastYearCustomers: 1050,
    businessDays: 26,
    monthlyWorkingStaff: 6,
    newCustomers: 350,
    regularMonthly: 750,
    special: 100,
    demographicLadies: 400,
    demographicKids: 200,
    demographicTeens: 150,
    demographic20s: 250,
    demographic30s: 100,
    demographic40s: 50,
    demographic50s: 30,
    demographic60sPlus: 20,
    avgMon: 45,
    avgTue: 40,
    avgWed: 42,
    avgThu: 41,
    avgFri: 48,
    avgSat: 55,
    avgSunHoliday: 53,
    updatedAt: Date.now()
  },
  {
    id: 'metric_bessho_2026-05',
    storeId: 'store_bessho',
    yearMonth: '2026-05',
    googleReviewCurrent: 4.2,
    totalCustomers: 950,
    budgetCustomers: 1000,
    lastYearCustomers: 900,
    businessDays: 27,
    monthlyWorkingStaff: 5,
    newCustomers: 200,
    regularMonthly: 680,
    special: 70,
    demographicLadies: 300,
    demographicKids: 150,
    demographicTeens: 100,
    demographic20s: 200,
    demographic30s: 100,
    demographic40s: 60,
    demographic50s: 30,
    demographic60sPlus: 10,
    avgMon: 35,
    avgTue: 32,
    avgWed: 30,
    avgThu: 31,
    avgFri: 38,
    avgSat: 45,
    avgSunHoliday: 42,
    updatedAt: Date.now()
  },
  {
    id: 'metric_bunko_2026-05',
    storeId: 'store_bunko',
    yearMonth: '2026-05',
    googleReviewCurrent: 4.6,
    totalCustomers: 1500,
    budgetCustomers: 1400,
    lastYearCustomers: 1350,
    businessDays: 26,
    monthlyWorkingStaff: 8,
    newCustomers: 450,
    regularMonthly: 900,
    special: 150,
    demographicLadies: 500,
    demographicKids: 300,
    demographicTeens: 200,
    demographic20s: 300,
    demographic30s: 100,
    demographic40s: 50,
    demographic50s: 30,
    demographic60sPlus: 20,
    avgMon: 55,
    avgTue: 50,
    avgWed: 52,
    avgThu: 51,
    avgFri: 58,
    avgSat: 68,
    avgSunHoliday: 65,
    updatedAt: Date.now()
  },
  {
    id: 'metric_mm_2026-05',
    storeId: 'store_mm',
    yearMonth: '2026-05',
    googleReviewCurrent: 4.8,
    totalCustomers: 1850,
    budgetCustomers: 1800,
    lastYearCustomers: 1700,
    businessDays: 25,
    monthlyWorkingStaff: 10,
    newCustomers: 600,
    regularMonthly: 1100,
    special: 150,
    demographicLadies: 650,
    demographicKids: 350,
    demographicTeens: 250,
    demographic20s: 400,
    demographic30s: 150,
    demographic40s: 50,
    demographic50s: 30,
    demographic60sPlus: 20,
    avgMon: 68,
    avgTue: 65,
    avgWed: 62,
    avgThu: 64,
    avgFri: 75,
    avgSat: 90,
    avgSunHoliday: 88,
    updatedAt: Date.now()
  }
];

export async function runDatabaseSeed(onUpdate: (msg: string) => void) {
  try {
    onUpdate('セキュア認証アカウントの初期化を開始...');
    
    // 1. Create standard accounts
    const accounts = [
      { id: 'bm', name: 'ブランドマネージャー', role: 'BM' as const, storeName: '本部' },
      { id: 'am1', name: 'エリアマネージャーA', role: 'AM' as const, storeName: 'エリアA' },
      { id: 's1', name: '横浜北口店長', role: '店長' as const, storeName: '北口' },
      { id: 's2', name: '横浜別所店長', role: '店長' as const, storeName: '別所' },
    ];

    for (const acc of accounts) {
      const email = `${acc.id}@paradise-weekly.app`;
      const password = 'password';

      try {
        onUpdate(`アカウント作成中: ${email}...`);
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        
        // Save user profile in firestore
        await setDoc(doc(db, 'users', cred.user.uid), {
          uid: cred.user.uid,
          email: email,
          name: acc.name,
          role: acc.role,
          storeName: acc.storeName,
          photoURL: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(acc.name)}`,
          createdAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString()
        });
      } catch (err: any) {
        if (err.code === 'auth/email-already-in-use') {
          onUpdate(`アカウント ${email} は既に存在します（スキップ）`);
        } else {
          console.error(`Error creating account ${email}`, err);
          onUpdate(`警告: ${email} の作成に失敗しました: ${err.message}`);
        }
      }
    }

    // Sign out to clean up from creation auth hook
    await signOut(auth);

    // 2. Seed Stores
    onUpdate('店舗情報の登録を開始...');
    const storeBatch = writeBatch(db);
    for (const s of SEED_STORES) {
      const sRef = doc(db, 'stores', s.id);
      storeBatch.set(sRef, s);
    }
    await storeBatch.commit();

    // 3. Seed Staff
    onUpdate('スタッフ情報の登録を開始...');
    const staffBatch = writeBatch(db);
    for (const sf of SEED_STAFFS) {
      const sfRef = doc(db, 'staffs', sf.id);
      staffBatch.set(sfRef, sf);
    }
    await staffBatch.commit();

    // 4. Seed Metrics
    onUpdate('店舗実績データ・比較指数の登録を開始...');
    const metricBatch = writeBatch(db);
    for (const m of SEED_METRICS) {
      const mRef = doc(db, 'storeMetrics', m.id);
      metricBatch.set(mRef, m);
    }
    await metricBatch.commit();

    onUpdate('全てのシードデータの初期セットアップが完了しました！🌴');
    return true;
  } catch (error: any) {
    console.error('Database seeding failed', error);
    onUpdate(`初期化エラー: ${error.message || error}`);
    throw error;
  }
}
