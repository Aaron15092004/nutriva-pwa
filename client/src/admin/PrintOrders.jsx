import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Printer } from 'lucide-react';
import { api } from '../lib/api.js';
import { productTitle } from '@shared/nutrition.js';

const vnd = (n) => `${Math.round(n ?? 0).toLocaleString('vi-VN')}đ`;
const day = (d) => (d ? `${d.slice(8)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : '');
const itemName = (i) => `${productTitle(i)}${i.type === 'milk' ? ` (${i.sweetness === 'low' ? 'ít ngọt' : 'không đường'})` : ''}`;

// Phiếu giao 1 đơn: người nhận, giờ giao, hàng, số tiền cần thu (COD)
function Slip({ o, store }) {
  const cod = o.payment === 'cod' && o.paymentStatus !== 'paid';
  return (
    <article className="slip mb-6 break-inside-avoid rounded-lg border border-border p-5 print:mb-0 print:rounded-none print:border-0 print:p-0">
      <header className="mb-4 flex items-start justify-between gap-4 border-b border-border pb-3">
        <div>
          <p className="text-xl font-extrabold text-brand-core">{store?.name || 'NUTRIVA'}</p>
          <p className="text-xs text-muted">{[store?.phone, store?.address].filter(Boolean).join(' • ')}</p>
        </div>
        <div className="text-right">
          <p className="font-mono text-lg font-bold">{o.code}</p>
          <p className="text-xs text-muted">Giao {day(o.delivery?.date)} • {o.delivery?.slot}</p>
        </div>
      </header>
      <dl className="mb-4 grid grid-cols-[120px_1fr] gap-y-1 text-sm">
        <dt className="text-muted">Người nhận</dt><dd className="font-bold">{o.address?.name} — {o.address?.phone}</dd>
        <dt className="text-muted">Giao tới</dt><dd>{o.delivery?.method === 'home' ? o.address?.line : 'Khách nhận tại cửa hàng'}</dd>
        {o.adminNote && (<><dt className="text-muted">Ghi chú</dt><dd>{o.adminNote}</dd></>)}
      </dl>
      <table className="w-full text-sm">
        <thead><tr className="border-b border-border text-left text-xs uppercase text-muted"><th className="py-1">✓</th><th>Sản phẩm</th><th className="text-right">SL</th><th className="text-right">Thành tiền</th></tr></thead>
        <tbody>
          {o.items.map((i) => (
            <tr key={`${i.slug}${i.sweetness}`} className="border-b border-surface">
              <td className="py-2"><span className="inline-block size-4 rounded border border-primary" /></td>
              <td>{itemName(i)}</td>
              <td className="text-right font-bold">{i.qty}</td>
              <td className="text-right">{vnd(i.price * i.qty)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex items-end justify-between gap-4">
        <p className="text-xs text-muted">Tạm tính {vnd(o.subtotal)}{o.discount ? ` • giảm ${vnd(o.discount)}` : ''} • phí giao {vnd(o.shippingFee)}</p>
        <p className={`rounded-lg px-4 py-2 text-right ${cod ? 'bg-warning' : 'bg-brand-light'}`}>
          <span className="block text-xs font-bold uppercase">{cod ? 'Thu khi giao (COD)' : o.paymentStatus === 'paid' ? 'Đã thanh toán' : 'Chuyển khoản — chưa xác nhận'}</span>
          <span className="text-xl font-extrabold">{cod ? vnd(o.total) : vnd(0)}</span>
        </p>
      </div>
    </article>
  );
}

// /admin/orders/print?id=… (1 đơn) hoặc ?date=YYYY-MM-DD (phiếu soạn tổng + phiếu giao từng đơn trong ngày)
export default function PrintOrders() {
  const [params] = useSearchParams();
  const id = params.get('id');
  const date = params.get('date');
  const [state, setState] = useState({ loading: true });
  useEffect(() => {
    (async () => {
      try {
        const store = (await api.get('/admin/settings')).item?.store;
        if (id) setState({ orders: [(await api.get(`/admin/orders/${id}`)).item], store });
        else setState({ ...(await api.get(`/admin/orders/prep?date=${date ?? ''}`)), store });
      } catch (e) {
        setState({ error: e.message });
      }
    })();
  }, [id, date]);
  useEffect(() => {
    document.title = id ? 'In phiếu giao' : `Phiếu soạn hàng ${day(state.date)}`;
  }, [id, state.date]);

  if (state.loading) return <p className="p-8 text-sm text-muted">Đang chuẩn bị phiếu…</p>;
  if (state.error) return <p className="p-8 text-sm text-warm-dark">{state.error}</p>;
  return (
    <main className="mx-auto min-h-dvh max-w-3xl bg-white p-6 print:max-w-none print:p-0">
      <div className="mb-4 flex items-center justify-between gap-4 print:hidden">
        <p className="text-sm text-muted">{state.orders.length} phiếu giao{state.items ? ` • ngày ${day(state.date)}` : ''} — mỗi phiếu in trên 1 trang A4</p>
        <button type="button" onClick={() => window.print()} className="inline-flex h-11 items-center gap-2 rounded-full bg-brand-dark px-6 font-bold text-white">
          <Printer size={18} aria-hidden="true" /> In
        </button>
      </div>
      {state.items && (
        <section className="slip mb-6 rounded-lg border border-border p-5 print:mb-0 print:rounded-none print:border-0 print:p-0">
          <h1 className="mb-1 text-2xl font-extrabold text-brand-core">Phiếu soạn hàng — giao {day(state.date)}</h1>
          <p className="mb-4 text-sm text-muted">{state.totals.orders} đơn • {state.totals.units} sản phẩm</p>
          <table className="w-full text-base">
            <thead><tr className="border-b-2 border-primary text-left text-xs uppercase text-muted"><th className="py-2">Sản phẩm</th><th className="text-right">Số lượng</th><th className="text-right">Số đơn</th><th className="text-right">Đã soạn</th></tr></thead>
            <tbody>
              {state.items.map((l) => (
                <tr key={`${l.slug}|${l.sweetness}`} className="border-b border-border">
                  <td className="py-3 font-bold">{itemName(l)}</td>
                  <td className="text-right text-2xl font-extrabold">{l.qty}</td>
                  <td className="text-right">{l.orders}</td>
                  <td className="text-right"><span className="inline-block h-6 w-16 rounded border border-primary" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      {state.orders.map((o) => <Slip key={o._id} o={o} store={state.store} />)}
    </main>
  );
}
