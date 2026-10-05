import { useState } from 'react';
import { Headphones, UserRound, Package, MessageCircle, CheckCircle2, MessageSquareReply, Clock } from 'lucide-react';
import { api } from '../../lib/api.js';
import { useApi } from '../../lib/useApi.js';
import { dateTime } from '../../lib/format.js';
import { useToast } from '../../context/ToastContext.jsx';
import { TopBar, Button, ErrorNote, Skeleton } from '../../components/ui.jsx';

const TOPICS = [
  { id: 'expert', label: 'Tư vấn chuyên gia', icon: UserRound },
  { id: 'order', label: 'Đơn hàng', icon: Package },
  { id: 'general', label: 'Khác', icon: MessageCircle },
];
const STATUS = { open: ['Đang chờ', 'warn'], answered: ['Đã phản hồi', 'good'], closed: ['Đã đóng', 'gray'] };

export default function Support() {
  const toast = useToast();
  const list = useApi('/support');
  const [topic, setTopic] = useState('expert');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const send = async () => {
    setBusy(true);
    setError('');
    try {
      const { request } = await api.post('/support', { topic, message });
      list.setData((d) => ({ requests: [request, ...(d?.requests ?? [])] }));
      setMessage('');
      toast('Đã gửi yêu cầu — NUTRIVA sẽ phản hồi sớm');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <TopBar title="Hỗ trợ" />
      <main className="page no-nav stack-lg">
        <div className="row">
          <span className="icon-tile lg"><Headphones size={26} /></span>
          <p className="muted small">Chọn chủ đề và mô tả nhu cầu — chuyên gia dinh dưỡng hoặc bộ phận chăm sóc khách hàng sẽ phản hồi ngay trong ứng dụng.</p>
        </div>
        <div className="grid-3">
          {TOPICS.map((t) => (
            <button key={t.id} className="choice" aria-pressed={topic === t.id} onClick={() => setTopic(t.id)}>
              <t.icon size={22} /> {t.label}
            </button>
          ))}
        </div>
        <div className="field">
          <label htmlFor="msg">Nội dung</label>
          <textarea id="msg" className="textarea" rows={4} maxLength={1000} placeholder="Ví dụ: Tôi muốn được tư vấn thực đơn giảm cân cho người tiểu đường…" value={message} onChange={(e) => setMessage(e.target.value)} />
        </div>
        <ErrorNote error={error} />
        <Button className="btn-primary btn-block" loading={busy} disabled={message.trim().length < 5} onClick={send}>Gửi yêu cầu</Button>

        <section className="stack">
          <h2 className="title-sm">Yêu cầu của bạn</h2>
          {list.loading && <Skeleton h={120} />}
          {list.data?.requests.length === 0 && <p className="small muted">Chưa có yêu cầu nào.</p>}
          {list.data?.requests.map((r) => (
            <article key={r._id} className="card stack" style={{ gap: 8 }}>
              <div className="row-between">
                <span className="xs muted row" style={{ gap: 4 }}><Clock size={13} /> {dateTime(r.createdAt)}</span>
                <span className={`badge ${STATUS[r.status][1]}`}>{STATUS[r.status][0]}</span>
              </div>
              <p className="small" style={{ whiteSpace: 'pre-wrap' }}>{r.message}</p>
              {r.reply && (
                <div className="notice info" style={{ display: 'block' }}>
                  <div className="row strong small" style={{ gap: 6, marginBottom: 4 }}><MessageSquareReply size={16} /> NUTRIVA phản hồi</div>
                  <p className="small" style={{ whiteSpace: 'pre-wrap' }}>{r.reply}</p>
                </div>
              )}
              {r.status === 'open' && !r.reply && <span className="xs muted row" style={{ gap: 4 }}><CheckCircle2 size={13} /> Đã nhận, đang chờ xử lý</span>}
            </article>
          ))}
        </section>
      </main>
    </>
  );
}
