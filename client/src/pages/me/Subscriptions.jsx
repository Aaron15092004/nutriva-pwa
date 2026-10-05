import { Link } from 'react-router-dom';
import { RefreshCw, Milk, CalendarDays } from 'lucide-react';
import { useApi } from '../../lib/useApi.js';
import { api } from '../../lib/api.js';
import { money } from '../../lib/format.js';
import { useToast } from '../../context/ToastContext.jsx';
import { TopBar, Skeleton, ErrorNote, Switch } from '../../components/ui.jsx';

export default function Subscriptions() {
  const toast = useToast();
  const { data, error, loading, setData } = useApi('/subscriptions');
  const list = data?.subscriptions ?? [];

  const toggle = async (s, active) => {
    const { subscription } = await api.patch(`/subscriptions/${s._id}`, { active });
    setData({ subscriptions: list.map((x) => (x._id === s._id ? subscription : x)) });
    toast(active ? 'Đã tiếp tục gói định kỳ' : 'Đã tạm dừng gói định kỳ');
  };

  return (
    <>
      <TopBar title="Gói định kỳ" />
      <main className="page no-nav stack">
        {loading && <Skeleton h={200} />}
        <ErrorNote error={error} />
        {!loading && !list.length && (
          <div className="empty">
            <span className="icon-tile lg"><RefreshCw size={28} /></span>
            <p>Bạn chưa đăng ký gói sữa định kỳ nào.</p>
          </div>
        )}
        {list.map((s) => (
          <article key={s._id} className="card stack" style={{ gap: 8 }}>
            <div className="row">
              <span className="icon-tile"><Milk size={22} /></span>
              <div className="grow">
                <b>{s.bottles} chai / tuần</b>
                <div className="small muted">{s.productName}</div>
              </div>
              <Switch checked={s.active} label={s.active ? 'Tạm dừng gói' : 'Tiếp tục gói'} onChange={(v) => toggle(s, v)} />
            </div>
            <div className="row small muted" style={{ gap: 6 }}>
              <CalendarDays size={16} /> Giao {s.days.join(', ')} • {s.frequency === 'weekly' ? 'mỗi tuần' : '2 tuần/lần'}
            </div>
            <div className="row-between">
              <span className={`badge ${s.active ? 'good' : 'gray'}`}>{s.active ? 'Đang hoạt động' : 'Tạm dừng'}</span>
              <b className="green tabular">{money(s.price)} / tuần</b>
            </div>
          </article>
        ))}
        <Link to="/shop/subscribe" className="btn btn-outline btn-block">Đăng ký gói mới</Link>
      </main>
    </>
  );
}
