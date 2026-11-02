import { Product, Food, Dish, Coupon, Setting, User, Activity, MealPlan, Promo } from './models/index.js';
import { TREATS, PROMOS, DEFAULT_CHANNELS, DEFAULT_POPUP } from './data/milk-extras.js';
import { ACTIVITIES } from './data/activities.js';
import { PRODUCTS, SUBSCRIPTION_PLANS, DIY_STEPS, SHIPPING_FEE, FREE_SHIP_FROM } from './data/products.js';
import { FOODS } from './data/foods.js';
import { DISH_RECIPES } from './data/dishes.js';
import { buildDishes } from './services/dishes.js';
import { buildMealPlans } from './data/meal-plans.js';

// Nạp dữ liệu mẫu CHỈ khi collection còn trống — không ghi đè thay đổi của admin.
export async function seedIfEmpty() {
  if (!(await Product.exists({}))) {
    const all = [...PRODUCTS, ...TREATS];
    await Product.insertMany(all.map((p, i) => ({ ...p, sort: i, steps: p.type === 'diy' ? (p.steps?.length ? p.steps : DIY_STEPS) : p.steps ?? [] })));
    console.log(`[seed] ${all.length} sản phẩm`);
  }
  if (!(await Food.exists({}))) {
    await Food.insertMany(FOODS);
    console.log(`[seed] ${FOODS.length} thực phẩm`);
  }
  if (!(await Dish.exists({}))) {
    const dishes = buildDishes(DISH_RECIPES, await Food.find().lean());
    await Dish.insertMany(dishes);
    console.log(`[seed] ${dishes.length} món ăn`);
  }
  if (!(await MealPlan.exists({ owner: null }))) {
    const plans = buildMealPlans(await Food.find().lean(), await Dish.find().lean());
    await MealPlan.insertMany(plans);
    console.log(`[seed] ${plans.length} kế hoạch ăn mẫu`);
  }
  if (!(await Activity.exists({}))) {
    await Activity.insertMany(ACTIVITIES);
    console.log(`[seed] ${ACTIVITIES.length} hoạt động thể chất`);
  } else {
    // Bổ sung ảnh cho hoạt động chưa có ảnh (không ghi đè ảnh admin đã đặt)
    const ops = ACTIVITIES.filter((a) => a.image).map((a) => ({
      updateOne: { filter: { slug: a.slug, $or: [{ image: null }, { image: '' }] }, update: { $set: { image: a.image, imageCredit: a.imageCredit } } },
    }));
    if (ops.length) {
      const r = await Activity.bulkWrite(ops);
      if (r.modifiedCount) console.log(`[seed] bổ sung ảnh cho ${r.modifiedCount} hoạt động`);
    }
  }
  if (!(await Coupon.exists({}))) {
    await Coupon.insertMany([
      { code: 'NUTRIVA10', label: 'Giảm 10% đơn hàng (tối đa 50.000đ)', kind: 'percent', value: 10, maxDiscount: 50000 },
      { code: 'CHAOBAN', label: 'Giảm 20.000đ cho đơn đầu tiên', kind: 'amount', value: 20000, firstOrderOnly: true },
    ]);
    console.log('[seed] mã giảm giá mẫu');
  }
  if (!(await Setting.exists({ key: 'main' }))) {
    await Setting.create({
      key: 'main',
      shippingFee: SHIPPING_FEE,
      freeShipFrom: FREE_SHIP_FROM,
      bank: { bankId: '', accountNo: '', accountName: '' },
      store: { name: 'NUTRIVA', address: '', phone: '' },
      subscriptionPlans: SUBSCRIPTION_PLANS,
      diySteps: DIY_STEPS,
      channels: DEFAULT_CHANNELS,
      popup: DEFAULT_POPUP,
    });
    console.log('[seed] cấu hình mặc định');
  }

  if (!(await Promo.exists({}))) {
    await Promo.insertMany(PROMOS);
    console.log(`[seed] ${PROMOS.length} banner quảng cáo`);
  }

  // Thăng quyền admin cho các email trong ADMIN_EMAILS (nếu tài khoản đã tồn tại)
  const admins = adminEmails();
  if (admins.length) await User.updateMany({ email: { $in: admins }, role: { $ne: 'admin' } }, { role: 'admin' });
}

export const adminEmails = () =>
  (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
