// Bộ chọn cho onboarding — chạm/kéo thay vì gõ bàn phím.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Minus, Plus } from 'lucide-react';
import { cx } from '../ds/index.jsx';

const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const fmtNum = (v, decimals) => v.toLocaleString('vi-VN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
const tick = () => {
  try {
    navigator.vibrate?.(4);
  } catch {
    /* không hỗ trợ rung */
  }
};

// Số chạy từ 0 → target (dùng cho màn khuyến nghị dinh dưỡng)
export function useCountUp(target, duration = 900) {
  const [v, setV] = useState(() => (reduceMotion() ? target : 0));
  useEffect(() => {
    if (reduceMotion()) {
      setV(target);
      return undefined;
    }
    let raf;
    const t0 = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - t0) / duration);
      setV(target * (1 - (1 - p) ** 3));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return v;
}

// ---- Thước kéo (ngang: cân nặng, vòng eo; dọc: chiều cao) ----
// Theo mẫu: chiếm phần lớn màn hình, số rất lớn, vạch dài. Vạch nhỏ/giữa vẽ bằng CSS gradient (không tạo hàng nghìn DOM),
// vạch chính + nhãn là phần tử thật. Kéo để chọn; phím mũi tên / nút −,+ để chỉnh chính xác.
export function RulerPicker({ min, max, step = 1, value, onChange, unit, decimals = 0, majorEvery = 10, midEvery, labelEvery = 10, px = 10, vertical = false, label, figure }) {
  const scroller = useRef(null);
  const fromScroll = useRef(false);
  const settle = useRef(null);
  const count = Math.round((max - min) / step);
  const clamp = (v) => Math.min(max, Math.max(min, Math.round(v / step) * step));
  const offsetOf = (v) => ((v - min) / step) * px;

  // Đồng bộ vị trí cuộn khi giá trị đổi từ bên ngoài (nút −/+, phím, giá trị khởi tạo)
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (fromScroll.current) {
      fromScroll.current = false;
      return;
    }
    if (vertical) el.scrollTop = offsetOf(value);
    else el.scrollLeft = offsetOf(value);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const onScroll = () => {
    const el = scroller.current;
    const pos = vertical ? el.scrollTop : el.scrollLeft;
    const v = Number(clamp(min + (pos / px) * step).toFixed(decimals));
    if (v !== value) {
      fromScroll.current = true;
      if (Math.trunc(v) !== Math.trunc(value)) tick();
      onChange(v);
    }
    // Dừng kéo → căn đúng vạch
    clearTimeout(settle.current);
    settle.current = setTimeout(() => el.scrollTo({ [vertical ? 'top' : 'left']: offsetOf(v), behavior: 'smooth' }), 140);
  };

  const nudge = (dir, big) => onChange(Number(clamp(value + dir * step * (big ? 10 : 1)).toFixed(decimals)));
  const onKey = (e) => {
    const map = { ArrowRight: 1, ArrowDown: vertical ? 1 : -1, ArrowLeft: -1, ArrowUp: vertical ? -1 : 1 };
    if (map[e.key]) {
      e.preventDefault();
      nudge(map[e.key], e.shiftKey);
    }
  };

  const majors = [];
  for (let i = 0; i <= count; i += Math.round(majorEvery / step)) majors.push(Number((min + i * step).toFixed(decimals)));
  const isLabel = (m) => Math.abs(((m - min) / labelEvery) - Math.round((m - min) / labelEvery)) < 1e-6;
  const len = count * px;
  const midPx = midEvery ? (midEvery / step) * px : null;
  const dirGrad = vertical ? 'to bottom' : 'to right';
  const grad = (every) => `repeating-linear-gradient(${dirGrad}, #B9C7BF 0 2px, transparent 2px ${every}px)`;
  const bgImage = midPx ? `${grad(midPx)}, ${grad(px)}` : grad(px);

  const slider = {
    role: 'slider',
    tabIndex: 0,
    'aria-label': label,
    'aria-valuemin': min,
    'aria-valuemax': max,
    'aria-valuenow': value,
    'aria-valuetext': `${fmtNum(value, decimals)} ${unit}`,
    onKeyDown: onKey,
  };
  const stepper = (dir, Icon, l) => (
    <button type="button" onClick={() => nudge(dir)} aria-label={l} className="grid h-12 w-12 shrink-0 place-items-center rounded-full border-2 border-border bg-white text-primary transition active:scale-90">
      <Icon size={20} strokeWidth={2.5} aria-hidden="true" />
    </button>
  );
  const Big = (
    <p className="flex items-baseline justify-center gap-2" aria-hidden="true">
      <b className="font-secondary text-[64px] font-bold leading-none tabular-nums tracking-tight text-primary">{fmtNum(value, decimals)}</b>
      <span className="font-secondary text-xl font-semibold text-muted">{unit}</span>
    </p>
  );

  // Thước dọc (chiều cao): thước bên trái cao ~58% màn hình, số lớn trên vạch chỉ, hình người đứng tới vạch
  if (vertical) {
    return (
      <div className="relative h-[58dvh] min-h-[400px] outline-none focus-visible:ring-2 focus-visible:ring-brand-soft" {...slider}>
        <div ref={scroller} onScroll={onScroll} className="absolute inset-y-0 left-0 w-36 overflow-y-scroll overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div style={{ height: '50%' }} />
          <div
            className="relative"
            style={{ height: len + 2, backgroundImage: bgImage, backgroundSize: midPx ? '56px 100%, 32px 100%' : '32px 100%', backgroundRepeat: 'no-repeat', backgroundPosition: 'left top' }}
          >
            {majors.map((m) => (
              <span key={m} className="absolute left-0 flex -translate-y-1/2 items-center gap-2" style={{ top: offsetOf(m) + 1 }}>
                <span className="h-0.5 w-20 rounded-full bg-secondary/60" />
                {isLabel(m) && <span className="font-secondary text-base font-semibold text-secondary">{fmtNum(m, 0)}</span>}
              </span>
            ))}
          </div>
          <div style={{ height: '50%' }} />
        </div>
        {/* Vạch chỉ + số lớn */}
        <span className="pointer-events-none absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-brand-main" aria-hidden="true" />
        <div className="pointer-events-none absolute right-0 top-1/2 flex -translate-y-[calc(100%+12px)] items-baseline gap-2 pr-2" aria-hidden="true">
          <b className="font-secondary text-[64px] font-bold leading-none tabular-nums tracking-tight text-primary">{fmtNum(value, decimals)}</b>
          <span className="font-secondary text-xl font-semibold text-muted">{unit}</span>
        </div>
        {figure && <div className="pointer-events-none absolute bottom-0 right-6 top-1/2 flex items-end justify-center pt-2">{figure}</div>}
        <span className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-background to-transparent" aria-hidden="true" />
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-background to-transparent" aria-hidden="true" />
        <div className="absolute right-0 top-2 flex gap-2">
          {stepper(-1, Minus, 'Giảm')}
          {stepper(1, Plus, 'Tăng')}
        </div>
      </div>
    );
  }

  // Thước ngang (cân nặng, vòng eo): số rất lớn, thước tràn viền với vạch dài
  return (
    <div className="flex flex-col gap-10">
      <div className="flex items-center justify-between gap-2">
        {stepper(-1, Minus, 'Giảm')}
        {Big}
        {stepper(1, Plus, 'Tăng')}
      </div>
      <div className="relative -mx-4 h-36 outline-none focus-visible:ring-2 focus-visible:ring-brand-soft" {...slider}>
        <div ref={scroller} onScroll={onScroll} className="flex h-full overflow-x-scroll overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="shrink-0" style={{ width: '50%' }} />
          <div
            className="relative h-full shrink-0"
            style={{ width: len + 2, backgroundImage: bgImage, backgroundSize: midPx ? '100% 64px, 100% 40px' : '100% 40px', backgroundRepeat: 'no-repeat', backgroundPosition: 'left bottom' }}
          >
            {majors.map((m) => (
              <span key={m} className="absolute bottom-0 flex -translate-x-1/2 flex-col items-center gap-2" style={{ left: offsetOf(m) + 1 }}>
                {isLabel(m) && <span className="font-secondary text-lg font-semibold text-secondary">{fmtNum(m, 0)}</span>}
                <span className="h-[88px] w-0.5 rounded-full bg-secondary/60" />
              </span>
            ))}
          </div>
          <div className="shrink-0" style={{ width: '50%' }} />
        </div>
        {/* Kim chỉ: cao bằng vạch chính, không che số nhãn */}
        <span className="pointer-events-none absolute bottom-0 left-1/2 h-[92px] w-1 -translate-x-1/2 rounded-full bg-brand-main" aria-hidden="true" />
        <span className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-background to-transparent" aria-hidden="true" />
        <span className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-background to-transparent" aria-hidden="true" />
      </div>
    </div>
  );
}

// Hình người đứng (cho thước chiều cao)
export function BodyFigure({ male }) {
  return (
    <svg viewBox="0 0 80 200" className="h-full w-auto text-divider" fill="currentColor" aria-hidden="true">
      <circle cx="40" cy="18" r="15" />
      {male ? (
        <path d="M22 40h36c7 0 11 5 11 12l-1 54c0 4-3 6-6 6s-6-2-6-6l-1-44h-2l1 128c0 5-4 8-8 8s-8-3-8-8l-1-70h-2l-1 70c0 5-4 8-8 8s-8-3-8-8l1-128h-2l-1 44c0 4-3 6-6 6s-6-2-6-6l-1-54c0-7 4-12 11-12z" />
      ) : (
        <path d="M24 40h32c7 0 10 5 11 11l3 52c0 4-2 6-5 6s-6-2-6-6l-3-40h-2l10 62H50l-1 63c0 5-4 8-8 8s-7-3-7-8l-1-63h-1l-1 63c0 5-4 8-7 8s-8-3-8-8l-1-63H10l10-62h-2l-3 40c0 4-3 6-6 6s-5-2-5-6l3-52c1-6 4-11 11-11z" transform="translate(4 0)" />
      )}
    </svg>
  );
}

// ---- Bánh xe chọn (năm sinh) — theo mẫu: to, giữa màn hình, dải chọn rộng ----
const ROW = 64;
export function WheelPicker({ items, value, onChange, label }) {
  const ref = useRef(null);
  const settle = useRef(null);
  const idx = Math.max(0, items.findIndex((x) => x.value === value));

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = idx * ROW;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onScroll = () => {
    const i = Math.min(items.length - 1, Math.max(0, Math.round(ref.current.scrollTop / ROW)));
    if (items[i].value !== value) {
      tick();
      onChange(items[i].value);
    }
    clearTimeout(settle.current);
    settle.current = setTimeout(() => ref.current?.scrollTo({ top: i * ROW, behavior: 'smooth' }), 120);
  };
  const go = useCallback(
    (d) => {
      const i = Math.min(items.length - 1, Math.max(0, idx + d));
      onChange(items[i].value);
      ref.current?.scrollTo({ top: i * ROW, behavior: 'smooth' });
    },
    [idx, items, onChange],
  );

  return (
    <div
      className="relative mx-auto h-[320px] w-full max-w-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-soft"
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={items[0].value}
      aria-valuemax={items.at(-1).value}
      aria-valuenow={value}
      onKeyDown={(e) => {
        if (e.key === 'ArrowDown') (e.preventDefault(), go(1));
        if (e.key === 'ArrowUp') (e.preventDefault(), go(-1));
      }}
    >
      <span className="pointer-events-none absolute inset-x-6 top-1/2 h-16 -translate-y-1/2 rounded-full bg-brand-soft/70" aria-hidden="true" />
      <div ref={ref} onScroll={onScroll} className="relative h-full snap-y snap-mandatory overflow-y-scroll overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div style={{ height: ROW * 2 }} />
        {items.map((it, i) => {
          const d = Math.abs(i - idx);
          return (
            <button
              type="button"
              key={it.value}
              onClick={() => go(i - idx)}
              tabIndex={-1}
              className={cx(
                'flex w-full snap-center items-center justify-center font-secondary tabular-nums transition-all duration-150',
                d === 0 ? 'text-[40px] font-bold text-brand-core' : d === 1 ? 'text-[30px] font-semibold text-muted' : 'text-2xl text-divider',
              )}
              style={{ height: ROW }}
            >
              {it.label}
            </button>
          );
        })}
        <div style={{ height: ROW * 2 }} />
      </div>
      <span className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-background to-transparent" aria-hidden="true" />
      <span className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background to-transparent" aria-hidden="true" />
    </div>
  );
}

// ---- Danh sách thẻ lựa chọn (1 hoặc nhiều) — theo mẫu: thẻ cao ~76px, cách 16px, icon không nền cỡ lớn ----
// Thẻ xuất hiện lần lượt; chọn → viền + nền xanh nhạt + dấu tích "bật".
export function OptionList({ options, value, onSelect, multi = false }) {
  const isOn = (id) => (multi ? (value ?? []).includes(id) : value === id);
  return (
    <div className="flex min-h-[52dvh] flex-col justify-center gap-[18px]" role={multi ? 'group' : 'radiogroup'}>
      {options.map((o, i) => {
        const on = isOn(o.id);
        const Icon = o.icon;
        return (
          <button
            key={o.id}
            type="button"
            role={multi ? 'checkbox' : 'radio'}
            aria-checked={on}
            onClick={() => onSelect(o.id)}
            className={cx(
              'ob-item flex min-h-[84px] w-full items-center gap-4 rounded-[22px] border-2 px-5 py-4 text-left transition duration-200 active:scale-[0.98]',
              on ? 'border-brand-main bg-brand-light shadow-none' : 'border-transparent bg-white shadow-card hover:border-brand-soft',
            )}
            style={{ animationDelay: `${60 + i * 60}ms` }}
          >
            <span className={cx('grid w-10 shrink-0 place-items-center', o.color ?? 'text-brand-dark')} aria-hidden="true">
              {o.render ?? (Icon && <Icon size={34} strokeWidth={2.25} />)}
            </span>
            <span className="min-w-0 flex-1">
              <span className={cx('block text-lg font-bold leading-6', on ? 'text-brand-deep' : 'text-primary')}>{o.label}</span>
              {o.desc && <span className="mt-1 block text-[15px] leading-5 text-muted">{o.desc}</span>}
            </span>
            {multi ? (
              <span className={cx('grid h-7 w-7 shrink-0 place-items-center rounded-lg border-2 transition', on ? 'ob-pop border-brand-main bg-brand-main text-white' : 'border-divider text-transparent')} aria-hidden="true">
                <Check size={16} strokeWidth={3} />
              </span>
            ) : (
              on && (
                <span className="ob-pop grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-main text-white" aria-hidden="true">
                  <Check size={16} strokeWidth={3} />
                </span>
              )
            )}
          </button>
        );
      })}
    </div>
  );
}

// Biểu tượng mức độ vận động (4 cột như sóng điện thoại) — không nền, cùng cỡ với icon khác
export function LevelBars({ level }) {
  return (
    <span className="flex h-9 items-end gap-1" aria-hidden="true">
      {[1, 2, 3, 4].map((i) => (
        <span key={i} className={cx('w-1.5 rounded-full', i <= level ? 'bg-warm-main' : 'bg-warm-soft')} style={{ height: 8 + i * 6 }} />
      ))}
    </span>
  );
}

// Ký hiệu giới tính ♀ / ♂ vẽ bằng nét (lucide không có sẵn)
export function GenderIcon({ male, size = 34 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {male ? (
        <>
          <circle cx="10" cy="14" r="6" />
          <path d="M14.5 9.5 20 4M15 4h5v5" />
        </>
      ) : (
        <>
          <circle cx="12" cy="9" r="6" />
          <path d="M12 15v7M9 19h6" />
        </>
      )}
    </svg>
  );
}
