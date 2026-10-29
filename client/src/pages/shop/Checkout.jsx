import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { User, Phone, MapPin, Truck, Store, CalendarDays, Clock, Banknote, Landmark, ChevronRight, Gift } from 'lucide-react';
import { api } from '../../lib/api.js';
import { newCid } from '../../lib/outbox.js';
import { useApi } from '../../lib/useApi.js';
import { money, today, addDays, longDate } from '../../lib/format.js';
import { useCart } from '../../context/CartContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { TopBar, ErrorNote, Skeleton } from '../../components/ui.jsx';
import { TextField, PrimaryButton, BottomBar } from '../../components/ds/form.jsx';
import { cx } from '../../components/ds/index.jsx';
import { COUPON_KEY } from './Cart.jsx';

const SLOTS = ['08:00 - 12:00', '13:00 - 17:00', '18:00 - 21:00'];

function Radio({ checked, onSelect, icon: Icon, title, desc }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      className={cx('flex min-h-16 items-center gap-2 rounded-lg border-2 bg-white px-4 py-2 text-left transition', checked ? 'border-brand-dark bg-brand-light' : 'border-border hover:border-brand-pastel')}
    >
      <Icon size={22} className={cx('shrink-0', checked ? 'text-brand-dark' : 'text-brand-main')} aria-hidden="true" />
      <span className="min-w-0">
        <span className={cx('block text-sm', checked ? 'font-bold text-brand-deep' : 'font-semibold text-primary')}>{title}</span>
        {desc && <span className="block text-xs text-muted">{desc}</span>}
      </span>
    </button>
  );
}

export default function Checkout() {
  const cart = useCart();
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const dates = Array.from({ length: 7 }, (_, i) => addDays(today(), i + 1));
  const [address, setAddress] = useState({ name: user.address?.name || user.name, phone: user.address?.phone ?? '', line: user.address?.line ?? '' });
  const [method, setMethod] = useState('home');
  const [date, setDate] = useState(dates[0]);
  const [slot, setSlot] = useState(SLOTS[0]);
  const [payment, setPayment] = useState('cod');
  const [quote, setQuote] = useState(null);
  const [error, setError] = useState('');
  const [placing, setPlacing] = useState(false);
  const coupon = sessionStorage.getItem(COUPON_KEY) || undefined;
  const cfg = useApi('/shop/config');
  // Khóa chống đặt trùng: bấm 2 lần / mạng chập chờn gửi lại vẫn chỉ ra 1 đơn. Đổi giỏ/lựa chọn → khóa mới.
  const requestId = useMemo(() => newCid(), [cart.items, coupon, method, date, slot, payment]);

  useEffect(() => {
    if (!cart.items.length) return;
    api
      .post('/orders/quote', { items: cart.items, coupon, method })
      .then((q) => {
        setQuote(q);
        setError('');
      })
      .catch((e) => setError(e.message));
  }, [cart.items, coupon, method]);

  if (!cart.items.length && !placing) return <Navigate to="/cart" replace />;

  const place = async () => {
    setError('');
    if (!address.name.trim() || !/^[0-9+ ]{9,13}$/.test(address.phone)) {
      setError('Vui lòng nhập họ tên và số điện thoại hợp lệ (9–13 chữ số).');
      return;
    }
    if (method === 'home' && !address.line.trim()) {
      setError('Vui lòng nhập địa chỉ nhận hàng.');
      return;
    }
    setPlacing(true);
    try {
      const { order } = await api.post('/orders', { items: cart.items, coupon, delivery: { method, date, slot }, address, payment, clientRequestId: requestId });
      cart.clear();
      sessionStorage.removeItem(COUPON_KEY);
      setUser({ ...user, address });
      navigate(`/orders/${order._id}?new=1`, { replace: true });
    } catch (e) {
      setError(e.message);
      setPlacing(false);
    }
  };

  const mc = cfg.data?.membership;
  const memberDays = mc?.enabled ? cart.items.reduce((n, i) => n + i.qty * ({ milk: mc.daysPerBottle, diy: mc.daysPerSet, treat: mc.daysPerTreat }[i.type] ?? 0), 0) : 0;
  const setAddr = (k) => (e) => setAddress({ ...address, [k]: e.target.value });
  const h2 = 'text-base font-bold text-primary';
  const selectBox = 'flex h-14 items-center gap-2 rounded-lg border border-border bg-white px-4 focus-within:border-brand-main focus-within:ring-2 focus-within:ring-brand-soft';

  return (
    <>
      <TopBar title="Xác nhận đơn hàng" fallback="/cart" />
      <main className="flex flex-col gap-6 px-4 pb-[calc(112px+var(--safe-b))] pt-2">
        <section className="flex flex-col gap-2">
          <h2 className={h2}>Thông tin nhận hàng</h2>
          <TextField id="co-name" aria-label="Họ tên" icon={User} autoComplete="name" placeholder="Họ tên" value={address.name} onChange={setAddr('name')} />
          <TextField id="co-phone" aria-label="Số điện thoại" icon={Phone} type="tel" autoComplete="tel" inputMode="tel" placeholder="Số điện thoại" value={address.phone} onChange={setAddr('phone')} />
          {method === 'home' && <TextField id="co-line" aria-label="Địa chỉ" icon={MapPin} autoComplete="street-address" placeholder="Số nhà, đường, phường, quận, tỉnh/thành" value={address.line} onChange={setAddr('line')} />}
        </section>

        <section className="flex flex-col gap-2" role="radiogroup" aria-label="Hình thức giao hàng">
          <h2 className={h2}>Hình thức giao hàng</h2>
          <div className="grid grid-cols-2 gap-2">
            <Radio checked={method === 'home'} onSelect={() => setMethod('home')} icon={Truck} title="Giao tận nơi" desc="Đến địa chỉ của bạn" />
            <Radio checked={method === 'pickup'} onSelect={() => setMethod('pickup')} icon={Store} title="Nhận tại cửa hàng" desc={cfg.data?.store?.address || 'Nhanh hơn, miễn phí'} />
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className={h2}>Thời gian {method === 'home' ? 'giao hàng' : 'nhận hàng'}</h2>
          <label className={selectBox}>
            <CalendarDays size={20} className="shrink-0 text-subtle" aria-hidden="true" />
            <select aria-label="Ngày" value={date} onChange={(e) => setDate(e.target.value)} className="h-full min-w-0 flex-1 bg-transparent text-base font-semibold text-primary outline-none">
              {dates.map((d) => (
                <option key={d} value={d}>{longDate(d)}</option>
              ))}
            </select>
          </label>
          <label className={selectBox}>
            <Clock size={20} className="shrink-0 text-subtle" aria-hidden="true" />
            <select aria-label="Khung giờ" value={slot} onChange={(e) => setSlot(e.target.value)} className="h-full min-w-0 flex-1 bg-transparent text-base font-semibold text-primary outline-none">
              {SLOTS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
        </section>

        <section className="flex flex-col gap-2" role="radiogroup" aria-label="Phương thức thanh toán">
          <h2 className={h2}>Phương thức thanh toán</h2>
          <Radio checked={payment === 'cod'} onSelect={() => setPayment('cod')} icon={Banknote} title="Thanh toán khi nhận hàng" desc="Tiền mặt khi nhận hàng" />
          {cfg.data?.bank && <Radio checked={payment === 'bank'} onSelect={() => setPayment('bank')} icon={Landmark} title="Chuyển khoản ngân hàng" desc={`Quét mã VietQR • ${cfg.data.bank.bankId}`} />}
        </section>

        {quote ? (
          <section className="flex flex-col gap-2 rounded-xl bg-white p-4 shadow-card">
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted">Tạm tính ({cart.count} sản phẩm)</span>
              <b className="font-secondary tabular-nums text-primary">{money(quote.subtotal)}</b>
            </div>
            {quote.discount > 0 && (
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted">Giảm giá ({quote.coupon})</span>
                <b className="font-secondary tabular-nums text-brand-dark">−{money(quote.discount)}</b>
              </div>
            )}
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted">Phí giao hàng</span>
              <b className="font-secondary tabular-nums text-primary">{quote.shippingFee ? money(quote.shippingFee) : 'Miễn phí'}</b>
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-surface pt-2">
              <span className="text-base font-bold text-primary">Tổng cộng</span>
              <b className="font-secondary text-2xl tabular-nums text-brand-dark">{money(quote.total)}</b>
            </div>
            {memberDays > 0 && (
              <p className="mt-1 flex items-center gap-2 rounded-lg bg-brand-light px-4 py-2 text-sm text-brand-deep">
                <Gift size={16} className="shrink-0" aria-hidden="true" /> Đơn này cộng <b>{memberDays} ngày</b> dùng kế hoạch & nhắc nhở khi giao thành công.
              </p>
            )}
          </section>
        ) : (
          !error && <Skeleton h={140} />
        )}
        <ErrorNote error={error} />

        <BottomBar>
          <PrimaryButton loading={placing} disabled={!quote} onClick={place} className="w-full">
            Xác nhận đặt hàng {quote ? `• ${money(quote.total)}` : ''}
            <ChevronRight size={20} aria-hidden="true" />
          </PrimaryButton>
        </BottomBar>
      </main>
    </>
  );
}
