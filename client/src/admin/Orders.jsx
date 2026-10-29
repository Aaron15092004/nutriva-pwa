import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Save, Phone, Copy, Printer, ChevronRight, Ban, Wallet, ClipboardList, Check } from 'lucide-react';
import { api } from '../lib/api.js';
import { productTitle } from '@shared/nutrition.js';
import { useToast } from '../context/ToastContext.jsx';
import { Button, ErrorNote, Skeleton } from '../components/ui.jsx';
import { useAdminList, useDebounced, Drawer, Pager, Field, vnd, dt, ymd, plusDays } from './kit.jsx';

export const ORDER_STATUS = [
  { id: 'confirmed', label: 'Đã xác nhận', tone: 'blue' },
  { id: 'preparing', label: 'Đang chuẩn bị', tone: 'warn' },
  { id: 'shipping', label: 'Đang giao', tone: 'warn' },
  { id: 'done', label: 'Hoàn tất', tone: 'good' },
  { id: 'cancelled', label: 'Đã hủy', tone: 'gray' },
];
const FLOW = ['confirmed', 'preparing', 'shipping', 'done'];
// Nút bước tiếp theo trong đơn
const NEXT = { confirmed: ['preparing', 'Bắt đầu chuẩn bị'], preparing: ['shipping', 'Giao cho shipper'], shipping: ['done', 'Đã giao xong'] };
const PAY_STATUS = [
  { id: 'unpaid', label: 'Chưa thanh toán', tone: 'gray' },
  { id: 'paid', label: 'Đã thanh toán', tone: 'good' },
  { id: 'refunded', label: 'Đã hoàn tiền', tone: 'warn' },
];
const QUEUES = [
  { id: '', label: 'Tất cả' },
  { id: 'todo', label: 'Cần xử lý' },
  { id: 'shipping', label: 'Đang giao' },
  { id: 'bank', label: 'Chờ xác nhận chuyển khoản' },
  { id: 'today', label: 'Giao hôm nay' },
  { id: 'tomorrow', label: 'Giao ngày mai' },
];
const badge = (list, id) => {
  const s = list.find((x) => x.id === id);
  return <span className={`badge ${s?.tone}`}>{s?.label ?? id}</span>;
};
const itemName = (i) => `${productTitle(i)}${i.type === 'milk' ? ` (${i.sweetness === 'low' ? 'ít ngọt' : 'không đường'})` : ''}`;
const fmtDay = (d) => (d ? `${d.slice(8)}/${d.slice(5, 7)}` : '');

// Thanh tiến trình đơn: xác nhận → chuẩn bị → đang giao → hoàn tất
function Stepper({ status }) {
  const at = FLOW.indexOf(status);
  return (
    <ol className="grid grid-cols-4 gap-1" aria-label="Tiến trình đơn">
      {FLOW.map((s, i) => (
        <li key={s} className="flex flex-col gap-1">
          <span className={`h-1.5 rounded-full ${status === 'cancelled' ? 'bg-border' : i <= at ? 'bg-brand-main' : 'bg-surface'}`} />
          <span className={`text-xs ${i === at ? 'font-bold text-primary' : 'text-muted'}`}>{ORDER_STATUS.find((x) => x.id === s).label}</span>
        </li>
      ))}
    </ol>
  );
}

function OrderDrawer({ order: initial, onClose, onSaved }) {
  const toast = useToast();
  const [order, setOrder] = useState(initial);
  const [moves, setMoves] = useState(null);
  const [adminNote, setAdminNote] = useState(initial.adminNote ?? '');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    api.get(`/admin/orders/${initial._id}`).then((d) => { setOrder(d.item); setMoves(d.moves); }).catch(() => setMoves([]));
  }, [initial._id]);

  const patch = async (body, label) => {
    setBusy(label);
    setError('');
    try {
      const { item } = await api.patch(`/admin/orders/${order._id}`, body);
      setOrder(item);
      toast(body.status ? 'Đã cập nhật đơn — khách hàng được thông báo' : 'Đã lưu');
      onSaved(item);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  };
  const next = NEXT[order.status];
  const prev = FLOW[FLOW.indexOf(order.status) - 1];
  const cancel = () => window.confirm(`Hủy đơn ${order.code}? Hàng được trả lại kho${order.membershipDays ? ', ngày dùng app đã cộng sẽ bị thu hồi' : ''}.`) && patch({ status: 'cancelled' }, 'cancel');
  const copy = (t) => navigator.clipboard?.writeText(t).then(() => toast('Đã sao chép')).catch(() => {});
  const lotsOf = (productId) => (moves ?? []).filter((m) => m.type === 'sale' && String(m.product?._id ?? m.product) === String(productId)).flatMap((m) => m.lots ?? []);

  return (
    <Drawer
      open
      title={`Đơn ${order.code}`}
      onClose={onClose}
      footer={
        <>
          {order.status !== 'cancelled' && (
            <button className="btn btn-danger btn-sm" style={{ marginRight: 'auto' }} disabled={Boolean(busy)} onClick={cancel}><Ban size={16} /> Hủy đơn</button>
          )}
          <Link className="btn btn-soft btn-sm" to={`/admin/orders/print?id=${order._id}`} target="_blank"><Printer size={16} /> In phiếu giao</Link>
          {next && (
            <Button className="btn-primary btn-sm" loading={busy === 'next'} onClick={() => patch({ status: next[0] }, 'next')}>
              {next[1]} <ChevronRight size={16} />
            </Button>
          )}
        </>
      }
    >
      <section className="a-card stack" style={{ gap: 12 }}>
        <div className="row-between">
          {badge(ORDER_STATUS, order.status)}
          {prev && order.status !== 'done' && order.status !== 'cancelled' && (
            <button className="btn btn-ghost btn-xs" disabled={Boolean(busy)} onClick={() => patch({ status: prev }, 'back')}>↩ Lùi về “{ORDER_STATUS.find((x) => x.id === prev).label}”</button>
          )}
        </div>
        <Stepper status={order.status} />
      </section>

      <section className="a-card">
        <dl className="a-kv">
          <dt>Người nhận</dt>
          <dd>
            <b>{order.address?.name}</b> •{' '}
            <a className="inline-flex items-center gap-1 font-bold text-brand-dark" href={`tel:${order.address?.phone}`}><Phone size={13} /> {order.address?.phone}</a>
          </dd>
          <dt>Giao hàng</dt>
          <dd>
            {order.delivery.method === 'home' ? (
              <span className="inline-flex items-start gap-1">
                Tận nơi: {order.address?.line}
                <button className="icon-btn !size-7" aria-label="Sao chép địa chỉ" onClick={() => copy(`${order.address?.name} ${order.address?.phone} ${order.address?.line}`)}><Copy size={13} /></button>
              </span>
            ) : 'Nhận tại cửa hàng'}
            <br />
            <b>{order.delivery.date?.split('-').reverse().join('/')}</b> • {order.delivery.slot}
          </dd>
          <dt>Khách hàng</dt><dd>{order.user?.name} • {order.user?.email ?? 'đã xóa'}</dd>
          <dt>Nguồn</dt><dd>{order.source === 'subscription' ? 'Gói định kỳ' : 'Cửa hàng'} • đặt {dt(order.createdAt)}</dd>
          <dt>Gói thành viên</dt><dd>{order.membershipDays > 0 ? (order.membershipRevoked ? `Đã thu hồi ${order.membershipDays} ngày (đơn hủy / hoàn tiền)` : `Đã cộng ${order.membershipDays} ngày dùng app`) : 'Cộng ngày dùng app khi đơn “Đã thanh toán” hoặc “Hoàn tất”'}</dd>
        </dl>
      </section>

      <section className="a-card stack" style={{ gap: 8 }}>
        <h3 className="title-sm">Hàng cần soạn</h3>
        {order.items.map((i) => {
          const lots = lotsOf(i.product);
          return (
            <div key={`${i.slug}${i.sweetness}`} className="row-between small" style={{ alignItems: 'flex-start' }}>
              <span>
                <b>{i.qty} ×</b> {itemName(i)}
                {lots.length > 0 && (
                  <span className="xs muted block">
                    Lô: {lots.map((l) => `${l.lot?.code ?? '?'}${l.lot?.expiryDate ? ` (HSD ${fmtDay(l.lot.expiryDate)})` : ''} × ${l.qty}`).join(', ')}
                  </span>
                )}
              </span>
              <b className="tabular">{vnd(i.price * i.qty)}</b>
            </div>
          );
        })}
        <div className="divider" />
        <div className="row-between small"><span className="muted">Tạm tính</span><span className="tabular">{vnd(order.subtotal)}</span></div>
        {order.discount > 0 && <div className="row-between small"><span className="muted">Giảm ({order.coupon})</span><span className="tabular">−{vnd(order.discount)}</span></div>}
        <div className="row-between small"><span className="muted">Phí giao</span><span className="tabular">{vnd(order.shippingFee)}</span></div>
        <div className="row-between"><b>Tổng {order.payment === 'cod' ? 'thu khi giao (COD)' : '(chuyển khoản)'}</b><b className="tabular green">{vnd(order.total)}</b></div>
      </section>

      <section className="a-card stack" style={{ gap: 8 }}>
        <div className="row-between">
          <h3 className="title-sm">Thanh toán</h3>
          {badge(PAY_STATUS, order.paymentStatus)}
        </div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          {order.paymentStatus !== 'paid' && order.status !== 'cancelled' && (
            <Button className="btn-soft btn-sm" loading={busy === 'paid'} onClick={() => patch({ paymentStatus: 'paid' }, 'paid')}><Wallet size={16} /> Đã nhận {vnd(order.total)}</Button>
          )}
          {order.paymentStatus === 'paid' && (
            <button className="btn btn-ghost btn-sm" disabled={Boolean(busy)} onClick={() => window.confirm('Đánh dấu đã hoàn tiền? Ngày dùng app đã cộng sẽ bị thu hồi.') && patch({ paymentStatus: 'refunded' }, 'refund')}>Đánh dấu đã hoàn tiền</button>
          )}
        </div>
      </section>

      <Field label="Ghi chú nội bộ" full htmlFor="note" hint="Chỉ admin thấy — vd: khách hẹn giao sau 17h">
        <textarea id="note" className="a-textarea" maxLength={500} value={adminNote} onChange={(e) => setAdminNote(e.target.value)} />
      </Field>
      {adminNote !== (order.adminNote ?? '') && (
        <Button className="btn-soft btn-sm self-start" loading={busy === 'note'} onClick={() => patch({ adminNote }, 'note')}><Save size={16} /> Lưu ghi chú</Button>
      )}

      <section className="a-card">
        <h3 className="title-sm" style={{ marginBottom: 6 }}>Lịch sử</h3>
        {order.history.map((h, i) => (
          <div key={i} className="small row-between"><span>{badge(ORDER_STATUS, h.status)} <span className="muted">bởi {h.by ?? '—'}</span></span><span className="muted">{dt(h.at)}</span></div>
        ))}
      </section>
      <ErrorNote error={error} />
    </Drawer>
  );
}

// Soạn hàng theo ngày giao: tổng từng loại cần chuẩn bị (nấu / lấy kho) + in phiếu soạn & phiếu giao cả ngày
function PrepPanel() {
  const [date, setDate] = useState(plusDays(ymd(), 1));
  const [data, setData] = useState(null);
  useEffect(() => {
    setData(null);
    api.get(`/admin/orders/prep?date=${date}`).then(setData).catch(() => setData({ items: [], orders: [], totals: { orders: 0, units: 0 } }));
  }, [date]);
  return (
    <section className="a-card stack" style={{ gap: 12 }}>
      <div className="row-between" style={{ flexWrap: 'wrap', gap: 8 }}>
        <h2 className="title-sm inline-flex items-center gap-2"><ClipboardList size={18} /> Soạn hàng theo ngày giao</h2>
        <div className="row" style={{ gap: 8 }}>
          <div className="a-chips">
            {[[ymd(), 'Hôm nay'], [plusDays(ymd(), 1), 'Ngày mai']].map(([d, l]) => <button key={d} aria-pressed={date === d} onClick={() => setDate(d)}>{l}</button>)}
          </div>
          <input type="date" className="a-input" aria-label="Ngày giao" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
          <Link className={`btn btn-primary btn-sm ${data?.orders.length ? '' : 'pointer-events-none opacity-50'}`} to={`/admin/orders/print?date=${date}`} target="_blank"><Printer size={16} /> In phiếu soạn & giao</Link>
        </div>
      </div>
      {!data ? (
        <Skeleton h={120} />
      ) : data.items.length ? (
        <>
          <p className="small muted">{data.totals.orders} đơn ({data.totals.home} giao tận nơi) • tổng {data.totals.units} sản phẩm • gồm đơn đã xác nhận, đang chuẩn bị, đang giao</p>
          <table className="a-table">
            <thead><tr><th>Sản phẩm</th><th className="num">Số lượng</th><th className="num">Số đơn</th></tr></thead>
            <tbody>
              {data.items.map((l) => (
                <tr key={`${l.slug}|${l.sweetness}`} className="!cursor-default">
                  <td><b>{itemName(l)}</b></td>
                  <td className="num"><b className="text-lg">{l.qty}</b></td>
                  <td className="num">{l.orders}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <p className="small muted">Không có đơn nào giao ngày {fmtDay(date)}.</p>
      )}
    </section>
  );
}

export default function Orders() {
  const [q, setQ] = useState('');
  const [f, setF] = useState({ queue: 'todo', paymentStatus: '', source: '' });
  const [page, setPage] = useState(1);
  const search = useDebounced(q);
  const list = useAdminList('/admin/orders', { q: search, page, limit: 30, ...f });
  const [open, setOpen] = useState(null);
  const [prep, setPrep] = useState(false);
  const counts = list.data?.counts ?? {};
  const pick = (patch) => {
    setF({ ...f, ...patch });
    setPage(1);
  };

  return (
    <>
      <div className="admin-head">
        <h1>Đơn hàng</h1>
        <button className="btn btn-soft btn-sm" aria-pressed={prep} onClick={() => setPrep((v) => !v)}><ClipboardList size={16} /> {prep ? 'Ẩn soạn hàng' : 'Soạn hàng theo ngày'}</button>
      </div>
      {prep && <PrepPanel />}
      <div className="a-chips mb-2 mt-2" role="group" aria-label="Hàng chờ">
        {QUEUES.map((x) => (
          <button key={x.id} aria-pressed={f.queue === x.id} onClick={() => pick({ queue: x.id })}>
            {x.label}{x.id && counts[x.id] != null ? ` (${counts[x.id]})` : ''}
          </button>
        ))}
      </div>
      <div className="a-toolbar">
        <div className="input-wrap a-search" style={{ minHeight: 40 }}>
          <Search size={18} />
          <input aria-label="Tìm đơn" placeholder="Mã đơn, tên hoặc SĐT người nhận" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} style={{ height: 38, fontSize: 14, fontWeight: 500 }} />
        </div>
        <select className="a-select" aria-label="Thanh toán" value={f.paymentStatus} onChange={(e) => pick({ paymentStatus: e.target.value })}>
          <option value="">Thanh toán: tất cả</option>
          {PAY_STATUS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <select className="a-select" aria-label="Nguồn" value={f.source} onChange={(e) => pick({ source: e.target.value })}>
          <option value="">Nguồn: tất cả</option>
          <option value="shop">Cửa hàng</option>
          <option value="subscription">Gói định kỳ</option>
        </select>
      </div>
      <ErrorNote error={list.error} />
      <div className="a-table-wrap">
        <table className="a-table">
          <thead>
            <tr><th>Mã</th><th>Người nhận</th><th>Giao</th><th>Hàng</th><th className="num">Tổng</th><th>Thanh toán</th><th>Trạng thái</th></tr>
          </thead>
          <tbody>
            {list.items.map((o) => (
              <tr key={o._id} onClick={() => setOpen(o)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setOpen(o)}>
                <td><b>{o.code}</b><div className="xs muted">{o.source === 'subscription' ? 'Gói định kỳ' : dt(o.createdAt)}</div></td>
                <td>{o.address?.name}<div className="xs muted">{o.address?.phone}</div></td>
                <td className="small">
                  <b className={o.delivery?.date === list.data?.today ? 'text-warm-dark' : ''}>{o.delivery?.date === list.data?.today ? 'Hôm nay' : o.delivery?.date === list.data?.tomorrow ? 'Ngày mai' : fmtDay(o.delivery?.date)}</b>
                  <div className="xs muted">{o.delivery?.method === 'home' ? 'Tận nơi' : 'Tại cửa hàng'} • {o.delivery?.slot}</div>
                </td>
                <td className="small">{o.items.map((i) => `${i.qty}× ${i.type === 'diy' ? 'Gói ' : ''}${i.name}`).join(', ')}</td>
                <td className="num"><b>{vnd(o.total)}</b></td>
                <td>{badge(PAY_STATUS, o.paymentStatus)}<div className="xs muted">{o.payment === 'cod' ? 'COD' : 'Chuyển khoản'}</div></td>
                <td>{badge(ORDER_STATUS, o.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!list.loading && !list.items.length && (
          <div className="a-empty">
            {f.queue === 'todo' ? <span className="inline-flex items-center gap-2"><Check size={16} /> Không còn đơn nào cần xử lý</span> : 'Không có đơn hàng.'}
          </div>
        )}
      </div>
      <Pager page={page} limit={30} total={list.total} onPage={setPage} />
      {open && (
        <OrderDrawer
          key={open._id}
          order={open}
          onClose={() => setOpen(null)}
          onSaved={(item) => list.setItems((items) => items.map((x) => (x._id === item._id ? item : x)))}
        />
      )}
    </>
  );
}
