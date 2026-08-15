import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { GlassCard } from '../components/ui/GlassCard';
import { useAuthStore } from '../store/useAuthStore';
import { useStoreMetricsStore } from '../store/useStoreMetricsStore';
import { useShiftStore } from '../store/useShiftStore';
import { TrendingUp, Save, Search, ChevronDown, ChevronUp, Lock, Unlock, ShieldAlert, Eye, EyeOff } from 'lucide-react';
import { StoreMetricsRanking } from './StoreMetricsRanking';
import { StoreAnalytics } from './StoreAnalytics';

interface MetricInputProps {
  label: string;
  field: string;
  storeId: string;
  isEditing: boolean;
  currentValue: any;
  step?: string;
  editData: Record<string, any>;
  onEditChange: (storeId: string, field: string, value: string) => void;
  isMasked: boolean;
}

const MetricInput = ({ label, field, storeId, isEditing, currentValue, step = "1", editData, onEditChange, isMasked }: MetricInputProps) => {
  if (!isEditing) {
    return (
      <div className="flex justify-between items-center py-1.5 border-b border-dashed border-line secure-unselectable select-none">
        <span className="text-sm font-bold text-ink-soft">{label}</span>
        {isMasked ? (
          <span className="text-xs font-black tracking-widest text-qb-blue/50 bg-qb-navy/5 px-2 py-0.5 rounded blur-[2.5px] select-none secure-unselectable cursor-not-allowed" title="機密マスク有効">***</span>
        ) : (
          <span className="tabular text-sm font-black text-ink">{currentValue || 0}</span>
        )}
      </div>
    );
  }
  return (
    <div className="flex justify-between items-center gap-2 py-1.5 border-b border-dashed border-line">
      <span className="text-sm font-bold text-ink-soft shrink-0">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        step={step}
        onFocus={(e) => e.target.select()}
        className="tabular w-24 min-h-[44px] text-right text-base font-black text-ink border border-line rounded-lg px-2 bg-white focus:ring-2 focus:ring-qb-cyan focus:border-qb-cyan outline-none"
        value={editData[storeId]?.[field] ?? currentValue ?? ''}
        onChange={(e) => onEditChange(storeId, field, e.target.value)}
      />
    </div>
  );
};

// 秒数 <-> mm:ss 変換
const secToMMSS = (sec: any) => {
  const n = Number(sec);
  if (!n || n <= 0) return '';
  const m = Math.floor(n / 60);
  const s = Math.round(n % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};
const mmssToSec = (str: string) => {
  const t = str.trim();
  if (!t) return 0;
  if (t.includes(':')) {
    const [m, s] = t.split(':');
    return (Number(m) || 0) * 60 + (Number(s) || 0);
  }
  return Number(t) || 0; // 数値のみは秒として扱う
};

// mm:ss 形式の時間入力（秒数で保存）
const TimeInput = ({ label, field, storeId, isEditing, currentValue, editData, onEditChange, isMasked }: MetricInputProps) => {
  const stored = editData[storeId]?.[field];
  const displaySec = stored !== undefined && stored !== '' ? stored : currentValue;
  if (!isEditing) {
    return (
      <div className="flex justify-between items-center py-1.5 border-b border-dashed border-line secure-unselectable select-none">
        <span className="text-sm font-bold text-ink-soft">{label}</span>
        {isMasked ? (
          <span className="text-xs font-black tracking-widest text-qb-blue/50 bg-qb-navy/5 px-2 py-0.5 rounded blur-[2.5px] select-none secure-unselectable cursor-not-allowed" title="機密マスク有効">**:**</span>
        ) : (
          <span className="tabular text-sm font-black text-ink">{secToMMSS(currentValue) || '--:--'}</span>
        )}
      </div>
    );
  }
  return (
    <div className="flex justify-between items-center gap-2 py-1.5 border-b border-dashed border-line">
      <span className="text-sm font-bold text-ink-soft shrink-0">{label}</span>
      <input
        type="text"
        inputMode="numeric"
        placeholder="mm:ss"
        onFocus={(e) => e.target.select()}
        className="tabular w-24 min-h-[44px] text-right text-base font-black text-ink border border-line rounded-lg px-2 bg-white focus:ring-2 focus:ring-qb-cyan focus:border-qb-cyan outline-none"
        defaultValue={secToMMSS(displaySec)}
        onBlur={(e) => onEditChange(storeId, field, String(mmssToSec(e.target.value)))}
      />
    </div>
  );
};

// Diagonal repeat watermark background
const SecurityWatermark = () => {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-[0.02] select-none secure-unselectable z-0">
      <div className="absolute -inset-[50%] flex flex-wrap content-center justify-center gap-16 rotate-12">
        {Array.from({ length: 48 }).map((_, i) => (
          <div key={i} className="text-xs font-black tracking-wider whitespace-nowrap text-slate-800 select-none secure-unselectable">
            CONFIDENTIAL MONITOR
          </div>
        ))}
      </div>
    </div>
  );
};

export const StoreMetrics = () => {
  const { user, viewMode } = useAuthStore();
  const activeRole = user?.role === 'BM' && viewMode ? viewMode : user?.role;
  const isBM = activeRole === 'BM';
  const { stores, initStores } = useShiftStore();
  const { metrics, subscribe, updateMetrics } = useStoreMetricsStore();
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const [rankingMonth, setRankingMonth] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const [editData, setEditData] = useState<Record<string, any>>({});
  const [editingStoreId, setEditingStoreId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'input' | 'ranking' | 'analytics'>('ranking');
  const [isMasked, setIsMasked] = useState(true);
  const [windowFocused, setWindowFocused] = useState(true);

  // Focus leave, right-clicks, screenshot keyboard shortcuts block listeners
  useEffect(() => {
    const isIframe = window.self !== window.top;
    const handleBlur = () => {
      // Only trigger screen-shield if we are in a standalone tab, not inside the AI Studio iframe workspace
      if (!isIframe) {
        setWindowFocused(false);
      }
    };
    const handleFocus = () => setWindowFocused(true);

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent Print (Ctrl+P, Cmd+P)
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        alert('【セキュリティ警告】本システムは印刷およびPDF出力が禁止されています。');
      }
      // Prevent Copy (Ctrl+C, Cmd+C)
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault();
      }
    };

    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('keydown', handleKeyDown);

    const unsubStores = initStores();
    const unsub = subscribe();
    
    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyDown);
      unsubStores();
      unsub();
    };
  }, [initStores, subscribe]);

  const handleEditChange = (storeId: string, field: string, value: string) => {
    setEditData(prev => ({
      ...prev,
      [storeId]: {
        ...(prev[storeId] || {}),
        [field]: value === '' ? '' : Number(value)
      }
    }));
  };

  const handleSave = async (storeId: string) => {
    const data = editData[storeId];
    if (data) {
      await updateMetrics(storeId, selectedMonth, data);
    }
    setEditingStoreId(null);
  };

  const startEditing = (storeId: string) => {
    const existing = metrics.find(m => m.storeId === storeId && m.yearMonth === selectedMonth);
    setEditData(prev => ({
      ...prev,
      [storeId]: existing || {}
    }));
    setEditingStoreId(storeId);
  };

  const filteredStores = stores; // maybe filter by AM assignment later if needed

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-32 px-4 pt-4 secure-unselectable select-none relative">
      <SecurityWatermark />

      {/* 🔒 Screen Protection Cover on Window Blur / Lost Focus */}
      {!windowFocused && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-3xl z-50 flex flex-col items-center justify-center p-6 text-center select-none secure-unselectable">
          <div className="max-w-md p-8 bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl space-y-6">
            <div className="w-16 h-16 bg-red-500/10 border border-red-500/30 text-red-500 rounded-2xl flex items-center justify-center mx-auto animate-pulse">
              <ShieldAlert size={36} />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-black text-white">⚠️ スクリーン保護フィルター作動</h3>
              <p className="text-sm font-bold text-slate-400 leading-relaxed">
                アプリケーションが非アクティブ（バックグラウンド）になりました。<br />
                第三者によるキャプチャ（スクショ）や視線からデータを保護するため、一時的に画面表示を強制遮断しています。
              </p>
            </div>
            <p className="text-xs text-purple-400 font-bold bg-purple-950/40 py-2 border border-purple-900/30 rounded-lg">
              画面を最前面に戻すと復帰します
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b border-line pb-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-black text-ink flex items-center gap-3">
            <span className="grid place-items-center h-11 w-11 shrink-0 rounded-2xl bg-gradient-to-br from-qb-blue to-qb-cyan text-white shadow-md">
              <TrendingUp size={22} />
            </span>
            実績・活動指標管理
          </h1>
          <p className="text-sm font-bold text-ink-soft mt-2">
            店舗の多面的な運営実績・活動指標を集約・比較し、全体の水準向上を支援する管理ボードです。
          </p>
        </div>

        {/* 🔒 Master Decrypt Switcher */}
        <button
          onClick={() => setIsMasked(!isMasked)}
          className={`tap px-4 rounded-xl text-xs font-black tracking-wider flex items-center gap-2 shadow-md transition-all active:scale-95 border select-none secure-unselectable shrink-0 ${
            isMasked
              ? 'bg-gradient-to-r from-qb-navy to-qb-blue-dark hover:from-qb-blue-dark hover:to-qb-blue text-white border-qb-navy'
              : 'bg-white hover:bg-canvas text-ink-soft border-line'
          }`}
        >
          {isMasked ? (
            <>
              <Lock className="text-qb-cyan animate-pulse" size={14} />
              <span>機密マスク: 有効中 (安全)</span>
            </>
          ) : (
            <>
              <Unlock className="text-qb-yellow" size={14} />
              <span>機密マスク: 一時解除中</span>
            </>
          )}
        </button>
      </div>

      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 bg-white/60 p-3 sm:p-4 rounded-2xl shadow-sm border border-white">
        <div className="flex gap-3 items-center">
          <span className="font-bold text-ink-soft text-sm shrink-0">表示月:</span>
          {activeTab === 'input' ? (
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="tabular flex-1 sm:flex-none min-h-[44px] px-3 rounded-xl border border-line bg-white shadow-sm font-bold text-ink focus:ring-2 focus:ring-qb-cyan focus:border-qb-cyan outline-none"
            />
          ) : (
            <input
              type="month"
              value={rankingMonth}
              onChange={(e) => setRankingMonth(e.target.value)}
              className="tabular flex-1 sm:flex-none min-h-[44px] px-3 rounded-xl border border-line bg-white shadow-sm font-bold text-ink focus:ring-2 focus:ring-qb-cyan focus:border-qb-cyan outline-none"
            />
          )}
        </div>
        <div className="grid grid-cols-3 sm:flex gap-1.5 bg-canvas p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('input')}
            className={`tap px-6 rounded-lg font-bold text-sm transition-all ${activeTab === 'input' ? 'bg-white text-qb-blue shadow-sm' : 'text-ink-soft hover:text-ink'}`}
          >
            詳細確認
          </button>
          <button
            onClick={() => setActiveTab('ranking')}
            className={`tap px-6 rounded-lg font-bold text-sm transition-all ${activeTab === 'ranking' ? 'bg-white text-qb-blue shadow-sm' : 'text-ink-soft hover:text-ink'}`}
          >
            ランキング
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`tap px-6 rounded-lg font-bold text-sm transition-all ${activeTab === 'analytics' ? 'bg-white text-qb-blue shadow-sm' : 'text-ink-soft hover:text-ink'}`}
          >
            分析
          </button>
        </div>
      </div>

      {activeTab === 'input' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredStores.map(store => {
            const storeMetric = metrics.find(m => m.storeId === store.id && m.yearMonth === selectedMonth);
            const isEditing = editingStoreId === store.id;

            const totalCust = storeMetric?.totalCustomers || 0;

            const getPercent = (count: number) => {
              if (!totalCust) return '0.0%';
              if (isMasked) return '**.*%';
              return ((count / totalCust) * 100).toFixed(1) + '%';
            };

          return (
            <GlassCard key={store.id} className="p-5 border-none bg-white/40 overflow-hidden relative shadow-md">
              <div className="flex justify-between items-center mb-4 pb-2 border-b-2 border-qb-blue/25">
                <h2 className="text-lg font-black text-ink truncate">{store.name}</h2>
                {isBM && (
                  isEditing ? (
                    <button
                      onClick={() => handleSave(store.id)}
                      className="tap bg-success hover:brightness-95 text-white px-4 rounded-xl text-sm font-black flex items-center gap-2 shadow-md transition-all active:scale-95 shrink-0"
                    >
                      <Save size={16} /> 保存
                    </button>
                  ) : (
                    <button
                      onClick={() => startEditing(store.id)}
                      className="tap bg-white hover:bg-canvas text-ink-soft px-4 rounded-xl border border-line text-sm font-black transition-all shadow-sm active:scale-95 shrink-0"
                    >
                      編集
                    </button>
                  )
                )}
              </div>

              <div className="space-y-4">
                {/* ボリューム指標 */}
                <div className="bg-white/50 p-3 rounded-xl border border-white">
                  <h3 className="text-xs font-black text-qb-blue mb-2 uppercase tracking-wider">顧客ボリューム</h3>
                  <div className="space-y-2 mb-3 bg-white/60 p-2 rounded-lg">
                    <MetricInput editData={editData} onEditChange={handleEditChange} label="総客" field="totalCustomers" storeId={store.id} isEditing={isEditing} currentValue={storeMetric?.totalCustomers} isMasked={isMasked} />
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <MetricInput editData={editData} onEditChange={handleEditChange} label="予客" field="budgetCustomers" storeId={store.id} isEditing={isEditing} currentValue={storeMetric?.budgetCustomers} isMasked={isMasked} />
                        {!isEditing && storeMetric?.budgetCustomers ? (
                           <div className="text-right text-xs font-bold text-blue-600 mt-1">
                             予客達成率: {isMasked ? '**.**%' : ((storeMetric.totalCustomers / storeMetric.budgetCustomers) * 100).toFixed(1) + '%'}
                           </div>
                        ) : null}
                      </div>
                      <div>
                        <MetricInput editData={editData} onEditChange={handleEditChange} label="前客" field="lastYearCustomers" storeId={store.id} isEditing={isEditing} currentValue={storeMetric?.lastYearCustomers} isMasked={isMasked} />
                        {!isEditing && storeMetric?.lastYearCustomers ? (
                           <div className="text-right text-xs font-bold text-emerald-600 mt-1">
                             前客比: {isMasked ? '**.**%' : ((storeMetric.totalCustomers / storeMetric.lastYearCustomers) * 100).toFixed(1) + '%'}
                           </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 border-t border-dashed border-gray-300 pt-2 mt-2">
                        <MetricInput editData={editData} onEditChange={handleEditChange} label="営日" field="businessDays" storeId={store.id} isEditing={isEditing} currentValue={storeMetric?.businessDays} isMasked={isMasked} />
                        <MetricInput editData={editData} onEditChange={handleEditChange} label="総稼(人工)" field="monthlyWorkingStaff" storeId={store.id} isEditing={isEditing} currentValue={storeMetric?.monthlyWorkingStaff} step="0.5" isMasked={isMasked} />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div>
                        <MetricInput editData={editData} onEditChange={handleEditChange} label="新規" field="newCustomers" storeId={store.id} isEditing={isEditing} currentValue={storeMetric?.newCustomers} isMasked={isMasked} />
                        {!isEditing && <div className="text-right text-xs text-qb-gray font-bold mt-0.5">{getPercent(storeMetric?.newCustomers || 0)}</div>}
                    </div>
                    <div>
                        <MetricInput editData={editData} onEditChange={handleEditChange} label="ツキイチ" field="regularMonthly" storeId={store.id} isEditing={isEditing} currentValue={storeMetric?.regularMonthly} isMasked={isMasked} />
                        {!isEditing && <div className="text-right text-xs text-qb-gray font-bold mt-0.5">{getPercent(storeMetric?.regularMonthly || 0)}</div>}
                    </div>
                  </div>
                  <MetricInput editData={editData} onEditChange={handleEditChange} label="優待" field="special" storeId={store.id} isEditing={isEditing} currentValue={storeMetric?.special} isMasked={isMasked} />
                </div>

                {/* 客層・属性区分 */}
                <div className="bg-white/50 p-3 rounded-xl border border-white grid grid-cols-2 gap-x-4 gap-y-1">
                  <h3 className="text-xs font-black text-qb-cyan mb-1 uppercase tracking-wider col-span-2">属性別</h3>
                  
                  <div>
                      <MetricInput editData={editData} onEditChange={handleEditChange} label="レディ" field="demographicLadies" storeId={store.id} isEditing={isEditing} currentValue={storeMetric?.demographicLadies} isMasked={isMasked} />
                      {!isEditing && <div className="text-right text-xs text-qb-gray font-bold mt-0.5">{getPercent(storeMetric?.demographicLadies || 0)}</div>}
                  </div>
                  <div>
                      <MetricInput editData={editData} onEditChange={handleEditChange} label="幼小" field="demographicKids" storeId={store.id} isEditing={isEditing} currentValue={storeMetric?.demographicKids} isMasked={isMasked} />
                      {!isEditing && <div className="text-right text-xs text-qb-gray font-bold mt-0.5">{getPercent(storeMetric?.demographicKids || 0)}</div>}
                  </div>
                  <div>
                      <MetricInput editData={editData} onEditChange={handleEditChange} label="中高" field="demographicTeens" storeId={store.id} isEditing={isEditing} currentValue={storeMetric?.demographicTeens} isMasked={isMasked} />
                      {!isEditing && <div className="text-right text-xs text-qb-gray font-bold mt-0.5">{getPercent(storeMetric?.demographicTeens || 0)}</div>}
                  </div>
                  <div>
                      <MetricInput editData={editData} onEditChange={handleEditChange} label="20代" field="demographic20s" storeId={store.id} isEditing={isEditing} currentValue={storeMetric?.demographic20s} isMasked={isMasked} />
                      {!isEditing && <div className="text-right text-xs text-qb-gray font-bold mt-0.5">{getPercent(storeMetric?.demographic20s || 0)}</div>}
                  </div>
                  <div>
                      <MetricInput editData={editData} onEditChange={handleEditChange} label="30代" field="demographic30s" storeId={store.id} isEditing={isEditing} currentValue={storeMetric?.demographic30s} isMasked={isMasked} />
                      {!isEditing && <div className="text-right text-xs text-qb-gray font-bold mt-0.5">{getPercent(storeMetric?.demographic30s || 0)}</div>}
                  </div>
                  <div>
                      <MetricInput editData={editData} onEditChange={handleEditChange} label="40代" field="demographic40s" storeId={store.id} isEditing={isEditing} currentValue={storeMetric?.demographic40s} isMasked={isMasked} />
                      {!isEditing && <div className="text-right text-xs text-qb-gray font-bold mt-0.5">{getPercent(storeMetric?.demographic40s || 0)}</div>}
                  </div>
                  <div>
                      <MetricInput editData={editData} onEditChange={handleEditChange} label="50代" field="demographic50s" storeId={store.id} isEditing={isEditing} currentValue={storeMetric?.demographic50s} isMasked={isMasked} />
                      {!isEditing && <div className="text-right text-xs text-qb-gray font-bold mt-0.5">{getPercent(storeMetric?.demographic50s || 0)}</div>}
                  </div>
                  <div>
                      <MetricInput editData={editData} onEditChange={handleEditChange} label="60歳以上" field="demographic60sPlus" storeId={store.id} isEditing={isEditing} currentValue={storeMetric?.demographic60sPlus} isMasked={isMasked} />
                      {!isEditing && <div className="text-right text-xs text-qb-gray font-bold mt-0.5">{getPercent(storeMetric?.demographic60sPlus || 0)}</div>}
                  </div>
                </div>

                {/* 曜日別平均客数 */}
                <div className="bg-white/50 p-3 rounded-xl border border-white">
                  <h3 className="text-xs font-black text-qb-blue-dark mb-2 uppercase tracking-wider">曜日別平均客数</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <MetricInput editData={editData} onEditChange={handleEditChange} label="月曜" field="avgMon" storeId={store.id} isEditing={isEditing} currentValue={storeMetric?.avgMon} isMasked={isMasked} />
                    <MetricInput editData={editData} onEditChange={handleEditChange} label="火曜" field="avgTue" storeId={store.id} isEditing={isEditing} currentValue={storeMetric?.avgTue} isMasked={isMasked} />
                    <MetricInput editData={editData} onEditChange={handleEditChange} label="水曜" field="avgWed" storeId={store.id} isEditing={isEditing} currentValue={storeMetric?.avgWed} isMasked={isMasked} />
                    <MetricInput editData={editData} onEditChange={handleEditChange} label="木曜" field="avgThu" storeId={store.id} isEditing={isEditing} currentValue={storeMetric?.avgThu} isMasked={isMasked} />
                    <MetricInput editData={editData} onEditChange={handleEditChange} label="金曜" field="avgFri" storeId={store.id} isEditing={isEditing} currentValue={storeMetric?.avgFri} isMasked={isMasked} />
                    <MetricInput editData={editData} onEditChange={handleEditChange} label="土曜" field="avgSat" storeId={store.id} isEditing={isEditing} currentValue={storeMetric?.avgSat} isMasked={isMasked} />
                    <MetricInput editData={editData} onEditChange={handleEditChange} label="日祝" field="avgSunHoliday" storeId={store.id} isEditing={isEditing} currentValue={storeMetric?.avgSunHoliday} isMasked={isMasked} />
                  </div>
                </div>

                {/* 口コミスコア */}
                <div className="bg-white/50 p-3 rounded-xl border border-white flex gap-4 items-center">
                  <div className="flex-1">
                    <h3 className="text-xs font-black tracking-wider text-success mb-2 uppercase">口コミスコア</h3>
                    <MetricInput editData={editData} onEditChange={handleEditChange} label="今回スコア" field="googleReviewCurrent" storeId={store.id} isEditing={isEditing} currentValue={storeMetric?.googleReviewCurrent} step="0.1" isMasked={isMasked} />
                  </div>
                </div>

                {/* 品質・稼働指標 */}
                <div className="bg-white/50 p-3 rounded-xl border border-white">
                  <h3 className="text-xs font-black text-qb-blue mb-2 uppercase tracking-wider">品質・稼働指標</h3>
                  <div className="grid grid-cols-2 gap-x-4">
                    <MetricInput editData={editData} onEditChange={handleEditChange} label="赤黄シグナル月平均(%)" field="redYellowSignal" storeId={store.id} isEditing={isEditing} currentValue={storeMetric?.redYellowSignal} step="0.1" isMasked={isMasked} />
                    <MetricInput editData={editData} onEditChange={handleEditChange} label="赤黄 平日(%)" field="redYellowWeekday" storeId={store.id} isEditing={isEditing} currentValue={storeMetric?.redYellowWeekday} step="0.1" isMasked={isMasked} />
                    <MetricInput editData={editData} onEditChange={handleEditChange} label="赤黄 土日祝(%)" field="redYellowHoliday" storeId={store.id} isEditing={isEditing} currentValue={storeMetric?.redYellowHoliday} step="0.1" isMasked={isMasked} />
                    <TimeInput editData={editData} onEditChange={handleEditChange} label="平均カット時間" field="avgCutTimeSec" storeId={store.id} isEditing={isEditing} currentValue={storeMetric?.avgCutTimeSec} isMasked={isMasked} />
                    <TimeInput editData={editData} onEditChange={handleEditChange} label="平均待ち時間" field="avgWaitTimeSec" storeId={store.id} isEditing={isEditing} currentValue={storeMetric?.avgWaitTimeSec} isMasked={isMasked} />
                    <MetricInput editData={editData} onEditChange={handleEditChange} label="男性比率(%)" field="maleRatio" storeId={store.id} isEditing={isEditing} currentValue={storeMetric?.maleRatio} step="0.1" isMasked={isMasked} />
                    <MetricInput editData={editData} onEditChange={handleEditChange} label="リピート比率(%)" field="repeatRatio" storeId={store.id} isEditing={isEditing} currentValue={storeMetric?.repeatRatio} step="0.1" isMasked={isMasked} />
                    <MetricInput editData={editData} onEditChange={handleEditChange} label="シニア割/ツキイチ(%)" field="seniorRatio" storeId={store.id} isEditing={isEditing} currentValue={storeMetric?.seniorRatio} step="0.1" isMasked={isMasked} />
                  </div>
                </div>

                {/* 時間帯別 来店数 */}
                <div className="bg-white/50 p-3 rounded-xl border border-white">
                  <h3 className="text-xs font-black text-qb-cyan mb-2 uppercase tracking-wider">時間帯別 来店数</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4">
                    <MetricInput editData={editData} onEditChange={handleEditChange} label="8-9時" field="h8" storeId={store.id} isEditing={isEditing} currentValue={storeMetric?.h8} isMasked={isMasked} />
                    <MetricInput editData={editData} onEditChange={handleEditChange} label="9-10時" field="h9" storeId={store.id} isEditing={isEditing} currentValue={storeMetric?.h9} isMasked={isMasked} />
                    <MetricInput editData={editData} onEditChange={handleEditChange} label="10-11時" field="h10" storeId={store.id} isEditing={isEditing} currentValue={storeMetric?.h10} isMasked={isMasked} />
                    <MetricInput editData={editData} onEditChange={handleEditChange} label="11-12時" field="h11" storeId={store.id} isEditing={isEditing} currentValue={storeMetric?.h11} isMasked={isMasked} />
                    <MetricInput editData={editData} onEditChange={handleEditChange} label="12-13時" field="h12" storeId={store.id} isEditing={isEditing} currentValue={storeMetric?.h12} isMasked={isMasked} />
                    <MetricInput editData={editData} onEditChange={handleEditChange} label="13-14時" field="h13" storeId={store.id} isEditing={isEditing} currentValue={storeMetric?.h13} isMasked={isMasked} />
                    <MetricInput editData={editData} onEditChange={handleEditChange} label="14-15時" field="h14" storeId={store.id} isEditing={isEditing} currentValue={storeMetric?.h14} isMasked={isMasked} />
                    <MetricInput editData={editData} onEditChange={handleEditChange} label="15-16時" field="h15" storeId={store.id} isEditing={isEditing} currentValue={storeMetric?.h15} isMasked={isMasked} />
                    <MetricInput editData={editData} onEditChange={handleEditChange} label="16-17時" field="h16" storeId={store.id} isEditing={isEditing} currentValue={storeMetric?.h16} isMasked={isMasked} />
                    <MetricInput editData={editData} onEditChange={handleEditChange} label="17-18時" field="h17" storeId={store.id} isEditing={isEditing} currentValue={storeMetric?.h17} isMasked={isMasked} />
                    <MetricInput editData={editData} onEditChange={handleEditChange} label="18-19時" field="h18" storeId={store.id} isEditing={isEditing} currentValue={storeMetric?.h18} isMasked={isMasked} />
                    <MetricInput editData={editData} onEditChange={handleEditChange} label="19-20時" field="h19" storeId={store.id} isEditing={isEditing} currentValue={storeMetric?.h19} isMasked={isMasked} />
                    <MetricInput editData={editData} onEditChange={handleEditChange} label="20-21時" field="h20" storeId={store.id} isEditing={isEditing} currentValue={storeMetric?.h20} isMasked={isMasked} />
                    <MetricInput editData={editData} onEditChange={handleEditChange} label="21-22時" field="h21" storeId={store.id} isEditing={isEditing} currentValue={storeMetric?.h21} isMasked={isMasked} />
                    <MetricInput editData={editData} onEditChange={handleEditChange} label="22-23時" field="h22" storeId={store.id} isEditing={isEditing} currentValue={storeMetric?.h22} isMasked={isMasked} />
                  </div>
                </div>

              </div>
            </GlassCard>
          );
        })}
        </div>
      ) : activeTab === 'ranking' ? (
        <StoreMetricsRanking stores={filteredStores} metrics={metrics} selectedMonth={rankingMonth} isMasked={isMasked} />
      ) : (
        <StoreAnalytics stores={filteredStores} metrics={metrics} selectedMonth={rankingMonth} isMasked={isMasked} />
      )}
    </div>
  );
};
