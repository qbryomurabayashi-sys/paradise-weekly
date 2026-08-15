// 追加詳細指標の書込（merge・非破壊）。screenshotから転記した各店 2026-07 実績。
// 追浜のみ 2026-04/05/06 も書込。実行: node scripts/writeDetailMetrics.mjs
import { readFileSync } from 'node:fs';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, collection, getDocs } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

const cfg = JSON.parse(readFileSync(new URL('../firebase-applet-config.json', import.meta.url)));
const app = initializeApp(cfg);
const db = getFirestore(app, cfg.firestoreDatabaseId);
const auth = getAuth(app);

const mmss = (s) => { const [m, x] = s.split(':').map(Number); return m * 60 + x; };

// name -> 2026-07 実績
const JUL = {
  '追浜': { totalCustomers:1509, redYellowSignal:60.2, redYellowWeekday:57.9, redYellowHoliday:65.6, avgCutTimeSec:mmss('13:11'), avgWaitTimeSec:mmss('05:21'), maleRatio:97.3, repeatRatio:97.3, seniorRatio:23.7,
    demographicKids:7, demographicTeens:45, demographic20s:88, demographic30s:100, demographic40s:277, demographic50s:383, demographic60sPlus:603,
    h8:0,h9:53,h10:232,h11:184,h12:125,h13:130,h14:107,h15:121,h16:137,h17:173,h18:147,h19:93,h20:1,h21:0,h22:0 },
  '北口': { totalCustomers:3379, redYellowSignal:85.6, redYellowWeekday:83.8, redYellowHoliday:90.2, avgCutTimeSec:mmss('13:14'), avgWaitTimeSec:mmss('15:02'), maleRatio:97.4, repeatRatio:97.9, seniorRatio:34.2,
    demographicKids:35, demographicTeens:92, demographic20s:87, demographic30s:192, demographic40s:706, demographic50s:1418, demographic60sPlus:858,
    h8:0,h9:135,h10:393,h11:299,h12:242,h13:261,h14:276,h15:263,h16:279,h17:345,h18:330,h19:321,h20:240,h21:4,h22:0 },
  '別所': { totalCustomers:3678, redYellowSignal:85.2, redYellowWeekday:81.5, redYellowHoliday:94.2, avgCutTimeSec:mmss('11:22'), avgWaitTimeSec:mmss('14:03'), maleRatio:90.4, repeatRatio:96.8, seniorRatio:27.7,
    demographicKids:199, demographicTeens:174, demographic20s:240, demographic30s:630, demographic40s:485, demographic50s:733, demographic60sPlus:1211,
    h8:0,h9:0,h10:523,h11:398,h12:309,h13:335,h14:392,h15:298,h16:348,h17:387,h18:306,h19:333,h20:43,h21:0,h22:0 },
  '文庫': { totalCustomers:3207, redYellowSignal:83.9, redYellowWeekday:79.9, redYellowHoliday:93.5, avgCutTimeSec:mmss('12:51'), avgWaitTimeSec:mmss('16:10'), maleRatio:95.9, repeatRatio:92.3, seniorRatio:27.8,
    demographicKids:84, demographicTeens:78, demographic20s:97, demographic30s:157, demographic40s:450, demographic50s:1213, demographic60sPlus:1126,
    h8:1,h9:402,h10:349,h11:344,h12:257,h13:274,h14:291,h15:241,h16:259,h17:277,h18:310,h19:200 },
  'MM': { totalCustomers:1992, redYellowSignal:81.3, redYellowWeekday:78.5, redYellowHoliday:86.6, avgCutTimeSec:mmss('13:11'), avgWaitTimeSec:mmss('10:19'), maleRatio:94.2, repeatRatio:98.9, seniorRatio:29.6,
    demographicKids:176, demographicTeens:74, demographic20s:49, demographic30s:62, demographic40s:255, demographic50s:947, demographic60sPlus:429,
    h8:0,h9:140,h10:226,h11:206,h12:160,h13:172,h14:193,h15:175,h16:181,h17:200,h18:217,h19:122 },
  'ｶﾐｵ': { totalCustomers:2299, redYellowSignal:79.5, redYellowWeekday:76.9, redYellowHoliday:85.7, avgCutTimeSec:mmss('12:53'), avgWaitTimeSec:mmss('13:45'), maleRatio:91.6, repeatRatio:95.2, seniorRatio:28.9,
    demographicKids:150, demographicTeens:101, demographic20s:104, demographic30s:219, demographic40s:257, demographic50s:754, demographic60sPlus:698,
    h8:0,h9:70,h10:297,h11:254,h12:187,h13:204,h14:220,h15:200,h16:221,h17:227,h18:223,h19:167,h20:13,h21:0,h22:0 },
  '久里': { totalCustomers:2532, redYellowSignal:91.9, redYellowWeekday:91.6, redYellowHoliday:92.6, avgCutTimeSec:mmss('13:14'), avgWaitTimeSec:mmss('21:34'), maleRatio:90.8, repeatRatio:94.8, seniorRatio:27.2,
    demographicKids:84, demographicTeens:94, demographic20s:168, demographic30s:353, demographic40s:329, demographic50s:728, demographic60sPlus:780,
    h8:0,h9:176,h10:294,h11:255,h12:213,h13:229,h14:230,h15:209,h16:283,h17:285,h18:258,h19:194,h20:5,h21:0,h22:0 },
  '汐入': { totalCustomers:3322, redYellowSignal:93.3, redYellowWeekday:92.8, redYellowHoliday:94.7, avgCutTimeSec:mmss('12:42'), avgWaitTimeSec:mmss('21:23'), maleRatio:92.5, repeatRatio:95.8, seniorRatio:26.4,
    demographicKids:226, demographicTeens:160, demographic20s:246, demographic30s:445, demographic40s:398, demographic50s:822, demographic60sPlus:1029,
    h8:0,h9:238,h10:374,h11:356,h12:287,h13:287,h14:304,h15:290,h16:301,h17:331,h18:322,h19:228,h20:8,h21:0,h22:0 },
  '市役': { totalCustomers:3317, redYellowSignal:89.7, redYellowWeekday:90.0, redYellowHoliday:88.8, avgCutTimeSec:mmss('12:03'), avgWaitTimeSec:mmss('18:27'), maleRatio:92.0, repeatRatio:96.1, seniorRatio:36.6,
    demographicKids:135, demographicTeens:71, demographic20s:122, demographic30s:171, demographic40s:453, demographic50s:1631, demographic60sPlus:702,
    h8:0,h9:123,h10:409,h11:345,h12:292,h13:281,h14:323,h15:286,h16:299,h17:337,h18:322,h19:239,h20:29,h21:0,h22:0 },
  '岡野': { totalCustomers:2302, redYellowSignal:88.2, redYellowWeekday:87.7, redYellowHoliday:89.4, avgCutTimeSec:mmss('14:35'), avgWaitTimeSec:mmss('19:01'), maleRatio:91.8, repeatRatio:72.9, seniorRatio:26.9,
    demographicKids:230, demographicTeens:94, demographic20s:122, demographic30s:167, demographic40s:440, demographic50s:792, demographic60sPlus:461,
    h8:0,h9:168,h10:252,h11:243,h12:185,h13:197,h14:230,h15:174,h16:206,h17:237,h18:225,h19:186,h20:3,h21:0,h22:0 },
  '保土': { totalCustomers:1419, redYellowSignal:55.8, redYellowWeekday:48.9, redYellowHoliday:72.5, avgCutTimeSec:mmss('14:20'), avgWaitTimeSec:mmss('08:42'), maleRatio:89.7, repeatRatio:85.2, seniorRatio:25.8,
    demographicKids:101, demographicTeens:35, demographic20s:85, demographic30s:154, demographic40s:194, demographic50s:418, demographic60sPlus:437,
    h8:0,h9:104,h10:155,h11:148,h12:104,h13:111,h14:110,h15:110,h16:152,h17:145,h18:181,h19:103,h20:1,h21:0,h22:0 },
};

// 追浜のみ 過去月（属性別/時間帯別なし。品質指標＋総客数のみ）
const OPPAMA_HIST = {
  '2026-04': { totalCustomers:1466, redYellowSignal:74.3, redYellowWeekday:71.4, redYellowHoliday:81.1, avgCutTimeSec:mmss('13:07'), avgWaitTimeSec:mmss('03:59'), maleRatio:99.0, repeatRatio:59.1, seniorRatio:26.8 },
  '2026-05': { totalCustomers:1473, redYellowSignal:75.0, redYellowWeekday:72.1, redYellowHoliday:79.0, avgCutTimeSec:mmss('14:38'), avgWaitTimeSec:mmss('03:42'), maleRatio:98.8, repeatRatio:59.2, seniorRatio:29.5 },
  '2026-06': { totalCustomers:1398, redYellowSignal:73.3, redYellowWeekday:71.2, redYellowHoliday:78.9, avgCutTimeSec:mmss('13:36'), avgWaitTimeSec:mmss('03:47'), maleRatio:98.6, repeatRatio:60.0, seniorRatio:31.0 },
};

async function main() {
  await signInWithEmailAndPassword(auth, 'bm@paradise-weekly.app', 'password');
  const snap = await getDocs(collection(db, 'stores'));
  const nameToId = {};
  snap.forEach((d) => { nameToId[(d.data().name || '').trim()] = d.id; });
  console.log('店舗一覧:', JSON.stringify(nameToId, null, 0));

  const write = async (name, ym, data) => {
    const id = nameToId[name];
    if (!id) { console.log(`  ✗ 店舗未検出: ${name}（スキップ）`); return; }
    await setDoc(doc(db, 'storeMetrics', `${id}_${ym}`), { ...data, storeId: id, yearMonth: ym, updatedAt: Date.now() }, { merge: true });
    console.log(`  ✓ ${name} ${ym} 書込 (${id})`);
  };

  console.log('--- 2026-07 全店 ---');
  for (const [name, data] of Object.entries(JUL)) await write(name, '2026-07', data);
  console.log('--- 追浜 過去月 ---');
  for (const [ym, data] of Object.entries(OPPAMA_HIST)) await write('追浜', ym, data);

  console.log('完了');
  process.exit(0);
}
main().catch((e) => { console.error('ERROR', e); process.exit(1); });
