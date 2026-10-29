import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useApi } from '../../lib/useApi.js';
import { api } from '../../lib/api.js';
import { track } from '../../lib/track.js';
import { cx } from '../ds/index.jsx';

// Link trong app (/shop/...) → điều hướng nội bộ; link ngoài (Shopee, Facebook…) → tab mới. Chặn mọi giao thức khác.
export const isExternal = (link) => /^https?:\/\//.test(link ?? '');
export const safeLink = (link) => (isExternal(link) || /^\/(?!\/)/.test(link ?? '') ? link : null);

export function SmartLink({ to, className, children, onClick, ...rest }) {
  const href = safeLink(to);
  if (!href) return <div className={className}>{children}</div>;
  return isExternal(href) ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className} onClick={onClick} {...rest}>
      {children}
    </a>
  ) : (
    <Link to={href} className={className} onClick={onClick} {...rest}>
      {children}
    </Link>
  );
}

// Nền theo chủ đề banner (chữ tối trên nền sáng, trừ 'dark') — không phủ lớp tối lên ảnh nữa
const THEME = {
  brand: { bg: 'linear-gradient(135deg, #F2F7E7 0%, #DCEBC2 100%)', ink: 'text-brand-core', cta: 'bg-brand-dark text-white' },
  warm: { bg: 'linear-gradient(135deg, #FFF3EC 0%, #FFDCCB 100%)', ink: 'text-warm-dark', cta: 'bg-warm-dark text-white' },
  cream: { bg: 'linear-gradient(135deg, #FFF8EA 0%, #F6E3BF 100%)', ink: 'text-[#5C3F0E]', cta: 'bg-[#5C3F0E] text-white' },
  dark: { bg: 'linear-gradient(135deg, #2F4B23 0%, #567324 100%)', ink: 'text-white', cta: 'bg-brand-accent text-primary' },
};
const INTERVAL = 5000;
const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Mỗi banner chỉ đếm 1 lượt xem / phiên
const seen = new Set();
function useViewHit(ref, promo, active) {
  useEffect(() => {
    const el = ref.current;
    if (!active || !el || seen.has(promo._id) || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && e.intersectionRatio >= 0.6 && !seen.has(promo._id)) {
          seen.add(promo._id);
          api.post(`/promos/${promo._id}/hit`, { kind: 'view' }).catch(() => {});
          io.disconnect();
        }
      },
      { threshold: [0.6] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, promo._id, active]);
}

function PromoCard({ promo, placement, active }) {
  const ref = useRef(null);
  useViewHit(ref, promo, active);
  const t = THEME[promo.theme] ?? THEME.brand;
  const click = () => {
    api.post(`/promos/${promo._id}/hit`, { kind: 'click' }).catch(() => {});
    track('promo.click', { id: promo._id, placement });
  };
  // Banner tự thiết kế (đã có chữ & logo): hiện nguyên ảnh 16:9, không phủ thêm chữ
  if (promo.theme === 'image' && promo.image)
    return (
      <SmartLink to={promo.link} onClick={click} className="block w-full shrink-0 snap-center overflow-hidden rounded-2xl shadow-card transition active:scale-[0.99]" aria-label={promo.title}>
        <div ref={ref}>
          <img src={promo.image} alt={promo.title} loading="lazy" draggable="false" className="aspect-[16/9] w-full object-cover" />
        </div>
      </SmartLink>
    );
  return (
    <SmartLink to={promo.link} onClick={click} className="relative flex h-[172px] w-full shrink-0 snap-center overflow-hidden rounded-2xl shadow-card transition active:scale-[0.99]" style={{ background: t.bg }} aria-label={`${promo.title}${promo.subtitle ? ` — ${promo.subtitle}` : ''}`}>
      <span ref={ref} className="absolute -right-12 -top-16 size-48 rounded-full border border-white/50" aria-hidden="true" />
      <div className={cx('relative z-10 flex w-[60%] flex-col items-start gap-1 p-5', t.ink)}>
        <span className="font-secondary text-2xs font-bold uppercase tracking-[0.14em] opacity-80">NUTRIVA</span>
        <p className="font-display text-xl font-bold leading-6 [font-variation-settings:'SOFT'_100] [text-wrap:balance]">{promo.title}</p>
        {promo.subtitle && <p className="line-clamp-2 text-xs opacity-85">{promo.subtitle}</p>}
        {promo.ctaLabel && (
          <span className={cx('mt-auto inline-flex h-9 items-center gap-1 rounded-full px-4 text-xs font-bold shadow-pill', t.cta)}>
            {promo.ctaLabel} <ChevronRight size={14} aria-hidden="true" />
          </span>
        )}
      </div>
      {promo.image && (
        <span className="absolute -right-2 top-1/2 h-[136px] w-[42%] -translate-y-1/2 rotate-[4deg] overflow-hidden rounded-xl border-4 border-white bg-white shadow-float" aria-hidden="true">
          <img src={promo.image} alt="" loading="lazy" draggable="false" className="h-full w-full object-cover" />
        </span>
      )}
    </SmartLink>
  );
}

// Dải banner quảng cáo theo vị trí (shop / plan / track): 1 banner/lần, tự chuyển 5 giây (dừng khi chạm/giảm chuyển động),
// vạch tiến độ kiểu "story". Không có banner nào → không chiếm chỗ.
export default function PromoCarousel({ placement, className = '' }) {
  const { data } = useApi(`/promos?placement=${placement}`);
  const promos = data?.promos ?? [];
  const box = useRef(null);
  const [index, setIndex] = useState(0);
  const [hold, setHold] = useState(false);
  const auto = !reducedMotion();
  const n = promos.length;

  useEffect(() => {
    if (n < 2 || hold || !auto) return undefined;
    const t = setTimeout(() => {
      const el = box.current;
      if (!el || document.hidden) return;
      const next = (index + 1) % n;
      el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' });
    }, INTERVAL);
    return () => clearTimeout(t);
  }, [index, n, hold, auto]);

  if (!n) return null;
  const onScroll = () => {
    const el = box.current;
    if (el) setIndex(Math.round(el.scrollLeft / el.clientWidth));
  };
  return (
    <section aria-label="Ưu đãi & tin mới" aria-roledescription="carousel" className={cx('flex flex-col gap-2', className)}>
      <div
        ref={box}
        onScroll={onScroll}
        onPointerDown={() => setHold(true)}
        onPointerUp={() => setHold(false)}
        onPointerCancel={() => setHold(false)}
        onFocus={() => setHold(true)}
        onBlur={() => setHold(false)}
        className="flex snap-x snap-mandatory gap-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {promos.map((p, i) => (
          <PromoCard key={p._id} promo={p} placement={placement} active={i === index} />
        ))}
      </div>
      {n > 1 && (
        <div className="flex justify-center gap-1" aria-hidden="true">
          {promos.map((p, i) => (
            <span key={p._id} className="h-1 w-6 overflow-hidden rounded-full bg-divider">
              <span
                key={i === index ? `on-${index}` : 'off'}
                className={cx('block h-full rounded-full bg-brand-dark', i < index && 'w-full', i > index && 'w-0', i === index && (auto && !hold ? 'promo-progress' : 'w-full'))}
              />
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
