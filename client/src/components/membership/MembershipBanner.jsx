import { Link } from 'react-router-dom';
import { Lock, Clock, Sparkles } from 'lucide-react';
import { useMembership, memberState, fmtDate } from '../../lib/membership.js';
import { cx } from '../ds/index.jsx';
import TrialStrip from './TrialStrip.jsx';
import { TrialButton } from './Paywall.jsx';

// Trạng thái gói ở trang chủ: đang dùng thử (kèm dải 7 ngày) / sắp hết hạn / hết hạn. Đang có gói và còn lâu → không hiện.
export default function MembershipBanner() {
  const { m } = useMembership();
  if (!m?.enabled || (m.member && !m.expiring)) return null;
  if (m.active && !m.member) return null; // admin hoặc tính năng khóa đang tắt
  const state = memberState(m);

  // Tài khoản mới: phải tự bấm kích hoạt dùng thử mới mở kế hoạch
  if (state === 'new')
    return (
      <section className="flex flex-col gap-4 rounded-xl bg-white p-4 shadow-card" aria-label="Dùng thử miễn phí">
        <span className="flex items-center gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-brand-light text-brand-dark" aria-hidden="true">
            <Sparkles size={20} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-base font-bold leading-6 text-primary">Nhận {m.freePlanDays} ngày dùng thử miễn phí</span>
            <span className="block text-xs text-muted">Mở kế hoạch ăn theo calo & khẩu vị của bạn — mỗi tài khoản 1 lần.</span>
          </span>
        </span>
        <TrialButton days={m.freePlanDays} className="h-12 w-full text-sm" />
      </section>
    );

  if (state === 'trial') {
    const today = Math.max(0, m.freePlanDays - m.trialLeft);
    return (
      <Link to="/me/membership" className="flex flex-col gap-4 rounded-xl bg-white p-4 shadow-card transition active:scale-[0.99]">
        <span className="flex items-center gap-4">
          <span className="min-w-0 flex-1">
            <span className="block text-base font-bold leading-6 text-primary">Dùng thử • còn {m.trialLeft} ngày</span>
            <span className="block text-xs text-muted">Kế hoạch mở ngày 1–{m.freePlanDays}. Quét mã trên chai để mở trọn 7 ngày.</span>
          </span>
          <span className="inline-flex h-10 shrink-0 items-center rounded-full bg-brand-dark px-4 text-sm font-bold text-white">Kích hoạt</span>
        </span>
        <TrialStrip free={m.freePlanDays} today={today} />
      </Link>
    );
  }

  const look = {
    member: { bg: 'bg-warning', icon: Clock, iconBg: 'bg-white text-snacks-hint', title: `Gói NUTRIVA còn ${m.daysLeft} ngày`, sub: `Hết hạn ${fmtDate(m.until)} — mua thêm sữa hoặc quét mã để gia hạn`, cta: 'Gia hạn' },
    expired: { bg: 'bg-warm-light', icon: Lock, iconBg: 'bg-white text-warm-dark', title: 'Gói NUTRIVA đã hết hạn', sub: 'Kế hoạch đầy đủ & nhắc nhở đang tạm khóa', cta: 'Quét mã' },
    over: { bg: 'bg-warm-light', icon: Lock, iconBg: 'bg-white text-warm-dark', title: 'Đã hết thời gian dùng thử', sub: 'Quét mã trên chai sữa hạt để mở lại kế hoạch & nhắc nhở', cta: 'Quét mã' },
  }[state];
  const I = look.icon;
  return (
    <Link to="/me/membership" className={cx('flex items-center gap-4 rounded-xl p-4 shadow-card transition active:scale-[0.99]', look.bg)}>
      <span className={cx('grid size-12 shrink-0 place-items-center rounded-full', look.iconBg)} aria-hidden="true">
        <I size={20} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-bold leading-6 text-primary">{look.title}</span>
        <span className="block text-xs text-secondary">{look.sub}</span>
      </span>
      <span className="inline-flex h-10 shrink-0 items-center rounded-full bg-brand-dark px-4 text-sm font-bold text-white">{look.cta}</span>
    </Link>
  );
}
