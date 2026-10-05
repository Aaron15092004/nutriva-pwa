import { MEALS, FOOD_GROUPS } from '../../../shared/nutrition.js';

// Kế hoạch ăn: dinh dưỡng luôn tính từ bảng thực phẩm / món ăn hiện tại (ctx = { foods, dishes } đã nạp sẵn).
const DAY_MS = 86400000;
const r1 = (v) => Math.round(v * 10) / 10;
const GROUP_ORDER = Object.fromEntries(FOOD_GROUPS.map((g, i) => [g.id, i]));

export const makeCtx = (foods, dishes) => ({
  food: new Map(foods.map((f) => [f.key, f])),
  dish: new Map(dishes.map((d) => [d.key, d])),
});

// Một món trong kế hoạch → tên, định lượng, dinh dưỡng
export function resolveItem(it, ctx) {
  if (it.dish) {
    const d = ctx.dish.get(it.dish);
    if (!d) return { ...it, name: it.label ?? it.dish, missing: true, kcal: 0, protein: 0, carb: 0, fat: 0 };
    const p = it.portion ?? 1;
    const grams = Math.round((d.ingredients ?? []).reduce((s, i) => s + i.grams, 0) * p);
    return {
      meal: it.meal,
      kind: 'dish',
      dish: d.key,
      portion: p,
      name: it.label || d.name,
      category: d.category,
      image: d.image,
      grams: grams || null,
      kcal: Math.round(d.kcal * p),
      protein: r1(d.protein * p),
      carb: r1(d.carb * p),
      fat: r1(d.fat * p),
    };
  }
  const f = ctx.food.get(it.food);
  if (!f) return { ...it, name: it.label ?? it.food, missing: true, kcal: 0, protein: 0, carb: 0, fat: 0 };
  const k = it.grams / 100;
  return {
    meal: it.meal,
    kind: 'food',
    food: f.key,
    foodName: f.name,
    group: f.group,
    name: it.label || f.name,
    note: it.note,
    grams: it.grams,
    kcal: Math.round(f.kcal * k),
    protein: r1(f.protein * k),
    carb: r1(f.carb * k),
    fat: r1(f.fat * k),
  };
}

const sum = (list) =>
  list.reduce((t, x) => ({ kcal: t.kcal + x.kcal, protein: r1(t.protein + x.protein), carb: r1(t.carb + x.carb), fat: r1(t.fat + x.fat) }), {
    kcal: 0,
    protein: 0,
    carb: 0,
    fat: 0,
  });

export function resolveDay(day, ctx) {
  const items = (day?.items ?? []).map((it) => resolveItem(it, ctx));
  const meals = MEALS.map((m) => {
    const list = items.filter((x) => x.meal === m.id);
    return { meal: m.id, label: m.label, items: list, ...sum(list) };
  });
  return { meals, ...sum(items) };
}

// Tóm tắt cho thẻ danh sách; full = kèm từng ngày
export function planSummary(p, userId) {
  return {
    id: String(p._id),
    slug: p.slug,
    title: p.title,
    summary: p.summary,
    style: p.style,
    kcalMin: p.kcalMin,
    kcalMax: p.kcalMax,
    image: p.image,
    imageCredit: p.imageCredit,
    dayCount: p.days.length,
    mealsPerDay: new Set(p.days.flatMap((d) => d.items.map((i) => i.meal))).size,
    mine: Boolean(p.owner && userId && String(p.owner) === String(userId)),
    copiedFrom: p.copiedFrom,
  };
}

export function planDetail(p, ctx, userId) {
  return {
    ...planSummary(p, userId),
    description: p.description,
    days: p.days.map((d, i) => ({ index: i, ...resolveDay(d, ctx) })),
    // Dữ liệu gốc để chỉnh sửa thực đơn tự tạo
    raw: p.days.map((d) => d.items),
  };
}

// Danh sách nguyên liệu (gộp theo thực phẩm): món ăn được tách thành nguyên liệu theo khẩu phần
export function ingredientsFor(days, ctx) {
  const acc = new Map();
  const add = (key, grams) => {
    const f = ctx.food.get(key);
    if (!f) return;
    const cur = acc.get(key) ?? { food: key, name: f.name, group: f.group, grams: 0 };
    cur.grams += grams;
    acc.set(key, cur);
  };
  for (const d of days)
    for (const it of d.items) {
      if (it.food) add(it.food, it.grams);
      else if (it.dish) {
        const dish = ctx.dish.get(it.dish);
        for (const ing of dish?.ingredients ?? []) add(ing.food, ing.grams * (it.portion ?? 1));
      }
    }
  return [...acc.values()]
    .map((x) => ({ ...x, grams: Math.round(x.grams) }))
    .sort((a, b) => (GROUP_ORDER[a.group] ?? 99) - (GROUP_ORDER[b.group] ?? 99) || b.grams - a.grams);
}

// Ngày thứ mấy của kế hoạch (0-based, lặp theo chu kỳ) ứng với `date`
export function planDayIndex(startDate, date, dayCount) {
  const diff = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / DAY_MS);
  return ((diff % dayCount) + dayCount) % dayCount;
}

// Kiểm tra & chuẩn hóa danh sách món khi người dùng chỉnh thực đơn tự tạo
export function cleanDays(days, ctx) {
  if (!Array.isArray(days) || days.length < 1 || days.length > 14) throw Object.assign(new Error('Kế hoạch cần 1–14 ngày'), { status: 400 });
  const MEAL_IDS = MEALS.map((m) => m.id);
  return days.map((items, i) => {
    if (!Array.isArray(items) || items.length > 40) throw Object.assign(new Error(`Ngày ${i + 1} không hợp lệ`), { status: 400 });
    return {
      items: items.map((it) => {
        if (!MEAL_IDS.includes(it.meal)) throw Object.assign(new Error('Bữa ăn không hợp lệ'), { status: 400 });
        const label = typeof it.label === 'string' ? it.label.trim().slice(0, 80) : undefined;
        const note = typeof it.note === 'string' ? it.note.trim().slice(0, 40) : undefined;
        if (it.dish) {
          if (!ctx.dish.has(it.dish)) throw Object.assign(new Error('Không tìm thấy món ăn'), { status: 400 });
          const portion = Number(it.portion ?? 1);
          if (!(portion >= 0.25 && portion <= 5)) throw Object.assign(new Error('Khẩu phần phải từ 0,25 đến 5'), { status: 400 });
          return { meal: it.meal, dish: it.dish, portion, label };
        }
        if (!ctx.food.has(it.food)) throw Object.assign(new Error('Không tìm thấy thực phẩm'), { status: 400 });
        const grams = Math.round(Number(it.grams));
        if (!(grams >= 1 && grams <= 3000)) throw Object.assign(new Error('Định lượng phải từ 1 đến 3000 g'), { status: 400 });
        return { meal: it.meal, food: it.food, grams, label, note };
      }),
    };
  });
}
