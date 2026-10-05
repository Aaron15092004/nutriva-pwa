import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Copy, Check, Package, Truck, CircleCheckBig, CalendarDays, Headphones, RotateCcw, XCircle, Landmark } from 'lucide-react';
import { useApi } from '../../lib/useApi.js';
import { api } from '../../lib/api.js';
import { money, dateTime, longDate } from '../../lib/format.js';
import { useCart } from '../../context/CartContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { TopBar, Skeleton, ErrorNote } from '../../components/ui.jsx';
import ProductImage from '../../components/ProductImage.jsx';

const STEPS = [
  { id: 'confirmed', label: 'Đã xác nhận', icon: Check },
  { id: 'preparing', label: 'Đang chuẩn bị', icon: Package },
  { id: 'shipping', label: 'Đang giao', icon: Truck },
  { id: 'done', label: 'Hoàn tất', icon: CircleCheckBig },
];

export const STATUS_LABEL = { confirmed: 'Đã xác nhận', preparing: 'Đang chuẩn bị', shipping: 'Đang giao', done: 'Hoàn tất', cancelled: 'Đã hủy' };

export default function OrderDetail() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const isNew = params.get('new') === '1';
  const navigate = useNavigate();
  const cart = useCart();
  const toast = useToast();
  const { data, error, loading, setData } = useApi(`/orders/${id}`);
  const cfg = useApi('/shop/config');
  const bank = cfg.data?.bank;
  const [copied, setCopied] = useState(false);
  const o = data?.order;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(o.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard bị chặn */
    }
  };

  const rebuy = () => {
    o.items.forEach((i) => cart.add(i, i.qty, i.sweetness));
    navigate('/cart');
  };

  const cancel = async () => {
    if (!window.confirm('Bạn chắc chắn muốn hủy đơn hàng này?')) return;
    try {
      setData(await api.post(`/orders/${id}/cancel`));
      toast('Đã hủy đơn hàng');
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const stepIdx = o ? STEPS.findIndex((s) => s.id === o.status) : -1;

  return (
    <>
      <TopBar title="Chi tiết đơn hàng" onBack={isNew ? () => navigate('/shop') : undefined} />
      <main className="page no-nav stack-lg">
        {loading && <Skeleton h={480} />}
        <ErrorNote error={error} />
        {o && (
          <>
            {isNew && (
              <section className="card center stack" style={{ alignItems: 'center', background: 'linear-gradient(160deg, var(--green-50), #fff)' }}>
                <CheckCircle2 size={56} color="var(--primary)" />
                <h2 className="title-lg">Đặt hàng thành công!</h2>
                <p className="muted small">Cảm ơn bạn đã chọn NUTRIVA.</p>
              </section>
            )}

            <section className="card stack" style={{ gap: 6 }}>
              <div className="row-between">
                <span className="muted small">Mã đơn hàng</span>
                <button className="row strong" onClick={copy} style={{ border: 0, background: 'none', gap: 6, minHeight: 44 }} aria-label="Sao chép mã đơn">
                  {o.code} {copied ? <Check size={16} color="var(--primary)" /> : <Copy size={16} />}
                </button>
              </div>
              <div className="row-between"><span className="muted small">Tổng tiền</span><b className="title-md tabular">{money(o.total)}</b></div>
              <div className="row-between"><span className="muted small">Ngày đặt hàng</span><span className="small">{dateTime(o.createdAt)}</span></div>
              <div className="row-between">
                <span className="muted small">Thanh toán</span>
                <span className="small row" style={{ gap: 6 }}>
                  {o.payment === 'cod' ? 'Khi nhận hàng' : 'Chuyển khoản'}
                  <span className={`badge ${o.paymentStatus === 'paid' ? 'good' : 'gray'}`}>{o.paymentStatus === 'paid' ? 'Đã thanh toán' : o.paymentStatus === 'refunded' ? 'Đã hoàn tiền' : 'Chưa thanh toán'}</span>
                </span>
              </div>
              {o.source === 'subscription' && <div className="row-between"><span className="muted small">Nguồn</span><span className="badge blue">Gói định kỳ</span></div>}
            </section>

            {o.payment === 'bank' && o.status !== 'cancelled' && o.paymentStatus !== 'paid' && bank && (
              <section className="card stack" style={{ alignItems: 'center', textAlign: 'center' }}>
                <h2 className="title-sm row" style={{ gap: 6 }}><Landmark size={20} color="var(--primary-600)" /> Chuyển khoản để hoàn tất</h2>
                <img
                  src={`https://img.vietqr.io/image/${encodeURIComponent(bank.bankId)}-${encodeURIComponent(bank.accountNo)}-compact2.png?amount=${o.total}&addInfo=${encodeURIComponent(o.code)}&accountName=${encodeURIComponent(bank.accountName)}`}
                  alt={`Mã QR chuyển khoản ${money(o.total)} cho đơn ${o.code}`}
                  width="240"
                  height="280"
                  style={{ width: 240, maxWidth: '100%', height: 'auto', borderRadius: 12, background: '#fff' }}
                />
                <div className="small">
                  <div>{bank.bankId} • <b>{bank.accountNo}</b></div>
                  <div>{bank.accountName}</div>
                  <div>Số tiền: <b>{money(o.total)}</b> • Nội dung: <b>{o.code}</b></div>
                </div>
                <p className="xs muted">Đơn sẽ được xác nhận đã thanh toán sau khi NUTRIVA kiểm tra giao dịch.</p>
              </section>
            )}

            <section className="card stack">
              <h2 className="title-sm">Trạng thái đơn hàng</h2>
              {o.status === 'cancelled' ? (
                <div className="notice danger"><XCircle size={18} /> Đơn hàng đã được hủy.</div>
              ) : (
                <ol className="grid-4" style={{ listStyle: 'none', margin: 0, padding: 0, position: 'relative' }}>
                  {STEPS.map((s, i) => {
                    const reached = i <= stepIdx;
                    const at = o.history.find((h) => h.status === s.id)?.at;
                    return (
                      <li key={s.id} className="center stack" style={{ gap: 4, alignItems: 'center' }} aria-current={i === stepIdx ? 'step' : undefined}>
                        <span style={{ width: 40, height: 40, borderRadius: 99, display: 'grid', placeItems: 'center', background: reached ? 'var(--primary)' : '#eff3f0', color: reached ? '#fff' : 'var(--subtle)', boxShadow: i === stepIdx ? '0 0 0 4px var(--green-100)' : 'none' }}>
                          <s.icon size={18} />
                        </span>
                        <span className="xs" style={{ fontWeight: reached ? 700 : 500, color: reached ? 'var(--green-800)' : 'var(--muted)' }}>{s.label}</span>
                        {at && <span className="xs muted">{dateTime(at).split(' ')[0]}</span>}
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>

            <section className="card tint row">
              <span className="icon-tile"><CalendarDays size={22} /></span>
              <div>
                <div className="small muted">{o.delivery.method === 'home' ? 'Dự kiến giao hàng' : 'Nhận tại cửa hàng'}</div>
                <b>{longDate(o.delivery.date)}</b>
                <div className="small">{o.delivery.slot}</div>
                {o.delivery.method === 'home' && <div className="xs muted">{o.address.name} • {o.address.phone} • {o.address.line}</div>}
              </div>
            </section>

            <section className="stack">
              <h2 className="title-sm">Sản phẩm trong đơn hàng</h2>
              {o.items.map((i) => (
                <div key={`${i.slug}${i.sweetness}`} className="card row">
                  <ProductImage product={i} style={{ width: 56, borderRadius: 12, flex: 'none' }} />
                  <div className="grow">
                    <b style={{ fontSize: 14 }}>{i.type === 'diy' ? 'Set tự làm ' : 'Sữa hạt '}{i.name}</b>
                    <div className="xs muted">{i.size}</div>
                  </div>
                  <span className="small muted">×{i.qty}</span>
                  <b className="tabular small">{money(i.price * i.qty)}</b>
                </div>
              ))}
              <div className="card stack" style={{ gap: 6 }}>
                <div className="row-between small"><span className="muted">Tạm tính</span><span className="tabular">{money(o.subtotal)}</span></div>
                {o.discount > 0 && <div className="row-between small"><span className="muted">Giảm giá</span><span className="tabular green">−{money(o.discount)}</span></div>}
                <div className="row-between small"><span className="muted">Phí giao hàng</span><span className="tabular">{o.shippingFee ? money(o.shippingFee) : 'Miễn phí'}</span></div>
                <div className="row-between"><b>Tổng cộng</b><b className="green tabular">{money(o.total)}</b></div>
              </div>
            </section>

            <div className="grid-2">
              <Link to="/me/support" className="btn btn-outline"><Headphones size={18} /> Liên hệ hỗ trợ</Link>
              <button className="btn btn-primary" onClick={rebuy}><RotateCcw size={18} /> Mua lại</button>
            </div>
            {o.status === 'confirmed' && (
              <button className="btn btn-danger" onClick={cancel}><XCircle size={18} /> Hủy đơn hàng</button>
            )}
          </>
        )}
      </main>
    </>
  );
}
