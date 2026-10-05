import { Router } from 'express';
import bcrypt from 'bcryptjs';
import {
  User, Product, Food, Dish, Coupon, Activity, Order, Subscription, SupportRequest, Setting,
  DailyLog, PlanChoice, Reminder, PushSubscription, WeightEntry, MealPlan,
} from '../models/index.js';
import { ah, requireAuth, requireAdmin, HttpError } from '../middleware/auth.js';
import { crudRouter } from './crud.js';
import { invalidateSettings, invalidateCatalog, loadFoods, loadDishes } from '../services/catalog.js';
import { notifyUser, generateSubscriptionOrders } from '../services/scheduler.js';
import { restock } from './shop.js';
import { imageUpload, saveImage, deleteImage } from '../services/files.js';
import { computeDish } from '../services/dishes.js';
import { makeCtx, cleanDays } from '../services/meal-plans.js';

const router = Router();
router.use(requireAuth, requireAdmin);

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const page = (req) => ({
  page: Math.max(1, Number(req.query.page) || 1),
  limit: Math.min(200, Math.max(1, Number(req.query.limit) || 50)),
});

// ---- Tổng quan ----
router.get(
  '/stats',
  ah(async (req, res) => {
    const now = new Date();
    const d30 = new Date(now - 30 * 86400000);
    const d14 = new Date(now - 13 * 86400000);
    d14.setHours(0, 0, 0, 0);
    const startToday = new Date(now);
    startToday.setHours(0, 0, 0, 0);
    const valid = { status: { $ne: 'cancelled' } };

    const [users, newUsers, ordersToday, pending, revenue30, byDay, topProducts, openSupport, activeSubs, unpaidBank] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ createdAt: { $gte: new Date(now - 7 * 86400000) } }),
      Order.countDocuments({ createdAt: { $gte: startToday } }),
      Order.countDocuments({ status: { $in: ['confirmed', 'preparing'] } }),
      Order.aggregate([{ $match: { ...valid, createdAt: { $gte: d30 } } }, { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } }]),
      Order.aggregate([
        { $match: { ...valid, createdAt: { $gte: d14 } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: process.env.APP_TZ || 'Asia/Ho_Chi_Minh' } }, total: { $sum: '$total' }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      Order.aggregate([
        { $match: { ...valid, createdAt: { $gte: d30 } } },
        { $unwind: '$items' },
        { $group: { _id: { slug: '$items.slug', type: '$items.type' }, name: { $first: '$items.name' }, qty: { $sum: '$items.qty' }, revenue: { $sum: { $multiply: ['$items.qty', '$items.price'] } } } },
        { $sort: { qty: -1 } },
        { $limit: 5 },
      ]),
      SupportRequest.countDocuments({ status: 'open' }),
      Subscription.countDocuments({ active: true }),
      Order.countDocuments({ ...valid, payment: 'bank', paymentStatus: 'unpaid' }),
    ]);
    res.json({
      users,
      newUsers,
      ordersToday,
      pending,
      revenue30: revenue30[0]?.total ?? 0,
      orders30: revenue30[0]?.count ?? 0,
      byDay,
      topProducts,
      openSupport,
      activeSubs,
      unpaidBank,
    });
  }),
);

// ---- Danh mục ----
router.use(
  '/products',
  crudRouter(Product, {
    onChange: invalidateCatalog,
    search: ['name', 'slug'],
    filters: ['type', 'active'],
    sort: { sort: 1, createdAt: 1 },
    writable: ['slug', 'type', 'name', 'subtitle', 'size', 'price', 'line', 'ingredients', 'extraIngredients', 'flavor', 'image', 'description', 'nutrition', 'storage', 'steps', 'stock', 'sort', 'active'],
  }),
);
router.use(
  '/foods',
  crudRouter(Food, {
    onChange: invalidateCatalog,
    search: ['name', 'key'],
    filters: ['group', 'nutrientGroup', 'plant', 'active'],
    sort: { group: 1, name: 1 },
    writable: ['key', 'name', 'group', 'nutrientGroup', 'kcal', 'protein', 'carb', 'fat', 'fiber', 'water', 'ash', 'waste', 'micros', 'serving', 'unit', 'plant', 'allergens', 'source', 'active'],
  }),
);
router.use(
  '/dishes',
  crudRouter(Dish, {
    onChange: invalidateCatalog,
    search: ['name', 'key'],
    filters: ['meal', 'category', 'tag', 'plant', 'active'],
    sort: { meal: 1, key: 1 },
    writable: ['key', 'meal', 'category', 'name', 'ingredients', 'tag', 'image', 'active', 'manual', 'kcal', 'protein', 'carb', 'fat', 'fiber', 'plant', 'allergens'],
    // Món thường: dinh dưỡng, vi chất, cờ chay, dị ứng luôn tính lại từ nguyên liệu.
    // Món đặc biệt (manual): giữ dinh dưỡng nhập tay, không liên kết thực phẩm.
    transform: async (body) => {
      if (body.manual) {
        if (!(Number(body.kcal) >= 0)) throw new HttpError(400, 'Món đặc biệt cần nhập năng lượng (kcal)');
        return { ...body, ingredients: [], micros: {} };
      }
      const { kcal, protein, carb, fat, fiber, plant, allergens, ...rest } = body;
      body = rest;
      if (!body.ingredients) return body;
      if (!body.ingredients.length) throw new HttpError(400, 'Món ăn cần ít nhất 1 nguyên liệu');
      const foods = await Food.find({ $or: [{ key: { $in: body.ingredients.map((i) => i.food).filter(Boolean) } }, { name: { $in: body.ingredients.map((i) => i.name).filter(Boolean) } }] }).lean();
      return { ...body, ...computeDish(body.ingredients, foods) };
    },
  }),
);
router.use(
  '/activities',
  crudRouter(Activity, {
    search: ['name', 'nameEn', 'slug'],
    filters: ['category', 'active'],
    sort: { name: 1 },
    writable: ['slug', 'name', 'nameEn', 'category', 'image', 'imageCredit', 'variants', 'defaultMinutes', 'active'],
  }),
);
// Kế hoạch ăn mẫu (chỉ bản hệ thống; thực đơn tự tạo thuộc về người dùng). days: [{ items: [...] }]
router.use(
  '/meal-plans',
  crudRouter(MealPlan, {
    scope: { owner: null },
    search: ['title', 'slug'],
    filters: ['style', 'active'],
    sort: { kcalMin: 1, sort: 1 },
    writable: ['slug', 'title', 'summary', 'description', 'style', 'kcalMin', 'kcalMax', 'image', 'imageCredit', 'days', 'sort', 'active'],
    transform: async (body) => {
      if (body.kcalMin != null && body.kcalMax != null && Number(body.kcalMin) >= Number(body.kcalMax)) throw new HttpError(400, 'Calo tối thiểu phải nhỏ hơn calo tối đa');
      if (body.days === undefined) return body;
      const [foods, dishes] = await Promise.all([loadFoods(), loadDishes()]);
      return { ...body, days: cleanDays(body.days.map((d) => d.items ?? d), makeCtx(foods, dishes)) };
    },
  }),
);
router.use(
  '/coupons',
  crudRouter(Coupon, {
    search: ['code', 'label'],
    filters: ['active'],
    writable: ['code', 'label', 'kind', 'value', 'maxDiscount', 'minSubtotal', 'maxUses', 'firstOrderOnly', 'expiresAt', 'active'],
  }),
);

// ---- Đơn hàng ----
const STATUS_TEXT = { confirmed: 'đã được xác nhận', preparing: 'đang được chuẩn bị', shipping: 'đang được giao', done: 'đã hoàn tất', cancelled: 'đã bị hủy' };

router.get(
  '/orders',
  ah(async (req, res) => {
    const { page: p, limit } = page(req);
    const where = {};
    for (const f of ['status', 'paymentStatus', 'payment', 'source']) if (req.query[f]) where[f] = req.query[f];
    const q = (req.query.q ?? '').toString().trim();
    if (q) {
      const re = { $regex: escapeRe(q), $options: 'i' };
      where.$or = [{ code: re }, { 'address.phone': re }, { 'address.name': re }];
    }
    const [items, total] = await Promise.all([
      Order.find(where).sort({ createdAt: -1 }).skip((p - 1) * limit).limit(limit).populate('user', 'name email').lean(),
      Order.countDocuments(where),
    ]);
    res.json({ items, total, page: p, limit });
  }),
);

router.get(
  '/orders/:id',
  ah(async (req, res) => {
    const item = await Order.findById(req.params.id).populate('user', 'name email').lean();
    if (!item) throw new HttpError(404, 'Không tìm thấy đơn hàng');
    res.json({ item });
  }),
);

router.patch(
  '/orders/:id',
  ah(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (!order) throw new HttpError(404, 'Không tìm thấy đơn hàng');
    const { status, paymentStatus, adminNote } = req.body ?? {};
    const prev = order.status;
    if (status && status !== prev) {
      if (!Object.keys(STATUS_TEXT).includes(status)) throw new HttpError(400, 'Trạng thái không hợp lệ');
      if (prev === 'cancelled') throw new HttpError(400, 'Đơn đã hủy, không thể đổi trạng thái');
      order.status = status;
      order.history.push({ status, at: new Date(), by: req.user.email });
    }
    if (paymentStatus) order.paymentStatus = paymentStatus;
    if (adminNote !== undefined) order.adminNote = String(adminNote).slice(0, 500);
    await order.save();
    if (status === 'cancelled' && prev !== 'cancelled') await restock(order);
    if (status && status !== prev) {
      await notifyUser(order.user, { title: `Đơn ${order.code}`, body: `Đơn hàng của bạn ${STATUS_TEXT[status]}.`, url: `/orders/${order._id}` });
    }
    res.json({ item: await order.populate('user', 'name email') });
  }),
);

// ---- Người dùng ----
router.get(
  '/users',
  ah(async (req, res) => {
    const { page: p, limit } = page(req);
    const where = {};
    if (req.query.role) where.role = req.query.role;
    const q = (req.query.q ?? '').toString().trim();
    if (q) {
      const re = { $regex: escapeRe(q), $options: 'i' };
      where.$or = [{ email: re }, { name: re }];
    }
    const [items, total] = await Promise.all([
      User.find(where).select('-passwordHash').sort({ createdAt: -1 }).skip((p - 1) * limit).limit(limit).lean(),
      User.countDocuments(where),
    ]);
    const counts = await Order.aggregate([{ $match: { user: { $in: items.map((u) => u._id) } } }, { $group: { _id: '$user', n: { $sum: 1 }, spent: { $sum: { $cond: [{ $ne: ['$status', 'cancelled'] }, '$total', 0] } } } }]);
    res.json({
      items: items.map((u) => {
        const c = counts.find((x) => String(x._id) === String(u._id));
        return { ...u, orders: c?.n ?? 0, spent: c?.spent ?? 0 };
      }),
      total,
      page: p,
      limit,
    });
  }),
);

router.patch(
  '/users/:id',
  ah(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) throw new HttpError(404, 'Không tìm thấy người dùng');
    const { role, name } = req.body ?? {};
    if (role) {
      if (!['user', 'admin'].includes(role)) throw new HttpError(400, 'Vai trò không hợp lệ');
      if (String(user._id) === String(req.user._id) && role !== 'admin') throw new HttpError(400, 'Không thể tự gỡ quyền admin của chính bạn');
      user.role = role;
    }
    if (name?.trim()) user.name = name.trim().slice(0, 60);
    await user.save();
    const { passwordHash, ...item } = user.toObject();
    res.json({ item });
  }),
);

router.post(
  '/users/:id/password',
  ah(async (req, res) => {
    const pw = req.body?.password ?? '';
    if (pw.length < 6) throw new HttpError(400, 'Mật khẩu cần ít nhất 6 ký tự');
    const r = await User.updateOne({ _id: req.params.id }, { passwordHash: await bcrypt.hash(pw, 10) });
    if (!r.matchedCount) throw new HttpError(404, 'Không tìm thấy người dùng');
    res.json({ ok: true });
  }),
);

router.delete(
  '/users/:id',
  ah(async (req, res) => {
    if (String(req.params.id) === String(req.user._id)) throw new HttpError(400, 'Không thể xóa chính bạn');
    const id = req.params.id;
    await Promise.all([DailyLog, PlanChoice, Order, Subscription, Reminder, SupportRequest, PushSubscription, WeightEntry].map((m) => m.deleteMany({ user: id })));
    const u = await User.findById(id).lean();
    await deleteImage(u?.avatar);
    await MealPlan.deleteMany({ owner: id });
    await User.deleteOne({ _id: id });
    res.status(204).end();
  }),
);

// ---- Gói định kỳ ----
router.get(
  '/subscriptions',
  ah(async (req, res) => {
    const { page: p, limit } = page(req);
    const where = req.query.active ? { active: req.query.active === 'true' } : {};
    const [items, total] = await Promise.all([
      Subscription.find(where).sort({ createdAt: -1 }).skip((p - 1) * limit).limit(limit).populate('user', 'name email').lean(),
      Subscription.countDocuments(where),
    ]);
    res.json({ items, total, page: p, limit });
  }),
);

router.patch(
  '/subscriptions/:id',
  ah(async (req, res) => {
    const item = await Subscription.findByIdAndUpdate(req.params.id, { active: Boolean(req.body?.active) }, { new: true }).populate('user', 'name email');
    if (!item) throw new HttpError(404, 'Không tìm thấy gói');
    res.json({ item });
  }),
);

router.post(
  '/subscriptions/run',
  ah(async (req, res) => res.json({ created: await generateSubscriptionOrders() })),
);

// ---- Hỗ trợ ----
router.get(
  '/support',
  ah(async (req, res) => {
    const { page: p, limit } = page(req);
    const where = req.query.status ? { status: req.query.status } : {};
    const [items, total] = await Promise.all([
      SupportRequest.find(where).sort({ createdAt: -1 }).skip((p - 1) * limit).limit(limit).populate('user', 'name email').lean(),
      SupportRequest.countDocuments(where),
    ]);
    res.json({ items, total, page: p, limit });
  }),
);

router.patch(
  '/support/:id',
  ah(async (req, res) => {
    const item = await SupportRequest.findById(req.params.id);
    if (!item) throw new HttpError(404, 'Không tìm thấy yêu cầu');
    const { reply, status } = req.body ?? {};
    if (reply !== undefined && String(reply).trim()) {
      item.reply = String(reply).trim().slice(0, 2000);
      item.repliedAt = new Date();
      item.status = 'answered';
    }
    if (status) item.status = status;
    await item.save();
    if (reply) await notifyUser(item.user, { title: 'NUTRIVA đã phản hồi yêu cầu của bạn', body: item.reply.slice(0, 120), url: '/me/support' });
    res.json({ item: await item.populate('user', 'name email') });
  }),
);

// ---- Cấu hình ----
router.get(
  '/settings',
  ah(async (req, res) => {
    const s = await Setting.findOne({ key: 'main' }).select('-vapid').lean();
    res.json({ item: s });
  }),
);

router.put(
  '/settings',
  ah(async (req, res) => {
    const { shippingFee, freeShipFrom, bank, store, subscriptionPlans, diySteps } = req.body ?? {};
    const update = {};
    if (shippingFee !== undefined) update.shippingFee = Math.max(0, Number(shippingFee) || 0);
    if (freeShipFrom !== undefined) update.freeShipFrom = Math.max(0, Number(freeShipFrom) || 0);
    if (bank) update.bank = { bankId: String(bank.bankId ?? '').trim(), accountNo: String(bank.accountNo ?? '').trim(), accountName: String(bank.accountName ?? '').trim().toUpperCase() };
    if (store) update.store = { name: store.name ?? '', address: store.address ?? '', phone: store.phone ?? '' };
    if (Array.isArray(subscriptionPlans)) {
      update.subscriptionPlans = subscriptionPlans.map((p, i) => {
        const bottles = Math.floor(Number(p.bottles));
        const price = Math.floor(Number(p.price));
        if (!(bottles > 0 && price > 0)) throw new HttpError(400, `Gói #${i + 1}: số chai và giá phải > 0`);
        return { id: p.id || `w${bottles}`, bottles, price, label: p.label || `${bottles} chai / tuần` };
      });
    }
    if (Array.isArray(diySteps)) update.diySteps = diySteps.filter((s) => s.title?.trim()).map((s) => ({ title: s.title.trim(), text: (s.text ?? '').trim() }));
    const item = await Setting.findOneAndUpdate({ key: 'main' }, update, { new: true, upsert: true }).select('-vapid').lean();
    invalidateSettings();
    res.json({ item });
  }),
);

// ---- Upload ảnh (lưu trong MongoDB GridFS) ----
router.post(
  '/uploads',
  imageUpload(3).single('file'),
  ah(async (req, res) => {
    if (!req.file) throw new HttpError(400, 'Chọn ảnh PNG/JPG/WebP tối đa 3 MB');
    res.status(201).json({ url: await saveImage(req.file, { by: req.user._id }) });
  }),
);

export default router;
