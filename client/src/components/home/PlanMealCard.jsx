import { Flame, Check, Plus } from 'lucide-react';
import { MEAL_THEME } from '../../theme/meals.js';
import { fmt, cx } from '../ds/index.jsx';

// Thẻ 1 bữa trong kế hoạch đang áp dụng (trang chủ): các món + tổng calo + ghi cả bữa 1 chạm
export default function PlanMealCard({ meal, label, items, kcal, logged, busy, onLog }) {
  const t = MEAL_THEME[meal] ?? MEAL_THEME.snack;
  const image = items.find((x) => x.image)?.image;
  const names = items.map((x) => x.name);
  return (
    <article className="flex w-60 shrink-0 snap-start flex-col overflow-hidden rounded-xl bg-white shadow-card">
      <div className="relative h-32">
        {image ? (
          <img src={image} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className={cx('grid h-full w-full place-items-center', t.card)} aria-hidden="true">
            <t.icon size={44} className={t.iconColor} />
          </div>
        )}
        <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-1 font-secondary text-xs font-semibold text-primary">
          <Flame size={14} className="text-warm-main" aria-hidden="true" /> {fmt(kcal)} kcal
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="flex-1">
          <p className="text-xs font-semibold text-muted">{label}</p>
          <h3 className="line-clamp-2 text-base font-bold leading-6 text-primary">{names.slice(0, 2).join(' • ')}</h3>
          {names.length > 2 && <p className="text-xs text-muted">+{names.length - 2} món khác</p>}
        </div>
        <button
          type="button"
          onClick={onLog}
          disabled={busy || logged}
          className={cx(
            'flex h-12 items-center justify-center gap-2 rounded-md text-base font-bold transition duration-150 active:scale-[0.98] disabled:cursor-default',
            logged ? 'bg-brand-light text-brand-dark' : 'bg-primary text-white hover:bg-dark',
          )}
        >
          {logged ? <Check size={18} aria-hidden="true" /> : <Plus size={18} aria-hidden="true" />}
          {logged ? 'Đã ghi' : busy ? 'Đang ghi…' : items.length > 1 ? `Ghi cả bữa (${items.length} món)` : 'Ghi lại'}
        </button>
      </div>
    </article>
  );
}
