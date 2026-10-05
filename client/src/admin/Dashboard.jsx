import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, Receipt, Wallet, Clock, Headphones, RefreshCw, Landmark } from 'lucide-react';
import { useApi } from '../lib/useApi.js';
import { ErrorNote, Skeleton } from '../components/ui.jsx';
import { vnd } from './kit.jsx';

function Stat({ icon: Icon, label, value, sub, to }) {
  const body = (
    <div className="a-card a-stat" style={{ height: '100%' }}>
      <div className="label"><Icon size={16} /> {label}</div>
      <div className="value">{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}

// Doanh thu 14 ngày: 1 series → không cần chú giải; hover/focus hiện giá trị; có bảng cho trình đọc màn hình
function RevenueChart({ byDay }) {
  const [hover, setHover] = useState(null);
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(Date.now() - (13 - i) * 86400000);
    const key = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
    const hit = byDay.find((x) => x._id === key);
    return { key, label: `${d.getDate()}/${d.getMonth() + 1}`, total: hit?.total ?? 0, count: hit?.count ?? 0 };
  });
  const max = Math.max(1, ...days.map((d) => d.total));
  return (
    <>
      <div className="a-bars" style={{ gridTemplateColumns: 'repeat(14, 1fr)' }} aria-hidden="true">
        {days.map((d) => (
          <div key={d.key} className="bar-col" tabIndex={0} onMouseEnter={() => setHover(d.key)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(d.key)} onBlur={() => setHover(null)}>
            {hover === d.key && <span className="tip">{d.label}: {vnd(d.total)} • {d.count} đơn</span>}
            <span className="bar" style={{ height: `${Math.max(2, (d.total / max) * 170)}px`, background: d.total ? undefined : '#dee6e1' }} />
            <span className="x">{d.label}</span>
          </div>
        ))}
      </div>
      <div className="sr-only"><table>
        <caption>Doanh thu 14 ngày gần nhất</caption>
        <tbody>{days.map((d) => <tr key={d.key}><td>{d.key}</td><td>{d.total}</td><td>{d.count} đơn</td></tr>)}</tbody>
      </table></div>
    </>
  );
}

export default function Dashboard() {
  const { data: s, error, loading } = useApi('/admin/stats');
  return (
    <>
      <div className="admin-head"><h1>Tổng quan</h1></div>
      <ErrorNote error={error} />
      {loading && <Skeleton h={300} />}
      {s && (
        <div className="stack-lg">
          <div className="a-grid-4">
            <Stat icon={Wallet} label="Doanh thu 30 ngày" value={vnd(s.revenue30)} sub={`${s.orders30} đơn (không tính đơn hủy)`} />
            <Stat icon={Receipt} label="Đơn hôm nay" value={s.ordersToday} sub={`${s.pending} đơn chờ xử lý`} to="/admin/orders" />
            <Stat icon={Users} label="Người dùng" value={s.users} sub={`+${s.newUsers} trong 7 ngày`} to="/admin/users" />
            <Stat icon={RefreshCw} label="Gói định kỳ đang chạy" value={s.activeSubs} to="/admin/subscriptions" />
          </div>
          <div className="a-grid-4">
            <Stat icon={Clock} label="Chờ xác nhận / chuẩn bị" value={s.pending} to="/admin/orders" />
            <Stat icon={Landmark} label="Chuyển khoản chưa xác nhận" value={s.unpaidBank} to="/admin/orders" />
            <Stat icon={Headphones} label="Yêu cầu hỗ trợ mới" value={s.openSupport} to="/admin/support" />
          </div>
          <div className="a-grid-2" style={{ gridTemplateColumns: '2fr 1fr' }}>
            <section className="a-card">
              <h2 className="title-sm">Doanh thu 14 ngày</h2>
              <RevenueChart byDay={s.byDay} />
            </section>
            <section className="a-card stack">
              <h2 className="title-sm">Bán chạy 30 ngày</h2>
              {!s.topProducts.length && <p className="small muted">Chưa có đơn hàng.</p>}
              {s.topProducts.map((p, i) => (
                <div key={`${p._id.slug}`} className="row-between small">
                  <span><b>{i + 1}.</b> {p._id.type === 'diy' ? 'Set ' : 'Sữa '}{p.name}</span>
                  <span className="tabular muted" style={{ whiteSpace: 'nowrap' }}>{p.qty} • {vnd(p.revenue)}</span>
                </div>
              ))}
            </section>
          </div>
        </div>
      )}
    </>
  );
}
