import { Router } from 'express';
import mongoose from 'mongoose';
import { Product, StockLot, StockMove } from '../models/index.js';
import { ah, requireAuth, requireAdmin, HttpError } from '../middleware/auth.js';
import { inTransaction } from '../services/orders.js';
import { receive, adjust, waste } from '../services/inventory.js';
import { createBatch, membershipConfig } from '../services/membership.js';
import { nowInTz, addDays } from '../services/scheduler.js';
import { audit } from '../services/audit.js';
import { productTitle } from '../../../shared/nutrition.js';

// Quản lý kho (admin): tồn kho + tốc độ bán + số ngày đủ hàng, lô & hạn dùng, phiếu nhập / kiểm kê / xuất hủy, lịch sử.
const router = Router();
router.use(requireAuth, requireAdmin);

const TYPE_LABEL = { import: 'Nhập kho', sale: 'Bán', return: 'Hoàn (hủy đơn)', adjust: 'Kiểm kê', waste: 'Xuất hủy' };
const oid = (v) => (mongoose.isValidObjectId(v) ? new mongoose.Types.ObjectId(v) : null);

// Tổng quan từng sản phẩm
router.get(
  '/',
  ah(async (req, res) => {
    const today = nowInTz().date;
    const soon = addDays(today, 2);
    const since7 = new Date(Date.now() - 7 * 86400000);
    const since30 = new Date(Date.now() - 30 * 86400000);
    const [products, sales, lots] = await Promise.all([
      Product.find().sort({ type: 1, sort: 1 }).select('slug name type image price stock lowStock active').lean(),
      StockMove.aggregate([
        { $match: { type: { $in: ['sale', 'return'] }, createdAt: { $gte: since30 } } },
        { $group: { _id: '$product', sold30: { $sum: { $multiply: ['$qty', -1] } }, sold7: { $sum: { $cond: [{ $gte: ['$createdAt', since7] }, { $multiply: ['$qty', -1] }, 0] } } } },
      ]),
      StockLot.aggregate([
        { $match: { remaining: { $gt: 0 } } },
        { $sort: { expiryDate: 1 } },
        { $group: { _id: '$product', lots: { $sum: 1 }, nextExpiry: { $first: '$expiryDate' }, nextLot: { $first: '$code' }, nextRemaining: { $first: '$remaining' }, expiringQty: { $sum: { $cond: [{ $and: [{ $ne: ['$expiryDate', null] }, { $lte: ['$expiryDate', soon] }] }, '$remaining', 0] } } } },
      ]),
    ]);
    const S = new Map(sales.map((x) => [String(x._id), x]));
    const L = new Map(lots.map((x) => [String(x._id), x]));
    const items = products.map((p) => {
      const s = S.get(String(p._id)) ?? { sold7: 0, sold30: 0 };
      const l = L.get(String(p._id));
      const perDay = Math.round((s.sold7 / 7) * 10) / 10;
      const status = p.stock == null ? 'untracked' : p.stock === 0 ? 'out' : p.stock <= (p.lowStock ?? 10) ? 'low' : 'ok';
      return {
        ...p,
        sold7: s.sold7,
        sold30: s.sold30,
        perDay,
        coverDays: p.stock != null && perDay > 0 ? Math.floor(p.stock / perDay) : null,
        lots: l?.lots ?? 0,
        nextExpiry: l?.nextExpiry ?? null,
        nextLot: l?.nextLot ?? null,
        expiringQty: l?.expiringQty ?? 0,
        expired: Boolean(l?.nextExpiry && l.nextExpiry < today),
        status,
      };
    });
    res.json({
      items,
      alerts: {
        out: items.filter((i) => i.status === 'out').length,
        low: items.filter((i) => i.status === 'low').length,
        expiring: items.reduce((n, i) => n + i.expiringQty, 0),
        expiredLots: await StockLot.countDocuments({ remaining: { $gt: 0 }, expiryDate: { $lt: today } }),
      },
      today,
    });
  }),
);

// Lô hàng (mặc định: còn tồn, hạn dùng gần nhất trước)
router.get(
  '/lots',
  ah(async (req, res) => {
    const where = {};
    if (oid(req.query.product)) where.product = oid(req.query.product);
    if (req.query.all !== '1') where.remaining = { $gt: 0 };
    if (req.query.expiring === '1') where.expiryDate = { $lte: addDays(nowInTz().date, 2) };
    const items = await StockLot.find(where).sort({ expiryDate: 1, createdAt: -1 }).limit(300).populate('product', 'name type slug').lean();
    res.json({ items, today: nowInTz().date });
  }),
);

// Lịch sử xuất nhập; ?format=csv để tải về
router.get(
  '/moves',
  ah(async (req, res) => {
    const where = {};
    if (oid(req.query.product)) where.product = oid(req.query.product);
    if (TYPE_LABEL[req.query.type]) where.type = String(req.query.type);
    const from = /^\d{4}-\d{2}-\d{2}$/.test(req.query.from ?? '') ? new Date(`${req.query.from}T00:00:00+07:00`) : null;
    const to = /^\d{4}-\d{2}-\d{2}$/.test(req.query.to ?? '') ? new Date(`${req.query.to}T23:59:59+07:00`) : null;
    if (from || to) where.createdAt = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
    const csv = req.query.format === 'csv';
    const limit = csv ? 20000 : Math.min(200, Math.max(10, Number(req.query.limit) || 50));
    const page = Math.max(1, Number(req.query.page) || 1);
    const [items, total] = await Promise.all([
      StockMove.find(where).sort({ createdAt: -1 }).skip(csv ? 0 : (page - 1) * limit).limit(limit).populate('product', 'name type').populate('lot', 'code').populate('order', 'code').lean(),
      StockMove.countDocuments(where),
    ]);
    if (!csv) return res.json({ items, total, page, limit });
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [['Thời gian', 'Sản phẩm', 'Loại phiếu', 'Số lượng', 'Tồn sau', 'Lô', 'Đơn hàng', 'Ghi chú', 'Người thực hiện']].concat(
      items.map((m) => [new Date(m.createdAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }), m.product?.name, TYPE_LABEL[m.type], m.qty, m.stockAfter, m.lot?.code ?? (m.lots ?? []).length, m.order?.code, m.note, m.by]),
    );
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="nutriva-xuat-nhap-kho-${nowInTz().date}.csv"`);
    res.send(`﻿${rows.map((r) => r.map(esc).join(',')).join('\n')}`);
  }),
);

const productOr404 = async (id) => {
  const p = oid(id) && (await Product.findById(id).lean());
  if (!p) throw new HttpError(404, 'Không tìm thấy sản phẩm');
  return p;
};

// Nhập kho 1 lô; tùy chọn tạo luôn mã kích hoạt cho từng chai / gói của lô
router.post(
  '/receive',
  ah(async (req, res) => {
    const p = await productOr404(req.body?.product);
    const { qty, lotCode, mfgDate, expiryDate, cost, note, codes } = req.body ?? {};
    const r = await inTransaction((session) => receive({ productId: p._id, qty, lotCode, mfgDate, expiryDate, cost, note, by: req.user.email }, session));
    let batch = null;
    if (codes && ['milk', 'diy'].includes(p.type)) {
      const cfg = await membershipConfig();
      const days = p.membershipDays ?? (p.type === 'milk' ? cfg.daysPerBottle : cfg.daysPerSet);
      if (days > 0) batch = await createBatch({ name: `${productTitle(p)} • lô ${r.lot.code}`, productSlug: p.slug, lot: r.lot._id, days, quantity: r.lot.qty, createdBy: req.user.email });
    }
    await audit(req, 'inventory.receive', { entity: 'Product', entityId: p._id, summary: `${productTitle(p)}: +${r.lot.qty} (lô ${r.lot.code}${expiryDate ? `, HSD ${expiryDate}` : ''})${batch ? ` • ${batch.quantity} mã kích hoạt` : ''}` });
    res.status(201).json({ lot: r.lot, stock: r.product.stock, batch });
  }),
);

router.post(
  '/adjust',
  ah(async (req, res) => {
    const p = await productOr404(req.body?.product);
    const r = await inTransaction((session) => adjust({ productId: p._id, actual: req.body?.actual, note: req.body?.note, by: req.user.email }, session));
    await audit(req, 'inventory.adjust', { entity: 'Product', entityId: p._id, summary: `${p.name}: ${p.stock ?? '∞'} → ${r.product.stock} (${r.diff >= 0 ? '+' : ''}${r.diff})` });
    res.json({ stock: r.product.stock, diff: r.diff });
  }),
);

router.post(
  '/waste',
  ah(async (req, res) => {
    const p = await productOr404(req.body?.product);
    const lotId = oid(req.body?.lot);
    const r = await inTransaction((session) => waste({ productId: p._id, lotId, qty: req.body?.qty, note: req.body?.note, by: req.user.email }, session));
    await audit(req, 'inventory.waste', { entity: 'Product', entityId: p._id, summary: `${p.name}: −${req.body?.qty} (${req.body?.note || 'xuất hủy'})` });
    res.json({ stock: r.product.stock });
  }),
);

// Ngưỡng cảnh báo sắp hết
router.patch(
  '/:id',
  ah(async (req, res) => {
    const n = Math.floor(Number(req.body?.lowStock));
    if (!(n >= 0 && n <= 100000)) throw new HttpError(400, 'Ngưỡng không hợp lệ');
    const p = await Product.findByIdAndUpdate(req.params.id, { lowStock: n }, { new: true }).lean();
    if (!p) throw new HttpError(404, 'Không tìm thấy sản phẩm');
    res.json({ lowStock: p.lowStock });
  }),
);

export default router;
