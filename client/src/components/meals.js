import { Apple, Wheat, Drumstick, Salad, Milk, Utensils, Carrot, Shell, Bean, Beef, Heart, Ham, Fish, Egg, Droplet, Candy, CupSoda, CookingPot, Amphora } from 'lucide-react';
import { MEAL_THEME } from '../theme/meals.js';

// Màu & icon cho 4 bữa — lấy từ theme chung (src/theme/meals.js)
export const MEAL_STYLE = Object.fromEntries(
  Object.entries(MEAL_THEME).map(([k, t]) => [k, { icon: t.icon, bg: t.bg, fg: t.fg }]),
);

// Icon theo nhóm thực phẩm (shared FOOD_GROUPS)
export const FOOD_ICON = new Proxy(
  {
    grain: Wheat,
    tuber: Carrot,
    veg: Salad,
    mushroom: Shell,
    fruit: Apple,
    legume: Bean,
    meat: Beef,
    poultry: Drumstick,
    offal: Heart,
    processed: Ham,
    seafood: Fish,
    egg: Egg,
    dairy: Milk,
    fat: Droplet,
    sweet: Candy,
    drink: CupSoda,
    spice: CookingPot,
    pickle: Amphora,
  },
  { get: (t, k) => t[k] ?? Utensils },
);

export const sumMeal = (items = []) =>
  items.reduce(
    (s, i) => ({ kcal: s.kcal + (i.kcal ?? 0), protein: s.protein + (i.protein ?? 0), carb: s.carb + (i.carb ?? 0), fat: s.fat + (i.fat ?? 0) }),
    { kcal: 0, protein: 0, carb: 0, fat: 0 },
  );

export const sumLog = (log) => {
  const all = Object.values(log?.meals ?? {}).flat();
  return sumMeal(all);
};
