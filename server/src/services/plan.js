import { MEALS, computeHealth } from '../../../shared/nutrition.js';

// Kế hoạch ăn uống: tính từ hồ sơ + danh mục món (DB) + sản phẩm sữa (DB) + lựa chọn của người dùng.
// ctx = { products, dishes } — nạp 1 lần mỗi request.

const DAY_MS = 86400000;
const dayIndex = (date) => Math.floor(Date.parse(`${date}T00:00:00Z`) / DAY_MS);
const GOAL_OFFSET = { maintain: 0, lose: 2, gain: 4 };

const hasAllergen = (list = [], allergies = []) => list.some((a) => allergies.includes(a));

export function safeProducts(products, profile) {
  return products.filter((p) => !hasAllergen(p.ingredients, profile.allergies));
}

// Sữa phù hợp: an toàn với dị ứng, ưu tiên đúng hương vị yêu thích
export function rankMilks(products, profile) {
  return safeProducts(products, profile)
    .filter((p) => p.type === 'milk')
    .sort((a, b) => (b.flavor === profile.flavor) - (a.flavor === profile.flavor));
}

function dishPool(profile, meal, dishes) {
  const pool = dishes.filter(
    (d) => d.meal === meal && !hasAllergen(d.allergens, profile.allergies) && (profile.diet !== 'flex-veg' || d.plant),
  );
  // Giảm cân ưu tiên món nhẹ trước, tăng cân ưu tiên món nhiều năng lượng
  if (profile.goal === 'lose') pool.sort((a, b) => a.kcal - b.kcal);
  if (profile.goal === 'gain') pool.sort((a, b) => b.kcal - a.kcal);
  return pool;
}

const milkItem = (p) => ({
  id: `milk:${p.slug}`,
  kind: 'milk',
  name: `Sữa hạt NUTRIVA ${p.name}`,
  size: p.size,
  slug: p.slug,
  image: p.image,
  tag: 'quick',
  kcal: p.nutrition.kcal,
  protein: p.nutrition.protein,
  carb: p.nutrition.carb,
  fat: p.nutrition.fat,
});

const dishItem = (d) => ({
  id: d.key,
  kind: 'dish',
  meal: d.meal,
  name: d.name,
  tag: d.tag,
  image: d.image,
  kcal: d.kcal,
  protein: d.protein,
  carb: d.carb,
  fat: d.fat,
});

export function findItem(id, { products, dishes }) {
  if (id.startsWith('milk:')) {
    const p = products.find((x) => x.slug === id.slice(5));
    return p ? milkItem(p) : null;
  }
  const d = dishes.find((x) => x.key === id);
  return d ? dishItem(d) : null;
}

// Hệ số khẩu phần để món khớp mức calo mục tiêu của bữa
function withPortion(item, target, meal) {
  if (item.kind === 'milk') return { ...item, meal, portion: 1 };
  const mid = (target.min + target.max) / 2;
  const portion = Math.min(1.5, Math.max(0.7, Math.round((mid / item.kcal) * 10) / 10));
  const s = (v) => Math.round(v * portion);
  return { ...item, meal, portion, kcal: s(item.kcal), protein: s(item.protein), carb: s(item.carb), fat: s(item.fat) };
}

const EMPTY = { id: 'none', kind: 'none', name: 'Chưa có món phù hợp', tag: 'quick', kcal: 1, protein: 0, carb: 0, fat: 0 };

export function defaultItem(profile, meal, date, ctx) {
  const i = dayIndex(date) + (GOAL_OFFSET[profile.goal] ?? 0);
  if (meal === 'snack') {
    // Sữa hạt uống lúc nào cũng được → xếp vào Bữa ăn nhẹ
    const milks = rankMilks(ctx.products, profile);
    if (milks.length) return milkItem(milks[i % milks.length]);
  }
  const pool = dishPool(profile, meal, ctx.dishes);
  const list = pool.length ? pool : ctx.dishes.filter((d) => d.meal === meal);
  return list.length ? dishItem(list[i % list.length]) : EMPTY;
}

export function alternatives(profile, meal, ctx, currentId) {
  const options = dishPool(profile, meal, ctx.dishes).map(dishItem);
  if (meal === 'snack') options.unshift(...rankMilks(ctx.products, profile).map(milkItem));
  const health = computeHealth(profile);
  return options
    .filter((o) => o.id !== currentId)
    .slice(0, 4)
    .map((o) => withPortion(o, health.meals[meal], meal));
}

export function buildDay(profile, date, ctx, choices = []) {
  const health = computeHealth(profile);
  const meals = MEALS.map((m) => {
    const chosen = choices.find((c) => c.date === date && c.meal === m.id);
    const item = (chosen && findItem(chosen.dishId, ctx)) || defaultItem(profile, m.id, date, ctx);
    return {
      meal: m.id,
      label: m.label,
      target: health.meals[m.id],
      custom: Boolean(chosen),
      note: chosen?.note ?? '',
      item: withPortion(item, health.meals[m.id], m.id),
    };
  });
  const totalKcal = meals.reduce((s, m) => s + m.item.kcal, 0);
  return { date, meals, totalKcal, targetKcal: health.targetKcal };
}

export function addDays(date, n) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}
