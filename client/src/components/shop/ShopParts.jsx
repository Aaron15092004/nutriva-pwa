// Thành phần dùng chung cho Cửa hàng: thẻ sản phẩm, bộ số lượng, thanh giỏ hàng nổi.
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Minus, Check, AlertTriangle, ShoppingBag, ChevronRight } from 'lucide-react';
import { money } from '../../lib/format.js';
import { useCart } from '../../context/CartContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { cx } from '../ds/index.jsx';
import ProductImage from '../ProductImage.jsx';

export const productTitle = (p) => `${p.type === 'diy' ? 'Set tự làm' : 'Sữa hạt'} ${p.name}`;

// Nút + có phản hồi: chuyển thành dấu tích 1,2 giây sau khi thêm
function AddButton({ p, size = 40 }) {
  const cart = useCart();
  const toast = useToast();
  const [done, setDone] = useState(false);
  const timer = useRef();
  useEffect(() => () => clearTimeout(timer.current), []);
  const add = (e) => {
    e.preventDefault();
    cart.add(p, 1, 'none');
    toast(`Đã thêm ${productTitle(p)} vào giỏ`);
    setDone(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setDone(false), 1200);
  };
  return (
    <button
      type="button"
      onClick={add}
      aria-label={`Thêm ${productTitle(p)} vào giỏ`}
      className={cx(
        'grid shrink-0 place-items-center rounded-full text-white shadow-pill transition duration-200 ease-out active:scale-90',
        done ? 'bg-brand-main' : 'bg-brand-dark hover:bg-brand-deep',
      )}
      style={{ width: size, height: size }}
    >
      {done ? <Check size={20} strokeWidth={2.5} aria-hidden="true" /> : <Plus size={20} strokeWidth={2.5} aria-hidden="true" />}
    </button>
  );
}

// Thẻ sản phẩm (lưới 2 cột hoặc hàng cuộn ngang)
export function ProductCard({ p, conflict, className = '' }) {
  const lowStock = p.stock != null && p.stock > 0 && p.stock <= 10;
  return (
    <article className={cx('group flex flex-col overflow-hidden rounded-xl bg-white shadow-card transition duration-200 hover:shadow-float', className)}>
      <Link to={`/shop/p/${p.slug}`} className="relative block" aria-label={productTitle(p)}>
        <ProductImage product={p} className="transition-transform duration-300 ease-out group-hover:scale-[1.02]" />
        <span className="absolute left-2 top-2 flex flex-col items-start gap-1">
          {p.type === 'diy' && <span className="rounded-full bg-white/95 px-2 py-1 font-secondary text-2xs font-bold text-recipe shadow-pill">Tự làm</span>}
          {p.stock === 0 && <span className="rounded-full bg-primary/80 px-2 py-1 font-secondary text-2xs font-bold text-white">Hết hàng</span>}
          {lowStock && <span className="rounded-full bg-warm-light px-2 py-1 font-secondary text-2xs font-bold text-warm-dark">Còn {p.stock}</span>}
        </span>
        {conflict && (
          <span className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-error text-warm-dark" title="Có thành phần bạn cần tránh">
            <AlertTriangle size={16} aria-hidden="true" />
            <span className="sr-only">Có thành phần bạn cần tránh</span>
          </span>
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-1 p-4 pt-2">
        <Link to={`/shop/p/${p.slug}`} className="line-clamp-2 text-sm font-bold leading-5 text-primary hover:text-brand-dark">{p.name}</Link>
        <span className="font-secondary text-xs text-muted">{p.size}</span>
        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <b className="font-secondary text-base text-brand-dark">{money(p.price)}</b>
          {p.stock !== 0 && <AddButton p={p} size={36} />}
        </div>
      </div>
    </article>
  );
}

// Bộ tăng giảm số lượng
export function QtyStepper({ value, onChange, min = 1, max = 50, size = 'md', label = 'Số lượng' }) {
  const h = size === 'sm' ? 'h-8 w-8' : 'h-11 w-11';
  return (
    <div role="group" aria-label={label} className="inline-flex shrink-0 items-center gap-1 rounded-full bg-surface p-1">
      <button type="button" aria-label="Giảm" disabled={value <= min} onClick={() => onChange(value - 1)} className={cx('grid place-items-center rounded-full bg-white text-primary shadow-pill transition active:scale-90 disabled:opacity-40', h)}>
        <Minus size={16} aria-hidden="true" />
      </button>
      <span aria-live="polite" className="w-8 text-center font-secondary text-base font-bold text-primary">{value}</span>
      <button type="button" aria-label="Tăng" disabled={value >= max} onClick={() => onChange(value + 1)} className={cx('grid place-items-center rounded-full bg-white text-primary shadow-pill transition active:scale-90 disabled:opacity-40', h)}>
        <Plus size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

// Thanh giỏ hàng nổi phía trên thanh điều hướng (chỉ hiện khi giỏ có hàng)
export function CartBar() {
  const cart = useCart();
  if (!cart.count) return null;
  return (
    <Link
      to="/cart"
      className="fixed inset-x-0 z-30 mx-auto flex h-14 w-[calc(100%-32px)] max-w-[448px] items-center gap-4 rounded-full bg-brand-core pl-2 pr-4 text-white shadow-float transition active:scale-[0.98] animate-[cart-in_0.25s_cubic-bezier(0.22,1,0.36,1)]"
      style={{ bottom: 'calc(var(--nav-h) + var(--safe-b) + 8px)' }}
    >
      <span className="relative grid h-10 w-10 place-items-center rounded-full bg-white/15">
        <ShoppingBag size={20} aria-hidden="true" />
        <span className="absolute -right-1 -top-1 grid h-5 min-w-[20px] place-items-center rounded-full bg-warm-main px-1 font-secondary text-2xs font-bold">{cart.count}</span>
      </span>
      <span className="flex-1 text-sm font-bold">Xem giỏ hàng</span>
      <span className="font-secondary text-base font-bold">{money(cart.subtotal)}</span>
      <ChevronRight size={20} aria-hidden="true" />
    </Link>
  );
}
