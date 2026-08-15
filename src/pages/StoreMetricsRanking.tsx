import React, { useMemo, useState } from 'react';
import { GlassCard } from '../components/ui/GlassCard';
import { RankBar, RatingStars, DeltaBadge, IconMeter } from '../components/ui/Indicators';
import { Trophy, Users, User, Star, TrendingUp, Lock, Percent, Flame } from 'lucide-react';

interface Props {
  stores: any[];
  metrics: any[];
  selectedMonth: string;
  isMasked?: boolean;
}

const getDayCapacity = (store: any, dayCategory: string) => {
  const hours = store.operatingHoursPerDay || 8;
  let staff = 1;
  const req = store.requiredStaffing;
  if (req) {
    switch (dayCategory) {
      case 'avgMon': staff = req.monday || 1; break;
      case 'avgTue':
      case 'avgWed':
      case 'avgThu': staff = req.weekday || 1; break;
      case 'avgFri': staff = req.friday || 1; break;
      case 'avgSat': staff = req.saturday || 1; break;
      case 'avgSunHoliday': staff = req.sundayHoliday || 1; break;
    }
  }
  return hours * staff;
};

const DEMO_OPTIONS = [
  { value: 'demographicLadies', label: 'レディ' },
  { value: 'demographicKids', label: '幼小' },
  { value: 'demographicTeens', label: '中高' },
  { value: 'demographic20s', label: '20代' },
  { value: 'demographic30s', label: '30代' },
  { value: 'demographic40s', label: '40代' },
  { value: 'demographic50s', label: '50代' },
  { value: 'demographic60sPlus', label: '60歳以上' },
];

const DAY_OPTIONS = [
  { value: 'avgMon', label: '月曜' },
  { value: 'avgTue', label: '火曜' },
  { value: 'avgWed', label: '水曜' },
  { value: 'avgThu', label: '木曜' },
  { value: 'avgFri', label: '金曜' },
  { value: 'avgSat', label: '土曜' },
  { value: 'avgSunHoliday', label: '日祝' },
];

export const StoreMetricsRanking: React.FC<Props> = ({ stores, metrics, selectedMonth, isMasked = true }) => {
  const [demoCategory, setDemoCategory] = useState<string>('demographicLadies');
  const [dayCategory, setDayCategory] = useState<string>('avgSat');
  const [selectedArea, setSelectedArea] = useState<string>('ALL');

  const areas = useMemo(() => Array.from(new Set(stores.map(s => s.assignedAM).filter(Boolean))), [stores]);

  const filteredStores = useMemo(() => {
    if (selectedArea === 'ALL') return stores;
    return stores.filter(s => s.assignedAM === selectedArea);
  }, [stores, selectedArea]);

  // Compute turnover rate ranking
  const turnoverRanking = useMemo(() => {
    return filteredStores.map(store => {
      const metric = metrics.find(m => m.storeId === store.id && m.yearMonth === selectedMonth);
      if (!metric || !metric.monthlyWorkingStaff || !metric.totalCustomers) {
        let reason = '-';
        if (metric && !metric.monthlyWorkingStaff) {
          reason = '未入力(人工数)';
        }
        return { store, rate: 0, text: reason };
      }

      const rate = metric.totalCustomers / metric.monthlyWorkingStaff;
      return { store, rate, text: rate.toFixed(1) + ' 人' };
    }).sort((a, b) => b.rate - a.rate);
  }, [filteredStores, metrics, selectedMonth]);

  const hasMissingStoreConfig = turnoverRanking.some(t => t.text === '未入力(人工数)');

  // Area Aggregation
  const areaAggregation = useMemo(() => {
    if (selectedArea !== 'ALL' || areas.length === 0) return null;

    return areas.map(area => {
      const areaStores = stores.filter(s => s.assignedAM === area);

      let _turnoverRate = 0;
      let _demoRate = 0;
      let _dayRate = 0;
      let _googleRate = 0;

      let totalAreaCustomers = 0;
      let totalAreaStaff = 0;
      let totalDemo = 0;
      let totalDay = 0;
      let totalAreaDayCapacity = 0;
      let totalGoogle = 0;
      let validGoogleStores = 0;

      areaStores.forEach(s => {
        const m = metrics.find(metric => metric.storeId === s.id && metric.yearMonth === selectedMonth);
        if (m) {
          totalAreaCustomers += (m.totalCustomers || 0);
          totalAreaStaff += (m.monthlyWorkingStaff || 0);
          totalDemo += (m[demoCategory] || 0);

          const dayCustomers = m[dayCategory] || 0;
          if (dayCustomers > 0) {
            totalDay += dayCustomers;
            totalAreaDayCapacity += getDayCapacity(s, dayCategory);
          }
          if (m.googleReviewCurrent) {
            totalGoogle += m.googleReviewCurrent;
            validGoogleStores += 1;
          }
        }
      });

      if (totalAreaStaff > 0) {
        _turnoverRate = totalAreaCustomers / totalAreaStaff;
      }
      if (totalAreaCustomers > 0) {
        _demoRate = totalDemo / totalAreaCustomers;
      }
      if (totalAreaDayCapacity > 0) {
        _dayRate = totalDay / totalAreaDayCapacity;
      }
      _googleRate = validGoogleStores > 0 ? totalGoogle / validGoogleStores : 0;

      return {
        area,
        turnoverRate: _turnoverRate,
        demoRate: _demoRate,
        dayRate: _dayRate,
        googleRate: _googleRate
      };
    });
  }, [stores, metrics, selectedMonth, demoCategory, dayCategory, areas, selectedArea]);

  const areaTurnoverRanking = useMemo(() => {
    if (!areaAggregation) return [];
    return [...areaAggregation].sort((a, b) => b.turnoverRate - a.turnoverRate);
  }, [areaAggregation]);

  const areaDemoRanking = useMemo(() => {
    if (!areaAggregation) return [];
    return [...areaAggregation].sort((a, b) => b.demoRate - a.demoRate);
  }, [areaAggregation]);

  const areaDayRanking = useMemo(() => {
    if (!areaAggregation) return [];
    return [...areaAggregation].sort((a, b) => b.dayRate - a.dayRate);
  }, [areaAggregation]);

  const areaGoogleRanking = useMemo(() => {
    if (!areaAggregation) return [];
    return [...areaAggregation].sort((a, b) => b.googleRate - a.googleRate);
  }, [areaAggregation]);

  const demographicRanking = useMemo(() => {
    return filteredStores.map(store => {
      const metric = metrics.find(m => m.storeId === store.id && m.yearMonth === selectedMonth);
      if (!metric || !metric.totalCustomers || !metric[demoCategory]) {
        return { store, rate: 0, text: '-' };
      }
      const rate = metric[demoCategory] / metric.totalCustomers;
      return { store, rate, text: (rate * 100).toFixed(1) + '%' };
    }).sort((a, b) => b.rate - a.rate);
  }, [filteredStores, metrics, selectedMonth, demoCategory]);

  // Day of week Ranking
  const dayRanking = useMemo(() => {
    return filteredStores.map(store => {
      const metric = metrics.find(m => m.storeId === store.id && m.yearMonth === selectedMonth);
      if (!metric || !metric[dayCategory]) {
        return { store, rate: 0, text: '-' };
      }
      const capacity = getDayCapacity(store, dayCategory);
      if (capacity === 0) return { store, rate: 0, text: '-' };

      const rate = metric[dayCategory] / capacity;
      return { store, rate, text: rate.toFixed(1) + ' 客/人時' };
    }).sort((a, b) => b.rate - a.rate);
  }, [filteredStores, metrics, selectedMonth, dayCategory]);

  // Google Review Ranking
  const googleRanking = useMemo(() => {
    return filteredStores.map(store => {
      const metric = metrics.find(m => m.storeId === store.id && m.yearMonth === selectedMonth);
      if (!metric || !metric.googleReviewCurrent) {
        return { store, rate: 0, text: '-' };
      }
      const rate = metric.googleReviewCurrent;
      return { store, rate, text: rate.toFixed(1) };
    }).sort((a, b) => b.rate - a.rate);
  }, [filteredStores, metrics, selectedMonth]);

  // Google Review Growth Ranking
  const googleGrowthRanking = useMemo(() => {
    const [year, month] = selectedMonth.split('-');
    const prevDate = new Date(parseInt(year), parseInt(month) - 2);
    const prevMonthStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

    return filteredStores.map(store => {
      const metric = metrics.find(m => m.storeId === store.id && m.yearMonth === selectedMonth);
      const prevMetric = metrics.find(m => m.storeId === store.id && m.yearMonth === prevMonthStr);

      if (!metric || !metric.googleReviewCurrent || !prevMetric || !prevMetric.googleReviewCurrent) {
        return { store, rate: -999, text: '-' };
      }

      const rate = metric.googleReviewCurrent - prevMetric.googleReviewCurrent;
      const sign = rate > 0 ? '+' : '';
      return { store, rate, text: sign + rate.toFixed(1) };
    }).sort((a, b) => b.rate - a.rate);
  }, [filteredStores, metrics, selectedMonth]);

  /**
   * ランキングカード。variant で右側の表現を切替（bar/stars/delta）。
   * マスク対象は数値もバー長も出さず、ロックバッジのみ表示。
   */
  const renderRankingList = (
    title: string,
    data: any[],
    icon: React.ReactNode,
    controls: React.ReactNode,
    shouldMaskMetric: boolean,
    variant: 'bar' | 'stars' | 'delta' | 'people' | 'busy' = 'bar',
  ) => {
    const valid = data.filter(d => d.text !== '-' && d.text !== '未入力(人工数)' && d.rate !== -999);
    const maxValue = valid.length ? Math.max(...valid.map(d => Math.abs(d.rate))) : 0;

    return (
      <GlassCard className="p-5">
        <div className="flex justify-between items-center gap-2 mb-4 pb-3 border-b border-line">
          <h2 className="text-base font-bold text-ink flex items-center gap-2 min-w-0">
            <span className="shrink-0 text-qb-blue">{icon}</span>
            <span className="truncate">{title}</span>
          </h2>
          {controls}
        </div>
        <div className="space-y-2.5">
          {data.map((item, i) => {
            const isPlaceholder = item.text === '-' || item.text === '未入力(人工数)' || item.rate === -999;
            const masked = isMasked && shouldMaskMetric && !isPlaceholder;
            const rank = i + 1;

            // プレースホルダ（データ無し）
            if (isPlaceholder) {
              return (
                <div key={item.store.id} className="flex items-center gap-3 opacity-60">
                  <span className="tabular flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#EAF0F7] text-sm font-black text-qb-gray">{rank}</span>
                  <span className="w-24 shrink-0 truncate text-sm font-bold text-ink">{item.store.name}</span>
                  <div className="h-3 flex-1 rounded-full bg-[#EAF0F7]" />
                  <span className="w-14 shrink-0 text-right text-xs font-bold text-qb-gray">{item.text === '未入力(人工数)' ? '未入力' : '—'}</span>
                </div>
              );
            }

            // マスク（機密）
            if (masked) {
              return (
                <div key={item.store.id} className="flex items-center gap-3">
                  <span
                    className="tabular flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm font-black text-white"
                    style={rank <= 3 ? { background: ['#E8B923', '#9AA7B5', '#C7864B'][rank - 1] } : { background: '#EAF0F7', color: '#7D7D7D' }}
                  >
                    {rank}
                  </span>
                  <span className="w-24 shrink-0 truncate text-sm font-bold text-ink">{item.store.name}</span>
                  <div className="relative h-3 flex-1 rounded-full bg-[#EAF0F7] overflow-hidden">
                    <div className="h-full w-full bg-[repeating-linear-gradient(45deg,#DADADA,#DADADA_4px,#EAF0F7_4px,#EAF0F7_8px)]" />
                  </div>
                  <span className="inline-flex items-center gap-1 shrink-0 rounded-md bg-qb-navy/5 px-2 py-1 text-xs font-bold text-ink-soft" title="暗号マスク有効">
                    <Lock size={12} /> 保護
                  </span>
                </div>
              );
            }

            // 人型 / 炎ピクトグラム（生産性・繁忙度合い）
            if (variant === 'people' || variant === 'busy') {
              const Icon = variant === 'people' ? User : Flame;
              // 固定スケール：生産性=50が満杯 / 忙しさ=5が満杯。塗り数・濃淡ともに value/max の割合で表現。
              const cfg = variant === 'people'
                ? { count: 8, size: 15, fillFrom: '#93C5FD', fillTo: '#00327D', scaleMax: 50 } // 淡い青→濃紺
                : { count: 5, size: 18, fillFrom: '#FCD34D', fillTo: '#DC2626', scaleMax: 5 };  // 黄→赤（ヒート）
              return (
                <div key={item.store.id} className="flex items-center gap-2.5">
                  <span
                    className="tabular flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm font-black text-white"
                    style={rank <= 3 ? { background: ['#E8B923', '#9AA7B5', '#C7864B'][rank - 1] } : { background: '#EAF0F7', color: '#7D7D7D' }}
                  >
                    {rank}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-bold text-ink">{item.store.name}</span>
                  <IconMeter
                    value={item.rate}
                    maxValue={cfg.scaleMax}
                    minFillRatio={0}
                    Icon={Icon}
                    count={cfg.count}
                    size={cfg.size}
                    fillFrom={cfg.fillFrom}
                    fillTo={cfg.fillTo}
                    displayValue={item.text}
                    className="shrink-0"
                  />
                </div>
              );
            }

            // 星評価（口コミスコア）
            if (variant === 'stars') {
              return (
                <div key={item.store.id} className="flex items-center gap-3">
                  <span
                    className="tabular flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm font-black text-white"
                    style={rank <= 3 ? { background: ['#E8B923', '#9AA7B5', '#C7864B'][rank - 1] } : { background: '#EAF0F7', color: '#7D7D7D' }}
                  >
                    {rank}
                  </span>
                  <span className="w-24 shrink-0 truncate text-sm font-bold text-ink">{item.store.name}</span>
                  <div className="flex-1" />
                  <RatingStars value={item.rate} size={14} />
                </div>
              );
            }

            // 増減（前月比）
            if (variant === 'delta') {
              return (
                <div key={item.store.id} className="flex items-center gap-3">
                  <span
                    className="tabular flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm font-black text-white"
                    style={rank <= 3 ? { background: ['#E8B923', '#9AA7B5', '#C7864B'][rank - 1] } : { background: '#EAF0F7', color: '#7D7D7D' }}
                  >
                    {rank}
                  </span>
                  <span className="w-24 shrink-0 truncate text-sm font-bold text-ink">{item.store.name}</span>
                  <div className="flex-1" />
                  <DeltaBadge value={item.rate} />
                </div>
              );
            }

            // 通常バー
            return (
              <RankBar
                key={item.store.id}
                rank={rank}
                label={item.store.name}
                value={item.rate}
                displayValue={item.text}
                maxValue={maxValue}
              />
            );
          })}
          {data.length === 0 && (
            <p className="text-sm font-bold text-qb-gray py-6 text-center">対象データがありません</p>
          )}
        </div>
      </GlassCard>
    );
  };

  const selectCls = 'text-xs font-bold text-ink bg-white/70 border border-line rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-qb-cyan min-h-[36px]';

  const demoSelect = (
    <select value={demoCategory} onChange={e => setDemoCategory(e.target.value)} className={selectCls}>
      {DEMO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
  const daySelect = (
    <select value={dayCategory} onChange={e => setDayCategory(e.target.value)} className={selectCls}>
      {DAY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );

  return (
    <div className="space-y-6">
      {/* エリア切替タブ */}
      <div className="flex flex-wrap gap-1.5 p-1.5 rounded-2xl glass w-fit max-w-full no-scrollbar overflow-x-auto">
        <button
          onClick={() => setSelectedArea('ALL')}
          className={`tap px-4 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
            selectedArea === 'ALL'
              ? 'bg-gradient-to-r from-qb-blue to-qb-cyan text-white shadow-md'
              : 'text-ink-soft hover:bg-white/60'
          }`}
        >
          全店舗
        </button>
        {areas.map(area => (
          <button
            key={area}
            onClick={() => setSelectedArea(area)}
            className={`tap px-4 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
              selectedArea === area
                ? 'bg-gradient-to-r from-qb-blue to-qb-cyan text-white shadow-md'
                : 'text-ink-soft hover:bg-white/60'
            }`}
          >
            {area}
          </button>
        ))}
      </div>

      {hasMissingStoreConfig && (
        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-xl text-ink flex flex-col gap-1 shadow-sm">
          <p className="text-sm font-bold">⚠️ 一部の店舗で「総稼(人工)」が未入力のため、1人工あたりの客数が計算できません。</p>
          <p className="text-xs font-bold text-ink-soft">※実績入力タブから実績を入力してください。</p>
        </div>
      )}

      {/* エリア別 集計ランキング */}
      {selectedArea === 'ALL' && areaAggregation && areaAggregation.length > 0 && (
        <section>
          <h2 className="text-lg font-bold text-ink mb-4 flex items-center gap-2">
            <Trophy className="text-qb-yellow" size={20} /> エリア別 合計・平均ランキング
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
            {renderRankingList(
              '1人工あたり生産性',
              areaTurnoverRanking.map(a => ({ store: { id: a.area, name: a.area }, rate: a.turnoverRate, text: a.turnoverRate.toFixed(1) + ' 人' })),
              <Users size={18} />, null, true, 'people',
            )}
            {renderRankingList(
              '属性比率 (平均)',
              areaDemoRanking.map(a => ({ store: { id: a.area, name: a.area }, rate: a.demoRate, text: (a.demoRate * 100).toFixed(1) + '%' })),
              <Percent size={18} />, demoSelect, true,
            )}
            {renderRankingList(
              '曜日別 忙しさ (平均)',
              areaDayRanking.map(a => ({ store: { id: a.area, name: a.area }, rate: a.dayRate, text: a.dayRate.toFixed(1) })),
              <Flame size={18} />, daySelect, true, 'busy',
            )}
            {renderRankingList(
              '口コミ (平均)',
              areaGoogleRanking.map(a => ({ store: { id: a.area, name: a.area }, rate: a.googleRate, text: a.googleRate.toFixed(1) })),
              <Star size={18} />, null, false, 'stars',
            )}
          </div>
        </section>
      )}

      {/* 店舗別 ランキング */}
      <section>
        <h2 className="text-lg font-bold text-ink mb-4 flex items-center gap-2">
          <Trophy className="text-qb-yellow" size={20} />
          {selectedArea === 'ALL' ? '全店舗 ランキング' : `${selectedArea} ランキング`}
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
          {renderRankingList('1人工あたり生産性', turnoverRanking, <Users size={18} />, null, true, 'people')}
          {renderRankingList('属性比率 (店舗別)', demographicRanking, <Percent size={18} />, demoSelect, true)}
          {renderRankingList('曜日別 スタッフの忙しさ', dayRanking, <Flame size={18} />, daySelect, true, 'busy')}
          {renderRankingList('口コミスコア', googleRanking, <Star size={18} />, null, false, 'stars')}
          {renderRankingList('口コミ前月比', googleGrowthRanking, <TrendingUp size={18} />, null, false, 'delta')}
        </div>
      </section>
    </div>
  );
};
