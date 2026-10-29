import { useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useApi } from '../lib/useApi.js';
import { ErrorNote, Skeleton } from '../components/ui.jsx';
import { LineChart, StatTile, SERIES } from './charts.jsx';

const RANGES = [
  { h: 1, label: '1 giờ' },
  { h: 6, label: '6 giờ' },
  { h: 24, label: '24 giờ' },
  { h: 168, label: '7 ngày' },
  { h: 336, label: '14 ngày' },
];
const n = (v) => (v ?? 0).toLocaleString('vi-VN');
const timeLabel = (iso, unit) => {
  const d = new Date(iso);
  return unit >= 1440 ? `${d.getDate()}/${d.getMonth() + 1}` : d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
};
const SORTS = { count: 'Nhiều request', s5xx: 'Lỗi máy chủ', p95: 'Chậm nhất' };

// Lưu lượng API: số request, lỗi, độ trễ theo thời gian và theo từng nhóm API
export default function Traffic() {
  const [hours, setHours] = useState(24);
  const [sort, setSort] = useState('count');
  const { data: t, error, loading, reload, refreshing } = useApi(`/admin/insights/traffic?hours=${hours}`);
  const routes = useMemo(() => [...(t?.routes ?? [])].sort((a, b) => b[sort] - a[sort]), [t, sort]);
  const series = (t?.series ?? []).map((s) => ({ key: s.at, label: timeLabel(s.at, t.unitMinutes), ...s }));
  const unitText = t ? (t.unitMinutes >= 1440 ? 'mỗi ngày' : t.unitMinutes >= 60 ? 'mỗi giờ' : `mỗi ${t.unitMinutes} phút`) : '';

  return (
    <>
      <div className="admin-head">
        <h1>Lưu lượng truy cập</h1>
        <div className="flex items-center gap-2">
          <select className="a-select" aria-label="Khoảng thời gian" value={hours} onChange={(e) => setHours(Number(e.target.value))}>
            {RANGES.map((r) => (
              <option key={r.h} value={r.h}>{r.label} qua</option>
            ))}
          </select>
          <button type="button" className="a-select inline-flex items-center gap-2" onClick={reload} disabled={refreshing}>
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} aria-hidden="true" /> Làm mới
          </button>
        </div>
      </div>
      <p className="-mt-2 mb-4 text-sm text-muted">Số liệu gom theo phút ở máy chủ, ghi vào DB mỗi phút (phút hiện tại chưa tính). Lưu 30 ngày.</p>
      <ErrorNote error={error} />
      {loading && !t && <Skeleton h={420} />}
      {t && (
        <div className="flex flex-col gap-4">
          <div className="a-grid-4">
            <StatTile label="Tổng request" value={n(t.totals.requests)} sub={`Trung bình ${n(t.totals.perMinute)}/phút`} />
            <StatTile label="Cao điểm" value={`${n(t.totals.peakPerMinute)}/phút`} sub={t.totals.peakAt ? `Lúc ${new Date(t.totals.peakAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}` : '—'} />
            <StatTile label="Lỗi máy chủ (5xx)" value={`${t.totals.errorRate}%`} tone={t.totals.errorRate >= 1 ? 'bad' : undefined} sub={`Lỗi phía người dùng (4xx): ${t.totals.clientErrorRate}%`} />
            <StatTile label="Thời gian phản hồi TB" value={`${n(t.totals.avgMs)} ms`} tone={t.totals.avgMs > 800 ? 'bad' : undefined} sub="Dưới 300 ms là nhanh" />
          </div>

          {series.length ? (
            <div className="a-grid-2">
              <section className="a-card flex flex-col gap-2">
                <h2 className="text-base font-bold text-primary">Số request {unitText}</h2>
                <LineChart caption={`Số request ${unitText}`} data={series.map((s) => ({ key: s.key, label: s.label, value: s.count }))} color={SERIES.brand} tipFormat={(v) => `${n(v)} request`} />
              </section>
              <section className="a-card flex flex-col gap-2">
                <h2 className="text-base font-bold text-primary">Độ trễ p95 (ms)</h2>
                <p className="-mt-1 text-xs text-muted">95% request nhanh hơn mức này</p>
                <LineChart caption="Độ trễ p95 theo thời gian" data={series.map((s) => ({ key: s.key, label: s.label, value: s.p95 }))} color={SERIES.water} tipFormat={(v) => `${n(v)} ms`} />
              </section>
              {series.some((s) => s.s5xx) && (
                <section className="a-card flex flex-col gap-2">
                  <h2 className="text-base font-bold text-primary">Lỗi máy chủ (5xx) {unitText}</h2>
                  <LineChart caption="Số lỗi máy chủ theo thời gian" data={series.map((s) => ({ key: s.key, label: s.label, value: s.s5xx }))} color={SERIES.critical} tipFormat={(v) => `${n(v)} lỗi`} />
                </section>
              )}
            </div>
          ) : (
            <p className="a-card text-sm text-muted">Chưa có số liệu trong khoảng này.</p>
          )}

          <section className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-bold text-primary">Theo nhóm API</h2>
              <select className="a-select" aria-label="Sắp xếp" value={sort} onChange={(e) => setSort(e.target.value)}>
                {Object.entries(SORTS).map(([k, v]) => (
                  <option key={k} value={k}>Sắp xếp: {v}</option>
                ))}
              </select>
            </div>
            <div className="a-table-wrap">
              <table className="a-table">
                <thead>
                  <tr>
                    <th>API</th>
                    <th className="num">Request</th>
                    <th className="num">4xx</th>
                    <th className="num">5xx</th>
                    <th className="num">TB (ms)</th>
                    <th className="num">p95 (ms)</th>
                    <th className="num">Chậm nhất</th>
                  </tr>
                </thead>
                <tbody>
                  {routes.map((r) => (
                    <tr key={r.route} className="!cursor-default">
                      <td className="font-mono text-xs">{r.route}</td>
                      <td className="num">{n(r.count)}</td>
                      <td className="num">{r.s4xx ? n(r.s4xx) : '—'}</td>
                      <td className={`num ${r.s5xx ? 'font-bold text-warm-dark' : ''}`}>{r.s5xx ? n(r.s5xx) : '—'}</td>
                      <td className="num">{n(r.avgMs)}</td>
                      <td className={`num ${r.p95 > 1000 ? 'font-bold text-warm-dark' : ''}`}>{n(r.p95)}</td>
                      <td className="num">{n(r.maxMs)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!routes.length && <div className="a-empty">Chưa có request nào.</div>}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
