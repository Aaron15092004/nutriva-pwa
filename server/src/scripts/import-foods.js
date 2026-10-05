// Nạp lại bảng THỰC PHẨM, MÓN ĂN và KẾ HOẠCH ĂN MẪU lên database.
// Dùng: npm run import-foods -w server
// - Thực phẩm & món ăn: thay toàn bộ dữ liệu cũ của 2 collection này.
// - Kế hoạch mẫu: cập nhật theo slug (giữ nguyên id → người dùng đang áp dụng không bị mất kế hoạch); thực đơn tự tạo không bị đụng tới.
// Nguồn: data/foods-vn.json (tạo từ figma/datathucpham/*.xlsx) + data/dishes.js + data/meal-plans.js.
import 'dotenv/config';
import { connectDB, disconnectDB } from '../config/db.js';
import { Food, Dish, MealPlan } from '../models/index.js';
import { FOODS } from '../data/foods.js';
import { DISH_RECIPES } from '../data/dishes.js';
import { buildDishes } from '../services/dishes.js';
import { buildMealPlans } from '../data/meal-plans.js';
import { FOOD_GROUPS, DISH_CATEGORIES, MICRO_IDS } from '../../../shared/nutrition.js';

if (!process.env.MONGODB_URI) {
  console.error('Thiếu MONGODB_URI trong server/.env');
  process.exit(1);
}

await connectDB();

// Kiểm tra công thức & kế hoạch trước khi xóa dữ liệu cũ
const dishes = buildDishes(DISH_RECIPES, FOODS);
const plans = buildMealPlans(FOODS, dishes);
const oldFoods = await Food.countDocuments();
const oldDishes = await Dish.countDocuments();

await Food.deleteMany({});
await Food.insertMany(FOODS);
await Dish.deleteMany({});
await Dish.insertMany(dishes);
await MealPlan.bulkWrite(plans.map((p) => ({ replaceOne: { filter: { slug: p.slug, owner: null }, replacement: { ...p, owner: null }, upsert: true } })));
const removed = await MealPlan.deleteMany({ owner: null, slug: { $nin: plans.map((p) => p.slug) } });

console.log(`Thực phẩm: ${oldFoods} → ${await Food.countDocuments()}`);
for (const g of FOOD_GROUPS) console.log(`  ${g.label.padEnd(26)} ${await Food.countDocuments({ group: g.id })}`);
const micro = await Promise.all(MICRO_IDS.map((m) => Food.countDocuments({ [`micros.${m}`]: { $ne: null } })));
console.log(`  Vi chất có số liệu: ${MICRO_IDS.map((m, i) => `${m} ${micro[i]}`).join(', ')}`);
console.log(`Món ăn: ${oldDishes} → ${await Dish.countDocuments()} (món đặc biệt: ${await Dish.countDocuments({ manual: true })})`);
for (const c of DISH_CATEGORIES) {
  const n = await Dish.countDocuments({ category: c.id });
  if (n) console.log(`  ${c.label.padEnd(30)} ${n}`);
}
console.log(`Kế hoạch mẫu: ${await MealPlan.countDocuments({ owner: null })}${removed.deletedCount ? ` (xóa ${removed.deletedCount} kế hoạch cũ)` : ''}`);
await disconnectDB();
console.log('✔ Đã nạp lại thực phẩm, món ăn và kế hoạch mẫu.');
