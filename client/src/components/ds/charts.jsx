// Biểu đồ và điều khiển dùng chung (Tailwind): cột, đường, thang BMI, hàng chip.
import { useEffect, useRef, useState } from 'react';
import { colors } from '../../theme/tokens.js';
import { cx, fmt } from './index.jsx';

function SrTable({ caption, rows, unit }) {
  return (
    <div className="sr-only">
    <table>
      <caption>{caption}</caption>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key}>
            <th scope="row">{r.label}</th>
            <td>{r.value == null ? 'Chưa có dữ liệu' : `${fmt(r.value, 1)} ${unit}`}</td>
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  );
}

// Biểu đồ cột (trục từ 0). data: [{ key, label, value }]; goal: đường mục tiêu (nét đứt)
export function BarChart({ data, goal, unit = '', caption, activeKey, height = 144, fill = 'bg-dinner-track', fillActive = 'bg-water-icon' }) {
  const [hover, setHover] = useState(null);
  const max = Math.max(goal ?? 0, ...data.map((d) => d.value ?? 0)) * 1.15 || 1;
  const goalY = goal ? (goal / max) * height : null;
  return (
    <div>
      <div className="relative" style={{ height: height + 24 }} aria-hidden="true">
        {goalY != null && (
          <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-divider" style={{ bottom: 24 + goalY }}>
            <span className="absolute -top-4 right-0 font-secondary text-2xs text-muted">Mục tiêu {fmt(goal)}</span>
          </div>
        )}
        <div className="absolute inset-x-0 top-0 grid h-full items-end gap-2" style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}>
          {data.map((d) => {
            const active = d.key === activeKey || d.key === hover;
            const h = d.value ? Math.max(4, (d.value / max) * height) : 4;
            return (
              <div
                key={d.key}
                className="relative flex h-full flex-col items-center justify-end gap-2"
                onMouseEnter={() => setHover(d.key)}
                onMouseLeave={() => setHover(null)}
              >
                {hover === d.key && (
                  <span className="absolute z-10 whitespace-nowrap rounded-sm bg-brand-core px-2 py-1 font-secondary text-xs text-white" style={{ bottom: h + 32 }}>
                    {d.value == null ? 'Chưa có dữ liệu' : `${fmt(d.value, 1)} ${unit}`}
                  </span>
                )}
                <span
                  className={cx('w-full max-w-[32px] rounded-t-sm transition-[height,background-color] duration-300', d.value ? (active ? fillActive : fill) : 'bg-surface')}
                  style={{ height: h }}
                />
                <span className={cx('h-4 font-secondary text-2xs', active ? 'font-bold text-primary' : 'text-muted')}>{d.label}</span>
              </div>
            );
          })}
        </div>
      </div>
      <SrTable caption={caption} rows={data} unit={unit} />
    </div>
  );
}

// Biểu đồ đường (trục co giãn theo dữ liệu — phù hợp cân nặng). data: [{ key, label, value }]
export function LineChart({ data, unit = '', caption, height = 144, color = colors.water.icon }) {
  const [hover, setHover] = useState(null);
  const W = 320;
  const pad = { l: 40, r: 8, t: 24, b: 24 };
  const vals = data.map((d) => d.value);
  const lo = Math.floor(Math.min(...vals) - 1);
  const hi = Math.ceil(Math.max(...vals) + 1);
  const x = (i) => (data.length === 1 ? W / 2 : pad.l + (i * (W - pad.l - pad.r)) / (data.length - 1));
  const y = (v) => pad.t + (1 - (v - lo) / (hi - lo)) * (height - pad.t - pad.b);
  const path = data.map((d, i) => `${i ? 'L' : 'M'}${x(i)} ${y(d.value)}`).join(' ');
  const last = data.length - 1;
  const show = hover ?? last;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${height}`} className="w-full overflow-visible" role="img" aria-label={caption}>
        {[lo, (lo + hi) / 2, hi].map((g) => (
          <g key={g}>
            <line x1={pad.l - 4} x2={W} y1={y(g)} y2={y(g)} stroke={colors.border} strokeDasharray="4 4" />
            <text x={0} y={y(g) + 3} className="fill-muted font-secondary" fontSize="10">{fmt(g, 1)}</text>
          </g>
        ))}
        {data.length > 1 && <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
        {data.map((d, i) => (
          <g key={d.key} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <circle cx={x(i)} cy={y(d.value)} r="14" fill="transparent" />
            <circle cx={x(i)} cy={y(d.value)} r={i === show ? 6 : 4} fill={i === show ? color : '#fff'} stroke={color} strokeWidth="2" />
          </g>
        ))}
        <text x={Math.min(W - 40, Math.max(40, x(show)))} y={y(data[show].value) - 12} textAnchor="middle" className="fill-primary font-secondary" fontSize="11" fontWeight="700">
          {fmt(data[show].value, 1)} {unit}
        </text>
        <text x={x(0)} y={height - 4} textAnchor={data.length === 1 ? 'middle' : 'start'} className="fill-muted font-secondary" fontSize="10">{data[0].label}</text>
        {data.length > 1 && <text x={x(last)} y={height - 4} textAnchor="end" className="fill-muted font-secondary" fontSize="10">{data[last].label}</text>}
      </svg>
      <SrTable caption={caption} rows={data} unit={unit} />
    </div>
  );
}

// Thang BMI (ngưỡng châu Á) + vạch vị trí
const BMI_MIN = 15;
const BMI_MAX = 35;
const BMI_BANDS = [
  { to: 18.5, color: colors.water.icon },
  { to: 23, color: colors.brand.main },
  { to: 25, color: colors.snacks.card },
  { to: 30, color: colors.warm.main },
  { to: 35, color: colors.warm.dark },
];
const pct = (v) => ((Math.min(BMI_MAX, Math.max(BMI_MIN, v)) - BMI_MIN) / (BMI_MAX - BMI_MIN)) * 100;

export function BmiScale({ bmi }) {
  let from = BMI_MIN;
  const band = BMI_BANDS.find((b) => bmi < b.to) ?? BMI_BANDS.at(-1);
  return (
    <div className="flex flex-col gap-2" aria-hidden="true">
      <div className="relative py-2">
        <div className="flex h-2 gap-0.5 overflow-hidden rounded-full">
          {BMI_BANDS.map((b) => {
            const w = b.to - from;
            from = b.to;
            return <span key={b.to} className="h-full" style={{ flex: w, background: b.color }} />;
          })}
        </div>
        <span
          className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 bg-white shadow-card"
          style={{ left: `${pct(bmi)}%`, borderColor: band.color }}
        />
      </div>
      <div className="relative h-4 font-secondary text-2xs text-muted">
        {[BMI_MIN, ...BMI_BANDS.map((b) => b.to)].map((v) => (
          <span key={v} className="absolute -translate-x-1/2 first:translate-x-0 last:-translate-x-full" style={{ left: `${pct(v)}%` }}>
            {String(v).replace('.', ',')}
          </span>
        ))}
      </div>
    </div>
  );
}

// Hàng chip chọn mục (cuộn ngang)
export function ChipTabs({ items, value, onChange, label }) {
  const ref = useRef(null);
  // Đưa chip đang chọn vào giữa vùng nhìn thấy (vd mức calo mặc định nằm ở cuối hàng)
  useEffect(() => {
    const el = ref.current?.querySelector('[aria-selected="true"]');
    const box = ref.current;
    if (el && box) box.scrollTo({ left: el.offsetLeft - (box.clientWidth - el.offsetWidth) / 2, behavior: 'smooth' });
  }, [value]);
  return (
    <div ref={ref} role="tablist" aria-label={label} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          role="tab"
          aria-selected={value === it.id}
          onClick={() => onChange(it.id)}
          className={cx(
            'h-10 shrink-0 rounded-full px-4 text-sm transition-colors duration-150',
            value === it.id ? 'bg-white font-bold text-primary shadow-pill' : 'bg-white/60 font-medium text-muted hover:bg-white',
          )}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}
