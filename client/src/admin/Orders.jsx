import { useState } from 'react';
import { Search, Save } from 'lucide-react';
import { api } from '../lib/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { Button, ErrorNote } from '../components/ui.jsx';
import { useAdminList, useDebounced, Drawer, Pager, Field, vnd, dt } from './kit.jsx';

export const ORDER_STATUS = [
  { id: 'confirmed', label: 'Đã xác nhận', tone: 'blue' },
  { id: 'preparing', label: 'Đang chuẩn bị', tone: 'warn' },
  { id: 'shipping', label: 'Đang giao', tone: 'warn' },
  { id: 'done', label: 'Hoàn tất', tone: 'good' },
  { id: 'cancelled', label: 'Đã hủy', tone: 'gray' },
];
const PAY_STATUS = [
  { id: 'unpaid', label: 'Chưa thanh toán', tone: 'gray' },
  { id: 'paid', label: 'Đã thanh toán', tone: 'good' },
  { id: 'refunded', label: 'Đã hoàn tiền', tone: 'warn' },
];
const badge = (list, id) => {
  const s = list.find((x) => x.id === id);
  return <span className={`badge ${s?.tone}`}>{s?.label ?? id}</span>;
};

function OrderDrawer({ order, onClose, onSaved }) {
  const toast = useToast();
  const [status, setStatus] = useState(order.status);
  const [paymentStatus, setPaymentStatus] = useState(order.paymentStatus);
  const [adminNote, setAdminNote] = useState(order.adminNote ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    if (status === 'cancelled' && order.status !== 'cancelled' && !window.confirm('Hủy đơn này? Tồn kho sẽ được hoàn lại.')) return;
    setSaving(true);
    setError('');
    try {
      const { item } = await api.patch(`/admin/orders/${order._id}`, { status, paymentStatus, adminNote });
      toast('Đã cập nhật đơn — khách hàng được thông báo');
      onSaved(item);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      open
      title={`Đơn ${order.code}`}
      onClose={onClose}
      footer={<><button className="btn btn-ghost btn-sm" onClick={onClose}>Đóng</button><Button className="btn-primary btn-sm" loading={saving} onClick={save}><Save size={16} /> Lưu</Button></>}
    >
      <section className="a-card">
        <dl className="a-kv">
          <dt>Khách hàng</dt><dd>{order.user?.name} • {order.user?.email ?? 'đã xóa'}</dd>
          <dt>Người nhận</dt><dd>{order.address?.name} • {order.address?.phone}</dd>
          <dt>Giao hàng</dt><dd>{order.delivery.method === 'home' ? `Tận nơi: ${order.address?.line}` : 'Nhận tại cửa hàng'}<br />{order.delivery.date} • {order.delivery.slot}</dd>
          <dt>Thanh toán</dt><dd>{order.payment === 'cod' ? 'Khi nhận hàng (COD)' : 'Chuyển khoản'}</dd>
          <dt>Nguồn</dt><dd>{order.source === 'subscription' ? 'Gói định kỳ' : 'Cửa hàng'}</dd>
          <dt>Đặt lúc</dt><dd>{dt(order.createdAt)}</dd>
        </dl>
      </section>
      <section className="a-card stack" style={{ gap: 6 }}>
        {order.items.map((i) => (
          <div key={`${i.slug}${i.sweetness}`} className="row-between small">
            <span>{i.type === 'diy' ? 'Set ' : 'Sữa '}{i.name}{i.type === 'milk' ? ` (${i.sweetness === 'low' ? 'ít ngọt' : 'không đường'})` : ''} × {i.qty}</span>
            <b className="tabular">{vnd(i.price * i.qty)}</b>
          </div>
        ))}
        <div className="divider" />
        <div className="row-between small"><span className="muted">Tạm tính</span><span className="tabular">{vnd(order.subtotal)}</span></div>
        {order.discount > 0 && <div className="row-between small"><span className="muted">Giảm ({order.coupon})</span><span className="tabular">−{vnd(order.discount)}</span></div>}
        <div className="row-between small"><span className="muted">Phí giao</span><span className="tabular">{vnd(order.shippingFee)}</span></div>
        <div className="row-between"><b>Tổng</b><b className="tabular green">{vnd(order.total)}</b></div>
      </section>
      <div className="a-form">
        <Field label="Trạng thái đơn" htmlFor="st">
          <select id="st" className="a-select" value={status} disabled={order.status === 'cancelled'} onChange={(e) => setStatus(e.target.value)}>
            {ORDER_STATUS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </Field>
        <Field label="Thanh toán" htmlFor="ps">
          <select id="ps" className="a-select" value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}>
            {PAY_STATUS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </Field>
        <Field label="Ghi chú nội bộ" full htmlFor="note">
          <textarea id="note" className="a-textarea" value={adminNote} onChange={(e) => setAdminNote(e.target.value)} />
        </Field>
      </div>
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

export default function Orders() {
  const [q, setQ] = useState('');
  const [f, setF] = useState({ status: '', paymentStatus: '', source: '' });
  const [page, setPage] = useState(1);
  const search = useDebounced(q);
  const list = useAdminList('/admin/orders', { q: search, page, limit: 30, ...f });
  const [open, setOpen] = useState(null);

  return (
    <>
      <div className="admin-head"><h1>Đơn hàng</h1></div>
      <div className="a-toolbar">
        <div className="input-wrap a-search" style={{ minHeight: 40 }}>
          <Search size={18} />
          <input aria-label="Tìm đơn" placeholder="Mã đơn, tên hoặc SĐT người nhận" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} style={{ height: 38, fontSize: 14, fontWeight: 500 }} />
        </div>
        <select className="a-select" aria-label="Trạng thái" value={f.status} onChange={(e) => { setF({ ...f, status: e.target.value }); setPage(1); }}>
          <option value="">Trạng thái: tất cả</option>
          {ORDER_STATUS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <select className="a-select" aria-label="Thanh toán" value={f.paymentStatus} onChange={(e) => { setF({ ...f, paymentStatus: e.target.value }); setPage(1); }}>
          <option value="">Thanh toán: tất cả</option>
          {PAY_STATUS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <select className="a-select" aria-label="Nguồn" value={f.source} onChange={(e) => { setF({ ...f, source: e.target.value }); setPage(1); }}>
          <option value="">Nguồn: tất cả</option>
          <option value="shop">Cửa hàng</option>
          <option value="subscription">Gói định kỳ</option>
        </select>
      </div>
      <ErrorNote error={list.error} />
      <div className="a-table-wrap">
        <table className="a-table">
          <thead>
            <tr><th>Mã</th><th>Khách</th><th>Giao</th><th className="num">Tổng</th><th>Thanh toán</th><th>Trạng thái</th><th>Đặt lúc</th></tr>
          </thead>
          <tbody>
            {list.items.map((o) => (
              <tr key={o._id} onClick={() => setOpen(o)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setOpen(o)}>
                <td><b>{o.code}</b>{o.source === 'subscription' && <div className="xs muted">Gói định kỳ</div>}</td>
                <td>{o.address?.name}<div className="xs muted">{o.address?.phone}</div></td>
                <td className="small">{o.delivery?.date}<div className="xs muted">{o.delivery?.method === 'home' ? 'Tận nơi' : 'Tại cửa hàng'}</div></td>
                <td className="num"><b>{vnd(o.total)}</b></td>
                <td>{badge(PAY_STATUS, o.paymentStatus)}<div className="xs muted">{o.payment === 'cod' ? 'COD' : 'Chuyển khoản'}</div></td>
                <td>{badge(ORDER_STATUS, o.status)}</td>
                <td className="small muted">{dt(o.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!list.loading && !list.items.length && <div className="a-empty">Không có đơn hàng.</div>}
      </div>
      <Pager page={page} limit={30} total={list.total} onPage={setPage} />
      {open && (
        <OrderDrawer
          key={open._id}
          order={open}
          onClose={() => setOpen(null)}
          onSaved={(item) => {
            list.setItems((items) => items.map((x) => (x._id === item._id ? item : x)));
            setOpen(null);
          }}
        />
      )}
    </>
  );
}
