import { Link } from 'react-router-dom';
import { ChevronRight, Receipt } from 'lucide-react';
import { useApi } from '../../lib/useApi.js';
import { money, dateTime } from '../../lib/format.js';
import { TopBar, Skeleton, ErrorNote } from '../../components/ui.jsx';
import Nuti from '../../components/mascot/Nuti.jsx';
import { STATUS_LABEL, StatusBadge } from './OrderDetail.jsx';

export default function Orders() {
  const { data, error, loading } = useApi('/orders');
  return (
    <>
      <TopBar title="Đơn hàng của tôi" fallback="/me" />
      <main className="flex flex-col gap-4 px-4 pb-[calc(32px+var(--safe-b))] pt-2">
        {loading && <Skeleton h={300} />}
        <ErrorNote error={error} />
        {data?.orders.length === 0 && (
          <section className="flex flex-col items-center gap-4 rounded-xl bg-white px-6 py-8 text-center shadow-card">
            <Nuti mood="wave" size={96} />
            <div>
              <h2 className="text-base font-bold text-primary">Bạn chưa có đơn hàng nào</h2>
              <p className="text-sm text-muted">Sữa hạt tươi giao tận nhà, hoặc set nguyên liệu để tự làm.</p>
            </div>
            <Link to="/shop" className="inline-flex h-12 items-center rounded-full bg-brand-dark px-6 font-bold text-white">
              Mua sắm ngay
            </Link>
          </section>
        )}
        {data?.orders.map((o) => (
          <Link key={o._id} to={`/orders/${o._id}`} className="flex items-center gap-4 rounded-xl bg-white p-4 shadow-card transition active:scale-[0.99]">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-light text-brand-dark" aria-hidden="true">
              <Receipt size={20} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="flex items-center justify-between gap-2">
                <b className="truncate text-primary">{o.code}</b>
                <StatusBadge status={o.status}>{STATUS_LABEL[o.status]}</StatusBadge>
              </span>
              <span className="text-sm text-muted">
                {o.items.length} sản phẩm • {dateTime(o.createdAt)}
              </span>
              <b className="font-secondary tabular-nums text-brand-dark">{money(o.total)}</b>
            </span>
            <ChevronRight size={20} className="shrink-0 text-divider" aria-hidden="true" />
          </Link>
        ))}
      </main>
    </>
  );
}
