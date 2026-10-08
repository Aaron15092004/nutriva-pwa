import { Heart, Flame, Check, Plus } from 'lucide-react';
import { MEAL_THEME } from '../../theme/meals.js';
import { fmt, cx } from '../ds/index.jsx';

const TAG = { cook: 'Tự nấu', quick: 'Nhanh gọn' };

// Thẻ món gợi ý (ảnh, yêu thích, kcal, kiểu chế biến, nút ghi lại)
export default function RecommendationCard({ item, mealLabel, favorite, tracked, busy, onFavorite, onTrack }) {
  const t = MEAL_THEME[item.meal] ?? MEAL_THEME.snack;
  return (
    <article className="flex w-52 shrink-0 snap-start flex-col overflow-hidden rounded-xl bg-white shadow-card">
      <div className="relative h-40">
        {item.image ? (
          <img src={item.image} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className={cx('grid h-full w-full place-items-center', t.card)} aria-hidden="true">
            <t.icon size={48} className={t.iconColor} />
          </div>
        )}
        <button
          type="button"
          aria-pressed={favorite}
          aria-label={favorite ? `Bỏ yêu thích ${item.name}` : `Yêu thích ${item.name}`}
          onClick={onFavorite}
          className="absolute right-2 top-2 grid h-10 w-10 place-items-center rounded-full bg-white/95 transition active:scale-95"
        >
          <Heart size={18} className={favorite ? 'fill-warm-main text-warm-main' : 'text-primary'} aria-hidden="true" />
        </button>
        <div className="absolute bottom-2 left-2 flex gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-1 font-secondary text-xs font-semibold text-primary">
            <Flame size={14} className="text-warm-main" aria-hidden="true" /> {fmt(item.kcal)} kcal
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-1 font-secondary text-xs font-semibold text-primary">
            <span className="h-2 w-2 rounded-full bg-recipe" aria-hidden="true" /> {TAG[item.tag] ?? 'Gợi ý'}
          </span>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="flex-1">
          <p className="text-xs font-semibold text-muted">{mealLabel}</p>
          <h3 className="line-clamp-2 text-base font-bold leading-6 text-primary">{item.name}</h3>
        </div>
        <button
          type="button"
          onClick={onTrack}
          disabled={busy || tracked}
          className={cx(
            'flex h-12 items-center justify-center gap-2 rounded-md text-base font-bold transition duration-150 active:scale-[0.98] disabled:cursor-default',
            tracked ? 'bg-brand-light text-brand-dark' : 'bg-primary text-white hover:bg-dark',
          )}
        >
          {tracked ? <Check size={18} aria-hidden="true" /> : <Plus size={18} aria-hidden="true" />}
          {tracked ? 'Đã ghi' : 'Ghi lại'}
        </button>
      </div>
    </article>
  );
}
