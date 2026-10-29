import { useState } from 'react';
import { Headphones, UserRound, Package, MessageCircle, CheckCircle2, MessageSquareReply, Clock } from 'lucide-react';
import { api } from '../../lib/api.js';
import { useApi } from '../../lib/useApi.js';
import { dateTime } from '../../lib/format.js';
import { useToast } from '../../context/ToastContext.jsx';
import { TopBar, ErrorNote, Skeleton } from '../../components/ui.jsx';
import { PrimaryButton } from '../../components/ds/form.jsx';
import { cx } from '../../components/ds/index.jsx';

const TOPICS = [
  { id: 'expert', label: 'Tư vấn chuyên gia', icon: UserRound },
  { id: 'order', label: 'Đơn hàng', icon: Package },
  { id: 'general', label: 'Khác', icon: MessageCircle },
];
const STATUS = {
  open: ['Đang chờ', 'bg-warning text-snacks-hint'],
  answered: ['Đã phản hồi', 'bg-brand-light text-brand-deep'],
  closed: ['Đã đóng', 'bg-surface text-muted'],
};

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
      <TopBar title="Hỗ trợ" fallback="/me" />
      <main className="flex flex-col gap-6 px-4 pb-[calc(32px+var(--safe-b))] pt-2">
        <div className="flex items-start gap-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-full bg-brand-light text-brand-dark" aria-hidden="true">
            <Headphones size={26} />
          </span>
          <p className="text-sm text-secondary">Chọn chủ đề và mô tả nhu cầu — chuyên gia dinh dưỡng hoặc bộ phận chăm sóc khách hàng sẽ phản hồi ngay trong ứng dụng.</p>
        </div>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Chủ đề">
          {TOPICS.map((t) => {
            const on = topic === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setTopic(t.id)}
                className={cx('flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-lg border-2 px-2 text-center text-sm transition', on ? 'border-brand-dark bg-brand-light font-bold text-brand-deep' : 'border-border bg-white font-medium text-secondary')}
              >
                <t.icon size={22} className={on ? 'text-brand-dark' : 'text-brand-main'} aria-hidden="true" /> {t.label}
              </button>
            );
          })}
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="msg" className="text-sm font-bold text-primary">Nội dung</label>
          <textarea
            id="msg"
            rows={4}
            maxLength={1000}
            placeholder="Ví dụ: Tôi muốn được tư vấn thực đơn giảm cân cho người tiểu đường…"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="min-h-28 w-full resize-y rounded-lg border border-border bg-white px-4 py-3 text-base text-primary outline-none focus:border-brand-main focus:ring-2 focus:ring-brand-soft"
          />
          <span className="self-end text-xs text-muted">{message.length}/1000</span>
        </div>
        <ErrorNote error={error} />
        <PrimaryButton loading={busy} disabled={message.trim().length < 5} onClick={send} className="w-full">
          Gửi yêu cầu
        </PrimaryButton>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-bold text-primary">Yêu cầu của bạn</h2>
          {list.loading && <Skeleton h={120} />}
          {list.data?.requests.length === 0 && <p className="text-sm text-muted">Chưa có yêu cầu nào.</p>}
          {list.data?.requests.map((r) => (
            <article key={r._id} className="flex flex-col gap-2 rounded-xl bg-white p-4 shadow-card">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1 text-xs text-muted">
                  <Clock size={13} aria-hidden="true" /> {dateTime(r.createdAt)}
                </span>
                <span className={cx('rounded-full px-2 py-1 text-xs font-semibold', STATUS[r.status][1])}>{STATUS[r.status][0]}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm text-primary">{r.message}</p>
              {r.reply && (
                <div className="rounded-lg border border-border bg-brand-light px-4 py-3">
                  <p className="mb-1 flex items-center gap-2 text-sm font-bold text-brand-deep">
                    <MessageSquareReply size={16} aria-hidden="true" /> NUTRIVA phản hồi
                  </p>
                  <p className="whitespace-pre-wrap text-sm text-secondary">{r.reply}</p>
                </div>
              )}
              {r.status === 'open' && !r.reply && (
                <span className="flex items-center gap-1 text-xs text-muted">
                  <CheckCircle2 size={13} aria-hidden="true" /> Đã nhận, đang chờ xử lý
                </span>
              )}
            </article>
          ))}
        </section>
      </main>
    </>
  );
}
