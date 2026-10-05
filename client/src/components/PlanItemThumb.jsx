import { MEAL_STYLE } from './meals.js';

// Ảnh món (nếu có) hoặc ô icon theo bữa
export default function PlanItemThumb({ item, meal, size = 'lg' }) {
  if (item.image) return <img className={`thumb ${size}`} src={item.image} alt="" loading="lazy" />;
  const s = MEAL_STYLE[meal] ?? MEAL_STYLE.snack;
  const dim = size === 'lg' ? 84 : 52;
  return (
    <span className={`thumb ${size}`} style={{ display: 'grid', placeItems: 'center', background: s.bg, color: s.fg, width: dim, height: dim }}>
      <s.icon size={size === 'lg' ? 32 : 22} />
    </span>
  );
}

export const TAG_LABEL = { cook: 'Tự nấu', quick: 'Nhanh gọn' };
