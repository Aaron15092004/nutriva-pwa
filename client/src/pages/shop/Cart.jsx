import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Trash2, X, TicketPercent, Truck, ChevronRight, ShoppingBag, CheckCircle2 } from 'lucide-react';
import { api } from '../../lib/api.js';
import { useApi } from '../../lib/useApi.js';
import { money } from '../../lib/format.js';
import { useCart } from '../../context/CartContext.jsx';
import { TopBar, Button } from '../../components/ui.jsx';
import { IconCircle } from '../../components/ds/index.jsx';
import ProductImage from '../../components/ProductImage.jsx';
import { QtyStepper, productTitle } from '../../components/shop/ShopParts.jsx';

export const COUPON_KEY = 'nutriva_coupon';

export default function Cart() {
  const cart = useCart();
  const navigate = useNavigate();
  const [code, setCode] = useState(() => sessionStorage.getItem(COUPON_KEY) ?? '');
  const [applied, setApplied] = useState(null);
  const [couponError, setCouponError] = useState('');
  const [checking, setChecking] = useState(false);
  const cfg = useApi('/shop/config');
  const freeFrom = cfg.data?.freeShipFrom;

  const apply = async () => {
    setChecking(true);
    setCouponError('');
    try {
      const q = await api.post('/orders/quote', { items: cart.items, coupon: code, method: 'pickup' });
      setApplied({ code: q.coupon, discount: q.discount, label: q.couponLabel });
      sessionStorage.setItem(COUPON_KEY, q.coupon);
    } catch (e) {
      setApplied(null);
      sessionStorage.removeItem(COUPON_KEY);
      setCouponError(e.message);
    } finally {
      setChecking(false);
    }
  };

  if (!cart.items.length) {
    return (
      <>
        <TopBar title="Giỏ hàng" />
        <main className="flex flex-col items-center gap-4 px-6 pb-12 pt-16 text-center">
          <IconCircle icon={ShoppingBag} className="bg-brand-light text-brand-dark" size={80} iconSize={36} />
          <h2 className="text-xl font-extrabold text-primary">Giỏ hàng đang trống</h2>
          <p className="text-sm text-muted">Khám phá sữa hạt tươi và set tự làm của NUTRIVA.</p>
          <Link to="/shop" className="mt-2 inline-flex h-12 items-center rounded-full bg-brand-dark px-6 text-base font-bold text-white hover:bg-brand-deep">
            Đến cửa hàng
          </Link>
        </main>
      </>
    );
  }

  const total = cart.subtotal - (applied?.discount ?? 0);
  const toFree = freeFrom ? Math.max(0, freeFrom - cart.subtotal) : 0;

  return (
    <>
      <TopBar
        title={`Giỏ hàng (${cart.count})`}
        actions={
          <button className="icon-btn" aria-label="Xóa toàn bộ giỏ hàng" onClick={() => window.confirm('Xóa toàn bộ giỏ hàng?') && cart.clear()}>
            <Trash2 size={20} />
          </button>
        }
      />
      <main className="flex flex-col gap-4 px-4 pb-[calc(120px+var(--safe-b))] pt-2">
        {freeFrom > 0 && (
          <div className="flex flex-col gap-2 rounded-xl bg-water-card p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-primary">
              <Truck size={18} className="text-water-icon" aria-hidden="true" />
              <span>{toFree > 0 ? <>Mua thêm <b>{money(toFree)}</b> để được miễn phí giao hàng</> : 'Đơn của bạn được miễn phí giao hàng'}</span>
            </p>
            <div className="h-2 overflow-hidden rounded-full bg-white/70" role="progressbar" aria-valuemin={0} aria-valuemax={freeFrom} aria-valuenow={Math.min(cart.subtotal, freeFrom)} aria-label="Tiến độ miễn phí giao hàng">
              <div className="h-full rounded-full bg-water-icon transition-[width] duration-500 ease-out" style={{ width: `${Math.min(100, (cart.subtotal / freeFrom) * 100)}%` }} />
            </div>
          </div>
        )}

        <ul className="flex flex-col gap-2">
          {cart.items.map((i) => (
            <li key={`${i.slug}|${i.sweetness}`} className="flex gap-4 rounded-xl bg-white p-4 shadow-card">
              <Link to={`/shop/p/${i.slug}`} className="shrink-0">
                <ProductImage product={i} ratio="1/1" className="w-20 rounded-md" />
              </Link>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-start gap-2">
                  <b className="line-clamp-2 flex-1 text-sm leading-5 text-primary">{productTitle(i)}</b>
                  <button type="button" aria-label={`Xóa ${i.name}`} onClick={() => cart.remove(i)} className="-mr-2 -mt-2 grid h-10 w-10 shrink-0 place-items-center rounded-full text-subtle hover:bg-surface">
                    <X size={18} aria-hidden="true" />
                  </button>
                </div>
                <span className="font-secondary text-xs text-muted">
                  {i.size}
                  {i.type === 'milk' ? ` • ${i.sweetness === 'low' ? 'Ít ngọt' : 'Không thêm đường'}` : ''}
                </span>
                <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                  <b className="font-secondary text-base text-brand-dark">{money(i.price * i.qty)}</b>
                  <QtyStepper size="sm" value={i.qty} min={0} onChange={(v) => cart.setQty(i, Math.min(50, v))} label={`Số lượng ${i.name}`} />
                </div>
              </div>
            </li>
          ))}
        </ul>

        <section className="flex flex-col gap-2 rounded-xl bg-white p-4 shadow-card">
          <label htmlFor="coupon" className="flex items-center gap-2 text-base font-bold text-primary">
            <TicketPercent size={20} className="text-brand-dark" aria-hidden="true" /> Mã giảm giá
          </label>
          <div className="flex gap-2">
            <input
              id="coupon"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Nhập mã của bạn"
              className="h-12 min-w-0 flex-1 rounded-full border border-border bg-background px-4 font-secondary text-base font-semibold uppercase tracking-wider text-primary outline-none placeholder:normal-case placeholder:tracking-normal placeholder:font-normal focus:border-brand-main"
            />
            <Button className="h-12 rounded-full bg-brand-light px-6 text-base font-bold text-brand-deep" style={{ minHeight: 48 }} loading={checking} disabled={!code.trim()} onClick={apply}>
              Áp dụng
            </Button>
          </div>
          {couponError && <p className="text-sm font-semibold text-warm-dark">{couponError}</p>}
          {applied && (
            <p className="flex items-center gap-1 text-sm font-semibold text-recipe">
              <CheckCircle2 size={16} aria-hidden="true" /> {applied.label}
            </p>
          )}
        </section>

        <section aria-label="Tổng tiền" className="flex flex-col gap-2 rounded-xl bg-white p-4 font-secondary text-sm shadow-card">
          <div className="flex justify-between">
            <span className="text-muted">Tạm tính ({cart.count} sản phẩm)</span>
            <b className="text-primary">{money(cart.subtotal)}</b>
          </div>
          {applied && (
            <div className="flex justify-between">
              <span className="text-muted">Giảm giá ({applied.code})</span>
              <b className="text-recipe">−{money(applied.discount)}</b>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted">Phí giao hàng</span>
            <span className="text-muted">Tính ở bước sau</span>
          </div>
        </section>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto flex max-w-app items-center gap-4 border-t border-border bg-white/95 px-4 pb-[calc(12px+var(--safe-b))] pt-3 backdrop-blur">
        <div className="min-w-0">
          <p className="font-secondary text-xs text-muted">Tổng tạm tính</p>
          <p className="font-secondary text-xl font-bold text-primary">{money(total)}</p>
        </div>
        <button type="button" onClick={() => navigate('/checkout')} className="flex h-12 flex-1 items-center justify-center gap-1 rounded-full bg-brand-dark text-base font-bold text-white transition hover:bg-brand-deep active:scale-[0.98]">
          Đặt hàng <ChevronRight size={20} aria-hidden="true" />
        </button>
      </div>
    </>
  );
}
