import { Plus, MoreHorizontal } from 'lucide-react';
import { MEAL_THEME } from '../../theme/meals.js';
import { FOOD_ICON, sumMeal } from '../meals.js';
import { ProgressBar, CircleButton, fmt, cx } from '../ds/index.jsx';

// Thẻ một bữa ăn (Sáng / Trưa / Tối / Nhẹ). Màu lấy từ MEAL_THEME theo `meal`.
export default function MealCard({ meal, label, items = [], target, onOpen }) {
  const t = MEAL_THEME[meal];
  const total = sumMeal(items).kcal;
  const first = items[0];
  const ItemIcon = FOOD_ICON[first?.group] ?? t.icon;
  const lower = label.toLowerCase();

  return (
    <article aria-labelledby={`meal-${meal}`} className={cx('flex flex-col gap-4 rounded-xl p-4', t.card)}>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <t.icon size={24} className={t.iconColor} aria-hidden="true" />
          <h3 id={`meal-${meal}`} className="flex-1 text-base font-bold text-primary">{label}</h3>
          <span className="font-secondary text-xs text-secondary">
            {fmt(total)} / {fmt(target.max)} kcal
          </span>
          <CircleButton icon={Plus} label={`Thêm món cho ${lower}`} onClick={onOpen} />
        </div>
        <ProgressBar value={total} max={target.max} track={t.track} fill={t.fill} label={`Calo ${lower}`} />
      </div>

      {first ? (
        <div className="flex items-center gap-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-white/70" aria-hidden="true">
            <ItemIcon size={20} className={t.iconColor} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-primary">{first.name}</p>
            <p className="font-secondary text-xs text-secondary">
              {fmt(first.kcal)} kcal, {first.foodId ? `${fmt(first.grams)} g` : `${fmt(first.grams / 100, 1)} phần`}
              {items.length > 1 && ` • +${items.length - 1} món khác`}
            </p>
          </div>
          <CircleButton icon={MoreHorizontal} label={`Xem tất cả món của ${lower}`} onClick={onOpen} className="bg-transparent text-primary hover:bg-white/50" />
        </div>
      ) : (
        <button type="button" onClick={onOpen} className="flex flex-col items-start gap-1 text-left">
          <span className="text-sm text-secondary">Chưa ghi món nào</span>
          <span className={cx('text-xs font-semibold', t.hint)}>Nhấn + để thêm {lower}</span>
        </button>
      )}
    </article>
  );
}
