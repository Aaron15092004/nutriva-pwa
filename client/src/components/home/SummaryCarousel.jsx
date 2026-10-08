import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, Utensils, Flame } from 'lucide-react';
import { colors } from '../../theme/tokens.js';
import { ProgressBar, ProgressRing, fmt, cx } from '../ds/index.jsx';

const TONE = { good: 'bg-success text-recipe', warn: 'bg-warning text-snacks-hint', bad: 'bg-error text-warm-dark' };

function Badge({ cat }) {
  if (!cat) return null;
  return <span className={cx('self-start rounded-full px-2 py-0.5 text-xs font-bold', TONE[cat.tone])}>{cat.label}</span>;
}

function PanelTitle({ children, edit }) {
  return (
    <div className="flex min-h-10 items-center justify-between gap-2">
      <h2 className="text-sm font-bold text-primary">{children}</h2>
      {edit && (
        <Link to="/me/edit" aria-label="Chỉnh hồ sơ & mục tiêu" className="grid h-10 w-10 place-items-center rounded-full text-secondary hover:bg-white/60">
          <Pencil size={16} aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value, unit, valueClass, iconClass }) {
  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-muted">
        {label} <Icon size={20} strokeWidth={2.25} className={iconClass} aria-hidden="true" />
      </div>
      <div className="flex items-baseline gap-1">
        <span className={cx('font-secondary text-xl font-bold', valueClass)}>{value}</span>
        <span className="text-sm text-muted">{unit}</span>
      </div>
    </div>
  );
}

// Trang 1: năng lượng trong ngày
function EnergyPanel({ goalLabel, h, eaten, burned }) {
  const left = h.targetKcal - eaten.kcal + burned;
  const over = left < 0;
  const macros = [
    { k: 'carb', label: 'Bột đường', fill: 'bg-water-icon' },
    { k: 'protein', label: 'Đạm', fill: 'bg-brand-main' },
    { k: 'fat', label: 'Béo', fill: 'bg-warm-main' },
  ];
  return (
    <div className="flex flex-col gap-4">
      <PanelTitle edit>{goalLabel}: {fmt(h.targetKcal)} kcal</PanelTitle>
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-4">
          <Stat icon={Utensils} label="Đã ăn" value={fmt(eaten.kcal)} unit="kcal" valueClass="text-brand-dark" iconClass="text-brand-main" />
          <Stat icon={Flame} label="Đã đốt" value={fmt(burned)} unit="kcal" valueClass="text-primary" iconClass="text-warm-main" />
        </div>
        <ProgressRing value={h.targetKcal - Math.max(0, left)} max={h.targetKcal} size={128} stroke={12} color={over ? colors.warm.main : colors.brand.main}>
          <div>
            <div className={cx('font-secondary text-2xl font-bold', over ? 'text-warm-dark' : 'text-primary')}>{fmt(Math.abs(left))}</div>
            <div className="text-xs text-muted">{over ? 'kcal vượt' : 'kcal còn lại'}</div>
          </div>
        </ProgressRing>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {macros.map((m) => (
          <div key={m.k} className="flex min-w-0 flex-col gap-1">
            <span className="text-xs text-muted">{m.label}</span>
            <ProgressBar value={eaten[m.k]} max={h.macros[m.k]} fill={m.fill} label={m.label} />
            <span className="font-secondary text-xs">
              <b className="text-primary">{fmt(eaten[m.k], 1)}</b>
              <span className="text-muted"> / {h.macros[m.k]}g</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BigMetric({ label, value, unit, cat, note }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg bg-white/70 p-4">
      <span className="text-xs text-muted">{label}</span>
      <span className="flex items-baseline gap-1">
        <b className="font-secondary text-2xl text-primary">{value ?? '--'}</b>
        {unit && <span className="text-xs text-muted">{unit}</span>}
      </span>
      <Badge cat={cat} />
      {note && <span className="text-xs text-muted">{note}</span>}
    </div>
  );
}

// Trang 2: chỉ số cơ thể
function BodyPanel({ h, p }) {
  return (
    <div className="flex flex-col gap-4">
      <PanelTitle edit>Chỉ số cơ thể</PanelTitle>
      <div className="grid grid-cols-2 gap-4">
        <BigMetric label="BMI" value={h.bmi} cat={h.bmiCategory} />
        <BigMetric label="Eo / chiều cao (WHtR)" value={h.whtr} cat={h.whtrCategory} />
      </div>
      <p className="font-secondary text-xs text-muted">
        {p.heightCm} cm • {p.weightKg} kg • vòng eo {p.waistCm} cm
      </p>
    </div>
  );
}

// Trang 3: năng lượng nền & công thức
function MetabolismPanel({ h, p }) {
  return (
    <div className="flex flex-col gap-4">
      <PanelTitle>Năng lượng nền</PanelTitle>
      <div className="grid grid-cols-2 gap-4">
        <BigMetric label="BMR" value={fmt(h.bmr)} unit="kcal" note="Mifflin – St Jeor" />
        <BigMetric label="TDEE" value={fmt(h.tdee)} unit="kcal" note={`BMR × ${h.activityFactor}`} />
      </div>
      <p className="font-secondary text-xs leading-4 text-muted">
        10 × {p.weightKg} + 6,25 × {p.heightCm} − 5 × {p.age} {p.gender === 'male' ? '+ 5' : '− 161'} = {fmt(h.bmr)} kcal. Chỉ số mang tính tham khảo.
      </p>
    </div>
  );
}

// Thẻ tổng quan dạng carousel (vuốt ngang) + chấm phân trang
export default function SummaryCarousel({ goalLabel, health, profile, eaten, burned }) {
  const ref = useRef(null);
  const [page, setPage] = useState(0);
  const pages = [
    { id: 'energy', label: 'Năng lượng hôm nay', node: <EnergyPanel goalLabel={goalLabel} h={health} eaten={eaten} burned={burned} /> },
    { id: 'body', label: 'Chỉ số cơ thể', node: <BodyPanel h={health} p={profile} /> },
    { id: 'meta', label: 'Năng lượng nền', node: <MetabolismPanel h={health} p={profile} /> },
  ];

  const onScroll = (e) => {
    const el = e.currentTarget;
    setPage(Math.round(el.scrollLeft / el.clientWidth));
  };
  const go = (i) => ref.current?.scrollTo({ left: i * ref.current.clientWidth, behavior: 'smooth' });

  return (
    <section aria-roledescription="carousel" aria-label="Tổng quan dinh dưỡng" className="flex flex-col gap-4">
      <div
        ref={ref}
        onScroll={onScroll}
        className="flex snap-x snap-mandatory overflow-x-auto rounded-xl bg-gradient-to-t from-brand-light via-brand-soft to-brand-pastel shadow-card [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {pages.map((pg, i) => (
          <div key={pg.id} className="w-full shrink-0 snap-center p-4" role="group" aria-roledescription="slide" aria-label={`${i + 1} / ${pages.length}: ${pg.label}`}>
            {pg.node}
          </div>
        ))}
      </div>
      <div className="flex justify-center" role="tablist" aria-label="Trang tổng quan">
        {pages.map((pg, i) => (
          <button key={pg.id} type="button" role="tab" aria-selected={page === i} aria-label={pg.label} onClick={() => go(i)} className="grid h-6 w-6 place-items-center">
            <span className={cx('h-1.5 rounded-full transition-all duration-300', page === i ? 'w-4 bg-primary' : 'w-1.5 bg-border')} />
          </button>
        ))}
      </div>
    </section>
  );
}
