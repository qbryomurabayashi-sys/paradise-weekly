/**
 * 視認性インジケーター & Bento プリミティブ
 * QB HOUSE Design System (Design.md §4-5 / design-tokens.yaml components)
 *
 * 依存を増やさず素の SVG / div で実装。色はブランドトークン（qb-*）を使用。
 * しきい値の色分けは Design.md §5 に準拠。
 */
import React from 'react';

/* ---------------------------------------------------------------------------
 * RatingStars — Google口コミ評価など。0.1刻みで部分塗り、数値併記可。
 * ------------------------------------------------------------------------- */
export const RatingStars: React.FC<{
  value: number;
  max?: number;
  size?: number;
  showValue?: boolean;
  className?: string;
}> = ({ value, max = 5, size = 16, showValue = true, className = '' }) => {
  // 0.5刻みに丸め、星ごとに「満(1)/半(0.5)/空(0)」で塗り分ける。
  const rounded = Math.round(value * 2) / 2;
  const baseId = React.useId();
  const gap = 2;
  const width = size * max + (max - 1) * gap;
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <svg width={width} height={size} viewBox={`0 0 ${width} ${size}`} role="img" aria-label={`評価 ${value} / ${max}`}>
        <defs>
          {Array.from({ length: max }).map((_, i) => {
            const level = Math.max(0, Math.min(1, rounded - i)); // その星の塗り割合 0 / 0.5 / 1
            return (
              <linearGradient key={i} id={`${baseId}-${i}`}>
                <stop offset={`${level * 100}%`} stopColor="#FAF028" />
                <stop offset={`${level * 100}%`} stopColor="#FFFFFF" />
              </linearGradient>
            );
          })}
        </defs>
        {Array.from({ length: max }).map((_, i) => {
          const x = i * (size + gap) + size / 2;
          const y = size / 2;
          const r = size / 2;
          const pts = star(x, y, r * 0.94, r * 0.42);
          return (
            <polygon
              key={i}
              points={pts}
              fill={`url(#${baseId}-${i})`}
              stroke="#E8B923"
              strokeWidth={0.9}
              strokeLinejoin="round"
            />
          );
        })}
      </svg>
      {showValue && <span className="tabular text-sm font-bold text-ink">{value.toFixed(1)}</span>}
    </span>
  );
};

function star(cx: number, cy: number, outer: number, inner: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(' ');
}

/* ---------------------------------------------------------------------------
 * ProgressRing — 達成率。≥100 success / 80-99 accent / <80 warning。
 * ------------------------------------------------------------------------- */
export const ProgressRing: React.FC<{
  value: number;            // 0-100+（%）
  size?: number;
  stroke?: number;
  label?: string;
  className?: string;
}> = ({ value, size = 72, stroke = 8, label, className = '' }) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, value));
  const dash = (clamped / 100) * c;
  const color = value >= 100 ? '#17B26A' : value >= 80 ? '#00A5EB' : value >= 60 ? '#FAF028' : '#E60000';
  return (
    <div className={`relative inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E4EBF2" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          style={{ transition: 'stroke-dasharray 0.5s cubic-bezier(0.16,1,0.3,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="tabular font-black text-ink" style={{ fontSize: size * 0.26 }}>{Math.round(value)}</span>
        <span className="text-ink-soft font-bold" style={{ fontSize: size * 0.13 }}>%</span>
      </div>
      {label && <span className="sr-only">{label}</span>}
    </div>
  );
};

/* ---------------------------------------------------------------------------
 * MetricBar — 前年比/比率など。基準(100%)を点線、＋success/−danger。
 * ------------------------------------------------------------------------- */
export const MetricBar: React.FC<{
  value: number;            // %。100 = 基準
  max?: number;             // バーの最大想定%（既定150）
  showBaseline?: boolean;
  className?: string;
}> = ({ value, max = 150, showBaseline = true, className = '' }) => {
  const w = Math.max(2, Math.min(100, (value / max) * 100));
  const color = value >= 100 ? '#17B26A' : value >= 90 ? '#00A5EB' : value >= 75 ? '#FAF028' : '#E60000';
  const basePos = (100 / max) * 100;
  return (
    <div className={`relative h-2.5 w-full rounded-full bg-[#EAF0F7] overflow-hidden ${className}`}>
      <div className="h-full rounded-full" style={{ width: `${w}%`, background: color, transition: 'width 0.5s cubic-bezier(0.16,1,0.3,1)' }} />
      {showBaseline && (
        <div className="absolute top-0 bottom-0 border-l-2 border-dashed border-qb-gray/50" style={{ left: `${basePos}%` }} />
      )}
    </div>
  );
};

/* ---------------------------------------------------------------------------
 * DeltaBadge — 増減。▲+success / ▼−danger。色＋記号で方向明示。
 * ------------------------------------------------------------------------- */
export const DeltaBadge: React.FC<{
  value: number;
  suffix?: string;
  className?: string;
}> = ({ value, suffix = '', className = '' }) => {
  const positive = value >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-bold tabular ${
        positive ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-qb-red'
      } ${className}`}
    >
      {positive ? '▲' : '▼'}{positive ? '+' : ''}{value.toFixed(1)}{suffix}
    </span>
  );
};

/* ---------------------------------------------------------------------------
 * RankBar — ランキング行。相対長バー＋順位（1-3位は金/銀/銅）。
 * ------------------------------------------------------------------------- */
const RANK_COLOR = ['#E8B923', '#9AA7B5', '#C7864B'];
export const RankBar: React.FC<{
  rank: number;             // 1始まり
  label: string;
  value: number;
  displayValue?: string;
  maxValue: number;         // 1位の値（相対長算出用）
  className?: string;
}> = ({ rank, label, value, displayValue, maxValue, className = '' }) => {
  const w = maxValue > 0 ? Math.max(4, (value / maxValue) * 100) : 4;
  const medal = rank <= 3 ? RANK_COLOR[rank - 1] : null;
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <span
        className="tabular flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm font-black"
        style={medal ? { background: medal, color: '#fff' } : { background: '#EAF0F7', color: '#7D7D7D' }}
      >
        {rank}
      </span>
      <span className="w-24 shrink-0 truncate text-sm font-bold text-ink">{label}</span>
      <div className="relative h-3 flex-1 rounded-full bg-[#EAF0F7] overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${w}%`, background: rank === 1 ? '#005AAF' : '#0082CD', transition: 'width 0.5s cubic-bezier(0.16,1,0.3,1)' }}
        />
      </div>
      <span className="tabular w-14 shrink-0 text-right text-sm font-black text-ink">{displayValue ?? value}</span>
    </div>
  );
};

/* ---------------------------------------------------------------------------
 * StatTile — Bento の基本タイル。label / value(Display) / delta / indicator。
 * ------------------------------------------------------------------------- */
export const StatTile: React.FC<{
  label: string;
  value: React.ReactNode;
  unit?: string;
  delta?: React.ReactNode;
  indicator?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: 'default' | 'primary' | 'accent' | 'success' | 'warning' | 'danger';
  span?: boolean;           // hero: 2列ぶち抜き
  className?: string;
}> = ({ label, value, unit, delta, indicator, icon, tone = 'default', span = false, className = '' }) => {
  const toneRing: Record<string, string> = {
    default: 'border-white/60',
    primary: 'border-qb-blue/30',
    accent: 'border-qb-cyan/40',
    success: 'border-emerald-300/50',
    warning: 'border-yellow-300/60',
    danger: 'border-red-300/60',
  };
  return (
    <div
      className={`glass rounded-2xl p-4 flex flex-col gap-2 border ${toneRing[tone]} ${span ? 'col-span-2' : ''} ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-wide text-ink-soft">{label}</span>
        {icon && <span className="text-qb-blue shrink-0">{icon}</span>}
      </div>
      <div className="flex items-end gap-1.5">
        <span className="tabular text-3xl font-black leading-none text-ink">{value}</span>
        {unit && <span className="mb-0.5 text-sm font-bold text-ink-soft">{unit}</span>}
        {delta && <span className="mb-0.5 ml-auto">{delta}</span>}
      </div>
      {indicator && <div className="mt-1">{indicator}</div>}
    </div>
  );
};

/* ---------------------------------------------------------------------------
 * BentoGrid — レスポンシブ・グリッドの薄いラッパ。
 * ------------------------------------------------------------------------- */
export const BentoGrid: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`bento-grid ${className}`}>{children}</div>
);

/* ---------------------------------------------------------------------------
 * IconMeter — アイコン（人型/炎など）を並べて量を絵で示すピクトグラム。
 *   filled 個を塗り、色は fillFrom→fillTo のグラデーションで強度を表現。
 *   1位(maxValue)基準の相対量。塗りが多いほど濃い（強い）色まで伸びる。
 * ------------------------------------------------------------------------- */
const hexToRgb = (h: string): [number, number, number] => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];
const lerpColor = (from: string, to: string, t: number): string => {
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * Math.max(0, Math.min(1, t))));
  return `#${c.map(v => v.toString(16).padStart(2, '0')).join('')}`;
};

export const IconMeter: React.FC<{
  value: number;
  maxValue: number;                 // 上位（1位）の値
  minValue?: number;                // 下位（最下位）の値。指定時は min–max で正規化し差を強調
  minFillRatio?: number;            // 最下位でも残す塗り割合（視認性確保）
  Icon: React.ComponentType<{ size?: number | string; strokeWidth?: number | string; fill?: string; className?: string }>;
  count?: number;                   // アイコン総数
  size?: number;
  fillFrom?: string;                // 弱い側の色
  fillTo?: string;                  // 強い側の色
  emptyColor?: string;
  displayValue?: string;
  className?: string;
}> = ({ value, maxValue, minValue, minFillRatio = 0.18, Icon, count = 10, size = 15, fillFrom = '#93C5FD', fillTo = '#00327D', emptyColor = '#E1E8F0', displayValue, className = '' }) => {
  // min–max 正規化で近接値の差を引き伸ばす（比較しやすさ優先）。min 未指定時は 0 基準。
  const lo = minValue ?? 0;
  const range = maxValue - lo;
  const norm = range > 0 ? Math.max(0, Math.min(1, (value - lo) / range)) : (maxValue > 0 ? Math.min(1, value / maxValue) : 0);
  const effNorm = value <= 0 ? 0 : (minFillRatio > 0 ? minFillRatio + (1 - minFillRatio) * norm : norm);
  const exact = effNorm * count;          // 実数の塗り量
  const full = Math.floor(exact);         // 整数分＝フル点灯
  const frac = exact - full;              // 小数点以下＝端数
  return (
    <span className={`inline-flex items-center gap-1.5 min-w-0 ${className}`}>
      <span className="flex shrink-0 items-center gap-px">
        {Array.from({ length: count }).map((_, i) => {
          // 位置ごとに左(淡)→右(濃)のグラデ。到達位置が右ほど強度が高い。
          const base = lerpColor(fillFrom, fillTo, count > 1 ? i / (count - 1) : 1);
          let color: string;
          if (i < full) {
            color = base;                                   // 整数分：フル
          } else if (i === full && frac >= 0.08) {
            color = lerpColor(emptyColor, base, frac);      // 小数点以下：端数ぶんだけ濃淡で
          } else {
            color = emptyColor;                             // 空
          }
          return <Icon key={i} size={size} strokeWidth={0} fill={color} className="shrink-0" />;
        })}
      </span>
      {displayValue && (
        <span className="tabular shrink-0 text-right text-sm font-black text-ink" style={{ minWidth: '3.25rem' }}>
          {displayValue}
        </span>
      )}
    </span>
  );
};
