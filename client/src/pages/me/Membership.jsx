import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { QrCode, Gift, ReceiptText, Clock, ShieldCheck, RefreshCw, ChevronRight, Sparkles, Lock } from 'lucide-react';
import { api } from '../../lib/api.js';
import { useApi } from '../../lib/useApi.js';
import { useMembership, refreshLocked, fmtDate, memberState } from '../../lib/membership.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { TopBar, ErrorNote, Skeleton, Logo } from '../../components/ui.jsx';
import { PrimaryButton } from '../../components/ds/form.jsx';
import { cx } from '../../components/ds/index.jsx';
import Nuti from '../../components/mascot/Nuti.jsx';
import ChannelLinks from '../../components/promo/ChannelLinks.jsx';
import QrScanner from '../../components/membership/QrScanner.jsx';
import TrialStrip from '../../components/membership/TrialStrip.jsx';
import { DayValueTiles, TrialButton } from '../../components/membership/Paywall.jsx';
import { BottleScene } from '../../components/brand/MilkArt.jsx';
import { flavorOf, FLAVORS } from '../../components/brand/art.js';

const SOURCE = { code: 'Mã trên chai', order: 'Đơn hàng', admin: 'NUTRIVA tặng', migration: 'Quà ra mắt', revoke: 'Thu hồi' };
const SOURCE_ICON = { code: QrCode, order: ReceiptText, admin: Gift, migration: Gift, revoke: Clock };
// Hiển thị mã theo nhóm 5 ký tự: XXXXX-XXXXX
const format = (raw) => {
  const c = raw.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 10);
  return c.length > 5 ? `${c.slice(0, 5)}-${c.slice(5)}` : c;
};
const vnd = (n) => `${Number(n ?? 0).toLocaleString('vi-VN')}đ`;

// Thẻ thành viên: số ngày còn lại thật lớn, chai sữa "tràn" khỏi mép trên của thẻ
const CARD = {
  member: { bg: 'linear-gradient(140deg, #2F4B23 0%, #435A1C 55%, #5E7F27 100%)', dark: true, line: 'mach-nhien' },
  trial: { bg: 'radial-gradient(120% 100% at 90% 10%, #FFFFFF 0%, #F2F8E1 40%, #C9E099 100%)', line: 'sen-com' },
  new: { bg: 'radial-gradient(120% 100% at 90% 10%, #FFFFFF 0%, #FFF6DF 40%, #F7D98F 100%)', line: 'mach-nhien' },
  expired: { bg: 'radial-gradient(120% 100% at 90% 10%, #FFFFFF 0%, #FFF0E7 40%, #F5BFA0 100%)', line: 'lut-thanh' },
  over: { bg: 'radial-gradient(120% 100% at 90% 10%, #FFFFFF 0%, #FFF0E7 40%, #F5BFA0 100%)', line: 'lut-thanh' },
};
const CHIP = {
  new: ['Chưa kích hoạt', Sparkles],
  trial: ['Dùng thử miễn phí', Sparkles],
  expired: ['Đã hết hạn', Lock],
  over: ['Hết dùng thử', Lock],
};
const SUB = {
  new: () => 'Mỗi tài khoản được dùng thử 1 lần',
  expired: (m) => `Hết hạn ${fmtDate(m.until)}`,
  over: () => 'Kế hoạch & nhắc nhở đang tạm khóa',
  trial: (m) => `Kế hoạch mở ngày 1–${m.freePlanDays} trên 7 ngày`,
  member: (m) => `Dùng đến ${fmtDate(m.until)}`,
};

function MemberCard({ m }) {
  if (!m) return <Skeleton h={232} />;
  const state = memberState(m);
  const look = CARD[state];
  const ink = look.dark ? '#FFFFFF' : flavorOf(look.line).ink;
  const [chipText, ChipIcon] = state === 'member' ? (m.expiring ? ['Sắp hết hạn', Clock] : ['Đang hoạt động', ShieldCheck]) : CHIP[state];
  const big = { member: m.daysLeft, trial: m.trialLeft }[state];
  return (
    <section aria-label="Thẻ thành viên NUTRIVA" className="pt-12">
      <div className="relative h-[196px]">
        <div className="absolute inset-0 overflow-hidden rounded-2xl shadow-float" style={{ background: look.bg }}>
          <span className={cx('absolute -right-16 -top-20 size-64 rounded-full border', look.dark ? 'border-white/10' : 'border-white/70')} />
          <span className={cx('absolute -right-2 -top-6 size-40 rounded-full border', look.dark ? 'border-white/10' : 'border-white/60')} />
        </div>
        <div className="absolute inset-0" style={{ clipPath: 'inset(-80px 0 0 0 round 0 0 32px 32px)' }}>
          <BottleScene line={look.line} h={214} nuts={false} seed={4} className="absolute -right-3 bottom-0" />
        </div>
        <div className="absolute inset-y-0 left-0 flex w-[60%] flex-col gap-1 p-5" style={{ color: ink }}>
          <Logo size={22} tone={look.dark ? 'white' : 'color'} />
          <span className={cx('mt-2 inline-flex items-center gap-1 self-start rounded-full px-2 py-0.5 text-2xs font-bold uppercase tracking-wider', look.dark ? 'bg-white/15' : 'bg-white/80')}>
            <ChipIcon size={12} aria-hidden="true" /> {chipText}
          </span>
          {big == null ? (
            <p className="mt-auto font-display text-[26px] font-bold leading-8 [font-variation-settings:'SOFT'_100]">{{ expired: 'Gia hạn để dùng tiếp', over: 'Kích hoạt để dùng tiếp', new: `Nhận ${m.freePlanDays} ngày dùng thử` }[state]}</p>
          ) : (
            <p className="mt-auto flex items-baseline gap-2">
              <span className="font-display text-[52px] font-bold leading-none tabular-nums [font-variation-settings:'SOFT'_100]">{big}</span>
              <span className="text-sm font-bold">{state === 'trial' ? 'ngày dùng thử' : 'ngày còn lại'}</span>
            </p>
          )}
          <p className={cx('text-xs font-semibold', look.dark ? 'text-brand-soft' : 'opacity-80')}>{SUB[state](m)}</p>
        </div>
      </div>
      {state === 'new' && (
        <div className="mt-4 flex flex-col gap-2">
          <TrialButton days={m.freePlanDays} />
          <p className="text-center text-xs text-muted">Mở kế hoạch ăn {m.freePlanDays} ngày kể từ lúc kích hoạt. Sau đó quét mã trên chai sữa để dùng tiếp.</p>
        </div>
      )}
      {state === 'trial' && (
        <div className="mt-4 flex flex-col gap-2 rounded-xl bg-white p-4 shadow-card">
          <p className="text-sm font-bold text-primary">Kế hoạch 7 ngày của bạn</p>
          <TrialStrip free={m.freePlanDays} today={Math.max(0, m.freePlanDays - m.trialLeft)} />
          <p className="text-xs text-muted">Dùng thử đến hết {fmtDate(`${m.trialEnds}T12:00:00`)}. Sau đó kế hoạch và nhắc nhở cần mã kích hoạt trên chai sữa.</p>
        </div>
      )}
    </section>
  );
}

// Minh họa vị trí mã: cổ chai + tem QR
const QR_CELLS = [0, 1, 2, 4, 6, 7, 9, 11, 12, 13, 15];
function CodeTagArt() {
  return (
    <svg viewBox="0 0 72 72" className="size-16 shrink-0" aria-hidden="true">
      <rect x="2" y="2" width="68" height="68" rx="18" fill="#F2F7E7" />
      <rect x="17" y="9" width="18" height="9" rx="3" fill="#24282C" />
      <path d="M18 18h16v5c0 3 7 6 7 12v31H11V35c0-6 7-9 7-12z" fill="#FBF5E6" stroke="#DCCB9E" strokeWidth="1.5" />
      <rect x="11" y="40" width="30" height="16" fill="#F7D98F" opacity=".6" />
      <g transform="rotate(-8 52 42)">
        <rect x="36" y="26" width="30" height="36" rx="6" fill="#FFFFFF" stroke="#7CA034" strokeWidth="1.8" />
        {QR_CELLS.map((c) => (
          <rect key={c} x={41 + (c % 4) * 5} y={31 + Math.floor(c / 4) * 5} width="4" height="4" rx="1" fill="#2F4B23" />
        ))}
        <rect x="41" y="54" width="20" height="3" rx="1.5" fill="#C2DB8E" />
      </g>
    </svg>
  );
}

// Mua thêm để gia hạn: 6 vị sữa (hình chai thật) + gói định kỳ
function BuyRail() {
  const { data } = useApi('/products?type=milk');
  const items = (data?.products ?? []).filter((p) => FLAVORS[p.line]);
  if (!items.length) return null;
  return (
    <div className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-2 overflow-x-auto px-4 pb-2 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {items.map((p) => {
        const f = flavorOf(p.line);
        return (
          <Link key={p.slug} to={`/shop/p/${p.slug}`} className="flex w-28 shrink-0 snap-start flex-col rounded-lg bg-white p-2 shadow-pill transition active:scale-[0.98]">
            <span className="relative block h-28 overflow-hidden rounded-md" style={{ background: `linear-gradient(160deg, ${f.bg[0]}, ${f.bg[1]})` }} aria-hidden="true">
              <img src={`/img/products/hero-${p.line}.webp`} alt="" loading="lazy" className="absolute left-1/2 top-2 w-12 -translate-x-1/2 rotate-[-4deg] drop-shadow-[0_6px_8px_rgba(40,30,10,0.25)]" />
            </span>
            <span className="mt-2 block truncate text-sm font-bold text-primary">{f.name}</span>
            <span className="block font-secondary text-xs text-muted">{vnd(p.price)}</span>
          </Link>
        );
      })}
      <Link to="/shop/subscribe" className="flex w-28 shrink-0 snap-start flex-col justify-between rounded-lg bg-brand-core p-4 text-white shadow-pill transition active:scale-[0.98]">
        <RefreshCw size={22} aria-hidden="true" />
        <span>
          <span className="block text-sm font-bold leading-5">Gói định kỳ</span>
          <span className="block text-xs text-brand-soft">Tự cộng ngày mỗi kỳ giao</span>
        </span>
      </Link>
    </div>
  );
}

export default function Membership() {
  const toast = useToast();
  const { user, setUser } = useAuth();
  const { m, history, reload, loading } = useMembership();
  const [params, setParams] = useSearchParams();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null); // { days, until }
  const [scanning, setScanning] = useState(false);
  const input = useRef(null);
  const autoSubmitted = useRef(false);

  const redeem = useCallback(
    async (raw, via = 'manual') => {
      setBusy(true);
      setError('');
      try {
        const r = await api.post('/membership/redeem', { code: raw, via });
        setDone({ days: r.days, until: r.until });
        setUser({ ...user, membership: { until: r.until } });
        setCode('');
        refreshLocked();
        reload();
        toast(`Đã kích hoạt +${r.days} ngày`);
      } catch (e) {
        setError(e.message);
      } finally {
        setBusy(false);
      }
    },
    [reload, setUser, toast, user],
  );

  // Mở từ QR quét bằng camera thường (link /activate?code=...) → điền sẵn và kích hoạt luôn
  useEffect(() => {
    const c = params.get('code');
    if (c && !autoSubmitted.current) {
      autoSubmitted.current = true;
      setCode(format(c));
      redeem(c, 'qr');
      setParams({}, { replace: true });
    } else if (params.get('scan') === '1') {
      input.current?.focus();
      setParams({}, { replace: true });
    }
  }, [params, setParams, redeem]);

  const onScan = useCallback(
    (c) => {
      setScanning(false);
      setCode(format(c));
      redeem(c, 'qr');
    },
    [redeem],
  );

  return (
    <>
      <TopBar title="Gói NUTRIVA" fallback="/me" />
      <main className="flex flex-col gap-6 px-4 pb-[calc(32px+var(--safe-b))]">
        <MemberCard m={m} />

        {done ? (
          <section role="status" className="flex flex-col items-center gap-2 rounded-xl bg-breakfast-card p-6 text-center shadow-card">
            <Nuti mood="dance" size={104} />
            <p className="font-display text-3xl font-bold text-brand-core [font-variation-settings:'SOFT'_100]">+{done.days} ngày!</p>
            <p className="text-sm text-secondary">Kế hoạch đầy đủ và nhắc nhở đã mở. Dùng đến {fmtDate(done.until)}.</p>
            <div className="mt-2 flex gap-2">
              <Link to="/plan" className="inline-flex h-11 items-center rounded-full bg-brand-dark px-6 text-sm font-bold text-white">Xem kế hoạch</Link>
              <button type="button" onClick={() => setDone(null)} className="inline-flex h-11 items-center rounded-full bg-white px-6 text-sm font-bold text-brand-deep shadow-pill">Nhập mã khác</button>
            </div>
          </section>
        ) : (
          <section aria-labelledby="code-title" className="flex flex-col gap-4 rounded-xl bg-white p-4 shadow-card">
            <div className="flex items-center gap-4">
              <CodeTagArt />
              <div className="min-w-0">
                <h2 id="code-title" className="text-base font-bold leading-6 text-primary">Kích hoạt bằng mã trên chai</h2>
                <p className="text-xs text-muted">Tem QR và mã 10 ký tự dán trên mỗi chai sữa, mỗi gói hạt. Mỗi mã dùng 1 lần.</p>
              </div>
            </div>
            <PrimaryButton className="w-full" onClick={() => setScanning(true)}>
              <QrCode size={20} aria-hidden="true" /> Quét mã QR
            </PrimaryButton>
            <div className="flex items-center gap-2 text-xs text-muted" aria-hidden="true">
              <span className="h-px flex-1 bg-border" /> hoặc nhập mã <span className="h-px flex-1 bg-border" />
            </div>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (code.replace('-', '').length === 10) redeem(code);
              }}
            >
              <label htmlFor="act-code" className="sr-only">Mã kích hoạt</label>
              <input
                ref={input}
                id="act-code"
                value={code}
                onChange={(e) => setCode(format(e.target.value))}
                placeholder="XXXXX-XXXXX"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                inputMode="text"
                className="h-14 min-w-0 flex-1 rounded-lg border border-border bg-background px-2 text-center font-secondary text-xl font-bold tracking-[0.14em] text-primary outline-none placeholder:text-divider focus:border-brand-main focus:ring-2 focus:ring-brand-soft"
              />
              <button type="submit" disabled={busy || code.replace('-', '').length !== 10} className="h-14 shrink-0 rounded-lg bg-brand-light px-4 text-sm font-bold text-brand-deep transition enabled:hover:bg-brand-soft disabled:opacity-50">
                {busy ? 'Đang kiểm tra…' : 'Kích hoạt'}
              </button>
            </form>
            <ErrorNote error={error} />
          </section>
        )}

        <section aria-labelledby="how-title" className="flex flex-col gap-2">
          <h2 id="how-title" className="text-lg font-bold text-primary">Cách cộng ngày</h2>
          <DayValueTiles cfg={{ daysPerBottle: m?.daysPerBottle ?? 2, daysPerSet: m?.daysPerSet ?? 4 }} />
          <p className="flex items-start gap-2 rounded-lg bg-brand-light px-4 py-2 text-xs text-brand-deep">
            <ReceiptText size={16} className="mt-0.5 shrink-0" aria-hidden="true" /> Mua trong app hoặc gói định kỳ: tự cộng ngày khi đơn đã thanh toán, không cần quét mã. Ngày mới được cộng dồn vào hạn hiện tại.
          </p>
        </section>

        <section aria-labelledby="buy-title" className="flex flex-col">
          <div className="flex items-center justify-between">
            <h2 id="buy-title" className="text-lg font-bold text-primary">Mua thêm để gia hạn</h2>
            <Link to="/shop?tab=milk" className="inline-flex h-10 items-center gap-1 text-sm font-bold text-brand-dark">
              Cửa hàng <ChevronRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <BuyRail />
          <p className="mb-2 mt-2 text-xs text-muted">Hoặc mua tại gian hàng chính thức — mã đã dán sẵn trên từng chai</p>
          <ChannelLinks chips from="membership" />
        </section>

        <section aria-labelledby="hist-title" className="flex flex-col gap-2">
          <h2 id="hist-title" className="text-lg font-bold text-primary">Lịch sử gia hạn</h2>
          {loading && !history.length && <Skeleton h={80} />}
          {!loading && !history.length && <p className="rounded-xl bg-white p-4 text-sm text-muted shadow-card">Chưa có lần gia hạn nào. Quét mã trên chai đầu tiên để bắt đầu.</p>}
          {history.length > 0 && (
            <ul className="rounded-xl bg-white px-4 shadow-card">
              {history.map((h) => {
                const I = SOURCE_ICON[h.source] ?? Gift;
                return (
                  <li key={h._id} className="flex items-center gap-4 border-b border-surface py-4 last:border-0">
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-light text-brand-dark" aria-hidden="true">
                      <I size={18} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-primary">
                        {SOURCE[h.source] ?? h.source}
                        {h.ref ? ` • ${h.ref}` : ''}
                      </span>
                      <span className="block truncate text-xs text-muted">
                        {fmtDate(h.createdAt)}
                        {h.note ? ` • ${h.note}` : ''}
                      </span>
                    </span>
                    <span className={cx('rounded-full px-2 py-1 font-secondary text-xs font-bold tabular-nums', h.days > 0 ? 'bg-brand-light text-brand-deep' : 'bg-warm-light text-warm-dark')}>
                      {h.days > 0 ? '+' : ''}
                      {h.days} ngày
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
      <QrScanner open={scanning} onClose={() => setScanning(false)} onResult={onScan} />
    </>
  );
}
