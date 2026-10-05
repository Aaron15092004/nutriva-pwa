import { useState } from 'react';
import { Play } from 'lucide-react';
import { api } from '../lib/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { ErrorNote, Switch } from '../components/ui.jsx';
import { useAdminList, Pager, vnd, dt } from './kit.jsx';

export default function Subscriptions() {
  const toast = useToast();
  const [active, setActive] = useState('');
  const [page, setPage] = useState(1);
  const list = useAdminList('/admin/subscriptions', { active, page, limit: 30 });
  const [running, setRunning] = useState(false);

  const toggle = async (s, v) => {
    const { item } = await api.patch(`/admin/subscriptions/${s._id}`, { active: v });
    list.setItems((items) => items.map((x) => (x._id === s._id ? item : x)));
    toast(v ? 'Đã bật gói' : 'Đã tạm dừng gói');
  };

  const runNow = async () => {
    setRunning(true);
    try {
      const { created } = await api.post('/admin/subscriptions/run');
      toast(created ? `Đã tạo ${created} đơn giao hôm nay` : 'Không có gói nào cần giao hôm nay (hoặc đã tạo rồi)');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setRunning(false);
    }
  };

  return (
    <>
      <div className="admin-head">
        <h1>Gói định kỳ</h1>
        <button className="btn btn-soft btn-sm" disabled={running} onClick={runNow}><Play size={16} /> Tạo đơn giao hôm nay</button>
      </div>
      <p className="small muted" style={{ marginTop: -8, marginBottom: 14 }}>Hệ thống tự tạo đơn lúc 6:00 sáng mỗi ngày giao theo lịch của từng gói. Nút trên chạy ngay (không tạo trùng).</p>
      <div className="a-toolbar">
        <select className="a-select" aria-label="Trạng thái" value={active} onChange={(e) => { setActive(e.target.value); setPage(1); }}>
          <option value="">Trạng thái: tất cả</option>
          <option value="true">Đang hoạt động</option>
          <option value="false">Tạm dừng</option>
        </select>
      </div>
      <ErrorNote error={list.error} />
      <div className="a-table-wrap">
        <table className="a-table">
          <thead><tr><th>Khách</th><th>Gói</th><th>Hương vị</th><th>Ngày giao</th><th>Địa chỉ</th><th>Tạo đơn gần nhất</th><th>Hoạt động</th></tr></thead>
          <tbody>
            {list.items.map((s) => (
              <tr key={s._id} style={{ cursor: 'default' }}>
                <td><b>{s.user?.name}</b><div className="xs muted">{s.user?.email}</div></td>
                <td>{s.bottles} chai/tuần<div className="xs muted">{vnd(s.price)}</div></td>
                <td>{s.productName}<div className="xs muted">{s.sweetness === 'low' ? 'Ít ngọt' : 'Không đường'}</div></td>
                <td>{s.days.join(', ')}<div className="xs muted">{s.frequency === 'weekly' ? 'Hằng tuần' : '2 tuần/lần'} • từ {s.startDate ?? '—'}</div></td>
                <td className="small">{s.address ? `${s.address.name} • ${s.address.phone}` : '—'}<div className="xs muted">{s.address?.line}</div></td>
                <td className="small muted">{s.lastGeneratedDate ?? 'Chưa'}<div className="xs">tạo {dt(s.createdAt)}</div></td>
                <td><Switch checked={s.active} label={s.active ? 'Tạm dừng gói' : 'Bật gói'} onChange={(v) => toggle(s, v)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!list.loading && !list.items.length && <div className="a-empty">Chưa có gói định kỳ.</div>}
      </div>
      <Pager page={page} limit={30} total={list.total} onPage={setPage} />
    </>
  );
}
