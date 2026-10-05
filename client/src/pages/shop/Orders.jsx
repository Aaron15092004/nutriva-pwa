import { Link } from 'react-router-dom';
import { ChevronRight, Receipt } from 'lucide-react';
import { useApi } from '../../lib/useApi.js';
import { money, dateTime } from '../../lib/format.js';
import { TopBar, Skeleton, ErrorNote } from '../../components/ui.jsx';
import { STATUS_LABEL } from './OrderDetail.jsx';

const TONE = { confirmed: 'blue', preparing: 'warn', shipping: 'warn', done: 'good', cancelled: 'gray' };

export default function Orders() {
  const { data, error, loading } = useApi('/orders');
  return (
    <>
      <TopBar title="Đơn hàng của tôi" />
      <main className="page no-nav stack">
        {loading && <Skeleton h={300} />}
        <ErrorNote error={error} />
        {data?.orders.length === 0 && (
          <div className="empty">
            <span className="icon-tile lg"><Receipt size={28} /></span>
            <p>Bạn chưa có đơn hàng nào.</p>
            <Link to="/shop" className="btn btn-primary">Mua sắm ngay</Link>
          </div>
        )}
        {data?.orders.map((o) => (
          <Link key={o._id} to={`/orders/${o._id}`} className="card card-link">
            <span className="grow stack" style={{ gap: 4 }}>
              <span className="row-between">
                <b>{o.code}</b>
                <span className={`badge ${TONE[o.status]}`}>{STATUS_LABEL[o.status]}</span>
              </span>
              <span className="small muted">{o.items.length} sản phẩm • {dateTime(o.createdAt)}</span>
              <b className="green tabular">{money(o.total)}</b>
            </span>
            <ChevronRight size={20} className="chev" />
          </Link>
        ))}
      </main>
    </>
  );
}
