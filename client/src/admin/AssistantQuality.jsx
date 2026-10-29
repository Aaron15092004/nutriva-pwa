import { useApi } from '../lib/useApi.js';
import { ErrorNote, Skeleton } from '../components/ui.jsx';
import { ColumnChart, StatTile } from './charts.jsx';
import { dt } from './kit.jsx';

const n = (v) => (v ?? 0).toLocaleString('vi-VN');
const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '—');

// Chất lượng trợ lý Nuti: mức sử dụng, tỉ lệ trả lời bằng AI, đánh giá 👍/👎 và các câu trả lời bị chê để cải thiện nội dung
export default function AssistantQuality() {
  const { data: s, error, loading } = useApi('/admin/insights/assistant');
  return (
    <>
      <div className="admin-head"><h1>Trợ lý Nuti</h1></div>
      <ErrorNote error={error} />
      {loading && !s && <Skeleton h={360} />}
      {s && (
        <div className="flex flex-col gap-4">
          <div className="a-grid-4">
            <StatTile label="Câu trả lời (30 ngày)" value={n(s.totals.answers)} sub={`${n(s.totals.users)} người đã hỏi`} />
            <StatTile label="Trả lời bằng AI" value={pct(s.totals.aiAnswers, s.totals.answers)} sub="Còn lại: chế độ cơ bản (AI tắt hoặc lỗi)" />
            <StatTile label="Hữu ích 👍" value={n(s.totals.up)} sub={`${pct(s.totals.up, s.totals.up + s.totals.down)} lượt đánh giá`} />
            <StatTile label="Chưa hữu ích 👎" value={n(s.totals.down)} tone={s.totals.down > s.totals.up ? 'bad' : undefined} sub="Xem chi tiết bên dưới" />
          </div>
          <section className="a-card flex flex-col gap-2">
            <h2 className="text-base font-bold text-primary">Câu hỏi mỗi ngày</h2>
            <ColumnChart caption="Số câu hỏi gửi Nuti mỗi ngày" data={s.byDay.map((d) => ({ key: d.date, label: `${Number(d.date.slice(8))}/${Number(d.date.slice(5, 7))}`, value: d.questions }))} tipFormat={(v) => `${n(v)} câu hỏi`} />
          </section>
          <section className="flex flex-col gap-2">
            <h2 className="text-base font-bold text-primary">Câu trả lời bị đánh giá chưa hữu ích</h2>
            {!s.downvoted.length && <p className="a-card text-sm text-muted">Chưa có đánh giá 👎 nào.</p>}
            {s.downvoted.map((m) => (
              <article key={m.id} className="a-card flex flex-col gap-2">
                <p className="text-xs text-muted">
                  {dt(m.at)} • {m.user?.email ?? 'tài khoản đã xóa'} • {m.ai ? 'AI' : 'Chế độ cơ bản'}
                </p>
                <p className="text-sm"><b>Hỏi:</b> {m.question || '—'}</p>
                <p className="whitespace-pre-wrap rounded-lg bg-background p-2 text-sm text-secondary"><b>Nuti:</b> {m.answer}</p>
              </article>
            ))}
          </section>
        </div>
      )}
    </>
  );
}
