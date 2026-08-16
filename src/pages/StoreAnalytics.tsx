import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ReferenceLine,
  RadarChart, PolarGrid, PolarAngleAxis, Radar,
  PieChart, Pie, Cell,
  BarChart, Bar,
} from 'recharts';
import { GlassCard } from '../components/ui/GlassCard';
import { BentoGrid, StatTile, ProgressRing, DeltaBadge, RatingStars } from '../components/ui/Indicators';
import { useAuthStore } from '../store/useAuthStore';
import {
  Users, Percent, Star, TrendingUp, Lightbulb, AlertTriangle, CheckCircle2,
  Radar as RadarIcon, PieChart as PieIcon, LineChart as LineIcon, BarChart3,
  Activity, Scissors, Clock, Repeat,
} from 'lucide-react';

interface Props {
  stores: any[];
  metrics: any[];
  selectedMonth: string;
  isMasked?: boolean;
}

const QB = {
  navy: '#00004B',
  blueDark: '#00327D',
  blue: '#005AAF',
  cyan: '#00A5EB',
  success: '#17B26A',
  danger: '#E60000',
  yellow: '#E8B923',
  grid: '#E4EBF2',
};

const DEMO_FIELDS: { key: string; label: string }[] = [
  { key: 'demographicLadies', label: 'レディ' },
  { key: 'demographicKids', label: '幼小' },
  { key: 'demographicTeens', label: '中高' },
  { key: 'demographic20s', label: '20代' },
  { key: 'demographic30s', label: '30代' },
  { key: 'demographic40s', label: '40代' },
  { key: 'demographic50s', label: '50代' },
  { key: 'demographic60sPlus', label: '60歳以上' },
];

const DAY_FIELDS = ['avgMon', 'avgTue', 'avgWed', 'avgThu', 'avgFri', 'avgSat', 'avgSunHoliday'];
const DAY_LABELS = ['月', '火', '水', '木', '金', '土', '日祝'];

const hexToRgb = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const lerp = (from: string, to: string, t: number) => {
  const a = hexToRgb(from), b = hexToRgb(to);
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * Math.max(0, Math.min(1, t))));
  return `#${c.map(v => v.toString(16).padStart(2, '0')).join('')}`;
};
const DEMO_COLORS = DEMO_FIELDS.map((_, i) => lerp(QB.blueDark, QB.cyan, i / (DEMO_FIELDS.length - 1)));

const clampPct = (v: number, cap: number) => Math.max(0, Math.min(100, (v / cap) * 100));

const getProductivity = (m: any) => (m?.monthlyWorkingStaff ? (m.totalCustomers || 0) / m.monthlyWorkingStaff : 0);
const getBudgetRate = (m: any) => (m?.budgetCustomers ? ((m.totalCustomers || 0) / m.budgetCustomers) * 100 : 0);
const getLastYearRate = (m: any) => (m?.lastYearCustomers ? ((m.totalCustomers || 0) / m.lastYearCustomers) * 100 : 0);
const getNewRate = (m: any) => (m?.totalCustomers ? ((m.newCustomers || 0) / m.totalCustomers) * 100 : 0);
const getRegularRate = (m: any) => (m?.totalCustomers ? ((m.regularMonthly || 0) / m.totalCustomers) * 100 : 0);
const getSpecialRate = (m: any) => (m?.totalCustomers ? ((m.special || 0) / m.totalCustomers) * 100 : 0);
const getDailyAvg = (m: any) => (m?.businessDays ? (m.totalCustomers || 0) / m.businessDays : 0);

const secToMMSS = (sec?: number) => {
  if (sec == null || isNaN(sec) || sec <= 0) return '--:--';
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

const HOUR_FIELDS = ['h8', 'h9', 'h10', 'h11', 'h12', 'h13', 'h14', 'h15', 'h16', 'h17', 'h18', 'h19', 'h20', 'h21', 'h22'];
const HOUR_LABELS = ['8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22'];

// 曜日別平均のばらつきが小さいほど「稼働バランスが良い」とみなし0-100で表現
const getDayBalance = (m: any) => {
  const values = DAY_FIELDS.map(k => m?.[k]).filter((v: any) => typeof v === 'number' && v > 0);
  if (values.length < 2) return 50;
  const mean = values.reduce((a: number, b: number) => a + b, 0) / values.length;
  if (mean === 0) return 50;
  const variance = values.reduce((a: number, v: number) => a + (v - mean) ** 2, 0) / values.length;
  const cv = Math.sqrt(variance) / mean; // 変動係数
  return Math.max(0, 100 - cv * 100);
};

export const StoreAnalytics: React.FC<Props> = ({ stores, metrics, selectedMonth: monthProp, isMasked = true }) => {
  const { user, viewMode } = useAuthStore();
  const activeRole = user?.role === 'BM' && viewMode ? viewMode : user?.role;

  const defaultStoreId = useMemo(() => {
    if (activeRole === '店長') {
      const mine = stores.find((s: any) => s.name === user?.storeName);
      if (mine) return mine.id;
    }
    return stores[0]?.id || '';
  }, [stores, activeRole, user?.storeName]);

  const [selectedStoreId, setSelectedStoreId] = useState<string>(defaultStoreId);
  const storeId = selectedStoreId || defaultStoreId;
  const store = stores.find((s: any) => s.id === storeId);
  const isLocked = activeRole === '店長';

  // 月：親propを初期値にして分析タブ内で独立選択できるようにする
  const [monthLocal, setMonthLocal] = useState<string>(monthProp);
  const selectedMonth = monthLocal;

  // エリア：店舗ドロップダウンを絞り込む（全エリア + 各AM）。BMのみ操作可。
  const [areaFilter, setAreaFilter] = useState<string>('ALL');
  const areas = useMemo(
    () => Array.from(new Set(stores.map((s: any) => s.assignedAM).filter(Boolean))) as string[],
    [stores],
  );
  const visibleStores = useMemo(
    () => (areaFilter === 'ALL' ? stores : stores.filter((s: any) => s.assignedAM === areaFilter)),
    [stores, areaFilter],
  );
  const handleAreaChange = (a: string) => {
    setAreaFilter(a);
    if (a !== 'ALL') {
      const inArea = stores.filter((s: any) => s.assignedAM === a);
      if (inArea.length && !inArea.some((s: any) => s.id === storeId)) setSelectedStoreId(inArea[0].id);
    }
  };

  const current = metrics.find((m: any) => m.storeId === storeId && m.yearMonth === selectedMonth);

  const area = store?.assignedAM;
  const areaStores = useMemo(() => stores.filter((s: any) => s.assignedAM === area), [stores, area]);
  const areaMetrics = useMemo(
    () => areaStores.map((s: any) => metrics.find((m: any) => m.storeId === s.id && m.yearMonth === selectedMonth)).filter(Boolean),
    [areaStores, metrics, selectedMonth],
  );
  const companyMetrics = useMemo(
    () => stores.map((s: any) => metrics.find((m: any) => m.storeId === s.id && m.yearMonth === selectedMonth)).filter(Boolean),
    [stores, metrics, selectedMonth],
  );

  const avg = (arr: any[], fn: (m: any) => number) => (arr.length ? arr.reduce((a, m) => a + fn(m), 0) / arr.length : 0);

  const areaAvgProductivity = avg(areaMetrics, getProductivity);
  const companyAvgProductivity = avg(companyMetrics, getProductivity);
  const areaAvgGoogle = avg(areaMetrics.filter((m: any) => m.googleReviewCurrent), (m) => m.googleReviewCurrent || 0);
  const companyAvgGoogle = avg(companyMetrics.filter((m: any) => m.googleReviewCurrent), (m) => m.googleReviewCurrent || 0);
  const companyAvgNewRate = avg(companyMetrics, getNewRate);

  // 直近6ヶ月の推移（当該店舗のみ、月昇順）
  const trend = useMemo(() => {
    return metrics
      .filter((m: any) => m.storeId === storeId)
      .sort((a: any, b: any) => a.yearMonth.localeCompare(b.yearMonth))
      .slice(-6)
      .map((m: any) => ({
        month: m.yearMonth.slice(5) + '月',
        総客数: m.totalCustomers || 0,
        予算: m.budgetCustomers || 0,
        前年: m.lastYearCustomers || 0,
        生産性: Number(getProductivity(m).toFixed(1)),
      }));
  }, [metrics, storeId]);

  // レーダー：店舗 vs エリア平均 vs 全社平均（各軸0-100に正規化）
  const radarData = useMemo(() => {
    const maxProductivity = Math.max(1, ...companyMetrics.map(getProductivity));
    const norm = (m: any) => ([
      { axis: '生産性', value: clampPct(getProductivity(m), maxProductivity) },
      { axis: '予算達成率', value: clampPct(getBudgetRate(m), 150) },
      { axis: '前年比', value: clampPct(getLastYearRate(m), 150) },
      { axis: '新規率', value: clampPct(getNewRate(m), 20) },
      { axis: '口コミ', value: clampPct((m.googleReviewCurrent || 0) * 20, 100) },
      { axis: '稼働バランス', value: getDayBalance(m) },
    ]);
    if (!current) return [];
    const storeAxes = norm(current);
    const areaAvgM = {
      totalCustomers: 0, monthlyWorkingStaff: 0, budgetCustomers: 0, lastYearCustomers: 0, newCustomers: 0, googleReviewCurrent: areaAvgGoogle,
    };
    const companyAvgM = { ...areaAvgM, googleReviewCurrent: companyAvgGoogle };
    return storeAxes.map((row, i) => ({
      axis: row.axis,
      [store?.name || '対象店舗']: Math.round(row.value),
      エリア平均: Math.round(clampPct(
        i === 0 ? areaAvgProductivity : i === 4 ? areaAvgGoogle * 20 : avg(areaMetrics, [getBudgetRate, getLastYearRate, getNewRate, () => 0, () => 0, getDayBalance][i] || (() => 0)),
        i === 0 ? maxProductivity : i === 3 ? 20 : i === 4 ? 100 : i === 5 ? 100 : 150,
      )),
      全社平均: Math.round(clampPct(
        i === 0 ? companyAvgProductivity : i === 4 ? companyAvgGoogle * 20 : avg(companyMetrics, [getBudgetRate, getLastYearRate, getNewRate, () => 0, () => 0, getDayBalance][i] || (() => 0)),
        i === 0 ? maxProductivity : i === 3 ? 20 : i === 4 ? 100 : i === 5 ? 100 : 150,
      )),
    }));
  }, [current, companyMetrics, areaMetrics, areaAvgProductivity, companyAvgProductivity, areaAvgGoogle, companyAvgGoogle, store]);

  // 客層構成（円グラフ）
  const demoData = useMemo(() => {
    if (!current) return [];
    return DEMO_FIELDS.map((f, i) => ({ name: f.label, value: current[f.key] || 0, color: DEMO_COLORS[i] })).filter(d => d.value > 0);
  }, [current]);

  // エリア別比較（生産性・口コミ）
  const areaCompare = useMemo(() => {
    const areas = Array.from(new Set(stores.map((s: any) => s.assignedAM).filter(Boolean)));
    return areas.map(a => {
      const aStores = stores.filter((s: any) => s.assignedAM === a);
      const aMetrics = aStores.map((s: any) => metrics.find((m: any) => m.storeId === s.id && m.yearMonth === selectedMonth)).filter(Boolean);
      return {
        name: a,
        生産性: Number(avg(aMetrics, getProductivity).toFixed(1)),
        isMine: a === area,
      };
    });
  }, [stores, metrics, selectedMonth, area]);

  // エリア別 口コミ比較
  const areaGoogleCompare = useMemo(() => {
    const areas = Array.from(new Set(stores.map((s: any) => s.assignedAM).filter(Boolean)));
    return areas.map(a => {
      const aStores = stores.filter((s: any) => s.assignedAM === a);
      const aMetrics = aStores.map((s: any) => metrics.find((m: any) => m.storeId === s.id && m.yearMonth === selectedMonth)).filter((m: any) => m && m.googleReviewCurrent);
      return {
        name: a,
        口コミ: Number(avg(aMetrics, (m) => m.googleReviewCurrent || 0).toFixed(2)),
        isMine: a === area,
      };
    }).filter(d => d.口コミ > 0);
  }, [stores, metrics, selectedMonth, area]);

  // 曜日別平均客数（ピーク/閑散日ハイライト）
  const dayChart = useMemo(() => {
    if (!current) return [];
    const rows = DAY_FIELDS.map((k, i) => ({ day: DAY_LABELS[i], 平均客数: Number((current[k] || 0).toFixed(1)) }));
    const vals = rows.map(r => r.平均客数);
    const max = Math.max(...vals), min = Math.min(...vals.filter(v => v > 0));
    return rows.map(r => ({ ...r, isPeak: r.平均客数 === max && max > 0, isLow: r.平均客数 === min && r.平均客数 > 0 }));
  }, [current]);

  // 客数内訳（新規/ツキイチ/優待/一般）
  const breakdownData = useMemo(() => {
    if (!current) return [];
    const total = current.totalCustomers || 0;
    const nw = current.newCustomers || 0, rg = current.regularMonthly || 0, sp = current.special || 0;
    const other = Math.max(0, total - nw - rg - sp);
    return [
      { name: '新規', value: nw, color: QB.cyan },
      { name: 'ツキイチ', value: rg, color: QB.blue },
      { name: '優待', value: sp, color: QB.yellow },
      { name: '一般', value: other, color: QB.blueDark },
    ].filter(d => d.value > 0);
  }, [current]);

  // 達成率トレンド（予算達成率% / 前年比%）
  const rateTrend = useMemo(() => {
    return metrics
      .filter((m: any) => m.storeId === storeId)
      .sort((a: any, b: any) => a.yearMonth.localeCompare(b.yearMonth))
      .slice(-6)
      .map((m: any) => ({
        month: m.yearMonth.slice(5) + '月',
        予算達成率: Number(getBudgetRate(m).toFixed(1)),
        前年比: Number(getLastYearRate(m).toFixed(1)),
      }));
  }, [metrics, storeId]);

  // 品質・スピード指標の月次推移（当店 vs 全社平均）
  const qualityTrend = useMemo(() => {
    const months = Array.from(new Set(metrics.filter((m: any) => m.storeId === storeId).map((m: any) => m.yearMonth)))
      .sort((a: any, b: any) => a.localeCompare(b))
      .slice(-12);
    const companyAvgFor = (ym: string, pick: (m: any) => number | null) => {
      const vals = stores
        .map((s: any) => metrics.find((m: any) => m.storeId === s.id && m.yearMonth === ym))
        .filter(Boolean)
        .map((m: any) => pick(m))
        .filter((v: any): v is number => typeof v === 'number' && !isNaN(v) && v > 0);
      return vals.length ? vals.reduce((a: number, b: number) => a + b, 0) / vals.length : null;
    };
    const round1 = (v: number | null) => (v == null ? null : Number(v.toFixed(1)));
    return months.map((ym: any) => {
      const m = metrics.find((x: any) => x.storeId === storeId && x.yearMonth === ym);
      return {
        month: ym.slice(5) + '月',
        カット: round1(m?.avgCutTimeSec ? m.avgCutTimeSec / 60 : null),
        カット全社: round1(companyAvgFor(ym, (x: any) => (x.avgCutTimeSec ? x.avgCutTimeSec / 60 : null))),
        待ち: round1(m?.avgWaitTimeSec ? m.avgWaitTimeSec / 60 : null),
        待ち全社: round1(companyAvgFor(ym, (x: any) => (x.avgWaitTimeSec ? x.avgWaitTimeSec / 60 : null))),
        シグナル: round1(m?.redYellowSignal != null ? m.redYellowSignal : null),
        シグナル全社: round1(companyAvgFor(ym, (x: any) => (x.redYellowSignal != null ? x.redYellowSignal : null))),
      };
    });
  }, [metrics, stores, storeId]);

  const hasCutTrend = useMemo(() => qualityTrend.filter(d => d.カット != null).length >= 2, [qualityTrend]);
  const hasWaitTrend = useMemo(() => qualityTrend.filter(d => d.待ち != null).length >= 2, [qualityTrend]);
  const hasSignalTrend = useMemo(() => qualityTrend.filter(d => d.シグナル != null).length >= 2, [qualityTrend]);
  const hasQualityTrend = hasCutTrend || hasWaitTrend || hasSignalTrend;

  // 時間帯別 来店分布（ピーク時間帯をハイライト）
  const hourChart = useMemo(() => {
    if (!current) return [];
    const rows = HOUR_FIELDS.map((k, i) => ({ hour: HOUR_LABELS[i] + '時', 来店数: current[k] || 0 }));
    const max = Math.max(...rows.map(r => r.来店数));
    return rows.map(r => ({ ...r, isPeak: r.来店数 === max && max > 0 }));
  }, [current]);
  const hasHourData = useMemo(() => hourChart.some(r => r.来店数 > 0), [hourChart]);

  // 全店 生産性ランキング（自店ハイライト＋順位）
  const storeRank = useMemo(() => {
    const rows = stores
      .map((s: any) => {
        const m = metrics.find((x: any) => x.storeId === s.id && x.yearMonth === selectedMonth);
        return m ? { name: s.name, 生産性: Number(getProductivity(m).toFixed(1)), isMine: s.id === storeId } : null;
      })
      .filter(Boolean) as { name: string; 生産性: number; isMine: boolean }[];
    rows.sort((a, b) => b.生産性 - a.生産性);
    const rank = rows.findIndex(r => r.isMine) + 1;
    return { rows, rank, total: rows.length };
  }, [stores, metrics, selectedMonth, storeId]);

  // 対策提案（ルールベース）
  const insights = useMemo(() => {
    if (!current) return [];
    const list: { tone: 'danger' | 'warning' | 'success'; text: string }[] = [];
    const budgetRate = getBudgetRate(current);
    const lastYearRate = getLastYearRate(current);
    const newRate = getNewRate(current);
    const balance = getDayBalance(current);
    const google = current.googleReviewCurrent || 0;

    if (current.budgetCustomers && budgetRate < 95) {
      list.push({ tone: 'danger', text: `予算達成率が${budgetRate.toFixed(1)}%と目標を下回っています。新規集客（チラシ・SNS）とリピート促進の両面で強化を検討しましょう。` });
    } else if (current.budgetCustomers && budgetRate >= 105) {
      list.push({ tone: 'success', text: `予算達成率${budgetRate.toFixed(1)}%と好調です。このシフト配置・接客の水準を維持しましょう。` });
    }

    if (current.lastYearCustomers && lastYearRate < 100) {
      list.push({ tone: 'warning', text: `前年比${lastYearRate.toFixed(1)}%で前年を下回っています。近隣の競合状況や客離れの要因を確認しましょう。` });
    }

    if (google > 0 && google < 3.5) {
      list.push({ tone: 'danger', text: `Google口コミが${google.toFixed(1)}と低めです。接客・待ち時間・店内清潔感の見直し、口コミ投稿の声かけを強化しましょう。` });
    } else if (google >= 4.3) {
      list.push({ tone: 'success', text: `Google口コミ${google.toFixed(1)}は高評価です。良い接客事例をスタッフ間で共有しましょう。` });
    }

    if (current.totalCustomers && newRate < companyAvgNewRate - 2) {
      list.push({ tone: 'warning', text: `新規率${newRate.toFixed(1)}%が全社平均（${companyAvgNewRate.toFixed(1)}%）より低めです。新規向けの入りやすさ（外観・案内表示）を見直しましょう。` });
    }

    if (balance < 60) {
      list.push({ tone: 'warning', text: `曜日ごとの客数の差が大きく、稼働バランスが乱れています。忙しい曜日にスタッフを厚めに、閑散日は削減するシフト調整を検討しましょう。` });
    }

    // 曜日ピーク/閑散の具体名
    const dayVals = DAY_FIELDS.map((k, i) => ({ label: DAY_LABELS[i], v: current[k] || 0 })).filter(d => d.v > 0);
    if (dayVals.length >= 3) {
      const peak = dayVals.reduce((a, b) => (b.v > a.v ? b : a));
      const low = dayVals.reduce((a, b) => (b.v < a.v ? b : a));
      list.push({ tone: 'success', text: `曜日別では「${peak.label}」が最も忙しく（平均${peak.v.toFixed(0)}人）、「${low.label}」が最も静かです。ピークの${peak.label}に主力スタッフを配置し、${low.label}は研修・清掃・販促準備に充てると効率的です。` });
    }

    // ツキイチ率が低い → リピート施策
    const regularRate = getRegularRate(current);
    if (current.totalCustomers && regularRate > 0 && regularRate < 15) {
      list.push({ tone: 'warning', text: `ツキイチ（月イチ）比率が${regularRate.toFixed(1)}%と低めです。次回来店の目安案内や定期利用の声かけでリピート定着を図りましょう。` });
    }

    // 客層の偏り → ターゲット施策
    const demoTotal = DEMO_FIELDS.reduce((a, f) => a + (current[f.key] || 0), 0);
    if (demoTotal > 0) {
      const top = DEMO_FIELDS.map(f => ({ label: f.label, v: current[f.key] || 0 })).reduce((a, b) => (b.v > a.v ? b : a));
      const share = (top.v / demoTotal) * 100;
      if (share >= 35) {
        list.push({ tone: 'success', text: `客層は「${top.label}」が${share.toFixed(0)}%と中心です。この層に響く時間帯・メニュー・声かけを強化しつつ、手薄な層への入口づくりも検討しましょう。` });
      }
    }

    // 待ち時間が長い → 混雑対策
    if (current.avgWaitTimeSec && current.avgWaitTimeSec >= 15 * 60) {
      list.push({ tone: 'warning', text: `平均待ち時間が${secToMMSS(current.avgWaitTimeSec)}と長めです。ピーク時間帯のスタッフ増員や案内動線の見直しで待ち時間短縮を図りましょう（時間帯別の来店分布を参照）。` });
    }

    // 赤黄シグナルが低い → オペレーション改善
    if (current.redYellowSignal != null && current.redYellowSignal < 70) {
      list.push({ tone: 'danger', text: `赤黄シグナル月平均が${current.redYellowSignal.toFixed(1)}%と低めです。回転・待ち時間管理のオペレーションを点検し、混雑時の声かけ・誘導を強化しましょう。` });
    }

    if (list.length === 0) {
      list.push({ tone: 'success', text: '主要な指標に大きな課題は見られません。現状の運営を継続しつつ、口コミ・新規率の更なる向上を目指しましょう。' });
    }

    const order = { danger: 0, warning: 1, success: 2 };
    return list.sort((a, b) => order[a.tone] - order[b.tone]);
  }, [current, companyAvgNewRate]);

  const toneStyle: Record<string, { bg: string; border: string; icon: React.ReactNode; text: string }> = {
    danger: { bg: 'bg-red-50', border: 'border-red-200', icon: <AlertTriangle size={18} className="text-qb-red shrink-0" />, text: 'text-ink' },
    warning: { bg: 'bg-amber-50', border: 'border-amber-200', icon: <AlertTriangle size={18} className="text-amber-600 shrink-0" />, text: 'text-ink' },
    success: { bg: 'bg-emerald-50', border: 'border-emerald-200', icon: <CheckCircle2 size={18} className="text-success shrink-0" />, text: 'text-ink' },
  };

  const mask = (v: string) => (isMasked ? '**.*' : v);
  const seriesNames = radarData.length ? Object.keys(radarData[0]).filter(k => k !== 'axis') : [];
  const seriesColors: Record<string, string> = { [store?.name || '対象店舗']: QB.blue, エリア平均: QB.cyan, 全社平均: QB.yellow };

  // 品質指標トレンドの共通描画（当店=実線青 / 全社平均=破線シアン / 基準=赤破線）
  const renderQualityLine = (
    title: string,
    icon: React.ReactNode,
    storeKey: 'カット' | '待ち' | 'シグナル',
    coKey: string,
    fmt: (v: number) => string,
    danger?: { y: number; label: string },
  ) => (
    <GlassCard className="p-5">
      <h2 className="text-base font-bold text-ink flex items-center gap-2 mb-4 pb-3 border-b border-line">
        <span className="shrink-0">{icon}</span>{title}
      </h2>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={qualityTrend} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid stroke={QB.grid} vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 12, fontWeight: 700, fill: '#00004B' }} axisLine={{ stroke: QB.grid }} tickLine={false} />
          <YAxis tick={{ fontSize: 12, fill: '#7D7D7D' }} axisLine={false} tickLine={false} width={40} hide={isMasked} domain={['auto', 'auto']} />
          <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12, fontWeight: 700, border: `1px solid ${QB.grid}` }} formatter={(v: any) => (isMasked ? '**.*' : fmt(v))} />
          {danger && !isMasked && (
            <ReferenceLine y={danger.y} stroke={QB.danger} strokeDasharray="5 4" strokeWidth={1.5}
              label={{ value: danger.label, position: 'insideTopRight', fill: QB.danger, fontSize: 11, fontWeight: 700 }} />
          )}
          <Line type="monotone" dataKey={storeKey} name={store?.name || '当店'} stroke={QB.blue} strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
          <Line type="monotone" dataKey={coKey} name="全社平均" stroke={QB.cyan} strokeWidth={2} strokeDasharray="4 4" dot={false} connectNulls />
        </LineChart>
      </ResponsiveContainer>
      <div className="flex items-center justify-center gap-4 mt-2 text-xs font-bold text-ink-soft">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: QB.blue }} />{store?.name || '当店'}</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 rounded-full" style={{ background: QB.cyan }} />全社平均</span>
      </div>
    </GlassCard>
  );

  return (
    <div className="space-y-6">
      {/* コントロールバー：月・エリア・店舗 */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 bg-white/60 p-3 sm:p-4 rounded-2xl shadow-sm border border-white">
        {/* 表示月 */}
        <div className="flex items-center gap-2">
          <span className="font-bold text-ink-soft text-sm shrink-0">表示月:</span>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setMonthLocal(e.target.value)}
            className="tabular flex-1 sm:flex-none min-h-[44px] px-3 rounded-xl border border-line bg-white shadow-sm font-bold text-ink focus:ring-2 focus:ring-qb-cyan focus:border-qb-cyan outline-none"
          />
        </div>

        {/* エリア（BMのみ） */}
        {!isLocked && areas.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="font-bold text-ink-soft text-sm shrink-0">エリア:</span>
            <select
              value={areaFilter}
              onChange={(e) => handleAreaChange(e.target.value)}
              className="min-h-[44px] px-3 rounded-xl border border-line bg-white shadow-sm font-bold text-ink focus:ring-2 focus:ring-qb-cyan focus:border-qb-cyan outline-none"
            >
              <option value="ALL">全エリア</option>
              {areas.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        )}

        {/* 対象店舗 */}
        <div className="flex items-center gap-2">
          <span className="font-bold text-ink-soft text-sm shrink-0">対象店舗:</span>
          {isLocked ? (
            <span className="tabular font-black text-ink text-base">{store?.name || '未設定'}</span>
          ) : (
            <select
              value={storeId}
              onChange={(e) => setSelectedStoreId(e.target.value)}
              className="min-h-[44px] px-3 rounded-xl border border-line bg-white shadow-sm font-bold text-ink focus:ring-2 focus:ring-qb-cyan focus:border-qb-cyan outline-none"
            >
              {visibleStores.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
        </div>
      </div>

      {!current ? (
        <GlassCard className="p-12 text-center">
          <p className="text-sm font-bold text-qb-gray">この店舗・この月のデータがまだありません。実績入力タブから登録してください。</p>
        </GlassCard>
      ) : (
        <>
          {/* Bento KPI */}
          <BentoGrid>
            <StatTile
              label="生産性 (客/人工)"
              value={isMasked ? mask('') : getProductivity(current).toFixed(1)}
              icon={<Users size={18} />}
              delta={<span className="text-xs font-bold text-ink-soft">エリア平均 {isMasked ? mask('') : areaAvgProductivity.toFixed(1)}</span>}
            />
            <StatTile
              label="予算達成率"
              value=""
              icon={<TrendingUp size={18} />}
              indicator={<ProgressRing value={isMasked ? 0 : getBudgetRate(current)} size={64} />}
            />
            <StatTile
              label="前年比"
              value={isMasked ? mask('') : `${getLastYearRate(current).toFixed(1)}%`}
              icon={<TrendingUp size={18} />}
              delta={!isMasked ? <DeltaBadge value={getLastYearRate(current) - 100} suffix="%" /> : undefined}
            />
            <StatTile
              label="Google口コミ"
              value=""
              icon={<Star size={18} />}
              indicator={<RatingStars value={current.googleReviewCurrent || 0} size={16} />}
            />
            <StatTile
              label="新規率"
              value={isMasked ? mask('') : `${getNewRate(current).toFixed(1)}%`}
              icon={<Percent size={18} />}
              delta={<span className="text-xs font-bold text-ink-soft">全社平均 {isMasked ? mask('') : companyAvgNewRate.toFixed(1)}%</span>}
            />
            <StatTile
              label="ツキイチ率"
              value={isMasked ? mask('') : `${getRegularRate(current).toFixed(1)}%`}
              icon={<Percent size={18} />}
            />
            <StatTile
              label="1日あたり客数"
              value={isMasked ? mask('') : getDailyAvg(current).toFixed(1)}
              icon={<Users size={18} />}
            />
            <StatTile
              label="優待率"
              value={isMasked ? mask('') : `${getSpecialRate(current).toFixed(1)}%`}
              icon={<Percent size={18} />}
            />
            {current.redYellowSignal != null && (
              <StatTile
                label="赤黄シグナル月平均"
                value={`${current.redYellowSignal.toFixed(1)}%`}
                icon={<Activity size={18} />}
                delta={<span className="text-xs font-bold text-ink-soft">平日{(current.redYellowWeekday ?? 0).toFixed(0)}% / 土日祝{(current.redYellowHoliday ?? 0).toFixed(0)}%</span>}
              />
            )}
            {current.avgCutTimeSec != null && (
              <StatTile
                label="平均カット時間"
                value={secToMMSS(current.avgCutTimeSec)}
                icon={<Scissors size={18} />}
              />
            )}
            {current.avgWaitTimeSec != null && (
              <StatTile
                label="平均待ち時間"
                value={secToMMSS(current.avgWaitTimeSec)}
                icon={<Clock size={18} />}
              />
            )}
            {current.repeatRatio != null && (
              <StatTile
                label="リピート比率"
                value={`${current.repeatRatio.toFixed(1)}%`}
                icon={<Repeat size={18} />}
              />
            )}
          </BentoGrid>

          {/* 全店 生産性ランキング内の自店位置 */}
          {storeRank.rank > 0 && (
            <GlassCard className="p-5">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-line">
                <h2 className="text-base font-bold text-ink flex items-center gap-2">
                  <BarChart3 className="text-qb-blue" size={20} /> 全店 生産性ランキング
                </h2>
                <span className="text-sm font-black text-qb-blue tabular">
                  {isMasked ? '**' : storeRank.rank}位 <span className="text-ink-soft font-bold">/ {storeRank.total}店</span>
                </span>
              </div>
              <ResponsiveContainer width="100%" height={Math.max(160, storeRank.rows.length * 34)}>
                <BarChart data={storeRank.rows} layout="vertical" margin={{ top: 0, right: 24, left: 8, bottom: 0 }}>
                  <XAxis type="number" hide={isMasked} tick={{ fontSize: 12, fill: '#7D7D7D' }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fontWeight: 700, fill: '#00004B' }} width={64} />
                  <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12, fontWeight: 700, border: `1px solid ${QB.grid}` }} formatter={(v: any) => isMasked ? '**.*' : v} />
                  <Bar dataKey="生産性" radius={[0, 8, 8, 0]}>
                    {storeRank.rows.map((d, i) => <Cell key={i} fill={d.isMine ? QB.blue : QB.grid} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </GlassCard>
          )}

          {/* 対策提案 */}
          <GlassCard className="p-5">
            <h2 className="text-base font-bold text-ink flex items-center gap-2 mb-4 pb-3 border-b border-line">
              <Lightbulb className="text-qb-yellow" size={20} /> 今後の対策提案
            </h2>
            <div className="space-y-2.5">
              {insights.map((it, i) => {
                const s = toneStyle[it.tone];
                return (
                  <div key={i} className={`flex items-start gap-2.5 p-3 rounded-xl border ${s.bg} ${s.border}`}>
                    {s.icon}
                    <p className={`text-sm font-bold leading-relaxed ${s.text}`}>{it.text}</p>
                  </div>
                );
              })}
            </div>
          </GlassCard>

          {/* 時間帯別 来店分布 */}
          {hasHourData && (
            <GlassCard className="p-5">
              <h2 className="text-base font-bold text-ink flex items-center gap-2 mb-4 pb-3 border-b border-line">
                <BarChart3 className="text-qb-cyan" size={20} /> 時間帯別 来店分布（当月・ピーク配置の目安）
              </h2>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={hourChart} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid stroke={QB.grid} vertical={false} />
                  <XAxis dataKey="hour" tick={{ fontSize: 11, fontWeight: 700, fill: '#00004B' }} axisLine={{ stroke: QB.grid }} tickLine={false} interval={0} />
                  <YAxis tick={{ fontSize: 12, fill: '#7D7D7D' }} axisLine={false} tickLine={false} width={40} hide={isMasked} />
                  <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12, fontWeight: 700, border: `1px solid ${QB.grid}` }} formatter={(v: any) => isMasked ? '**.*' : v} />
                  <Bar dataKey="来店数" radius={[6, 6, 0, 0]}>
                    {hourChart.map((d, i) => <Cell key={i} fill={d.isPeak ? QB.blue : QB.cyan} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="flex items-center justify-center gap-4 mt-2 text-xs font-bold text-ink-soft">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: QB.blue }} />最繁忙時間帯</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: QB.cyan }} />来店数</span>
              </div>
            </GlassCard>
          )}

          {/* 品質・スピード指標の推移（当店 vs 全社平均） */}
          {hasQualityTrend && (
            <section>
              <h2 className="text-lg font-bold text-ink mb-4 flex items-center gap-2">
                <Activity className="text-qb-cyan" size={20} /> 品質・スピード指標の推移（当店 vs 全社平均）
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
                {hasCutTrend && renderQualityLine('平均カット時間（分）', <Scissors className="text-qb-blue" size={18} />, 'カット', 'カット全社', v => `${v}分`, { y: 14, label: '基準14分' })}
                {hasWaitTrend && renderQualityLine('平均待ち時間（分）', <Clock className="text-qb-blue" size={18} />, '待ち', '待ち全社', v => `${v}分`, { y: 10, label: '基準10分' })}
                {hasSignalTrend && renderQualityLine('赤黄シグナル比率（%）', <Activity className="text-qb-blue" size={18} />, 'シグナル', 'シグナル全社', v => `${v}%`, { y: 70, label: '基準70%' })}
              </div>
            </section>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* 推移グラフ */}
            <GlassCard className="p-5">
              <h2 className="text-base font-bold text-ink flex items-center gap-2 mb-4 pb-3 border-b border-line">
                <LineIcon className="text-qb-blue" size={20} /> 客数の推移（直近{trend.length}ヶ月）
              </h2>
              {trend.length < 2 ? (
                <p className="text-sm font-bold text-qb-gray py-10 text-center">データ蓄積中です（2ヶ月以上のデータが必要）</p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={trend} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid stroke={QB.grid} vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fontWeight: 700, fill: '#00004B' }} axisLine={{ stroke: QB.grid }} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: '#7D7D7D' }} axisLine={false} tickLine={false} width={40} hide={isMasked} />
                    <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12, fontWeight: 700, border: `1px solid ${QB.grid}` }} />
                    <Line type="monotone" dataKey="総客数" stroke={QB.blue} strokeWidth={2.5} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="予算" stroke={QB.cyan} strokeWidth={2} strokeDasharray="4 4" dot={false} />
                    <Line type="monotone" dataKey="前年" stroke={QB.yellow} strokeWidth={2} strokeDasharray="2 3" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </GlassCard>

            {/* レーダーチャート */}
            <GlassCard className="p-5">
              <h2 className="text-base font-bold text-ink flex items-center gap-2 mb-4 pb-3 border-b border-line">
                <RadarIcon className="text-qb-cyan" size={20} /> 多軸比較（店舗 / エリア / 全社）
              </h2>
              <ResponsiveContainer width="100%" height={260}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke={QB.grid} />
                  <PolarAngleAxis dataKey="axis" tick={{ fontSize: 12, fontWeight: 700, fill: '#00004B' }} />
                  {seriesNames.map((name) => (
                    <Radar key={name} name={name} dataKey={name} stroke={seriesColors[name] || QB.blue} fill={seriesColors[name] || QB.blue} fillOpacity={name === (store?.name || '対象店舗') ? 0.35 : 0.08} strokeWidth={2} />
                  ))}
                  <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12, fontWeight: 700, border: `1px solid ${QB.grid}` }} />
                </RadarChart>
              </ResponsiveContainer>
              <div className="flex items-center justify-center gap-4 mt-2">
                {seriesNames.map(name => (
                  <span key={name} className="flex items-center gap-1.5 text-xs font-bold text-ink-soft">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: seriesColors[name] || QB.blue }} />
                    {name}
                  </span>
                ))}
              </div>
            </GlassCard>

            {/* 客層構成 円グラフ */}
            <GlassCard className="p-5">
              <h2 className="text-base font-bold text-ink flex items-center gap-2 mb-4 pb-3 border-b border-line">
                <PieIcon className="text-qb-blue-dark" size={20} /> 客層構成（当月）
              </h2>
              {demoData.length === 0 ? (
                <p className="text-sm font-bold text-qb-gray py-10 text-center">客層データが未入力です</p>
              ) : (
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <ResponsiveContainer width="100%" height={200} className="sm:!w-1/2">
                    <PieChart>
                      <Pie data={demoData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={1}>
                        {demoData.map((d, i) => <Cell key={i} fill={d.color} stroke="#fff" strokeWidth={1} />)}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12, fontWeight: 700, border: `1px solid ${QB.grid}` }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 w-full space-y-1.5">
                    {demoData.map((d, i) => {
                      const total = demoData.reduce((a, x) => a + x.value, 0);
                      const pct = total ? (d.value / total) * 100 : 0;
                      return (
                        <div key={i} className="flex items-center justify-between text-xs font-bold">
                          <span className="flex items-center gap-1.5 text-ink-soft"><span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />{d.name}</span>
                          <span className="tabular text-ink">{isMasked ? '**.*%' : pct.toFixed(1) + '%'}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </GlassCard>

            {/* エリア別比較 */}
            <GlassCard className="p-5">
              <h2 className="text-base font-bold text-ink flex items-center gap-2 mb-4 pb-3 border-b border-line">
                <BarChart3 className="text-success" size={20} /> エリア別 生産性比較
              </h2>
              {areaCompare.length === 0 ? (
                <p className="text-sm font-bold text-qb-gray py-10 text-center">エリア設定がありません</p>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(160, areaCompare.length * 44)}>
                  <BarChart data={areaCompare} layout="vertical" margin={{ top: 0, right: 24, left: 8, bottom: 0 }}>
                    <XAxis type="number" hide={isMasked} tick={{ fontSize: 12, fill: '#7D7D7D' }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fontWeight: 700, fill: '#00004B' }} width={90} />
                    <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12, fontWeight: 700, border: `1px solid ${QB.grid}` }} formatter={(v: any) => isMasked ? '**.*' : v} />
                    <Bar dataKey="生産性" radius={[0, 8, 8, 0]}>
                      {areaCompare.map((d, i) => <Cell key={i} fill={d.isMine ? QB.blue : QB.grid} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </GlassCard>

            {/* 曜日別平均客数 */}
            <GlassCard className="p-5">
              <h2 className="text-base font-bold text-ink flex items-center gap-2 mb-4 pb-3 border-b border-line">
                <BarChart3 className="text-qb-cyan" size={20} /> 曜日別 平均客数（シフト最適化）
              </h2>
              {dayChart.length === 0 || dayChart.every(d => d.平均客数 === 0) ? (
                <p className="text-sm font-bold text-qb-gray py-10 text-center">曜日別データが未入力です</p>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={dayChart} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                      <CartesianGrid stroke={QB.grid} vertical={false} />
                      <XAxis dataKey="day" tick={{ fontSize: 12, fontWeight: 700, fill: '#00004B' }} axisLine={{ stroke: QB.grid }} tickLine={false} />
                      <YAxis tick={{ fontSize: 12, fill: '#7D7D7D' }} axisLine={false} tickLine={false} width={40} hide={isMasked} />
                      <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12, fontWeight: 700, border: `1px solid ${QB.grid}` }} formatter={(v: any) => isMasked ? '**.*' : v} />
                      <Bar dataKey="平均客数" radius={[8, 8, 0, 0]}>
                        {dayChart.map((d, i) => <Cell key={i} fill={d.isPeak ? QB.blue : d.isLow ? QB.grid : QB.cyan} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="flex items-center justify-center gap-4 mt-2 text-xs font-bold text-ink-soft">
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: QB.blue }} />ピーク</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: QB.cyan }} />通常</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: QB.grid }} />閑散</span>
                  </div>
                </>
              )}
            </GlassCard>

            {/* 客数内訳ドーナツ */}
            <GlassCard className="p-5">
              <h2 className="text-base font-bold text-ink flex items-center gap-2 mb-4 pb-3 border-b border-line">
                <PieIcon className="text-qb-blue" size={20} /> 客数内訳（新規 / ツキイチ / 優待 / 一般）
              </h2>
              {breakdownData.length === 0 ? (
                <p className="text-sm font-bold text-qb-gray py-10 text-center">内訳データが未入力です</p>
              ) : (
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <ResponsiveContainer width="100%" height={200} className="sm:!w-1/2">
                    <PieChart>
                      <Pie data={breakdownData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={1}>
                        {breakdownData.map((d, i) => <Cell key={i} fill={d.color} stroke="#fff" strokeWidth={1} />)}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12, fontWeight: 700, border: `1px solid ${QB.grid}` }} formatter={(v: any) => isMasked ? '**.*' : v} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 w-full space-y-1.5">
                    {breakdownData.map((d, i) => {
                      const total = breakdownData.reduce((a, x) => a + x.value, 0);
                      const pct = total ? (d.value / total) * 100 : 0;
                      return (
                        <div key={i} className="flex items-center justify-between text-xs font-bold">
                          <span className="flex items-center gap-1.5 text-ink-soft"><span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />{d.name}</span>
                          <span className="tabular text-ink">{isMasked ? '**.*%' : pct.toFixed(1) + '%'}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </GlassCard>

            {/* 達成率トレンド */}
            <GlassCard className="p-5">
              <h2 className="text-base font-bold text-ink flex items-center gap-2 mb-4 pb-3 border-b border-line">
                <LineIcon className="text-success" size={20} /> 達成率トレンド（予算 / 前年比）
              </h2>
              {rateTrend.length < 2 ? (
                <p className="text-sm font-bold text-qb-gray py-10 text-center">データ蓄積中です（2ヶ月以上のデータが必要）</p>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={rateTrend} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                      <CartesianGrid stroke={QB.grid} vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 12, fontWeight: 700, fill: '#00004B' }} axisLine={{ stroke: QB.grid }} tickLine={false} />
                      <YAxis tick={{ fontSize: 12, fill: '#7D7D7D' }} axisLine={false} tickLine={false} width={40} hide={isMasked} domain={['auto', 'auto']} />
                      <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12, fontWeight: 700, border: `1px solid ${QB.grid}` }} formatter={(v: any) => isMasked ? '**.*' : `${v}%`} />
                      <Line type="monotone" dataKey="予算達成率" stroke={QB.blue} strokeWidth={2.5} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="前年比" stroke={QB.yellow} strokeWidth={2} strokeDasharray="4 4" dot={{ r: 2 }} />
                    </LineChart>
                  </ResponsiveContainer>
                  <div className="flex items-center justify-center gap-4 mt-2 text-xs font-bold text-ink-soft">
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: QB.blue }} />予算達成率</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: QB.yellow }} />前年比</span>
                  </div>
                </>
              )}
            </GlassCard>

            {/* エリア別 口コミ比較 */}
            <GlassCard className="p-5">
              <h2 className="text-base font-bold text-ink flex items-center gap-2 mb-4 pb-3 border-b border-line">
                <Star className="text-qb-yellow" size={20} /> エリア別 Google口コミ比較
              </h2>
              {areaGoogleCompare.length === 0 ? (
                <p className="text-sm font-bold text-qb-gray py-10 text-center">口コミデータがありません</p>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(160, areaGoogleCompare.length * 44)}>
                  <BarChart data={areaGoogleCompare} layout="vertical" margin={{ top: 0, right: 32, left: 8, bottom: 0 }}>
                    <XAxis type="number" domain={[0, 5]} hide={isMasked} tick={{ fontSize: 12, fill: '#7D7D7D' }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fontWeight: 700, fill: '#00004B' }} width={90} />
                    <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12, fontWeight: 700, border: `1px solid ${QB.grid}` }} formatter={(v: any) => isMasked ? '**.*' : v} />
                    <Bar dataKey="口コミ" radius={[0, 8, 8, 0]}>
                      {areaGoogleCompare.map((d, i) => <Cell key={i} fill={d.isMine ? QB.yellow : QB.grid} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </GlassCard>
          </div>
        </>
      )}
    </div>
  );
};
