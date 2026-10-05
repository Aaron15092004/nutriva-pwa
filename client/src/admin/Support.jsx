import { useState } from 'react';
import { Send } from 'lucide-react';
import { api } from '../lib/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { Button, ErrorNote } from '../components/ui.jsx';
import { useAdminList, Drawer, Pager, Field, dt } from './kit.jsx';

const STATUS = [
  { id: 'open', label: 'Mới', tone: 'warn' },
  { id: 'answered', label: 'Đã phản hồi', tone: 'good' },
  { id: 'closed', label: 'Đã đóng', tone: 'gray' },
];
const TOPIC = { expert: 'Tư vấn chuyên gia', order: 'Đơn hàng', general: 'Khác' };
const badge = (id) => {
  const s = STATUS.find((x) => x.id === id);
  return <span className={`badge ${s?.tone}`}>{s?.label}</span>;
};

function ReplyDrawer({ req, onClose, onSaved }) {
  const toast = useToast();
  const [reply, setReply] = useState(req.reply ?? '');
  const [status, setStatus] = useState(req.status);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const { item } = await api.patch(`/admin/support/${req._id}`, { reply: reply !== req.reply ? reply : undefined, status: reply !== req.reply ? undefined : status });
      toast(reply !== req.reply ? 'Đã gửi phản hồi — khách hàng được thông báo' : 'Đã cập nhật');
      onSaved(item);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer
      open
      title={`${TOPIC[req.topic] ?? 'Hỗ trợ'} — ${req.user?.name ?? ''}`}
      onClose={onClose}
      footer={<><button className="btn btn-ghost btn-sm" onClick={onClose}>Đóng</button><Button className="btn-primary btn-sm" loading={busy} onClick={save}><Send size={16} /> Lưu / gửi</Button></>}
    >
      <section className="a-card stack" style={{ gap: 6 }}>
        <div className="row-between small"><span className="muted">{req.user?.email}</span><span className="muted">{dt(req.createdAt)}</span></div>
        <p style={{ whiteSpace: 'pre-wrap' }}>{req.message}</p>
      </section>
      <div className="a-form">
        <Field label="Phản hồi cho khách" full htmlFor="rp" hint="Khách xem phản hồi trong mục Hỗ trợ và nhận thông báo đẩy.">
          <textarea id="rp" className="a-textarea" style={{ minHeight: 140 }} value={reply} onChange={(e) => setReply(e.target.value)} />
        </Field>
        <Field label="Trạng thái" htmlFor="ss">
          <select id="ss" className="a-select" value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </Field>
      </div>
      <ErrorNote error={error} />
    </Drawer>
  );
}

export default function Support() {
  const [status, setStatus] = useState('open');
  const [page, setPage] = useState(1);
  const list = useAdminList('/admin/support', { status, page, limit: 30 });
  const [open, setOpen] = useState(null);

  return (
    <>
      <div className="admin-head"><h1>Hỗ trợ khách hàng</h1></div>
      <div className="a-toolbar">
        <select className="a-select" aria-label="Trạng thái" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">Tất cả</option>
          {STATUS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </div>
      <ErrorNote error={list.error} />
      <div className="a-table-wrap">
        <table className="a-table">
          <thead><tr><th>Khách</th><th>Chủ đề</th><th>Nội dung</th><th>Trạng thái</th><th>Gửi lúc</th></tr></thead>
          <tbody>
            {list.items.map((r) => (
              <tr key={r._id} onClick={() => setOpen(r)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setOpen(r)}>
                <td><b>{r.user?.name}</b><div className="xs muted">{r.user?.email}</div></td>
                <td>{TOPIC[r.topic] ?? r.topic}</td>
                <td className="small" style={{ maxWidth: 380 }}>{r.message.length > 120 ? `${r.message.slice(0, 120)}…` : r.message}</td>
                <td>{badge(r.status)}</td>
                <td className="small muted">{dt(r.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!list.loading && !list.items.length && <div className="a-empty">Không có yêu cầu.</div>}
      </div>
      <Pager page={page} limit={30} total={list.total} onPage={setPage} />
      {open && (
        <ReplyDrawer
          key={open._id}
          req={open}
          onClose={() => setOpen(null)}
          onSaved={(item) => { list.setItems((items) => items.map((x) => (x._id === item._id ? item : x))); setOpen(null); }}
        />
      )}
    </>
  );
}
