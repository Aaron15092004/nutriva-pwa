import { Router } from 'express';
import { Product, Order, Subscription, Coupon } from '../models/index.js';
import { ah, requireAuth, HttpError } from '../middleware/auth.js';
import { explainProduct } from '../services/recommend.js';
import { getSettings, loadProducts } from '../services/catalog.js';
import { nowInTz } from '../services/scheduler.js';

const router = Router();
const PHONE_RE = /^[0-9+ ]{9,13}$/;

// ---- Danh mục (công khai) ----
router.get(
  '/products',
  ah(async (req, res) => {
    const products = await loadProducts();
    res.json({ products: req.query.type ? products.filter((p) => p.type === req.query.type) : products });
  }),
);

router.get(
  '/products/:slug',
  ah(async (req, res) => {
    const product = await Product.findOne({ slug: req.params.slug, active: true }).lean();
    if (!product) throw new HttpError(404, 'Không tìm thấy sản phẩm');
    const sibling = product.line ? await Product.findOne({ line: product.line, slug: { $ne: product.slug }, active: true }).lean() : null;
    let steps;
    if (product.type === 'diy') steps = product.steps?.length ? product.steps : (await getSettings()).diySteps;
    res.json({ product, sibling, steps });
  }),
);

router.get(
  '/shop/config',
  ah(async (req, res) => {
    const s = await getSettings();
    res.json({
      plans: s.subscriptionPlans ?? [],
      shippingFee: s.shippingFee ?? 0,
      freeShipFrom: s.freeShipFrom ?? 0,
      bank: s.bank?.accountNo ? s.bank : null,
      store: s.store ?? {},
    });
  }),
);

router.use(requireAuth);

router.get(
  '/products/:slug/why',
  ah(async (req, res) => {
    const product = await Product.findOne({ slug: req.params.slug }).lean();
    if (!product) throw new HttpError(404, 'Không tìm thấy sản phẩm');
    res.json({ product, ...explainProduct(product, req.user.profile.toObject()) });
  }),
);

// ---- Mã giảm giá ----
async function checkCoupon(code, subtotal, userId) {
  if (!code) return null;
  const c = await Coupon.findOne({ code: code.trim().toUpperCase(), active: true }).lean();
  if (!c) throw new HttpError(400, 'Mã giảm giá không hợp lệ');
  if (c.expiresAt && c.expiresAt < new Date()) throw new HttpError(400, 'Mã giảm giá đã hết hạn');
  if (c.maxUses != null && c.usedCount >= c.maxUses) throw new HttpError(400, 'Mã giảm giá đã hết lượt sử dụng');
  if (subtotal < (c.minSubtotal ?? 0)) throw new HttpError(400, `Mã áp dụng cho đơn từ ${c.minSubtotal.toLocaleString('vi-VN')}đ`);
  if (c.firstOrderOnly && (await Order.exists({ user: userId, status: { $ne: 'cancelled' }, source: 'shop' }))) {
    throw new HttpError(400, 'Mã chỉ áp dụng cho đơn hàng đầu tiên');
  }
  let discount = c.kind === 'percent' ? Math.round((subtotal * c.value) / 100) : c.value;
  if (c.maxDiscount) discount = Math.min(discount, c.maxDiscount);
  return { coupon: c, discount: Math.min(discount, subtotal) };
}

// ---- Giá trị đơn hàng: luôn tính lại ở server từ giá trong DB ----
async function quote({ items = [], coupon, method }, userId) {
  if (!Array.isArray(items) || !items.length) throw new HttpError(400, 'Giỏ hàng trống');
  const products = await Product.find({ slug: { $in: items.map((i) => i.slug) }, active: true }).lean();
  const lines = items.map((i) => {
    const p = products.find((x) => x.slug === i.slug);
    const qty = Math.floor(Number(i.qty));
    if (!p) throw new HttpError(400, `Sản phẩm "${i.name ?? i.slug}" không còn bán`);
    if (!(qty >= 1 && qty <= 50)) throw new HttpError(400, 'Số lượng không hợp lệ');
    return { product: p._id, slug: p.slug, name: p.name, type: p.type, image: p.image, size: p.size, sweetness: i.sweetness === 'low' ? 'low' : 'none', price: p.price, qty, stock: p.stock };
  });
  for (const p of products) {
    const need = lines.filter((l) => l.slug === p.slug).reduce((s, l) => s + l.qty, 0);
    if (p.stock != null && need > p.stock) throw new HttpError(400, `"${p.name}" chỉ còn ${p.stock} sản phẩm`);
  }
  const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const applied = await checkCoupon(coupon, subtotal, userId);
  const discount = applied?.discount ?? 0;
  const s = await getSettings();
  const shippingFee = method === 'pickup' || (s.freeShipFrom && subtotal - discount >= s.freeShipFrom) ? 0 : (s.shippingFee ?? 0);
  return {
    lines: lines.map(({ stock, ...l }) => l),
    subtotal,
    discount,
    coupon: applied?.coupon.code,
    couponId: applied?.coupon._id,
    couponLabel: applied?.coupon.label,
    shippingFee,
    total: subtotal - discount + shippingFee,
  };
}

router.post(
  '/orders/quote',
  ah(async (req, res) => {
    const { lines, couponId, ...q } = await quote(req.body, req.user._id);
    res.json({ ...q, items: lines });
  }),
);

router.post(
  '/orders',
  ah(async (req, res) => {
    const { delivery, address, payment } = req.body ?? {};
    if (!['home', 'pickup'].includes(delivery?.method)) throw new HttpError(400, 'Chọn hình thức giao hàng');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(delivery?.date ?? '') || !delivery?.slot) throw new HttpError(400, 'Chọn thời gian giao hàng');
    if (delivery.date <= nowInTz().date) throw new HttpError(400, 'Ngày giao phải từ ngày mai trở đi');
    if (!['cod', 'bank'].includes(payment)) throw new HttpError(400, 'Chọn phương thức thanh toán');
    if (!address?.name?.trim() || !PHONE_RE.test(address?.phone ?? '')) throw new HttpError(400, 'Nhập tên và số điện thoại hợp lệ');
    if (delivery.method === 'home' && !address?.line?.trim()) throw new HttpError(400, 'Nhập địa chỉ nhận hàng');
    if (payment === 'bank' && !(await getSettings()).bank?.accountNo) throw new HttpError(400, 'Cửa hàng chưa hỗ trợ chuyển khoản, vui lòng chọn thanh toán khi nhận hàng');

    const q = await quote({ ...req.body, method: delivery.method }, req.user._id);

    // Trừ tồn kho có điều kiện (không âm); hoàn lại nếu một dòng thất bại
    const taken = [];
    for (const l of q.lines) {
      const r = await Product.updateOne({ _id: l.product, $or: [{ stock: null }, { stock: { $gte: l.qty } }] }, [
        { $set: { stock: { $cond: [{ $eq: ['$stock', null] }, null, { $subtract: ['$stock', l.qty] }] } } },
      ]);
      if (!r.modifiedCount && !r.matchedCount) {
        for (const t of taken) await Product.updateOne({ _id: t.product, stock: { $ne: null } }, { $inc: { stock: t.qty } });
        throw new HttpError(409, `"${l.name}" vừa hết hàng`);
      }
      taken.push(l);
    }
    if (q.couponId) await Coupon.updateOne({ _id: q.couponId }, { $inc: { usedCount: 1 } });

    const order = await Order.create({
      user: req.user._id,
      code: `NTV-${Date.now().toString(36).toUpperCase().slice(-6)}`,
      items: q.lines,
      subtotal: q.subtotal,
      discount: q.discount,
      coupon: q.coupon,
      shippingFee: q.shippingFee,
      total: q.total,
      delivery: { method: delivery.method, date: delivery.date, slot: String(delivery.slot).slice(0, 30) },
      address: { name: address.name.trim(), phone: address.phone.trim(), line: address.line?.trim() ?? '' },
      payment,
      history: [{ status: 'confirmed', at: new Date(), by: 'user' }],
    });

    req.user.address = order.address;
    await req.user.save();
    res.status(201).json({ order });
  }),
);

router.get(
  '/orders',
  ah(async (req, res) => res.json({ orders: await Order.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(100).lean() })),
);

router.get(
  '/orders/:id',
  ah(async (req, res) => {
    const order = await Order.findOne({ _id: req.params.id, user: req.user._id }).lean();
    if (!order) throw new HttpError(404, 'Không tìm thấy đơn hàng');
    res.json({ order });
  }),
);

export async function restock(order) {
  for (const i of order.items) await Product.updateOne({ _id: i.product, stock: { $ne: null } }, { $inc: { stock: i.qty } });
}

router.post(
  '/orders/:id/cancel',
  ah(async (req, res) => {
    const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
    if (!order) throw new HttpError(404, 'Không tìm thấy đơn hàng');
    if (order.status !== 'confirmed') throw new HttpError(400, 'Đơn đã được chuẩn bị, vui lòng liên hệ hỗ trợ để hủy');
    order.status = 'cancelled';
    order.history.push({ status: 'cancelled', at: new Date(), by: 'user' });
    await order.save();
    await restock(order);
    res.json({ order });
  }),
);

// ---- Gói định kỳ ----
const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

router.get(
  '/subscriptions',
  ah(async (req, res) => res.json({ subscriptions: await Subscription.find({ user: req.user._id }).sort({ createdAt: -1 }).lean() })),
);

router.post(
  '/subscriptions',
  ah(async (req, res) => {
    const { planId, productSlug, days, frequency, address, sweetness } = req.body ?? {};
    const plan = (await getSettings()).subscriptionPlans?.find((p) => p.id === planId);
    if (!plan) throw new HttpError(400, 'Chọn số lượng mỗi tuần');
    const product = await Product.findOne({ slug: productSlug, type: 'milk', active: true }).lean();
    if (!product) throw new HttpError(400, 'Chọn hương vị');
    const validDays = WEEKDAYS.filter((d) => (days ?? []).includes(d));
    if (!validDays.length) throw new HttpError(400, 'Chọn ít nhất 1 ngày giao');
    if (validDays.length > plan.bottles) throw new HttpError(400, `Gói ${plan.bottles} chai chỉ giao tối đa ${plan.bottles} ngày`);
    if (!address?.name?.trim() || !PHONE_RE.test(address?.phone ?? '') || !address?.line?.trim()) throw new HttpError(400, 'Nhập đầy đủ tên, số điện thoại và địa chỉ giao');

    const tomorrow = new Date(Date.parse(`${nowInTz().date}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
    const sub = await Subscription.create({
      user: req.user._id,
      planId,
      bottles: plan.bottles,
      price: plan.price,
      productSlug,
      productName: product.name,
      sweetness: sweetness === 'low' ? 'low' : 'none',
      days: validDays,
      frequency: frequency === 'biweekly' ? 'biweekly' : 'weekly',
      address: { name: address.name.trim(), phone: address.phone.trim(), line: address.line.trim() },
      startDate: tomorrow,
    });
    res.status(201).json({ subscription: sub });
  }),
);

router.patch(
  '/subscriptions/:id',
  ah(async (req, res) => {
    const sub = await Subscription.findOne({ _id: req.params.id, user: req.user._id });
    if (!sub) throw new HttpError(404, 'Không tìm thấy gói');
    if (typeof req.body.active === 'boolean') sub.active = req.body.active;
    await sub.save();
    res.json({ subscription: sub });
  }),
);

export default router;
