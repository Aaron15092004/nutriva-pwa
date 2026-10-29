import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, QrCode, ShoppingBag, Check, Sparkles } from 'lucide-react';
import { useApi } from '../../lib/useApi.js';
import { useMembership, memberState, useStartTrial } from '../../lib/membership.js';
import { useToast } from '../../context/ToastContext.jsx';
import { track } from '../../lib/track.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { Sheet, ErrorNote } from '../ui.jsx';
import { PrimaryButton } from '../ds/form.jsx';
import { cx } from '../ds/index.jsx';
import { BottleTrio } from '../brand/MilkArt.jsx';
import ChannelLinks from '../promo/ChannelLinks.jsx';

const WELCOME_KEY = 'nutriva_welcome_trial';
const DEFAULT_CFG = { freePlanDays: 3, daysPerBottle: 2, daysPerSet: 4 };
const HERO = { h: 140, total: 168, overlap: 42 }; // khớp kích thước BottleTrio (cao 1,2 × h)

export function useMemberConfig() {
  const { data } = useApi('/shop/config');
  return { ...DEFAULT_CFG, ...data?.membership };
}

// Dòng thời gian dùng thử: hôm nay → khi hết dùng thử → cách gia hạn
function TrialTimeline({ cfg }) {
  const steps = [
    { icon: Sparkles, on: true, title: 'Bấm “Kích hoạt dùng thử”', text: `Mở kế hoạch ăn ${cfg.freePlanDays} ngày kể từ hôm nay — mỗi tài khoản 1 lần.` },
    { icon: Lock, title: `Sau ${cfg.freePlanDays} ngày`, text: 'Kế hoạch ăn và nhắc nhở cần mã kích hoạt trên chai sữa.' },
    { icon: QrCode, title: 'Mỗi chai sữa hạt', text: `Quét mã trên chai: +${cfg.daysPerBottle} ngày • gói hạt tự nấu: +${cfg.daysPerSet} ngày, cộng dồn.` },
  ];
  return (
    <ol className="flex flex-col">
      {steps.map((s, i) => (
        <li key={s.title} className="relative flex gap-4 pb-4 last:pb-0">
          {i < steps.length - 1 && <span className="absolute bottom-0 left-5 top-10 w-0.5 -translate-x-1/2 bg-brand-soft" aria-hidden="true" />}
          <span className={cx('relative grid size-10 shrink-0 place-items-center rounded-full', s.on ? 'bg-brand-dark text-white shadow-pill' : 'bg-white text-brand-dark ring-2 ring-inset ring-brand-soft')} aria-hidden="true">
            <s.icon size={18} />
          </span>
          <div className="min-w-0 pt-1">
            <p className="text-sm font-bold text-primary">{s.title}</p>
            <p className="text-sm text-secondary">{s.text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

// "1 chai = 2 ngày • 1 gói = 4 ngày" bằng hình sản phẩm thật → hiểu ngay cách quy đổi
export function DayValueTiles({ cfg, className = '' }) {
  const tiles = [
    { img: '/img/products/hero-mach-nhien.webp', bg: 'bg-[#FFF3D6]', days: cfg.daysPerBottle, label: 'mỗi chai sữa hạt', fit: 'h-[64px] w-auto translate-y-3' },
    { img: '/img/products/set-sen-com.webp', bg: 'bg-[#EEF5DC]', days: cfg.daysPerSet, label: 'mỗi gói hạt tự nấu', fit: 'h-full w-full object-cover' },
  ];
  return (
    <div className={cx('grid grid-cols-2 gap-2', className)}>
      {tiles.map((t) => (
        <div key={t.label} className="flex items-center gap-2 rounded-lg bg-white p-2 pr-4 shadow-pill">
          <span className={cx('flex size-14 shrink-0 items-start justify-center overflow-hidden rounded-md', t.bg)} aria-hidden="true">
            <img src={t.img} alt="" className={t.fit} />
          </span>
          <span className="min-w-0">
            <b className="block font-display text-xl leading-6 text-brand-core">+{t.days} ngày</b>
            <span className="block text-xs text-muted">{t.label}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

function Header({ eyebrow, title, text }) {
  return (
    <header className="flex flex-col items-center gap-1 text-center">
      <p className="font-secondary text-xs font-bold uppercase tracking-[0.14em] text-brand-main">{eyebrow}</p>
      <h2 className="font-display text-[26px] font-bold leading-8 text-brand-core [font-variation-settings:'SOFT'_100] [text-wrap:balance]">{title}</h2>
      {text && <p className="text-sm text-secondary [text-wrap:pretty]">{text}</p>}
    </header>
  );
}

// Nút "Kích hoạt dùng thử N ngày" dùng chung (sheet, thẻ khóa, banner, trang Gói)
export function TrialButton({ days, onDone, className = 'w-full', label }) {
  const toast = useToast();
  const { start, busy, error } = useStartTrial();
  return (
    <>
      <PrimaryButton
        className={className}
        loading={busy}
        onClick={async () => {
          try {
            await start();
            toast(`Đã mở kế hoạch ăn ${days} ngày dùng thử`);
            onDone?.();
          } catch {
            /* lỗi hiện bên dưới */
          }
        }}
      >
        <Sparkles size={20} aria-hidden="true" /> {label ?? `Kích hoạt dùng thử ${days} ngày`}
      </PrimaryButton>
      <ErrorNote error={error} />
    </>
  );
}

function WelcomeBody({ cfg, go }) {
  const { user } = useAuth();
  return (
    <div className="flex flex-col gap-6 pt-2">
      <Header eyebrow="Quà cho tài khoản mới" title={`Chào ${user?.name ?? 'bạn'}, nhận ${cfg.freePlanDays} ngày dùng thử`} text="Kế hoạch ăn theo calo & khẩu vị của bạn. Mỗi chai sữa hạt NUTRIVA có mã kích hoạt — uống sữa là app luôn mở." />
      <TrialTimeline cfg={cfg} />
      <div className="flex flex-col gap-1">
        <TrialButton days={cfg.freePlanDays} onDone={() => go('/plan')} />
        <button type="button" onClick={() => go('/me/membership?scan=1')} className="inline-flex h-12 items-center justify-center gap-2 rounded-full text-sm font-bold text-brand-dark hover:bg-brand-light">
          <QrCode size={18} aria-hidden="true" /> Tôi đã có mã trên chai
        </button>
      </div>
    </div>
  );
}

function PaywallBody({ cfg, message, go, canTrial }) {
  const perks = ['Kế hoạch ăn trọn 7 ngày, tự đổi món theo khẩu vị', 'Nhắc uống nước, uống sữa, vận động đúng giờ', 'Thực đơn tính theo calo & mục tiêu của bạn'];
  return (
    <div className="flex flex-col gap-6 pt-2">
      <Header eyebrow="Gói NUTRIVA" title="Mở khóa trọn bộ NUTRIVA" text={message || 'Kế hoạch đầy đủ và nhắc nhở dành cho tài khoản còn hạn gói.'} />
      <DayValueTiles cfg={cfg} />
      <ul className="flex flex-col gap-2">
        {perks.map((p) => (
          <li key={p} className="flex items-start gap-2 text-sm text-secondary">
            <Check size={18} className="mt-0.5 shrink-0 text-brand-main" aria-hidden="true" /> {p}
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-2">
        {canTrial && <TrialButton days={cfg.freePlanDays} label={`Dùng thử miễn phí ${cfg.freePlanDays} ngày`} onDone={() => go('/plan')} />}
        <PrimaryButton variant={canTrial ? 'outline' : 'primary'} className="w-full" onClick={() => go('/me/membership?scan=1')}>
          <QrCode size={20} aria-hidden="true" /> Quét mã trên chai
        </PrimaryButton>
        {canTrial ? (
          <button type="button" onClick={() => go('/shop?tab=milk')} className="inline-flex h-11 items-center justify-center gap-2 rounded-full text-sm font-bold text-brand-dark hover:bg-brand-light">
            <ShoppingBag size={18} aria-hidden="true" /> Mua sữa hạt trong app
          </button>
        ) : (
          <PrimaryButton variant="outline" className="w-full" onClick={() => go('/shop?tab=milk')}>
            <ShoppingBag size={20} aria-hidden="true" /> Mua sữa hạt trong app
          </PrimaryButton>
        )}
      </div>
      <div className="flex flex-col items-center gap-2">
        <p className="text-xs font-semibold text-muted">Hoặc mua tại gian hàng chính thức — mã nằm sẵn trên chai</p>
        <ChannelLinks chips from="paywall" className="justify-center" />
      </div>
    </div>
  );
}

// Lắng nghe sự kiện 'nutriva:paywall' (server trả MEMBERSHIP_REQUIRED hoặc người dùng bấm vào nội dung bị khóa)
// + lời chào dùng thử 1 lần cho tài khoản mới
export default function Paywall() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const cfg = useMemberConfig();
  const { m } = useMembership();
  const [state, setState] = useState(null); // { message } | { welcome: true }

  useEffect(() => {
    const onPaywall = (e) => {
      setState({ message: e.detail?.message });
      track('paywall.view', { feature: e.detail?.message?.slice(0, 40) ?? 'generic' });
    };
    window.addEventListener('nutriva:paywall', onPaywall);
    return () => window.removeEventListener('nutriva:paywall', onPaywall);
  }, []);

  useEffect(() => {
    if (!user?.createdAt || Date.now() - new Date(user.createdAt) > 24 * 3600 * 1000) return undefined;
    if (user.membership?.until || user.membership?.trialStart) return undefined; // đã có gói / đã dùng thử
    try {
      if (localStorage.getItem(WELCOME_KEY) === user.id) return undefined;
      localStorage.setItem(WELCOME_KEY, user.id);
    } catch {
      return undefined;
    }
    const t = setTimeout(() => setState({ welcome: true }), 1500);
    return () => clearTimeout(t);
  }, [user?.id, user?.createdAt, user?.membership?.until, user?.membership?.trialStart]);

  const close = () => setState(null);
  const go = (to) => {
    close();
    navigate(to);
  };
  const welcome = state?.welcome;
  return (
    <Sheet
      open={Boolean(state)}
      onClose={close}
      bare
      title={welcome ? 'Dùng thử miễn phí' : 'Mở khóa gói NUTRIVA'}
      hero={<BottleTrio lines={welcome ? ['sen-com', 'mach-nhien', 'lut-thanh'] : ['huyen-moc', 'nau-moc', 'sen-thanh']} h={HERO.h} poolTo="#F8FAF8" />}
      heroH={HERO.total}
      heroOverlap={HERO.overlap}
    >
      {state && (welcome ? <WelcomeBody cfg={cfg} go={go} /> : <PaywallBody cfg={cfg} message={state.message} go={go} canTrial={memberState(m) === 'new'} />)}
    </Sheet>
  );
}

// Hàng món ăn giả (làm mờ) phía sau lớp khóa — cho thấy "bên trong có gì"
const PREVIEW = [
  { c: 'bg-breakfast-card', w: 'w-3/4' },
  { c: 'bg-lunch-card', w: 'w-2/3' },
  { c: 'bg-dinner-card', w: 'w-4/5' },
];

// Thay cho nội dung bị khóa (ngày kế hoạch, nhắc nhở…). compact: 1 dòng như thẻ theo dõi ở trang chủ.
export function LockedCard({ title = 'Nội dung dành cho thành viên', text, compact = false }) {
  const cfg = useMemberConfig();
  const { m } = useMembership();
  const canTrial = memberState(m) === 'new';
  // Tài khoản mới chưa dùng thử: mời kích hoạt dùng thử thay vì quét mã
  if (canTrial && !compact)
    return (
      <section className="relative overflow-hidden rounded-xl bg-white shadow-card">
        <div className="flex select-none flex-col gap-4 p-4 opacity-70 blur-[3px]" aria-hidden="true">
          {PREVIEW.map((r) => (
            <div key={r.c} className="flex items-center gap-4">
              <span className={cx('size-14 shrink-0 rounded-lg', r.c)} />
              <span className="flex flex-1 flex-col gap-2">
                <span className={cx('h-3 rounded-full bg-divider', r.w)} />
                <span className="h-3 w-1/3 rounded-full bg-border" />
              </span>
            </div>
          ))}
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-b from-white/40 via-white/90 to-white px-6 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-brand-dark text-white shadow-float" aria-hidden="true">
            <Sparkles size={22} />
          </span>
          <p className="text-base font-bold leading-6 text-primary">Kế hoạch ăn đang chờ bạn mở</p>
          <p className="text-sm text-secondary">Kích hoạt dùng thử miễn phí {cfg.freePlanDays} ngày — mỗi tài khoản 1 lần.</p>
          <TrialButton days={cfg.freePlanDays} className="mt-1 h-11 px-6 text-sm" />
        </div>
      </section>
    );
  if (compact)
    return (
      <section className="flex items-center gap-4 rounded-xl bg-white p-4 shadow-card">
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-brand-light text-brand-dark" aria-hidden="true">
          <Lock size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold leading-6 text-primary">{title}</p>
          {text && <p className="line-clamp-2 text-xs text-muted">{text}</p>}
        </div>
        <Link to="/me/membership" className="inline-flex h-10 shrink-0 items-center rounded-full bg-brand-dark px-4 text-sm font-bold text-white transition active:scale-95">
          {canTrial ? 'Dùng thử' : 'Mở khóa'}
        </Link>
      </section>
    );
  return (
    <section className="relative overflow-hidden rounded-xl bg-white shadow-card">
      <div className="flex select-none flex-col gap-4 p-4 opacity-70 blur-[3px]" aria-hidden="true">
        {PREVIEW.map((r) => (
          <div key={r.c} className="flex items-center gap-4">
            <span className={cx('size-14 shrink-0 rounded-lg', r.c)} />
            <span className="flex flex-1 flex-col gap-2">
              <span className={cx('h-3 rounded-full bg-divider', r.w)} />
              <span className="h-3 w-1/3 rounded-full bg-border" />
            </span>
            <span className="h-8 w-8 rounded-full bg-surface" />
          </div>
        ))}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-b from-white/40 via-white/90 to-white px-6 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-brand-dark text-white shadow-float" aria-hidden="true">
          <Lock size={22} />
        </span>
        <p className="text-base font-bold leading-6 text-primary [text-wrap:balance]">{title}</p>
        {text && <p className="text-sm text-secondary [text-wrap:pretty]">{text}</p>}
        <Link to="/me/membership?scan=1" className="mt-1 inline-flex h-11 items-center gap-2 rounded-full bg-brand-dark px-6 text-sm font-bold text-white shadow-pill transition active:scale-95">
          <QrCode size={18} aria-hidden="true" /> Quét mã trên chai • +{cfg.daysPerBottle} ngày
        </Link>
      </div>
    </section>
  );
}
