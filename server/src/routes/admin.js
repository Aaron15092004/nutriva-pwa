import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { User, Product, Food, Dish, Coupon, Activity, Order, Subscription, SupportRequest, Setting, MealPlan, Promo, ActivationBatch, ActivationCode, MembershipGrant, StockLot, StockMove } from '../models/index.js';
import { grantForOrder, revokeForOrder, grantDays, createBatch, prettyCode, normalizeCode, membershipConfig } from '../services/membership.js';
import { appUrl } from '../services/mail.js';
import { SALES_CHANNELS } from '../../../shared/nutrition.js';
import { ah, requireAuth, requireAdmin, HttpError } from '../middleware/auth.js';
import { crudRouter } from './crud.js';
import { invalidateSettings, invalidateCatalog, loadAllFoods, loadAllDishes } from '../services/catalog.js';
import { notifyUser, generateSubscriptionOrders, nowInTz, startOfDayInTz, addDays } from '../services/scheduler.js';
import { imageUpload, saveImage } from '../services/files.js';
import { cancelOrder, canMove, ORDER_STATUSES, PAYMENT_STATUSES } from '../services/orders.js';
import { deleteAccount } from '../services/accounts.js';
import { audit, diff } from '../services/audit.js';
import { profileAge } from '../../../shared/nutrition.js';
import { computeDish } from '../services/dishes.js';
import { makeCtx, cleanDays } from '../services/meal-plans.js';

const router = Router();
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
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
    // Mốc ngày theo giờ Việt Nam (APP_TZ), không theo giờ máy chủ
    const now = new Date();
    const today = nowInTz(now).date;
    const d30 = new Date(now - 30 * 86400000);
    const d14 = startOfDayInTz(addDays(today, -13));
    const startToday = startOfDayInTz(today);
    const valid = { status: { $ne: 'cancelled' } };
    const [lowStock, expiringLots, activeMembers] = await Promise.all([
      Product.countDocuments({ stock: { $ne: null }, $expr: { $lte: ['$stock', { $ifNull: ['$lowStock', 10] }] } }),
      StockLot.countDocuments({ remaining: { $gt: 0 }, expiryDate: { $lte: addDays(today, 2) } }),
      User.countDocuments({ 'membership.until': { $gt: now } }),
    ]);

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
      lowStock,
      expiringLots,
      activeMembers,
    });
  }),
);

// ---- Danh mục ----
// Xóa / đổi mã một mục đang được tham chiếu sẽ làm hỏng món ăn, kế hoạch, gói định kỳ → chặn, gợi ý "tắt" thay vì xóa.
const inUse = (n, what) => (n ? `${n} ${what}` : null);
async function assertUnused(parts, verb) {
  const used = (await Promise.all(parts)).filter(Boolean);
  if (used.length) throw new HttpError(409, `Không thể ${verb}: đang được dùng trong ${used.join(', ')}. Hãy tắt hiển thị thay vì ${verb}.`);
}
const foodRefs = (key) => [
  Dish.countDocuments({ 'ingredients.food': key }).then((n) => inUse(n, 'món ăn')),
  MealPlan.countDocuments({ 'days.items.food': key }).then((n) => inUse(n, 'kế hoạch/thực đơn')),
];
const dishRefs = (key) => [MealPlan.countDocuments({ 'days.items.dish': key }).then((n) => inUse(n, 'kế hoạch/thực đơn'))];
const productRefs = (slug) => [Subscription.countDocuments({ productSlug: slug, active: true }).then((n) => inUse(n, 'gói định kỳ đang chạy'))];
const keyGuard = (field, refs) => ({
  beforeUpdate: async (doc, changes) => {
    if (changes[field] !== undefined && String(changes[field]).trim().toLowerCase() !== String(doc[field]).toLowerCase()) await assertUnused(refs(doc[field]), 'đổi mã');
  },
  beforeDelete: (doc) => assertUnused(refs(doc[field]), 'xóa'),
});

router.use(
  '/products',
  crudRouter(Product, {
    onChange: invalidateCatalog,
    ...keyGuard('slug', productRefs),
    search: ['name', 'slug'],
    filters: ['type', 'active'],
    sort: { sort: 1, createdAt: 1 },
    writable: ['slug', 'type', 'name', 'subtitle', 'size', 'price', 'line', 'ingredients', 'extraIngredients', 'flavor', 'image', 'imageCredit', 'badge', 'description', 'nutrition', 'storage', 'steps', 'lowStock', 'membershipDays', 'sort', 'active'], // tồn kho chỉ đổi qua Kho hàng (có phiếu xuất nhập)
  }),
);
router.use(
  '/foods',
  crudRouter(Food, {
    onChange: invalidateCatalog,
    ...keyGuard('key', foodRefs),
    search: ['name', 'key'],
    filters: ['group', 'nutrientGroup', 'plant', 'active'],
    sort: { group: 1, name: 1 },
    writable: ['key', 'name', 'group', 'nutrientGroup', 'kcal', 'protein', 'carb', 'fat', 'fiber', 'water', 'ash', 'waste', 'micros', 'serving', 'unit', 'plant', 'allergens', 'source', 'image', 'active'],
  }),
);
router.use(
  '/dishes',
  crudRouter(Dish, {
    onChange: invalidateCatalog,
    ...keyGuard('key', dishRefs),
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
      const [foods, dishes] = await Promise.all([loadAllFoods(), loadAllDishes()]);
      return { ...body, days: cleanDays(body.days.map((d) => d.items ?? d), makeCtx(foods, dishes)) };
    },
  }),
);
// Banner quảng cáo (trang chủ / cửa hàng / kế hoạch / theo dõi). Link trong app (/shop/...) hoặc link ngoài (https://...)
const LINK_RE = /^(\/[^\s]*|https?:\/\/[^\s]+)$/;
router.use(
  '/promos',
  crudRouter(Promo, {
    search: ['title', 'subtitle'],
    filters: ['active', 'placements'],
    sort: { sort: 1, createdAt: -1 },
    writable: ['title', 'subtitle', 'image', 'imageCredit', 'ctaLabel', 'link', 'placements', 'theme', 'startAt', 'endAt', 'sort', 'active'],
    label: (d) => d.title,
    transform: async (body) => {
      if (body.link && !LINK_RE.test(String(body.link).trim())) throw new HttpError(400, 'Link phải là trang trong app (bắt đầu bằng /) hoặc địa chỉ https://');
      for (const k of ['startAt', 'endAt']) if (body[k] === '') body[k] = null;
      if (body.startAt && body.endAt && new Date(body.startAt) > new Date(body.endAt)) throw new HttpError(400, 'Ngày kết thúc phải sau ngày bắt đầu');
      return body;
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
    const today = nowInTz().date;
    const tomorrow = addDays(today, 1);
    // Hàng chờ xử lý (chip lọc nhanh ở trang Đơn hàng)
    const QUEUES = {
      todo: { status: { $in: ['confirmed', 'preparing'] } },
      shipping: { status: 'shipping' },
      bank: { payment: 'bank', paymentStatus: 'unpaid', status: { $ne: 'cancelled' } },
      today: { 'delivery.date': today, status: { $nin: ['cancelled', 'done'] } },
      tomorrow: { 'delivery.date': tomorrow, status: { $nin: ['cancelled', 'done'] } },
    };
    const where = { ...(QUEUES[req.query.queue] ?? {}) };
    for (const f of ['status', 'paymentStatus', 'payment', 'source']) if (req.query[f]) where[f] = String(req.query[f]);
    if (DATE_RE.test(req.query.date ?? '')) where['delivery.date'] = String(req.query.date);
    const q = (req.query.q ?? '').toString().trim();
    if (q) {
      const re = { $regex: escapeRe(q), $options: 'i' };
      where.$or = [{ code: re }, { 'address.phone': re }, { 'address.name': re }];
    }
    // Hàng chờ: giao sớm nhất trước; còn lại: mới đặt trước
    const sort = req.query.queue && req.query.queue !== 'bank' ? { 'delivery.date': 1, createdAt: 1 } : { createdAt: -1 };
    const [items, total, ...counts] = await Promise.all([
      Order.find(where).sort(sort).skip((p - 1) * limit).limit(limit).populate('user', 'name email').lean(),
      Order.countDocuments(where),
      ...Object.values(QUEUES).map((w) => Order.countDocuments(w)),
    ]);
    res.json({ items, total, page: p, limit, counts: Object.fromEntries(Object.keys(QUEUES).map((k, i) => [k, counts[i]])), today, tomorrow });
  }),
);

// Soạn hàng theo ngày giao: tổng số chai / gói từng loại cần chuẩn bị + danh sách đơn (in phiếu soạn & phiếu giao)
router.get(
  '/orders/prep',
  ah(async (req, res) => {
    const date = DATE_RE.test(req.query.date ?? '') ? String(req.query.date) : addDays(nowInTz().date, 1);
    const orders = await Order.find({ 'delivery.date': date, status: { $in: ['confirmed', 'preparing', 'shipping'] } })
      .sort({ 'delivery.slot': 1, createdAt: 1 })
      .populate('user', 'name email')
      .lean();
    const lines = new Map();
    for (const o of orders) {
      for (const it of o.items) {
        const key = `${it.slug}|${it.sweetness ?? ''}`;
        const l = lines.get(key) ?? { slug: it.slug, type: it.type, name: it.name, sweetness: it.sweetness ?? null, qty: 0, orders: 0 };
        l.qty += it.qty;
        l.orders += 1;
        lines.set(key, l);
      }
    }
    const items = [...lines.values()].sort((a, b) => a.type.localeCompare(b.type) || b.qty - a.qty);
    res.json({ date, items, orders, totals: { orders: orders.length, units: items.reduce((n, l) => n + l.qty, 0), home: orders.filter((o) => o.delivery?.method === 'home').length } });
  }),
);

router.get(
  '/orders/:id',
  ah(async (req, res) => {
    const item = await Order.findById(req.params.id).populate('user', 'name email').lean();
    if (!item) throw new HttpError(404, 'Không tìm thấy đơn hàng');
    // Lô hàng đã xuất cho đơn (mã lô, hạn dùng) → soạn đúng lô, truy vết khi có khiếu nại
    const moves = await StockMove.find({ order: item._id }).sort({ createdAt: 1 }).populate('product', 'name type').populate('lots.lot', 'code expiryDate').lean();
    res.json({ item, moves });
  }),
);

router.patch(
  '/orders/:id',
  ah(async (req, res) => {
    const { status, paymentStatus, adminNote } = req.body ?? {};
    let order = await Order.findById(req.params.id);
    if (!order) throw new HttpError(404, 'Không tìm thấy đơn hàng');
    const before = order.toObject();
    const prev = order.status;
    const moving = status && status !== prev;
    if (moving && !canMove(prev, status)) {
      throw new HttpError(400, prev === 'cancelled' ? 'Đơn đã hủy, không thể mở lại — hãy tạo đơn mới' : prev === 'done' ? 'Đơn đã hoàn tất — chỉ có thể hủy (hoàn tiền)' : 'Chỉ lùi được 1 bước so với trạng thái hiện tại');
    }
    if (paymentStatus !== undefined && !PAYMENT_STATUSES.includes(paymentStatus)) throw new HttpError(400, 'Trạng thái thanh toán không hợp lệ');

    if (moving && status === 'cancelled') {
      // Hủy nguyên tử: hoàn kho đúng 1 lần dù người dùng cũng đang bấm hủy
      order = await cancelOrder({ _id: order._id }, { by: req.user.email, from: ORDER_STATUSES.filter((x) => x !== 'cancelled') });
      if (!order) throw new HttpError(409, 'Đơn vừa được hủy ở nơi khác, vui lòng tải lại');
    } else if (moving) {
      // Chỉ chuyển nếu trạng thái chưa bị đổi bởi người khác trong lúc admin đang xem
      order = await Order.findOneAndUpdate(
        { _id: order._id, status: prev },
        { $set: { status }, $push: { history: { status, at: new Date(), by: req.user.email } } },
        { new: true },
      );
      if (!order) throw new HttpError(409, 'Đơn vừa được cập nhật ở nơi khác, vui lòng tải lại');
    }
    const set = {};
    if (paymentStatus !== undefined) set.paymentStatus = paymentStatus;
    if (adminNote !== undefined) set.adminNote = String(adminNote).slice(0, 500);
    if (Object.keys(set).length) order = await Order.findByIdAndUpdate(order._id, { $set: set }, { new: true });

    const changes = diff(
      { status: before.status, paymentStatus: before.paymentStatus, adminNote: before.adminNote },
      { status: order.status, paymentStatus: order.paymentStatus, adminNote: order.adminNote },
    );
    if (changes) await audit(req, 'order.update', { entity: 'Order', entityId: order._id, summary: order.code, changes });
    // Gói sử dụng: đơn đã thanh toán (chuyển khoản xác nhận) hoặc đã giao xong (COD) → cộng ngày; hủy / hoàn tiền → thu hồi
    if (order.status === 'cancelled' || order.paymentStatus === 'refunded') {
      const d = await revokeForOrder(order._id, order.status === 'cancelled' ? 'Hủy đơn' : 'Hoàn tiền');
      if (d) await audit(req, 'membership.revoke', { entity: 'Order', entityId: order._id, summary: `${order.code}: −${d} ngày` });
    } else if (order.paymentStatus === 'paid' || order.status === 'done') {
      const d = await grantForOrder(order._id);
      if (d) {
        await audit(req, 'membership.grant', { entity: 'Order', entityId: order._id, summary: `${order.code}: +${d} ngày` });
        await notifyUser(order.user, { title: 'Đã gia hạn gói NUTRIVA', body: `Đơn ${order.code} được cộng ${d} ngày sử dụng kế hoạch & nhắc nhở.`, url: '/me/membership' });
      }
      order = await Order.findById(order._id);
    }
    if (moving) {
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
      User.find(where).select('-passwordHash -tokenVersion -survey').sort({ createdAt: -1 }).skip((p - 1) * limit).limit(limit).lean(),
      User.countDocuments(where),
    ]);
    const counts = await Order.aggregate([{ $match: { user: { $in: items.map((u) => u._id) } } }, { $group: { _id: '$user', n: { $sum: 1 }, spent: { $sum: { $cond: [{ $ne: ['$status', 'cancelled'] }, '$total', 0] } } } }]);
    res.json({
      items: items.map((u) => {
        const c = counts.find((x) => String(x._id) === String(u._id));
        return { ...u, profile: u.profile && { ...u.profile, age: profileAge(u.profile) }, orders: c?.n ?? 0, spent: c?.spent ?? 0 };
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
    const before = user.toObject();
    const { role, name } = req.body ?? {};
    if (role) {
      if (!['user', 'admin'].includes(role)) throw new HttpError(400, 'Vai trò không hợp lệ');
      if (String(user._id) === String(req.user._id) && role !== 'admin') throw new HttpError(400, 'Không thể tự gỡ quyền admin của chính bạn');
      user.role = role;
    }
    if (name?.trim()) user.name = name.trim().slice(0, 60);
    const changes = diff({ role: before.role, name: before.name }, { role: user.role, name: user.name });
    // Gỡ quyền admin → đăng xuất mọi phiên của người đó (token cũ không còn dùng được)
    if (before.role === 'admin' && user.role !== 'admin') user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    await user.save();
    if (changes) await audit(req, 'user.update', { entity: 'User', entityId: user._id, summary: user.email, changes });
    const { passwordHash, tokenVersion, ...item } = user.toObject();
    res.json({ item });
  }),
);

router.post(
  '/users/:id/password',
  ah(async (req, res) => {
    const pw = req.body?.password ?? '';
    if (pw.length < 6) throw new HttpError(400, 'Mật khẩu cần ít nhất 6 ký tự');
    if (pw.length > 128) throw new HttpError(400, 'Mật khẩu quá dài');
    // Đặt lại mật khẩu → mọi phiên đăng nhập cũ của người dùng bị thu hồi
    const user = await User.findByIdAndUpdate(req.params.id, { passwordHash: await bcrypt.hash(pw, 10), $inc: { tokenVersion: 1 } }, { new: true });
    if (!user) throw new HttpError(404, 'Không tìm thấy người dùng');
    await audit(req, 'user.password_reset', { entity: 'User', entityId: user._id, summary: user.email });
    res.json({ ok: true });
  }),
);

router.delete(
  '/users/:id',
  ah(async (req, res) => {
    if (String(req.params.id) === String(req.user._id)) throw new HttpError(400, 'Không thể xóa chính bạn');
    const u = await User.findById(req.params.id).select('email name').lean();
    if (!u) throw new HttpError(404, 'Không tìm thấy người dùng');
    await deleteAccount(u._id);
    await audit(req, 'user.delete', { entity: 'User', entityId: u._id, summary: `${u.email} (${u.name ?? ''})` });
    res.status(204).end();
  }),
);

// ---- Gói sử dụng của 1 người dùng ----
router.get(
  '/users/:id/membership',
  ah(async (req, res) => {
    const user = await User.findById(req.params.id, { membership: 1, createdAt: 1 }).lean();
    if (!user) throw new HttpError(404, 'Không tìm thấy người dùng');
    const history = await MembershipGrant.find({ user: user._id }).sort({ createdAt: -1 }).limit(50).lean();
    const codes = await ActivationCode.countDocuments({ usedBy: user._id });
    res.json({ until: user.membership?.until ?? null, history, codes });
  }),
);

router.post(
  '/users/:id/membership',
  ah(async (req, res) => {
    const days = Math.round(Number(req.body?.days));
    if (!days || Math.abs(days) > 3650) throw new HttpError(400, 'Nhập số ngày (âm để trừ), tối đa 3650');
    const note = String(req.body?.note ?? '').trim().slice(0, 120);
    if (!note) throw new HttpError(400, 'Nhập lý do (vd: tặng khách hàng thân thiết, bù lỗi giao hàng)');
    const user = await User.findById(req.params.id, { email: 1 }).lean();
    if (!user) throw new HttpError(404, 'Không tìm thấy người dùng');
    const until = await grantDays(user._id, days, { source: days > 0 ? 'admin' : 'revoke', note, by: req.user.email });
    await audit(req, 'membership.admin', { entity: 'User', entityId: user._id, summary: `${user.email}: ${days > 0 ? '+' : ''}${days} ngày — ${note}` });
    res.json({ until });
  }),
);

// ---- Mã kích hoạt (in QR + mã nhập tay trên chai) ----
router.get(
  '/activation',
  ah(async (req, res) => {
    const batches = await ActivationBatch.find().sort({ createdAt: -1 }).limit(200).populate('lot', 'code expiryDate').lean();
    const counts = await ActivationCode.aggregate([{ $match: { batch: { $in: batches.map((b) => b._id) } } }, { $group: { _id: { b: '$batch', s: '$status' }, n: { $sum: 1 } } }]);
    const by = (id, st) => counts.find((c) => String(c._id.b) === String(id) && c._id.s === st)?.n ?? 0;
    const [used30, activeMembers] = await Promise.all([
      ActivationCode.countDocuments({ status: 'used', usedAt: { $gte: new Date(Date.now() - 30 * 86400000) } }),
      User.countDocuments({ 'membership.until': { $gt: new Date() } }),
    ]);
    res.json({
      items: batches.map((b) => ({ ...b, used: by(b._id, 'used'), void: by(b._id, 'void'), unused: by(b._id, 'new') })),
      stats: { used30, activeMembers },
      config: await membershipConfig(),
    });
  }),
);

router.post(
  '/activation',
  ah(async (req, res) => {
    const { name, productSlug, days, quantity, packSize, unit, expiresAt, note } = req.body ?? {};
    const n = Math.floor(Number(quantity));
    const d = Math.floor(Number(days));
    const pack = Math.floor(Number(packSize ?? 1));
    if (!String(name ?? '').trim()) throw new HttpError(400, 'Đặt tên lô mã (vd: Mạch Nhiên — lô 30/10)', { name: 'Bắt buộc' });
    if (!(n >= 1 && n <= 20000)) throw new HttpError(400, 'Số lượng mã từ 1 đến 20.000', { quantity: 'Từ 1 đến 20.000' });
    if (!(pack >= 1 && pack <= 1000)) throw new HttpError(400, 'Quy cách: 1 mã cho 1 đến 1.000 đơn vị', { packSize: 'Từ 1 đến 1.000' });
    if (!(d >= 1 && d <= 365)) throw new HttpError(400, 'Số ngày mỗi mã từ 1 đến 365', { days: 'Từ 1 đến 365' });
    if (expiresAt && Number.isNaN(Date.parse(expiresAt))) throw new HttpError(400, 'Hạn kích hoạt không hợp lệ', { expiresAt: 'Ngày không hợp lệ' });
    const batch = await createBatch({
      name: String(name).trim().slice(0, 80),
      productSlug: productSlug || undefined,
      days: d,
      quantity: n,
      packSize: pack,
      unit: String(unit || 'chai').trim().slice(0, 20),
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      note: String(note ?? '').slice(0, 200),
      createdBy: req.user.email,
    });
    await audit(req, 'activation.create', { entity: 'ActivationBatch', entityId: batch._id, summary: `${batch.name}: ${n} mã × ${d} ngày${pack > 1 ? ` (1 mã / ${pack} ${batch.unit})` : ''}` });
    res.status(201).json({ item: batch });
  }),
);

// Danh sách mã của 1 lô; ?format=csv (in tem: mã + link QR)
router.get(
  '/activation/:id/codes',
  ah(async (req, res) => {
    const batch = await ActivationBatch.findById(req.params.id).lean();
    if (!batch) throw new HttpError(404, 'Không tìm thấy lô mã');
    const where = { batch: batch._id };
    if (['new', 'used', 'void'].includes(req.query.status)) where.status = String(req.query.status);
    const q = normalizeCode(req.query.q);
    if (q) where.code = { $regex: `^${q}` };
    const base = `${appUrl()}/activate?code=`;
    if (req.query.format === 'csv') {
      const all = await ActivationCode.find(where).sort({ _id: 1 }).lean();
      const rows = [['STT', 'Mã', 'Link QR', 'Số ngày', 'Trạng thái']].concat(all.map((c, i) => [i + 1, prettyCode(c.code), base + c.code, c.days, c.status]));
      res.set('Content-Type', 'text/csv; charset=utf-8');
      res.set('Content-Disposition', `attachment; filename="ma-kich-hoat-${batch._id}.csv"`);
      return res.send(`\uFEFF${rows.map((r) => r.join(',')).join('\n')}`);
    }
    const limit = req.query.all === '1' ? 20000 : 100;
    const items = await ActivationCode.find(where).sort({ _id: 1 }).limit(limit).populate('usedBy', 'name email').lean();
    res.json({ batch, items: items.map((c) => ({ ...c, pretty: prettyCode(c.code), link: base + c.code })), total: await ActivationCode.countDocuments(where) });
  }),
);

router.patch(
  '/activation/:id',
  ah(async (req, res) => {
    const set = {};
    if (typeof req.body?.active === 'boolean') set.active = req.body.active;
    if (req.body?.name) set.name = String(req.body.name).trim().slice(0, 80);
    if (req.body?.expiresAt !== undefined) set.expiresAt = req.body.expiresAt ? new Date(req.body.expiresAt) : null;
    const item = await ActivationBatch.findByIdAndUpdate(req.params.id, set, { new: true }).lean();
    if (!item) throw new HttpError(404, 'Không tìm thấy lô mã');
    await audit(req, 'activation.update', { entity: 'ActivationBatch', entityId: item._id, summary: `${item.name}${set.active === false ? ' — ngừng' : set.active ? ' — bật lại' : ''}` });
    res.json({ item });
  }),
);

// Vô hiệu 1 mã (vd chai bị hỏng / mã bị lộ)
router.post(
  '/activation/codes/:code/void',
  ah(async (req, res) => {
    const code = normalizeCode(req.params.code);
    const r = await ActivationCode.findOneAndUpdate({ code, status: 'new' }, { status: 'void' }, { new: true }).lean();
    if (!r) throw new HttpError(400, 'Không tìm thấy mã chưa dùng');
    await audit(req, 'activation.void', { entity: 'ActivationCode', entityId: r._id, summary: prettyCode(code) });
    res.json({ ok: true });
  }),
);

// Tra cứu nhanh 1 mã (khách hỏi "mã của tôi bị báo đã dùng")
router.get(
  '/activation/lookup/:code',
  ah(async (req, res) => {
    const c = await ActivationCode.findOne({ code: normalizeCode(req.params.code) }).populate('batch', 'name days active expiresAt').populate('usedBy', 'name email').lean();
    if (!c) throw new HttpError(404, 'Không có mã này');
    res.json({ item: { ...c, pretty: prettyCode(c.code) } });
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
    await audit(req, item.active ? 'subscription.resume' : 'subscription.pause', { entity: 'Subscription', entityId: item._id, summary: `${item.productName} — ${item.user?.email ?? ''}` });
    res.json({ item });
  }),
);

router.post(
  '/subscriptions/run',
  ah(async (req, res) => {
    const created = await generateSubscriptionOrders();
    await audit(req, 'subscription.run', { summary: `Tạo ${created} đơn` });
    res.json({ created });
  }),
);

// ---- Hỗ trợ ----
router.get(
  '/support',
  ah(async (req, res) => {
    const { page: p, limit } = page(req);
    const where = req.query.status ? { status: String(req.query.status) } : {};
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
    if (status) {
      if (!['open', 'answered', 'closed'].includes(status)) throw new HttpError(400, 'Trạng thái không hợp lệ');
      item.status = status;
    }
    await item.save();
    await audit(req, reply ? 'support.reply' : 'support.update', { entity: 'SupportRequest', entityId: item._id, summary: `${item.topic ?? ''} → ${item.status}` });
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
    const { shippingFee, freeShipFrom, bank, store, subscriptionPlans, diySteps, channels, popup, membership, interstitial } = req.body ?? {};
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
    if (Array.isArray(channels)) {
      update.channels = channels
        .filter((c) => SALES_CHANNELS.some((x) => x.id === c.id) && String(c.url ?? '').trim())
        .map((c) => {
          const url = String(c.url).trim();
          if (!/^https?:\/\//.test(url)) throw new HttpError(400, `Link ${c.label || c.id} phải bắt đầu bằng https://`);
          return { id: c.id, label: String(c.label || SALES_CHANNELS.find((x) => x.id === c.id).label).slice(0, 30), url: url.slice(0, 300), note: String(c.note ?? '').slice(0, 60) };
        });
    }
    if (popup && typeof popup === 'object') {
      const link = String(popup.ctaLink ?? '').trim();
      if (link && !/^(\/|https?:\/\/)/.test(link)) throw new HttpError(400, 'Link nút popup phải bắt đầu bằng / hoặc https://');
      update.popup = {
        enabled: Boolean(popup.enabled),
        title: String(popup.title ?? '').slice(0, 80),
        text: String(popup.text ?? '').slice(0, 240),
        image: String(popup.image ?? '').slice(0, 300),
        imageCredit: String(popup.imageCredit ?? '').slice(0, 160),
        ctaLabel: String(popup.ctaLabel ?? '').slice(0, 30),
        ctaLink: link.slice(0, 300),
        showChannels: popup.showChannels !== false,
        everyHours: Math.min(720, Math.max(1, Math.round(Number(popup.everyHours) || 24))),
      };
    }
    const clamp = (v, lo, hi, def) => Math.min(hi, Math.max(lo, Number.isFinite(Number(v)) ? Math.round(Number(v)) : def));
    if (membership && typeof membership === 'object') {
      update.membership = {
        enabled: membership.enabled !== false,
        freePlanDays: clamp(membership.freePlanDays, 0, 7, 3),
        daysPerBottle: clamp(membership.daysPerBottle, 0, 60, 2),
        daysPerSet: clamp(membership.daysPerSet, 0, 120, 4),
        daysPerTreat: clamp(membership.daysPerTreat, 0, 60, 0),
        expiryNoticeDays: clamp(membership.expiryNoticeDays, 0, 14, 2),
        codesPerReward: clamp(membership.codesPerReward, 0, 50, 4),
        rewardDays: clamp(membership.rewardDays, 0, 60, 3),
      };
    }
    if (interstitial && typeof interstitial === 'object') {
      update.interstitial = {
        enabled: Boolean(interstitial.enabled),
        everyNav: clamp(interstitial.everyNav, 2, 50, 6),
        minMinutes: clamp(interstitial.minMinutes, 1, 1440, 5),
        skipSeconds: clamp(interstitial.skipSeconds, 0, 10, 3),
        maxPerDay: clamp(interstitial.maxPerDay, 1, 50, 4),
        skipMembers: Boolean(interstitial.skipMembers),
      };
    }
    if (Array.isArray(diySteps)) update.diySteps = diySteps.filter((s) => s.title?.trim()).map((s) => ({ title: s.title.trim(), text: (s.text ?? '').trim() }));
    const before = await Setting.findOne({ key: 'main' }).select('-vapid').lean();
    const item = await Setting.findOneAndUpdate({ key: 'main' }, update, { new: true, upsert: true }).select('-vapid').lean();
    invalidateSettings();
    await audit(req, 'settings.update', { entity: 'Setting', summary: Object.keys(update).join(', '), before, after: item });
    res.json({ item });
  }),
);

// ---- Upload ảnh (lưu trong MongoDB GridFS) ----
router.post(
  '/uploads',
  imageUpload(3).single('file'),
  ah(async (req, res) => {
    if (!req.file) throw new HttpError(400, 'Chọn ảnh PNG/JPG/WebP tối đa 3 MB');
    const url = await saveImage(req.file, { by: req.user._id });
    await audit(req, 'file.upload', { entity: 'File', summary: `${req.file.originalname} (${Math.round(req.file.size / 1024)} KB)` });
    res.status(201).json({ url });
  }),
);

export default router;
