import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Copy, Check, Package, Truck, CircleCheckBig, CalendarDays, Headphones, RotateCcw, XCircle, Landmark } from 'lucide-react';
import { useApi } from '../../lib/useApi.js';
import { api } from '../../lib/api.js';
import { money, dateTime, longDate } from '../../lib/format.js';
import { useCart } from '../../context/CartContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { TopBar, Skeleton, ErrorNote } from '../../components/ui.jsx';
import { PrimaryButton } from '../../components/ds/form.jsx';
import { cx } from '../../components/ds/index.jsx';
import ProductImage from '../../components/ProductImage.jsx';
import { productTitle } from '@shared/nutrition.js';

const STEPS = [
  { id: 'confirmed', label: 'Đã xác nhận', icon: Check },
  { id: 'preparing', label: 'Đang chuẩn bị', icon: Package },
  { id: 'shipping', label: 'Đang giao', icon: Truck },
  { id: 'done', label: 'Hoàn tất', icon: CircleCheckBig },
];

export const STATUS_LABEL = { confirmed: 'Đã xác nhận', preparing: 'Đang chuẩn bị', shipping: 'Đang giao', done: 'Hoàn tất', cancelled: 'Đã hủy' };
const TONE = {
  confirmed: 'bg-info text-dinner-hint',
  preparing: 'bg-warning text-snacks-hint',
  shipping: 'bg-warning text-snacks-hint',
  done: 'bg-brand-light text-brand-deep',
  cancelled: 'bg-surface text-muted',
  paid: 'bg-brand-light text-brand-deep',
  muted: 'bg-surface text-muted',
};
export function StatusBadge({ status, children }) {
  return <span className={cx('shrink-0 whitespace-nowrap rounded-full px-2 py-1 text-xs font-semibold', TONE[status] ?? TONE.muted)}>{children}</span>;
}

const Row = ({ label, children }) => (
  <div className="flex min-h-8 items-center justify-between gap-4">
    <span className="text-sm text-muted">{label}</span>
    {children}
  </div>
);
const card = 'rounded-xl bg-white p-4 shadow-card';

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
  const [cancelling, setCancelling] = useState(false);
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
    setCancelling(true);
    try {
      setData(await api.post(`/orders/${id}/cancel`));
      toast('Đã hủy đơn hàng');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setCancelling(false);
    }
  };

  const stepIdx = o ? STEPS.findIndex((s) => s.id === o.status) : -1;
  const payLabel = o?.paymentStatus === 'paid' ? 'Đã thanh toán' : o?.paymentStatus === 'refunded' ? 'Đã hoàn tiền' : 'Chưa thanh toán';

  return (
    <>
      <TopBar title="Chi tiết đơn hàng" fallback="/orders" onBack={isNew ? () => navigate('/shop') : undefined} />
      <main className="flex flex-col gap-6 px-4 pb-[calc(32px+var(--safe-b))] pt-2">
        {loading && <Skeleton h={480} />}
        <ErrorNote error={error} />
        {o && (
          <>
            {isNew && (
              <section className="flex flex-col items-center gap-2 rounded-xl bg-gradient-to-b from-brand-light to-white p-6 text-center shadow-card">
                <CheckCircle2 size={56} className="text-brand-dark" aria-hidden="true" />
                <h2 className="font-display text-2xl font-bold text-brand-core [font-variation-settings:'SOFT'_100]">Đặt hàng thành công!</h2>
                <p className="text-sm text-muted">Cảm ơn bạn đã chọn NUTRIVA.</p>
              </section>
            )}

            <section className={cx(card, 'flex flex-col gap-1')}>
              <Row label="Mã đơn hàng">
                <button type="button" className="inline-flex min-h-11 items-center gap-2 font-bold text-primary" onClick={copy} aria-label={`Sao chép mã đơn ${o.code}`}>
                  {o.code} {copied ? <Check size={16} className="text-brand-dark" aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
                </button>
              </Row>
              <Row label="Tổng tiền">
                <b className="font-secondary text-lg tabular-nums text-primary">{money(o.total)}</b>
              </Row>
              <Row label="Ngày đặt hàng">
                <span className="text-sm text-secondary">{dateTime(o.createdAt)}</span>
              </Row>
              <Row label="Thanh toán">
                <span className="flex items-center gap-2 text-sm text-secondary">
                  {o.payment === 'cod' ? 'Khi nhận hàng' : 'Chuyển khoản'}
                  <StatusBadge status={o.paymentStatus === 'paid' ? 'paid' : 'muted'}>{payLabel}</StatusBadge>
                </span>
              </Row>
              {o.source === 'subscription' && (
                <Row label="Nguồn">
                  <StatusBadge status="confirmed">Gói định kỳ</StatusBadge>
                </Row>
              )}
            </section>

            {o.payment === 'bank' && o.status !== 'cancelled' && o.paymentStatus !== 'paid' && bank && (
              <section className={cx(card, 'flex flex-col items-center gap-4 text-center')}>
                <h2 className="flex items-center gap-2 text-base font-bold text-primary">
                  <Landmark size={20} className="text-brand-main" aria-hidden="true" /> Chuyển khoản để hoàn tất
                </h2>
                <img
                  src={`https://img.vietqr.io/image/${encodeURIComponent(bank.bankId)}-${encodeURIComponent(bank.accountNo)}-compact2.png?amount=${o.total}&addInfo=${encodeURIComponent(o.code)}&accountName=${encodeURIComponent(bank.accountName)}`}
                  alt={`Mã QR chuyển khoản ${money(o.total)} cho đơn ${o.code}`}
                  width="240"
                  height="280"
                  className="h-auto w-60 max-w-full rounded-lg bg-white"
                />
                <div className="text-sm text-secondary">
                  <p>
                    {bank.bankId} • <b>{bank.accountNo}</b>
                  </p>
                  <p>{bank.accountName}</p>
                  <p>
                    Số tiền: <b>{money(o.total)}</b> • Nội dung: <b>{o.code}</b>
                  </p>
                </div>
                <p className="text-xs text-muted">Đơn sẽ được xác nhận đã thanh toán sau khi NUTRIVA kiểm tra giao dịch.</p>
              </section>
            )}

            <section className={cx(card, 'flex flex-col gap-4')}>
              <h2 className="text-base font-bold text-primary">Trạng thái đơn hàng</h2>
              {o.status === 'cancelled' ? (
                <p className="flex items-center gap-2 rounded-lg bg-error px-4 py-3 text-sm font-semibold text-warm-dark">
                  <XCircle size={18} aria-hidden="true" /> Đơn hàng đã được hủy.
                </p>
              ) : (
                <ol className="grid grid-cols-4 gap-1">
                  {STEPS.map((s, i) => {
                    const reached = i <= stepIdx;
                    const at = o.history.find((h) => h.status === s.id)?.at;
                    return (
                      <li key={s.id} className="flex flex-col items-center gap-1 text-center" aria-current={i === stepIdx ? 'step' : undefined}>
                        <span className={cx('grid size-10 place-items-center rounded-full', reached ? 'bg-brand-dark text-white' : 'bg-surface text-subtle', i === stepIdx && 'ring-4 ring-brand-soft')} aria-hidden="true">
                          <s.icon size={18} />
                        </span>
                        <span className={cx('text-xs', reached ? 'font-bold text-brand-deep' : 'font-medium text-muted')}>{s.label}</span>
                        {at && <span className="text-xs text-muted">{dateTime(at).split(' ')[0]}</span>}
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>

            <section className="flex items-start gap-4 rounded-xl border border-border bg-brand-light p-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white text-brand-dark" aria-hidden="true">
                <CalendarDays size={22} />
              </span>
              <div className="min-w-0">
                <p className="text-sm text-muted">{o.delivery.method === 'home' ? 'Dự kiến giao hàng' : 'Nhận tại cửa hàng'}</p>
                <b className="text-primary">{longDate(o.delivery.date)}</b>
                <p className="text-sm text-secondary">{o.delivery.slot}</p>
                {o.delivery.method === 'home' && (
                  <p className="text-xs text-muted">
                    {o.address.name} • {o.address.phone} • {o.address.line}
                  </p>
                )}
              </div>
            </section>

            <section className="flex flex-col gap-2">
              <h2 className="text-base font-bold text-primary">Sản phẩm trong đơn hàng</h2>
              {o.items.map((i) => (
                <div key={`${i.slug}${i.sweetness}`} className={cx(card, 'flex items-center gap-4')}>
                  <ProductImage product={i} className="w-14 shrink-0 rounded-lg" />
                  <div className="min-w-0 flex-1">
                    <b className="block text-sm text-primary">
                      {productTitle(i)}
                    </b>
                    <span className="text-xs text-muted">{i.size}</span>
                  </div>
                  <span className="text-sm text-muted">×{i.qty}</span>
                  <b className="font-secondary text-sm tabular-nums text-primary">{money(i.price * i.qty)}</b>
                </div>
              ))}
              <div className={cx(card, 'flex flex-col gap-1 text-sm')}>
                <Row label="Tạm tính">
                  <span className="font-secondary tabular-nums">{money(o.subtotal)}</span>
                </Row>
                {o.discount > 0 && (
                  <Row label="Giảm giá">
                    <span className="font-secondary tabular-nums text-brand-dark">−{money(o.discount)}</span>
                  </Row>
                )}
                <Row label="Phí giao hàng">
                  <span className="font-secondary tabular-nums">{o.shippingFee ? money(o.shippingFee) : 'Miễn phí'}</span>
                </Row>
                <div className="flex items-center justify-between border-t border-surface pt-2">
                  <b className="text-primary">Tổng cộng</b>
                  <b className="font-secondary tabular-nums text-brand-dark">{money(o.total)}</b>
                </div>
              </div>
            </section>

            <div className="grid grid-cols-2 gap-2">
              <Link to="/me/support" className="inline-flex h-14 items-center justify-center gap-2 rounded-full border-2 border-brand-dark bg-white px-4 font-bold text-brand-dark">
                <Headphones size={18} aria-hidden="true" /> Hỗ trợ
              </Link>
              <PrimaryButton onClick={rebuy}>
                <RotateCcw size={18} aria-hidden="true" /> Mua lại
              </PrimaryButton>
            </div>
            {o.status === 'confirmed' && (
              <PrimaryButton variant="soft" loading={cancelling} onClick={cancel} className="w-full !text-warm-dark">
                <XCircle size={18} aria-hidden="true" /> Hủy đơn hàng
              </PrimaryButton>
            )}
          </>
        )}
      </main>
    </>
  );
}
