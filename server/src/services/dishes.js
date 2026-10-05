import { MICRO_IDS } from '../../../shared/nutrition.js';

// Tính dinh dưỡng món ăn từ công thức nguyên liệu (giá trị thực phẩm trên 100 g).
const r1 = (v) => Math.round(v * 10) / 10;

// ingredients: [{ food: key } | { name }, grams]; foods: danh sách thực phẩm (lean) để tra cứu
export function computeDish(ingredients, foods) {
  const byKey = new Map(foods.map((f) => [f.key, f]));
  const byName = new Map(foods.map((f) => [f.name.toLowerCase(), f]));
  const items = [];
  const total = { kcal: 0, protein: 0, carb: 0, fat: 0, fiber: 0 };
  const micros = {}; // chỉ cộng vi chất có số liệu; không nguyên liệu nào có → null
  let plant = true;
  const allergens = new Set();
  for (const ing of ingredients) {
    const f = byKey.get(ing.food) ?? byName.get((ing.name ?? '').toLowerCase());
    if (!f) throw Object.assign(new Error(`Không tìm thấy thực phẩm "${ing.name ?? ing.food}"`), { status: 400 });
    const g = Number(ing.grams);
    if (!(g > 0)) throw Object.assign(new Error(`Số gram của "${f.name}" không hợp lệ`), { status: 400 });
    const k = g / 100;
    total.kcal += f.kcal * k;
    total.protein += f.protein * k;
    total.carb += f.carb * k;
    total.fat += f.fat * k;
    total.fiber += (f.fiber ?? 0) * k;
    for (const m of MICRO_IDS) {
      const v = f.micros?.[m];
      if (v != null) micros[m] = (micros[m] ?? 0) + v * k;
    }
    if (!f.plant) plant = false;
    (f.allergens ?? []).forEach((a) => allergens.add(a));
    items.push({ food: f.key, name: f.name, grams: g });
  }
  return {
    ingredients: items,
    kcal: Math.round(total.kcal),
    protein: r1(total.protein),
    carb: r1(total.carb),
    fat: r1(total.fat),
    fiber: r1(total.fiber),
    micros: Object.fromEntries(MICRO_IDS.map((m) => [m, micros[m] == null ? null : r1(micros[m])])),
    manual: false,
    plant,
    allergens: [...allergens],
  };
}

// Công thức seed → document Dish
// Món đặc biệt (manual) giữ nguyên dinh dưỡng nhập tay, không liên kết thực phẩm
export function buildDishes(recipes, foods) {
  return recipes.map(({ ingredients, manual, ...d }) =>
    manual
      ? { ...d, ...manual, ingredients: [], micros: {}, allergens: [], manual: true }
      : { ...d, ...computeDish(ingredients.map(([name, grams]) => ({ name, grams })), foods) },
  );
}
