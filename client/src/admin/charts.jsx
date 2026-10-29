import { useMemo, useRef, useState } from 'react';

// Biểu đồ nhỏ cho trang quản trị (không dùng thư viện): 1 chuỗi số / biểu đồ → không cần chú giải, tiêu đề nói rõ đang vẽ gì.
// Quy ước: cột ≤ 24px bo 4px ở đầu, đường 2px, lưới mảnh 1px, chữ dùng màu chữ (không dùng màu dữ liệu), luôn có bảng ẩn cho trình đọc màn hình.
export const SERIES = { brand: '#567324', water: '#2679a8', critical: '#b94719' };
const GRID = '#e3e9e5';

const compact = (n) => (Math.abs(n) >= 1e6 ? `${+(n / 1e6).toFixed(1)}tr` : Math.abs(n) >= 1000 ? `${+(n / 1000).toFixed(1)}K` : `${+n.toFixed(1)}`.replace('.', ','));
// Trục y tròn số: 0 · nửa · đỉnh (1 / 2 / 2,5 / 5 × 10^k)
function niceMax(v) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const f = v / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
}

function SrTable({ caption, rows, format }) {
  // Bọc trong div sr-only (bảng tự nó không co được 1px → làm trang dài thừa)
  return (
    <div className="sr-only">
    <table>
      <caption>{caption}</caption>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key}>
            <th scope="row">{r.label}</th>
            <td>{format(r.value)}</td>
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  );
}

function Tip({ x, children, width }) {
  // Giữ tooltip trong khung biểu đồ
  const left = Math.min(Math.max(x, 70), width - 70);
  return (
    <div className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg bg-[#14211b] px-2 py-1 text-xs text-white shadow" style={{ left }}>
      {children}
    </div>
  );
}

// Cột theo thời gian. data: [{ key, label, value, sub? }]
export function ColumnChart({ data, format = compact, caption, color = SERIES.brand, height = 180, tipFormat }) {
  const [hover, setHover] = useState(null);
  const box = useRef(null);
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)));
  const every = Math.ceil(data.length / 8); // nhãn trục x thưa ra để không chồng chữ
  const h = height - 24;
  const hovered = hover != null ? data[hover] : null;
  const width = box.current?.clientWidth ?? 600;
  return (
    <figure className="m-0">
      <div ref={box} className="relative pl-10" style={{ height }} aria-hidden="true" onMouseLeave={() => setHover(null)}>
        {[1, 0.5, 0].map((t) => (
          <div key={t} className="absolute left-10 right-0 border-t" style={{ top: 16 + (1 - t) * (h - 16), borderColor: GRID }}>
            <span className="absolute -left-10 -top-2 w-8 text-right font-secondary text-[11px] text-muted">{format(max * t)}</span>
          </div>
        ))}
        <div className="absolute bottom-6 left-10 right-0 flex items-end" style={{ top: 16 }}>
          {data.map((d, i) => (
            <div key={d.key} className="flex h-full flex-1 items-end justify-center" onMouseEnter={() => setHover(i)}>
              <div className="w-[60%] max-w-6 rounded-t" style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value ? 2 : 0, background: color, opacity: hover == null || hover === i ? 1 : 0.55 }} />
            </div>
          ))}
        </div>
        <div className="absolute bottom-0 left-10 right-0 h-4">
          {data.map((d, i) =>
            i % every === 0 ? (
              <span key={d.key} className="absolute -translate-x-1/2 whitespace-nowrap font-secondary text-[11px] text-muted" style={{ left: `${((i + 0.5) / data.length) * 100}%` }}>
                {d.label}
              </span>
            ) : null,
          )}
        </div>
        {hovered && (
          <Tip x={40 + ((hover + 0.5) / data.length) * (width - 40)} width={width}>
            <b>{hovered.label}</b> · {(tipFormat ?? format)(hovered.value)}
            {hovered.sub ? ` · ${hovered.sub}` : ''}
          </Tip>
        )}
      </div>
      <SrTable caption={caption} rows={data} format={tipFormat ?? format} />
    </figure>
  );
}

// Đường theo thời gian (crosshair + tooltip). data: [{ key, label, value }]
export function LineChart({ data, format = compact, caption, color = SERIES.water, height = 180, tipFormat }) {
  const [hover, setHover] = useState(null);
  const box = useRef(null);
  const W = 600;
  const H = height - 24;
  const PAD = 16;
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)));
  const xs = (i) => (data.length <= 1 ? W / 2 : (i / (data.length - 1)) * W);
  const ys = (v) => PAD + (1 - v / max) * (H - PAD);
  const path = useMemo(() => data.map((d, i) => `${i ? 'L' : 'M'}${xs(i).toFixed(1)},${ys(d.value).toFixed(1)}`).join(''), [data, max]); // eslint-disable-line react-hooks/exhaustive-deps
  const every = Math.ceil(data.length / 6);
  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - r.left) / r.width) * (data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  };
  const last = data.length - 1;
  const width = box.current?.clientWidth ?? 600;
  return (
    <figure className="m-0">
      <div ref={box} className="relative pl-10" style={{ height }} aria-hidden="true">
        {[1, 0.5, 0].map((t) => (
          <div key={t} className="absolute left-10 right-0 border-t" style={{ top: PAD + (1 - t) * (H - PAD), borderColor: GRID }}>
            <span className="absolute -left-10 -top-2 w-8 text-right font-secondary text-[11px] text-muted">{format(max * t)}</span>
          </div>
        ))}
        {data.length > 0 && (
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute left-10 right-0 top-0 h-[calc(100%-24px)] w-[calc(100%-40px)] overflow-visible" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
            {data.length > 1 && <path d={`${path}L${xs(last)},${H}L0,${H}Z`} fill={color} opacity="0.1" />}
            <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            {hover != null && <line x1={xs(hover)} x2={xs(hover)} y1={PAD} y2={H} stroke="#5e6d65" strokeWidth="1" vectorEffect="non-scaling-stroke" />}
            <rect x="0" y="0" width={W} height={H} fill="transparent" />
          </svg>
        )}
        {/* Điểm cuối / điểm đang rê: chấm ≥ 8px có viền trắng 2px (vẽ bằng HTML để không bị kéo méo) */}
        {data.length > 0 && [hover ?? last].map((i) => (
          <span key={i} className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white" style={{ background: color, left: `calc(40px + ${(xs(i) / W) * 100}% - ${(xs(i) / W) * 40}px)`, top: `${(ys(data[i].value) / H) * (height - 24)}px` }} />
        ))}
        <div className="absolute bottom-0 left-10 right-0 h-4">
          {data.map((d, i) =>
            (i % every === 0 && last - i >= every / 2) || i === last ? (
              <span key={d.key} className={`absolute whitespace-nowrap font-secondary text-[11px] text-muted ${i === 0 ? '' : i === last ? '-translate-x-full' : '-translate-x-1/2'}`} style={{ left: `${(xs(i) / W) * 100}%` }}>
                {d.label}
              </span>
            ) : null,
          )}
        </div>
        {hover != null && (
          <Tip x={40 + (xs(hover) / W) * (width - 40)} width={width}>
            <b>{data[hover].label}</b> · {(tipFormat ?? format)(data[hover].value)}
          </Tip>
        )}
      </div>
      <SrTable caption={caption} rows={data} format={tipFormat ?? format} />
    </figure>
  );
}

// Thanh ngang có giá trị ở đầu thanh (phễu, nền tảng). items: [{ key, label, value, note? }]
export function HBars({ items, format = (v) => v.toLocaleString('vi-VN'), color = SERIES.brand, max }) {
  const top = max ?? Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="flex flex-col gap-3">
      {items.map((it) => (
        <li key={it.key} className="grid grid-cols-[minmax(96px,30%)_1fr] items-center gap-3">
          <span className="truncate text-sm text-secondary" title={it.label}>{it.label}</span>
          <span className="flex min-w-0 items-center gap-2">
            <span className="h-4 shrink-0 rounded-r" style={{ width: `${Math.max(it.value ? 1 : 0, (it.value / top) * 75)}%`, background: color }} aria-hidden="true" />
            <span className="whitespace-nowrap font-secondary text-sm font-semibold tabular-nums text-primary">{format(it.value)}</span>
            {it.note && <span className="truncate font-secondary text-xs text-muted">{it.note}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

// Ô số liệu: nhãn · giá trị · ghi chú (so sánh / giải thích)
export function StatTile({ label, value, sub, tone }) {
  return (
    <div className="a-card flex flex-col gap-1">
      <span className="text-sm text-muted">{label}</span>
      <span className={`font-secondary text-2xl font-bold tabular-nums ${tone === 'bad' ? 'text-warm-dark' : 'text-primary'}`}>{value}</span>
      {sub && <span className="text-xs text-muted">{sub}</span>}
    </div>
  );
}
