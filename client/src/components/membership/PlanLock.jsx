import { Link } from 'react-router-dom';
import { Lock, QrCode, ShoppingBag, Check, Sparkles } from 'lucide-react';
import { useMembership, memberState } from '../../lib/membership.js';
import { BottleTrio } from '../brand/MilkArt.jsx';
import { TrialButton } from './Paywall.jsx';

// Đang được dùng kế hoạch: có gói còn hạn, admin / tắt khóa, hoặc đang trong thời gian dùng thử
export function usePlanAccess() {
  const { m } = useMembership();
  if (!m) return { ready: false, open: true, m };
  const st = memberState(m);
  return { ready: true, open: !m.enabled || m.active || st === 'trial', state: st, m };
}

const MEALS_PREVIEW = [
  ['bg-breakfast-card', 'Bữa sáng', 'w-2/3'],
  ['bg-lunch-card', 'Bữa trưa', 'w-3/4'],
  ['bg-dinner-card', 'Bữa tối', 'w-1/2'],
  ['bg-snacks-card', 'Bữa phụ', 'w-2/5'],
];

// Màn khóa thay cho toàn bộ trang Kế hoạch: xem mờ thực đơn phía sau + cách mở khóa
export default function PlanLock({ state, m }) {
  const isNew = state === 'new';
  const title = isNew ? `Mở kế hoạch ăn — ${m.freePlanDays} ngày dùng thử miễn phí` : state === 'expired' ? 'Gói NUTRIVA đã hết hạn' : 'Đã hết thời gian dùng thử';
  const text = isNew
    ? 'Thực đơn 7 ngày tính theo calo, mục tiêu và khẩu vị của bạn. Mỗi tài khoản được dùng thử 1 lần.'
    : `Quét mã trên chai sữa hạt để tiếp tục: mỗi chai +${m.daysPerBottle} ngày, mỗi gói hạt +${m.daysPerSet} ngày.`;
  return (
    <section aria-labelledby="plan-lock" className="flex flex-col gap-4">
      <div className="relative overflow-hidden rounded-2xl bg-white shadow-card">
        {/* Thực đơn mờ phía sau — cho thấy bên trong có gì */}
        <div className="flex min-h-[460px] select-none flex-col gap-4 p-4 opacity-60 blur-[3px]" aria-hidden="true">
          <div className="flex items-center gap-4 rounded-xl bg-brand-light p-4">
            <span className="size-16 rounded-full border-8 border-brand-main" />
            <span className="flex flex-1 flex-col gap-2"><span className="h-4 w-1/2 rounded-full bg-brand-pastel" /><span className="h-3 w-3/4 rounded-full bg-brand-soft" /></span>
          </div>
          {MEALS_PREVIEW.map(([c, l, w]) => (
            <div key={l} className="flex items-center gap-4">
              <span className={`size-14 shrink-0 rounded-lg ${c}`} />
              <span className="flex flex-1 flex-col gap-2"><span className="text-sm font-bold text-primary">{l}</span><span className={`h-3 rounded-full bg-divider ${w}`} /></span>
            </div>
          ))}
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-b from-white/30 via-white/85 to-white px-6 pb-4 text-center">
          {/* 3 chai sữa ở trung tâm màn khóa (to, nổi bật) + huy hiệu khóa / dùng thử */}
          <div className="relative" aria-hidden="true">
            <BottleTrio h={160} poolTo="#FFFFFF" />
            <span className="absolute -bottom-1 left-1/2 grid size-11 -translate-x-1/2 place-items-center rounded-full bg-brand-dark text-white shadow-float ring-4 ring-white">
              {isNew ? <Sparkles size={20} /> : <Lock size={18} />}
            </span>
          </div>
          <h2 id="plan-lock" className="font-display text-2xl font-bold leading-8 text-brand-core [font-variation-settings:'SOFT'_100] [text-wrap:balance]">{title}</h2>
          <p className="text-sm text-secondary [text-wrap:pretty]">{text}</p>
        </div>
      </div>

      <ul className="flex flex-col gap-2 rounded-xl bg-white p-4 shadow-card">
        {['Thực đơn 7 ngày theo calo & khẩu vị, đổi món 1 chạm', 'Danh sách nguyên liệu đi chợ cho cả tuần', 'Nhắc uống nước, uống sữa, vận động đúng giờ'].map((t) => (
          <li key={t} className="flex items-start gap-2 text-sm text-secondary">
            <Check size={18} className="mt-0.5 shrink-0 text-brand-main" aria-hidden="true" /> {t}
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-2">
        {isNew && <TrialButton days={m.freePlanDays} />}
        <Link to="/me/membership?scan=1" className={`inline-flex h-14 items-center justify-center gap-2 rounded-full text-base font-bold transition active:scale-[0.98] ${isNew ? 'border-2 border-brand-dark bg-white text-brand-dark' : 'bg-brand-dark text-white'}`}>
          <QrCode size={20} aria-hidden="true" /> Quét mã trên chai sữa
        </Link>
        <Link to="/shop?tab=milk" className="inline-flex h-12 items-center justify-center gap-2 rounded-full text-sm font-bold text-brand-dark hover:bg-brand-light">
          <ShoppingBag size={18} aria-hidden="true" /> Mua sữa hạt — mỗi chai có mã kích hoạt
        </Link>
      </div>
    </section>
  );
}
