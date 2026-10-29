import { useState } from 'react';
import { useApi } from '../lib/useApi.js';
import { ErrorNote, Skeleton } from '../components/ui.jsx';
import { ColumnChart, HBars, StatTile, SERIES } from './charts.jsx';

const PLATFORM = { android: 'Android', ios: 'iPhone / iPad', desktop: 'Máy tính', unknown: 'Không rõ' };
// Thứ tự các bước onboarding (khớp client/src/pages/onboarding/Onboarding.jsx)
const STEPS = [
  ['goal', 'Mục tiêu'], ['gender', 'Giới tính'], ['birth', 'Năm sinh'], ['height', 'Chiều cao'], ['weight', 'Cân nặng'],
  ['target', 'Cân nặng mục tiêu'], ['waist', 'Vòng eo'], ['goalset', 'Xác nhận mục tiêu'], ['motivation', 'Động lực'],
  ['obstacle', 'Trở ngại'], ['compare', 'So sánh'], ['activity', 'Vận động'], ['diet', 'Chế độ ăn'],
  ['milkHabit', 'Thói quen sữa hạt'], ['flavor', 'Khẩu vị'], ['sweetness', 'Độ ngọt'], ['preference', 'Pha sẵn / tự làm'],
  ['milkTimes', 'Giờ uống sữa'], ['allergy', 'Dị ứng'], ['logging', 'Thói quen ghi chép'], ['easy', 'Ghi chép dễ'],
  ['recommend', 'Gợi ý'], ['results', 'Kết quả'], ['loading', 'Tạo kế hoạch'], ['ready', 'Sẵn sàng'], ['account', 'Tạo tài khoản'],
];
const n = (v) => (v ?? 0).toLocaleString('vi-VN');
const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '—');
const dayLabel = (d) => `${Number(d.slice(8))}/${Number(d.slice(5, 7))}`;

export default function Insights() {
  const [days, setDays] = useState(30);
  const { data: s, error, loading } = useApi(`/admin/insights/users?days=${days}`);

  const funnelSteps = s
    ? STEPS.filter(([k]) => s.funnel.steps[k] != null).map(([k, label]) => ({ key: k, label, value: s.funnel.steps[k], note: pct(s.funnel.steps[k], s.funnel.starts) }))
    : [];
  const signups = s ? Object.values(s.funnel.signups).reduce((a, b) => a + b, 0) : 0;

  return (
    <>
      <div className="admin-head">
        <h1>Người dùng & hành vi</h1>
        <select className="a-select" aria-label="Khoảng thời gian" value={days} onChange={(e) => setDays(Number(e.target.value))}>
          <option value={7}>7 ngày</option>
          <option value={30}>30 ngày</option>
          <option value={90}>90 ngày</option>
        </select>
      </div>
      <ErrorNote error={error} />
      {loading && !s && <Skeleton h={420} />}
      {s && (
        <div className="flex flex-col gap-4">
          <div className="a-grid-4">
            <StatTile label="Tổng người dùng" value={n(s.totals.total)} sub={`+${n(s.totals.new7)} trong 7 ngày • +${n(s.totals.newToday)} hôm nay`} />
            <StatTile label="Hoạt động hôm nay (DAU)" value={n(s.totals.dau)} sub={`7 ngày: ${n(s.totals.wau)} • 30 ngày: ${n(s.totals.mau)}`} />
            <StatTile label="Độ gắn bó (DAU/MAU)" value={`${s.totals.stickiness}%`} sub="Trên 20% là tốt với app sức khỏe" />
            <StatTile
              label="Giữ chân sau 7 ngày"
              value={s.retentionD7 ? `${s.retentionD7.rate}%` : '—'}
              sub={s.retentionD7 ? `${n(s.retentionD7.returned)}/${n(s.retentionD7.cohort)} người đăng ký 8–37 ngày trước còn quay lại` : 'Chưa đủ dữ liệu'}
            />
          </div>
          <div className="a-grid-4">
            <StatTile label="Ghi nhật ký (7 ngày)" value={n(s.engagement.loggers7)} sub={`${pct(s.engagement.loggers7, s.totals.wau)} người hoạt động tuần`} />
            <StatTile label="Mua hàng (30 ngày)" value={n(s.engagement.buyers30)} sub={`${pct(s.engagement.buyers30, s.totals.mau)} người hoạt động tháng`} />
            <StatTile label="Gói định kỳ đang chạy" value={n(s.engagement.activeSubscribers)} sub="Số người có gói đang bật" />
            <StatTile label="Cài app (30 ngày)" value={n(s.engagement.installs30)} sub={`Đăng nhập Google: ${n(s.totals.google)} tài khoản`} />
          </div>

          <div className="a-grid-2">
            <section className="a-card flex flex-col gap-2">
              <h2 className="text-base font-bold text-primary">Thiết bị mở app mỗi ngày</h2>
              <p className="text-xs text-muted">Đếm mỗi thiết bị tối đa 1 lần/ngày (gồm cả khách chưa đăng ký)</p>
              <ColumnChart
                caption="Thiết bị mở app mỗi ngày"
                data={s.daily.map((d) => ({ key: d.date, label: dayLabel(d.date), value: d.visitors, sub: `${n(d.members)} đã đăng nhập` }))}
                tipFormat={(v) => `${n(v)} thiết bị`}
              />
            </section>
            <section className="a-card flex flex-col gap-2">
              <h2 className="text-base font-bold text-primary">Đăng ký mới mỗi ngày</h2>
              <p className="text-xs text-muted">
                {days} ngày: {n(s.daily.reduce((a, d) => a + d.signups, 0))} tài khoản mới
              </p>
              <ColumnChart caption="Đăng ký mới mỗi ngày" data={s.daily.map((d) => ({ key: d.date, label: dayLabel(d.date), value: d.signups }))} color={SERIES.water} tipFormat={(v) => `${n(v)} người`} />
            </section>
          </div>

          <div className="a-grid-2">
            <section className="a-card flex flex-col gap-4">
              <div>
                <h2 className="text-base font-bold text-primary">Phễu onboarding (30 ngày)</h2>
                <p className="text-xs text-muted">
                  {n(s.funnel.starts)} thiết bị bắt đầu → {n(signups)} đăng ký ({pct(signups, s.funnel.starts)}). % = so với số bắt đầu; bước tụt mạnh là nơi người dùng bỏ dở.
                </p>
              </div>
              {funnelSteps.length ? <HBars items={funnelSteps} max={s.funnel.starts || undefined} /> : <p className="text-sm text-muted">Chưa có dữ liệu — sự kiện được ghi từ phiên bản này trở đi.</p>}
              {signups > 0 && (
                <p className="text-sm text-secondary">
                  Cách đăng ký: {Object.entries(s.funnel.signups).map(([k, v]) => `${k === 'google' ? 'Google' : 'Email'} ${n(v)}`).join(' • ')}
                </p>
              )}
            </section>
            <section className="a-card flex flex-col gap-4">
              <div>
                <h2 className="text-base font-bold text-primary">Nền tảng (30 ngày)</h2>
                <p className="text-xs text-muted">Số thiết bị mở app; ghi chú = số thiết bị đang dùng bản đã cài</p>
              </div>
              {s.platforms.length ? (
                <HBars items={s.platforms.map((p) => ({ key: p.platform, label: PLATFORM[p.platform] ?? p.platform, value: p.devices, note: `${n(p.installed)} đã cài` }))} />
              ) : (
                <p className="text-sm text-muted">Chưa có dữ liệu.</p>
              )}
            </section>
          </div>
        </div>
      )}
    </>
  );
}
