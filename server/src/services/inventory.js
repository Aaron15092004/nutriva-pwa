import { Product, StockLot, StockMove, Order } from '../models/index.js';
import { HttpError } from '../middleware/auth.js';
import { invalidateCatalog } from './catalog.js';

// Kho hàng: mỗi lần nhập tạo 1 LÔ (mã lô, ngày SX, hạn dùng). Bán hàng trừ lô sắp hết hạn trước (FIFO theo hạn dùng),
// hủy đơn trả lại đúng lô đã trừ. Mọi thay đổi tồn kho đều có phiếu xuất/nhập (StockMove) để đối soát.

const todayVN = () => new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);

// Trừ số lượng khỏi các lô còn hàng, ưu tiên hạn dùng sớm nhất → [{ lot, qty }].
// Lấy lô CÒN HẠN trước; lô quá hạn được xuất hủy tự động, chỉ dùng tới khi không còn lô nào khác.
async function takeFromLots(productId, qty, session) {
  const out = [];
  let left = qty;
  const today = todayVN();
  const all = await StockLot.find({ product: productId, remaining: { $gt: 0 } }, null, { session }).sort({ expiryDate: 1, createdAt: 1 });
  const lots = [...all.filter((l) => !l.expiryDate || l.expiryDate >= today), ...all.filter((l) => l.expiryDate && l.expiryDate < today)];
  for (const lot of lots) {
    if (left <= 0) break;
    const take = Math.min(left, lot.remaining);
    const r = await StockLot.updateOne({ _id: lot._id, remaining: { $gte: take } }, { $inc: { remaining: -take } }, { session });
    if (r.modifiedCount) {
      out.push({ lot: lot._id, qty: take });
      left -= take;
    }
  }
  return out; // tồn kho có thể lớn hơn tổng các lô (vd nhập tay trước khi có quản lý lô) → phần còn lại không gắn lô
}

const stockOf = async (productId, session) => (await Product.findById(productId, { stock: 1 }, { session }).lean())?.stock ?? null;

// Gọi trong transaction đặt hàng (sau khi đã trừ Product.stock)
export async function recordSale(order, session) {
  for (const it of order.items) {
    const stock = await stockOf(it.product, session);
    if (stock == null) continue; // sản phẩm không quản lý tồn kho
    const lots = await takeFromLots(it.product, it.qty, session);
    await StockMove.create([{ product: it.product, type: 'sale', qty: -it.qty, stockAfter: stock, lots, order: order._id, note: order.code, by: order.source === 'subscription' ? 'system' : 'user' }], { session });
  }
}

// Gọi trong transaction hủy đơn (sau khi đã cộng lại Product.stock)
export async function recordReturn(order, by, session) {
  const sales = await StockMove.find({ order: order._id, type: 'sale' }, null, { session }).lean();
  for (const m of sales) {
    for (const a of m.lots ?? []) await StockLot.updateOne({ _id: a.lot }, { $inc: { remaining: a.qty } }, { session });
    await StockMove.create([{ product: m.product, type: 'return', qty: -m.qty, stockAfter: await stockOf(m.product, session), lots: m.lots, order: order._id, note: `Hủy ${order.code}`, by }], { session });
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Nhập kho 1 lô mới
export async function receive({ productId, qty, lotCode, mfgDate, expiryDate, cost, note, by }, session) {
  const n = Math.floor(Number(qty));
  if (!(n >= 1 && n <= 100000)) throw new HttpError(400, 'Số lượng nhập từ 1 đến 100.000');
  if (expiryDate && !DATE_RE.test(expiryDate)) throw new HttpError(400, 'Hạn dùng không hợp lệ');
  if (mfgDate && !DATE_RE.test(mfgDate)) throw new HttpError(400, 'Ngày sản xuất không hợp lệ');
  if (mfgDate && expiryDate && expiryDate < mfgDate) throw new HttpError(400, 'Hạn dùng phải sau ngày sản xuất');
  // Sản phẩm chưa quản lý tồn (stock = null) → bắt đầu quản lý từ 0
  const product = await Product.findOneAndUpdate({ _id: productId }, [{ $set: { stock: { $add: [{ $ifNull: ['$stock', 0] }, n] } } }], { new: true, session });
  if (!product) throw new HttpError(404, 'Không tìm thấy sản phẩm');
  const code = String(lotCode || `LO-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`).trim().slice(0, 40);
  const [lot] = await StockLot.create([{ product: product._id, code, qty: n, remaining: n, mfgDate, expiryDate, cost: Math.max(0, Number(cost) || 0), note: String(note ?? '').slice(0, 200), createdBy: by }], { session });
  await StockMove.create([{ product: product._id, type: 'import', qty: n, stockAfter: product.stock, lot: lot._id, note: String(note || `Nhập lô ${code}`).slice(0, 200), by }], { session });
  invalidateCatalog();
  return { product, lot };
}

// Số lượng đang giữ cho đơn chưa rời kho (đã xác nhận / đang chuẩn bị). Tồn kho trong hệ thống = có thể bán
// (đã trừ khi khách đặt), nên hàng thực tế trên kệ = tồn kho + đang giữ.
export async function reservedQty(session) {
  const rows = await Order.aggregate([
    { $match: { status: { $in: ['confirmed', 'preparing'] } } },
    { $unwind: '$items' },
    { $group: { _id: '$items.product', qty: { $sum: '$items.qty' } } },
  ]).session(session ?? null);
  return new Map(rows.map((r) => [String(r._id), r.qty]));
}

// Kiểm kê: nhập SỐ ĐẾM THỰC TẾ trên kệ → tồn có thể bán = thực tế − đang giữ cho đơn chưa giao.
// Chênh lệch ghi thành phiếu điều chỉnh; thiếu thì trừ lô gần hết hạn trước. Sản phẩm chưa theo dõi → bắt đầu theo dõi từ số này.
export async function adjust({ productId, actual, note, by }, session) {
  const n = Math.floor(Number(actual));
  if (!(n >= 0 && n <= 1000000)) throw new HttpError(400, 'Số lượng thực tế không hợp lệ', { actual: 'Nhập số từ 0' });
  const before = await Product.findById(productId, null, { session });
  if (!before) throw new HttpError(404, 'Không tìm thấy sản phẩm');
  const held = (await reservedQty(session)).get(String(productId)) ?? 0;
  if (n < held) throw new HttpError(400, `Thực tế (${n}) ít hơn số đang giữ cho đơn chưa giao (${held}) — kiểm tra lại số đếm hoặc các đơn đang chuẩn bị`, { actual: `Ít nhất ${held} (đang giữ cho đơn)` });
  const sellable = n - held;
  const diff = sellable - (before.stock ?? 0);
  if (!diff && before.stock != null) return { product: before, diff: 0, held };
  const product = await Product.findOneAndUpdate({ _id: productId }, { $set: { stock: sellable } }, { new: true, session });
  const lots = diff < 0 ? await takeFromLots(productId, -diff, session) : [];
  await StockMove.create([{ product: productId, type: 'adjust', qty: diff, stockAfter: sellable, lots, note: String(note || (before.stock == null ? 'Kiểm kê đầu kỳ' : 'Kiểm kê')).slice(0, 200), by }], { session });
  invalidateCatalog();
  return { product, diff, held };
}

// Xuất hủy (hỏng, hết hạn, dùng thử…): trừ tồn kho + trừ lô chỉ định (hoặc lô gần hết hạn trước)
export async function waste({ productId, lotId, qty, note, by }, session) {
  const n = Math.floor(Number(qty));
  if (!(n >= 1)) throw new HttpError(400, 'Số lượng không hợp lệ');
  const product = await Product.findOneAndUpdate({ _id: productId, stock: { $gte: n } }, { $inc: { stock: -n } }, { new: true, session });
  if (!product) throw new HttpError(400, 'Tồn kho không đủ để xuất hủy');
  let lots;
  if (lotId) {
    const r = await StockLot.updateOne({ _id: lotId, product: productId, remaining: { $gte: n } }, { $inc: { remaining: -n } }, { session });
    if (!r.modifiedCount) throw new HttpError(400, 'Lô không đủ số lượng');
    lots = [{ lot: lotId, qty: n }];
  } else lots = await takeFromLots(productId, n, session);
  await StockMove.create([{ product: productId, type: 'waste', qty: -n, stockAfter: product.stock, lot: lotId ?? null, lots, note: String(note || 'Xuất hủy').slice(0, 200), by }], { session });
  invalidateCatalog();
  return { product };
}

// Xuất hủy mọi lô đã quá hạn còn tồn (chạy tự động mỗi lượt scheduler, hoặc admin bấm tay) → không bán hàng hết hạn.
// Mỗi lô xử lý nguyên tử: chỉ lô còn đúng số remaining đã đọc mới bị trừ → chạy song song / lặp lại không trừ 2 lần.
export async function wasteExpired(by = 'system') {
  const today = todayVN();
  const lots = await StockLot.find({ remaining: { $gt: 0 }, expiryDate: { $ne: null, $lt: today } }).limit(200).lean();
  let qty = 0;
  for (const lot of lots) {
    const claimed = await StockLot.findOneAndUpdate({ _id: lot._id, remaining: lot.remaining }, { $set: { remaining: 0 } }, { new: false });
    if (!claimed) continue;
    const n = claimed.remaining;
    const product = await Product.findOneAndUpdate({ _id: lot.product, stock: { $ne: null } }, [{ $set: { stock: { $max: [0, { $subtract: ['$stock', n] }] } } }], { new: true });
    await StockMove.create({ product: lot.product, type: 'waste', qty: -n, stockAfter: product?.stock ?? null, lot: lot._id, lots: [{ lot: lot._id, qty: n }], note: `Quá hạn ${lot.expiryDate} — lô ${lot.code}`, by });
    qty += n;
  }
  if (qty) invalidateCatalog();
  return { lots: lots.length, qty };
}
