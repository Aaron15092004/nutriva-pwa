// Thành phần dùng chung cho Kế hoạch ăn: macro, tổng ngày, dòng món, khối bữa, thẻ kế hoạch.
import { Link } from 'react-router-dom';
import { Zap, Wheat, Droplet, ChevronRight, Milk, Lock, LockOpen } from 'lucide-react';
import { PLAN_STYLES } from '@shared/nutrition.js';
import { MEAL_THEME } from '../../theme/meals.js';
import { colors } from '../../theme/tokens.js';
import { FOOD_ICON } from '../meals.js';
import { ProgressBar, fmt, cx } from '../ds/index.jsx';
import { useMembership, memberState } from '../../lib/membership.js';

export const STYLE_LABEL = Object.fromEntries(PLAN_STYLES.map((s) => [s.id, s.label]));
const MACROS = [
  { k: 'protein', label: 'Đạm', icon: Zap, cls: 'text-brand-main', color: colors.brand.main, kcal: 4 },
  { k: 'carb', label: 'Bột đường', icon: Wheat, cls: 'text-water-icon', color: colors.water.icon, kcal: 4 },
  { k: 'fat', label: 'Béo', icon: Droplet, cls: 'text-warm-main', color: colors.warm.main, kcal: 9 },
];

// Đạm • Bột đường • Béo (gram) với icon màu
export function MacroLine({ protein, carb, fat, className = '' }) {
  const v = { protein, carb, fat };
  return (
    <span className={cx('flex flex-wrap items-center gap-x-4 gap-y-1 font-secondary text-xs text-secondary', className)}>
      {MACROS.map((m) => (
        <span key={m.k} className="inline-flex items-center gap-1" title={m.label}>
          <m.icon size={14} className={m.cls} strokeWidth={2.25} aria-hidden="true" />
          <span className="sr-only">{m.label}</span>
          {fmt(v[m.k], 1)} g
        </span>
      ))}
    </span>
  );
}

// Vòng tỉ lệ năng lượng từ đạm / bột đường / béo
export function MacroDonut({ protein = 0, carb = 0, fat = 0, size = 48 }) {
  const parts = MACROS.map((m) => ({ ...m, v: ({ protein, carb, fat })[m.k] * m.kcal }));
  const total = parts.reduce((s, p) => s + p.v, 0) || 1;
  const stroke = size / 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let off = 0;
  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90" role="img" aria-label={parts.map((p) => `${p.label} ${Math.round((p.v / total) * 100)}%`).join(', ')}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={colors.surface} strokeWidth={stroke} />
      {parts.map((p) => {
        const len = (p.v / total) * c;
        const el = <circle key={p.k} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={p.color} strokeWidth={stroke} strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-off} />;
        off += len;
        return el;
      })}
    </svg>
  );
}

// Tổng năng lượng của ngày (+ tiến độ đã ăn nếu có)
export function DaySummary({ kcal, protein, carb, fat, eaten, children }) {
  return (
    <section aria-label="Tổng dinh dưỡng trong ngày" className="flex flex-col gap-4 rounded-xl bg-white p-4 shadow-card">
      <div className="flex items-center gap-4">
        <MacroDonut protein={protein} carb={carb} fat={fat} size={56} />
        <div className="min-w-0 flex-1">
          <p className="flex items-baseline gap-1">
            <b className="font-secondary text-2xl text-primary">{fmt(kcal)}</b>
            <span className="text-sm text-muted">kcal</span>
          </p>
          <MacroLine protein={protein} carb={carb} fat={fat} />
        </div>
      </div>
      {eaten != null && (
        <div className="flex items-center gap-4">
          <ProgressBar value={eaten} max={kcal} track="bg-surface" fill="bg-brand-main" label="Đã ăn so với thực đơn" />
          <span className="w-12 shrink-0 text-right font-secondary text-sm font-bold text-primary">{Math.min(100, Math.round((eaten / (kcal || 1)) * 100))}%</span>
        </div>
      )}
      {children}
    </section>
  );
}

// Ảnh món / ô icon theo nhóm thực phẩm (màu theo bữa)
export function ItemThumb({ item, size = 56 }) {
  const t = MEAL_THEME[item.meal] ?? MEAL_THEME.snack;
  if (item.image) return <img src={item.image} alt="" loading="lazy" className="shrink-0 rounded-md object-cover" style={{ width: size, height: size }} />;
  const Icon = item.kind === 'dish' || !item.group ? t.icon : FOOD_ICON[item.group];
  return (
    <span className={cx('grid shrink-0 place-items-center rounded-md', t.card)} style={{ width: size, height: size }} aria-hidden="true">
      <Icon size={size * 0.45} className={t.iconColor} />
    </span>
  );
}

export const amountText = (it) =>
  it.kind === 'dish'
    ? `${String(it.portion).replace('.', ',')} phần${it.grams ? ` (~${fmt(it.grams)} g)` : ''}`
    : `${fmt(it.grams)} ${/^sua-(?!chua)/.test(it.food ?? '') ? 'ml' : 'g'}${it.note ? ` (${it.note})` : ''}`;

// Món có sữa hạt NUTRIVA (thực phẩm sữa hạt, sản phẩm NUTRIVA hoặc món nấu với sữa hạt)
export const isMilkItem = (it) => it.food === 'sua-hat-nutriva' || it.kind === 'milk' || /sữa hạt/i.test(it.name ?? '');
const milkLink = (it) => (it.kind === 'milk' && it.slug ? `/shop/p/${it.slug}` : '/shop?tab=milk');

// Một món trong thực đơn: thumb, tên, định lượng • kcal, macro, nút hành động bên phải
export function PlanItemRow({ item, action, children, buy = true }) {
  return (
    <li className="flex items-center gap-4 rounded-lg bg-white p-4 shadow-card">
      <ItemThumb item={item} />
      <div className="min-w-0 flex-1">
        <p className={cx('line-clamp-2 text-base font-bold leading-6', item.missing ? 'text-muted line-through' : 'text-primary')}>{item.name}</p>
        <p className="font-secondary text-xs text-muted">
          {amountText(item)} • {fmt(item.kcal)} kcal
        </p>
        <MacroLine protein={item.protein} carb={item.carb} fat={item.fat} className="mt-1" />
        {buy && !item.missing && isMilkItem(item) && (
          <Link to={milkLink(item)} className="mt-2 inline-flex min-h-8 items-center gap-1 rounded-full bg-brand-light px-2 text-xs font-bold text-brand-deep hover:bg-brand-soft">
            <Milk size={14} aria-hidden="true" /> Mua sữa hạt NUTRIVA
          </Link>
        )}
        {children}
      </div>
      {action}
    </li>
  );
}

// Một bữa: tiêu đề + tổng kcal + danh sách món
export function MealBlock({ meal, label, kcal, children, footer }) {
  const t = MEAL_THEME[meal] ?? MEAL_THEME.snack;
  return (
    <section aria-labelledby={`pm-${meal}`} className="flex flex-col gap-2">
      <div className="flex min-h-10 items-center gap-2">
        <t.icon size={20} className={t.iconColor} aria-hidden="true" />
        <h3 id={`pm-${meal}`} className="flex-1 text-lg font-extrabold text-primary">{label}</h3>
        <span className="font-secondary text-sm text-secondary">{fmt(kcal)} kcal</span>
      </div>
      <ul className="flex flex-col gap-2">{children}</ul>
      {footer}
    </section>
  );
}

export function PlanPills({ plan, className = '' }) {
  const pills = [plan.style && plan.style !== 'eat-clean' ? STYLE_LABEL[plan.style] : null, `${plan.mealsPerDay} bữa/ngày`, `${plan.dayCount} ngày`].filter(Boolean);
  return (
    <span className={cx('flex flex-wrap gap-2', className)}>
      {pills.map((p) => (
        <span key={p} className="rounded-full bg-surface px-4 py-1 font-secondary text-xs font-semibold text-secondary">{p}</span>
      ))}
    </span>
  );
}

export const kcalRange = (p) => `${fmt(p.kcalMin)}–${fmt(p.kcalMax)} kcal/ngày`;

// Nhãn khóa trên ảnh bìa: đang dùng thử (mở vài ngày đầu) / hết hạn (cần kích hoạt). Thành viên → không hiện.
function LockBadge({ dayCount }) {
  const { m } = useMembership();
  if (!m?.enabled || m.active) return null;
  const st = memberState(m);
  const trial = st === 'trial';
  return (
    <span className={cx('absolute right-4 top-4 inline-flex items-center gap-1 rounded-full px-2 py-1 font-secondary text-xs font-bold shadow-pill', trial ? 'bg-white/95 text-brand-dark' : 'bg-primary/85 text-white')}>
      {trial ? <LockOpen size={12} aria-hidden="true" /> : <Lock size={12} aria-hidden="true" />}
      {trial ? `Mở ${Math.min(m.freePlanDays, dayCount)}/${dayCount} ngày` : st === 'new' ? 'Kích hoạt dùng thử để mở' : 'Cần kích hoạt'}
    </span>
  );
}

// Thẻ kế hoạch lớn có ảnh bìa (Khám phá, Tự tạo). Ảnh luôn 16:9 (ảnh nằm tuyệt đối → ảnh dọc không kéo cao thẻ)
export function PlanCard({ plan, badge }) {
  return (
    <Link to={`/plan/m/${plan.mine ? plan.id : plan.slug}`} className="group flex h-full flex-col overflow-hidden rounded-xl bg-white shadow-card transition hover:shadow-float active:scale-[0.99]">
      <div className="relative aspect-[16/9] shrink-0 overflow-hidden bg-surface">
        {plan.image && <img src={plan.image} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />}
        {badge && <span className="absolute left-4 top-4 rounded-full bg-white/95 px-2 py-1 font-secondary text-xs font-bold text-brand-dark shadow-pill">{badge}</span>}
        {!plan.mine && <LockBadge dayCount={plan.dayCount ?? 7} />}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 text-lg font-bold leading-6 text-primary group-hover:text-brand-dark">{plan.title}</h3>
        <p className="font-secondary text-sm text-muted">{kcalRange(plan)}</p>
        <PlanPills plan={plan} className="mt-auto" />
      </div>
    </Link>
  );
}

// Thẻ ngang gọn (kế hoạch đang áp dụng)
export function PlanMiniCard({ plan, note }) {
  return (
    <Link to={`/plan/m/${plan.mine ? plan.id : plan.slug}`} className="flex items-center gap-4 rounded-xl bg-white p-4 shadow-card transition hover:shadow-float active:scale-[0.99]">
      {plan.image ? (
        <img src={plan.image} alt="" loading="lazy" className="h-20 w-20 shrink-0 rounded-md object-cover" style={{ aspectRatio: '1 / 1' }} />
      ) : (
        <span className="h-20 w-20 shrink-0 rounded-md bg-surface" aria-hidden="true" />
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="line-clamp-2 text-base font-bold leading-6 text-primary">{plan.title}</span>
        <span className="font-secondary text-xs text-muted">{note ?? kcalRange(plan)}</span>
        <PlanPills plan={plan} />
      </span>
      <ChevronRight size={20} className="shrink-0 text-subtle" aria-hidden="true" />
    </Link>
  );
}
