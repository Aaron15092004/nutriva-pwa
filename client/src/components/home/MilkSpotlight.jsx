import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Pause, Play } from 'lucide-react';
import { useApi } from '../../lib/useApi.js';
import { track } from '../../lib/track.js';
import { flavorOf, FLAVORS } from '../brand/art.js';
import { BottleScene } from '../brand/MilkArt.jsx';
import { cx } from '../ds/index.jsx';

const INTERVAL = 5000;
const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const vnd = (n) => `${Number(n ?? 0).toLocaleString('vi-VN')}đ`;

// Banner nổi bật ở trang chủ: 6 vị sữa hạt, chai "bật" ra khỏi khung từ vũng sữa bắn.
// Tự chuyển 5 giây/lần (dừng khi chạm, rời màn hình, hoặc người dùng bật giảm chuyển động), vuốt trái/phải để đổi vị.
export default function MilkSpotlight({ className = '' }) {
  const { data } = useApi('/products?type=milk');
  const items = (data?.products ?? []).filter((p) => FLAVORS[p.line]);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(reducedMotion);
  const [hold, setHold] = useState(false);
  const [visible, setVisible] = useState(true);
  const box = useRef(null);
  const drag = useRef(null);
  const n = items.length;

  useEffect(() => {
    const el = box.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, [n]);

  useEffect(() => {
    if (n < 2 || paused || hold || !visible) return undefined;
    const t = setTimeout(() => !document.hidden && setI((x) => (x + 1) % n), INTERVAL);
    return () => clearTimeout(t);
  }, [i, n, paused, hold, visible]);

  if (!n) return <div className={cx('h-[268px]', className)} aria-hidden="true" />;
  const p = items[i % n];
  const f = flavorOf(p.line);
  const go = (d) => setI((x) => (x + d + n) % n);

  const onDown = (e) => {
    drag.current = { x: e.clientX, y: e.clientY, moved: false };
    setHold(true);
  };
  const onUp = (e) => {
    const d = drag.current;
    setHold(false);
    if (!d) return;
    const dx = e.clientX - d.x;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(e.clientY - d.y)) {
      d.moved = true;
      go(dx < 0 ? 1 : -1);
    }
  };

  return (
    <section ref={box} data-spotlight aria-roledescription="carousel" aria-label="Sữa hạt tươi NUTRIVA" className={cx('flex flex-col gap-2 pt-14', className)}>
      <Link
        to={`/shop/p/${p.slug}`}
        aria-label={`Sữa hạt ${f.name} — ${p.subtitle}, ${vnd(p.price)}. Xem sản phẩm`}
        className="relative block h-[212px] touch-pan-y select-none rounded-2xl transition-transform duration-150 active:scale-[0.99]"
        onPointerDown={onDown}
        onPointerUp={onUp}
        onPointerCancel={() => setHold(false)}
        onPointerLeave={() => setHold(false)}
        onClickCapture={(e) => {
          if (drag.current?.moved) {
            e.preventDefault();
            drag.current = null;
          } else track('promo.click', { id: 'spotlight', placement: 'home', slug: p.slug });
        }}
        onFocus={() => setHold(true)}
        onBlur={() => setHold(false)}
        draggable="false"
      >
        {/* Nền: chồng 6 lớp gradient, đổi vị = đổi độ mờ → chuyển màu mượt */}
        <div className="absolute inset-0 overflow-hidden rounded-2xl shadow-float">
          {items.map((x, j) => {
            const c = flavorOf(x.line);
            return <div key={x.line} className={cx('absolute inset-0 transition-opacity duration-700 ease-out', j === i ? 'opacity-100' : 'opacity-0')} style={{ background: `radial-gradient(120% 90% at 85% 20%, #FFFFFF 0%, ${c.bg[0]} 38%, ${c.bg[1]} 100%)` }} />;
          })}
          <span className="absolute -right-16 -top-16 size-64 rounded-full border border-white/60" />
          <span className="absolute -right-4 -top-4 size-40 rounded-full border border-white/50" />
        </div>

        {/* Chai + sữa bắn: chỉ cắt đáy & hai bên theo thẻ, phía trên để chai "tràn" ra ngoài khung */}
        <div className="absolute inset-0" style={{ clipPath: 'inset(-90px 0 0 0 round 0 0 32px 32px)' }}>
          <BottleScene line={p.line} k={i} h={250} seed={3 + (i % 3)} className="absolute bottom-0 right-[-1%]" />
        </div>

        <div className="absolute inset-y-0 left-0 flex w-[54%] flex-col py-5 pl-5" style={{ color: f.ink }}>
          <span className="inline-flex self-start rounded-full bg-white/80 px-2 py-0.5 font-secondary text-2xs font-bold uppercase tracking-wider">Sữa hạt tươi • {p.size ?? '330ml'}</span>
          <div key={`t${i}`} className="slide-up-in mt-2 flex flex-col gap-1">
            <p className="font-display text-[28px] font-bold leading-8 [font-variation-settings:'SOFT'_100]">{f.name}</p>
            <p className="line-clamp-2 text-xs font-semibold opacity-80">{p.subtitle}</p>
          </div>
          <span className="mt-auto inline-flex h-10 items-center gap-2 self-start rounded-full pl-4 pr-1 text-sm font-bold text-white shadow-float" style={{ background: f.ink }}>
            {vnd(p.price)}
            <span className="grid size-8 place-items-center rounded-full bg-white/20" aria-hidden="true">
              <ArrowRight size={16} />
            </span>
          </span>
        </div>
      </Link>

      <div className="flex items-center justify-center gap-1">
        <div className="flex items-center" role="group" aria-label="Chọn vị sữa">
          {items.map((x, j) => (
            <button key={x.line} type="button" onClick={() => setI(j)} aria-label={`Vị ${flavorOf(x.line).name}`} aria-current={j === i ? 'true' : undefined} className="grid h-8 w-6 place-items-center">
              <span className={cx('block h-2 rounded-full transition-all duration-300', j === i ? 'w-5' : 'w-2 bg-divider')} style={j === i ? { background: flavorOf(x.line).ink } : undefined} />
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setPaused((v) => !v)} aria-label={paused ? 'Tự chuyển vị' : 'Dừng tự chuyển'} className="grid size-8 place-items-center rounded-full text-muted hover:bg-white">
          {paused ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />}
        </button>
      </div>
    </section>
  );
}
