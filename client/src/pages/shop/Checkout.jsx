import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { User, Phone, MapPin, Truck, Store, CalendarDays, Clock, Banknote, Landmark, ChevronRight } from 'lucide-react';
import { api } from '../../lib/api.js';
import { useApi } from '../../lib/useApi.js';
import { money, today, addDays, longDate } from '../../lib/format.js';
import { useCart } from '../../context/CartContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { TopBar, Button, ErrorNote, Skeleton } from '../../components/ui.jsx';
import { COUPON_KEY } from './Cart.jsx';

const SLOTS = ['08:00 - 12:00', '13:00 - 17:00', '18:00 - 21:00'];

function Radio({ checked, onSelect, icon: Icon, title, desc }) {
  return (
    <button type="button" role="radio" aria-checked={checked} className="choice row-choice" onClick={onSelect}>
      <Icon size={22} />
      <span>{title}{desc && <span className="desc" style={{ display: 'block' }}>{desc}</span>}</span>
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

  useEffect(() => {
    if (!cart.items.length) return;
    api
      .post('/orders/quote', { items: cart.items, coupon, method })
      .then(setQuote)
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
      const { order } = await api.post('/orders', { items: cart.items, coupon, delivery: { method, date, slot }, address, payment });
      cart.clear();
      sessionStorage.removeItem(COUPON_KEY);
      setUser({ ...user, address });
      navigate(`/orders/${order._id}?new=1`, { replace: true });
    } catch (e) {
      setError(e.message);
      setPlacing(false);
    }
  };

  const setAddr = (k) => (e) => setAddress({ ...address, [k]: e.target.value });

  return (
    <>
      <TopBar title="Xác nhận đơn hàng" />
      <main className="page has-cta stack-lg">
        <section className="stack">
          <h2 className="title-sm">Thông tin nhận hàng</h2>
          <div className="input-wrap"><User size={20} /><input aria-label="Họ tên" autoComplete="name" placeholder="Họ tên" value={address.name} onChange={setAddr('name')} /></div>
          <div className="input-wrap"><Phone size={20} /><input aria-label="Số điện thoại" type="tel" autoComplete="tel" inputMode="tel" placeholder="Số điện thoại" value={address.phone} onChange={setAddr('phone')} /></div>
          {method === 'home' && (
            <div className="input-wrap"><MapPin size={20} /><input aria-label="Địa chỉ" autoComplete="street-address" placeholder="Số nhà, đường, phường, quận, tỉnh/thành" value={address.line} onChange={setAddr('line')} /></div>
          )}
        </section>

        <section className="stack" role="radiogroup" aria-label="Hình thức giao hàng">
          <h2 className="title-sm">Hình thức giao hàng</h2>
          <div className="grid-2">
            <Radio checked={method === 'home'} onSelect={() => setMethod('home')} icon={Truck} title="Giao hàng tận nơi" desc="Giao đến địa chỉ của bạn" />
            <Radio checked={method === 'pickup'} onSelect={() => setMethod('pickup')} icon={Store} title="Nhận tại cửa hàng" desc={cfg.data?.store?.address || 'Nhận nhanh hơn, miễn phí'} />
          </div>
        </section>

        <section className="stack">
          <h2 className="title-sm">Thời gian {method === 'home' ? 'giao hàng' : 'nhận hàng'}</h2>
          <div className="input-wrap">
            <CalendarDays size={20} />
            <select aria-label="Ngày" value={date} onChange={(e) => setDate(e.target.value)}>
              {dates.map((d) => <option key={d} value={d}>{longDate(d)}</option>)}
            </select>
          </div>
          <div className="input-wrap">
            <Clock size={20} />
            <select aria-label="Khung giờ" value={slot} onChange={(e) => setSlot(e.target.value)}>
              {SLOTS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
        </section>

        <section className="stack" role="radiogroup" aria-label="Phương thức thanh toán">
          <h2 className="title-sm">Phương thức thanh toán</h2>
          <Radio checked={payment === 'cod'} onSelect={() => setPayment('cod')} icon={Banknote} title="Thanh toán khi nhận hàng" desc="Thanh toán bằng tiền mặt khi nhận hàng" />
          {cfg.data?.bank && (
            <Radio checked={payment === 'bank'} onSelect={() => setPayment('bank')} icon={Landmark} title="Chuyển khoản ngân hàng" desc={`Quét mã VietQR • ${cfg.data.bank.bankId}`} />
          )}
        </section>

        {quote ? (
          <section className="card stack" style={{ gap: 8 }}>
            <div className="row-between"><span className="muted">Tạm tính ({cart.count} sản phẩm)</span><b className="tabular">{money(quote.subtotal)}</b></div>
            {quote.discount > 0 && <div className="row-between"><span className="muted">Giảm giá ({quote.coupon})</span><b className="tabular green">−{money(quote.discount)}</b></div>}
            <div className="row-between"><span className="muted">Phí giao hàng</span><b className="tabular">{quote.shippingFee ? money(quote.shippingFee) : 'Miễn phí'}</b></div>
            <div className="divider" />
            <div className="row-between"><span className="title-sm">Tổng cộng</span><b className="title-lg green tabular">{money(quote.total)}</b></div>
          </section>
        ) : (
          !error && <Skeleton h={140} />
        )}
        <ErrorNote error={error} />

        <div className="sticky-cta">
          <Button className="btn-primary btn-block" loading={placing} disabled={!quote} onClick={place}>
            Xác nhận đặt hàng <ChevronRight size={20} />
          </Button>
        </div>
      </main>
    </>
  );
}
