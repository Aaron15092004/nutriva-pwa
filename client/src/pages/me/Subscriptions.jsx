import { Link } from 'react-router-dom';
import { Milk, CalendarDays } from 'lucide-react';
import { useApi } from '../../lib/useApi.js';
import { api } from '../../lib/api.js';
import { money } from '../../lib/format.js';
import { useToast } from '../../context/ToastContext.jsx';
import { TopBar, Skeleton, ErrorNote, Switch } from '../../components/ui.jsx';
import { cx } from '../../components/ds/index.jsx';
import Nuti from '../../components/mascot/Nuti.jsx';

export default function Subscriptions() {
  const toast = useToast();
  const { data, error, loading, setData } = useApi('/subscriptions');
  const list = data?.subscriptions ?? [];

  const toggle = async (s, active) => {
    setData((d) => ({ subscriptions: (d?.subscriptions ?? []).map((x) => (x._id === s._id ? { ...x, active } : x)) }));
    try {
      const { subscription } = await api.patch(`/subscriptions/${s._id}`, { active });
      setData((d) => ({ subscriptions: (d?.subscriptions ?? []).map((x) => (x._id === s._id ? subscription : x)) }));
      toast(active ? 'Đã tiếp tục gói định kỳ' : 'Đã tạm dừng gói định kỳ');
    } catch (e) {
      setData((d) => ({ subscriptions: (d?.subscriptions ?? []).map((x) => (x._id === s._id ? s : x)) }));
      toast(e.message, 'error');
    }
  };

  return (
    <>
      <TopBar title="Gói định kỳ" fallback="/me" />
      <main className="flex flex-col gap-4 px-4 pb-[calc(32px+var(--safe-b))] pt-2">
        {loading && <Skeleton h={200} />}
        <ErrorNote error={error} />
        {!loading && !list.length && (
          <section className="flex flex-col items-center gap-2 rounded-xl bg-white px-6 py-8 text-center shadow-card">
            <Nuti mood="happy" size={88} />
            <h2 className="text-base font-bold text-primary">Chưa có gói sữa định kỳ</h2>
            <p className="text-sm text-muted">Sữa hạt tươi giao tận nhà theo lịch bạn chọn — tạm dừng hoặc tiếp tục bất cứ lúc nào.</p>
          </section>
        )}
        {list.map((s) => (
          <article key={s._id} className={cx('flex flex-col gap-2 rounded-xl bg-white p-4 shadow-card', !s.active && 'opacity-80')}>
            <div className="flex items-center gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-light text-brand-dark" aria-hidden="true">
                <Milk size={22} />
              </span>
              <div className="min-w-0 flex-1">
                <b className="block text-primary">{s.bottles} chai / tuần</b>
                <span className="text-sm text-muted">{s.productName}</span>
              </div>
              <Switch checked={s.active} label={s.active ? 'Tạm dừng gói' : 'Tiếp tục gói'} onChange={(v) => toggle(s, v)} />
            </div>
            <p className="flex items-center gap-2 text-sm text-muted">
              <CalendarDays size={16} aria-hidden="true" /> Giao {s.days.join(', ')} • {s.frequency === 'weekly' ? 'mỗi tuần' : '2 tuần/lần'}
            </p>
            <div className="flex items-center justify-between gap-2">
              <span className={cx('rounded-full px-2 py-1 text-xs font-semibold', s.active ? 'bg-brand-light text-brand-deep' : 'bg-surface text-muted')}>{s.active ? 'Đang hoạt động' : 'Tạm dừng'}</span>
              <b className="font-secondary tabular-nums text-brand-dark">{money(s.price)} / tuần</b>
            </div>
          </article>
        ))}
        <Link to="/shop/subscribe" className="inline-flex h-14 items-center justify-center rounded-full border-2 border-brand-dark bg-white font-bold text-brand-dark">
          Đăng ký gói mới
        </Link>
      </main>
    </>
  );
}
