import { Migration, User, Order, Product, Food, Dish, MealPlan, Setting, Promo, Subscription, PlanChoice, ChatMessage, MembershipGrant } from '../models/index.js';
import { PRODUCTS, LEGACY_LINES } from '../data/products.js';
import { TREATS, PROMOS, DEFAULT_CHANNELS, DEFAULT_POPUP } from '../data/milk-extras.js';
import { DISH_RECIPES } from '../data/dishes.js';
import { buildDishes } from '../services/dishes.js';
import { buildMealPlans } from '../data/meal-plans.js';
import { acquireLock, releaseLock } from '../services/locks.js';

// Migration dữ liệu có phiên bản: mỗi mục chạy đúng 1 lần (ghi vào collection `migrations`).
// Thêm migration mới: thêm phần tử vào cuối mảng, đặt tên theo ngày + mô tả; up() phải chạy lại được an toàn (idempotent).
export const MIGRATIONS = [
  {
    name: '2026-10-22-profile-birth-year',
    // Tuổi lưu cố định → không tăng theo năm. Suy ra năm sinh từ năm tạo tài khoản − tuổi lúc đó.
    async up() {
      const r = await User.updateMany({ 'profile.birthYear': { $exists: false }, 'profile.age': { $type: 'number' } }, [
        { $set: { 'profile.birthYear': { $subtract: [{ $year: { $ifNull: ['$createdAt', '$$NOW'] } }, '$profile.age'] } } },
      ]);
      return `${r.modifiedCount} người dùng`;
    },
  },
  {
    name: '2026-10-22-order-defaults',
    async up() {
      const r = await Order.updateMany({ anonymized: { $exists: false } }, { $set: { anonymized: false } });
      return `${r.modifiedCount} đơn`;
    },
  },
  {
    name: '2026-10-29-nut-milk-catalog',
    // App tập trung vào sữa hạt: bổ sung sản phẩm từ sữa hạt, món dùng sữa hạt, kế hoạch "Sữa hạt mỗi ngày",
    // banner quảng cáo, kênh bán hàng & popup. Chỉ THÊM mục còn thiếu — không ghi đè chỉnh sửa của admin.
    async up() {
      const notes = [];
      const maxSort = (await Product.findOne().sort({ sort: -1 }).lean())?.sort ?? 0;
      const p = await Product.bulkWrite(TREATS.map((t, i) => ({ updateOne: { filter: { slug: t.slug }, update: { $setOnInsert: { ...t, sort: maxSort + 1 + i } }, upsert: true } })));
      notes.push(`${p.upsertedCount} sản phẩm`);

      const foods = await Food.find().lean();
      const existingDish = new Set((await Dish.find().select('key').lean()).map((d) => d.key));
      const milkRecipes = DISH_RECIPES.filter((r) => !existingDish.has(r.key) && r.ingredients.some(([n]) => n === 'Sữa hạt NUTRIVA'));
      if (milkRecipes.length) await Dish.insertMany(buildDishes(milkRecipes, foods));
      notes.push(`${milkRecipes.length} món`);

      const existingPlan = new Set((await MealPlan.find({ owner: null }).select('slug').lean()).map((x) => x.slug));
      const plans = buildMealPlans(foods, await Dish.find().lean()).filter((x) => x.style === 'nut-milk' && !existingPlan.has(x.slug));
      if (plans.length) await MealPlan.insertMany(plans);
      notes.push(`${plans.length} kế hoạch`);

      await Setting.updateOne({ key: 'main', $or: [{ channels: { $exists: false } }, { channels: { $size: 0 } }] }, { $set: { channels: DEFAULT_CHANNELS } });
      await Setting.updateOne({ key: 'main', 'popup.title': { $exists: false } }, { $set: { popup: DEFAULT_POPUP } });
      if (!(await Promo.exists({}))) {
        await Promo.insertMany(PROMOS);
        notes.push(`${PROMOS.length} banner`);
      }
      return notes.join(', ');
    },
  },
  {
    name: '2026-10-30-brand-lineup',
    // Dòng sản phẩm thật theo bao bì (Mạch Nhiên, Sen Thanh, Sen Cốm, Lứt Thanh, Nâu Mộc, Huyền Mộc) + ảnh thật + banner.
    // Giữ nguyên giá, tồn kho, trạng thái bán; cập nhật slug ở các chỗ tham chiếu (gói định kỳ, lựa chọn kế hoạch, chat).
    async up() {
      const notes = [];
      let renamed = 0;
      for (const [oldKey, newKey] of Object.entries(LEGACY_LINES)) {
        for (const prefix of ['sua', 'set']) {
          const oldSlug = `${prefix}-${oldKey}`;
          const newSlug = `${prefix}-${newKey}`;
          const seed = PRODUCTS.find((p) => p.slug === newSlug);
          if (!seed || (await Product.exists({ slug: newSlug }))) continue;
          const r = await Product.updateOne(
            { slug: oldSlug },
            { $set: { slug: newSlug, line: newKey, name: seed.name, subtitle: seed.subtitle, size: seed.size, ingredients: seed.ingredients, extraIngredients: seed.extraIngredients, flavor: seed.flavor, image: seed.image, description: seed.description, nutrition: seed.nutrition }, $unset: { imageCredit: 1 } },
          );
          if (!r.modifiedCount) continue;
          renamed++;
          await Subscription.updateMany({ productSlug: oldSlug }, { $set: { productSlug: newSlug, productName: seed.name } });
          await PlanChoice.updateMany({ dishId: `milk:${oldSlug}` }, { $set: { dishId: `milk:${newSlug}` } });
          await ChatMessage.updateMany({ product: oldSlug }, { $set: { product: newSlug } });
          await Promo.updateMany({ link: `/shop/p/${oldSlug}` }, { $set: { link: `/shop/p/${newSlug}` } });
        }
      }
      notes.push(`${renamed} sản phẩm đổi tên`);

      // Banner: thay ảnh tạm bằng banner thật, thêm 2 banner thiết kế sẵn (kèm quảng cáo chuyển trang)
      const swap = { '/img/research/banner-3-vi.webp': '/img/banners/nhan-mach-nhien.webp', '/img/research/banner-hanh-nhan.webp': '/img/banners/nhan-nau-moc.webp', '/img/research/banner-hat.webp': '/img/banners/banner-goi-hat.webp' };
      for (const [from, to] of Object.entries(swap)) await Promo.updateMany({ image: from }, { $set: { image: to, imageCredit: '' } });
      for (const p of PROMOS.filter((x) => x.theme === 'image')) {
        if (!(await Promo.exists({ image: p.image, theme: 'image' }))) await Promo.create(p);
      }
      await Setting.updateOne({ key: 'main', 'popup.image': /^\/img\/research\// }, { $set: { 'popup.image': '/img/banners/banner-sua-hat.webp', 'popup.imageCredit': '' } });

      // Tài khoản đã có trước khi bật gói sử dụng: tặng 14 ngày để không bị khóa đột ngột
      const since = new Date();
      const legacy = await User.find({ createdAt: { $lt: since }, role: { $ne: 'admin' }, 'membership.until': null }, { _id: 1 }).lean();
      const until = new Date(Date.now() + 14 * 86400000);
      if (legacy.length) {
        await User.updateMany({ _id: { $in: legacy.map((u) => u._id) }, 'membership.until': null }, { $set: { 'membership.until': until } });
        await MembershipGrant.insertMany(legacy.map((u) => ({ user: u._id, days: 14, source: 'migration', note: 'Tặng khi ra mắt gói sử dụng', untilBefore: null, untilAfter: until })));
      }
      notes.push(`${legacy.length} tài khoản được tặng 14 ngày`);
      return notes.join(', ');
    },
  },
  {
    name: '2026-10-31-brand-art',
    // Ảnh bìa kế hoạch sữa hạt & ảnh món dùng sữa hạt: thay ảnh tạm (research) bằng ảnh dựng từ chai NUTRIVA thật.
    // Chỉ đổi khi đang dùng đúng ảnh tạm cũ → không ghi đè ảnh admin đã tự thay.
    async up() {
      const PLANS = {
        'sua-hat-thanh-nhe-1200': ['/img/research/plan-ly-sua-2.webp', '/img/plans/milk-thanh-nhe.webp'],
        'sua-hat-sang-khoe-1600': ['/img/research/plan-ngu-coc-sua.webp', '/img/plans/milk-sang-khoe.webp'],
        'sua-hat-nang-dong-2000': ['/img/research/plan-sinh-to.webp', '/img/plans/milk-nang-dong.webp'],
        'sua-hat-tang-can-2400': ['/img/research/banner-bua-sang.webp', '/img/plans/milk-tang-can.webp'],
      };
      let plans = 0;
      for (const [slug, [from, to]] of Object.entries(PLANS)) {
        const r = await MealPlan.updateMany({ slug, image: from }, { $set: { image: to }, $unset: { imageCredit: 1 } });
        plans += r.modifiedCount;
      }
      let dishes = 0;
      for (const [from, to] of [['/img/research/plan-ngu-coc-sua.webp', '/img/products/sua-mach-nhien.webp'], ['/img/research/plan-ly-sua.webp', '/img/products/sua-nau-moc.webp']]) {
        const r = await Dish.updateMany({ image: from }, { $set: { image: to }, $unset: { imageCredit: 1 } });
        dishes += r.modifiedCount;
      }
      return `${plans} kế hoạch, ${dishes} món đổi ảnh`;
    },
  },
];

export async function runMigrations() {
  if (!(await acquireLock('migrations', 10 * 60 * 1000))) {
    console.log('[migrate] server khác đang chạy migration — bỏ qua');
    return;
  }
  try {
    const done = new Set((await Migration.find().lean()).map((m) => m.name));
    for (const m of MIGRATIONS) {
      if (done.has(m.name)) continue;
      const t0 = Date.now();
      const note = await m.up();
      await Migration.create({ name: m.name, ranAt: new Date(), ms: Date.now() - t0 });
      console.log(`[migrate] ${m.name}: ${note ?? 'xong'}`);
    }
  } finally {
    await releaseLock('migrations');
  }
}
