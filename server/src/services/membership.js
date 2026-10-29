import crypto from 'node:crypto';
import { User, Order, Product, ActivationCode, ActivationBatch, MembershipGrant } from '../models/index.js';
import { HttpError } from '../middleware/auth.js';
import { getSettings } from './catalog.js';
import { nowInTz, addDays } from './scheduler.js';

// Gói sử dụng app: người dùng chưa kích hoạt chỉ xem N/7 ngày kế hoạch (N = freePlanDays) và không có nhắc nhở.
// Kích hoạt / gia hạn bằng: mã in trên chai (QR hoặc nhập tay) • đơn mua trong app đã thanh toán • admin cộng tay.
const DAY_MS = 86400000;
export const DEFAULTS = { enabled: true, freePlanDays: 3, daysPerBottle: 2, daysPerSet: 4, daysPerTreat: 0, expiryNoticeDays: 2 };

export async function membershipConfig() {
  const s = await getSettings();
  return { ...DEFAULTS, ...(s.membership ?? {}) };
}

export const isActive = (user, now = Date.now()) => Boolean(user?.membership?.until && new Date(user.membership.until).getTime() > now);

// Được dùng đầy đủ: gói đang còn hạn, hoặc tính năng khóa đang tắt
export async function hasAccess(user) {
  const cfg = await membershipConfig();
  return !cfg.enabled || isActive(user) || user?.role === 'admin';
}

// Ngày thứ mấy kể từ ngày đăng ký (theo giờ VN) — người chưa kích hoạt dùng thử kế hoạch tự động trong N ngày đầu
export function trialDayIndex(user, date) {
  const start = nowInTz(new Date(user.createdAt ?? Date.now())).date;
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / DAY_MS);
}

export async function status(user) {
  const cfg = await membershipConfig();
  const active = isActive(user);
  const until = user.membership?.until ?? null;
  const daysLeft = active ? Math.ceil((new Date(until).getTime() - Date.now()) / DAY_MS) : 0;
  const trialStart = nowInTz(new Date(user.createdAt ?? Date.now())).date;
  return {
    enabled: cfg.enabled,
    active: !cfg.enabled || active || user.role === 'admin',
    member: active,
    until,
    daysLeft,
    expiring: active && daysLeft <= cfg.expiryNoticeDays,
    freePlanDays: cfg.freePlanDays,
    trialEnds: addDays(trialStart, cfg.freePlanDays - 1),
    trialLeft: Math.max(0, cfg.freePlanDays - trialDayIndex(user, nowInTz().date)), // số ngày dùng thử còn lại, tính cả hôm nay
    daysPerBottle: cfg.daysPerBottle,
    daysPerSet: cfg.daysPerSet,
  };
}

// Cộng (days > 0) hoặc trừ (days < 0) ngày sử dụng — nguyên tử, có ghi sổ
export async function grantDays(userId, days, { source, ref, note, by, session } = {}) {
  if (!days) return null;
  const before = await User.findById(userId, { membership: 1 }, { session }).lean();
  if (!before) return null;
  const ms = Math.round(days * DAY_MS);
  // Cộng: tính từ max(bây giờ, hạn hiện tại). Trừ: từ hạn hiện tại.
  const base = days > 0 ? { $max: ['$$NOW', { $ifNull: ['$membership.until', '$$NOW'] }] } : { $ifNull: ['$membership.until', '$$NOW'] };
  const user = await User.findOneAndUpdate({ _id: userId }, [{ $set: { 'membership.until': { $add: [base, ms] } } }], { new: true, session, projection: { membership: 1 } });
  await MembershipGrant.create([{ user: userId, days, source, ref, note, by, untilBefore: before.membership?.until ?? null, untilAfter: user.membership.until }], { session });
  return user.membership.until;
}

const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export const newCode = () => [...crypto.randomBytes(10)].map((b) => ALPHABET[b % 32]).join('');
// Bỏ khoảng trắng, gạch nối; không phân biệt hoa thường (mã không dùng 0/O/1/I nên không lo nhầm)
export const normalizeCode = (raw) => String(raw ?? '').toUpperCase().replace(/[^0-9A-Z]/g, '');
export const prettyCode = (c) => `${c.slice(0, 5)}-${c.slice(5)}`;

// Tạo lô mã kích hoạt (in lên chai). Trả về danh sách mã.
export async function createBatch({ name, productSlug, lot, days, quantity, expiresAt, note, createdBy }) {
  const batch = await ActivationBatch.create({ name, productSlug, lot, days, quantity, expiresAt, note, createdBy });
  const docs = [];
  const seen = new Set();
  while (docs.length < quantity) {
    const code = newCode();
    if (seen.has(code)) continue;
    seen.add(code);
    docs.push({ code, batch: batch._id, days });
  }
  // Trùng với mã cũ (cực hiếm, 32^10 khả năng) → bỏ mã trùng rồi sinh bù
  try {
    await ActivationCode.insertMany(docs, { ordered: false });
  } catch (e) {
    if (e.code !== 11000 && !e.writeErrors) throw e;
  }
  for (let tries = 0; tries < 50; tries++) {
    const missing = quantity - (await ActivationCode.countDocuments({ batch: batch._id }));
    if (missing <= 0) break;
    await ActivationCode.insertMany(Array.from({ length: missing }, () => ({ code: newCode(), batch: batch._id, days })), { ordered: false }).catch(() => {});
  }
  return batch;
}

// Người dùng nhập / quét mã trên chai
export async function redeem(user, raw) {
  const code = normalizeCode(raw);
  if (code.length !== 10) throw new HttpError(400, 'Mã gồm 10 ký tự (chữ và số) in dưới mã QR trên chai');
  const doc = await ActivationCode.findOne({ code }).lean();
  if (!doc) throw new HttpError(404, 'Mã không đúng — kiểm tra lại các ký tự in trên chai nhé');
  if (doc.status === 'used') throw new HttpError(409, String(doc.usedBy) === String(user._id) ? 'Bạn đã kích hoạt mã này rồi' : 'Mã này đã được sử dụng');
  if (doc.status === 'void') throw new HttpError(410, 'Mã đã bị vô hiệu hóa');
  const batch = await ActivationBatch.findById(doc.batch).lean();
  if (!batch?.active) throw new HttpError(410, 'Lô mã này đã ngừng sử dụng');
  if (batch.expiresAt && new Date(batch.expiresAt) < new Date()) throw new HttpError(410, 'Mã đã hết hạn kích hoạt');
  // Giữ chỗ nguyên tử: 2 người cùng nhập 1 mã → chỉ 1 người được
  const claimed = await ActivationCode.findOneAndUpdate({ _id: doc._id, status: 'new' }, { status: 'used', usedBy: user._id, usedAt: new Date() }, { new: true });
  if (!claimed) throw new HttpError(409, 'Mã này vừa được sử dụng');
  const until = await grantDays(user._id, doc.days, { source: 'code', ref: prettyCode(code), note: batch.name });
  return { days: doc.days, until };
}

// Số ngày sử dụng của 1 đơn: mỗi đơn vị × số ngày theo sản phẩm (hoặc theo loại trong Cài đặt)
export async function orderDays(order, cfg) {
  const ids = order.items.map((i) => i.product).filter(Boolean);
  const products = new Map((await Product.find({ _id: { $in: ids } }, { membershipDays: 1, type: 1 }).lean()).map((p) => [String(p._id), p]));
  const perType = { milk: cfg.daysPerBottle, diy: cfg.daysPerSet, treat: cfg.daysPerTreat };
  return order.items.reduce((sum, i) => {
    const p = products.get(String(i.product));
    const per = p?.membershipDays ?? perType[p?.type ?? i.type] ?? 0;
    return sum + per * i.qty;
  }, 0);
}

// Đơn đã thanh toán (chuyển khoản xác nhận / giao COD thành công) → tự gia hạn. Gọi nhiều lần vẫn chỉ cộng 1 lần.
export async function grantForOrder(orderId) {
  const cfg = await membershipConfig();
  const order = await Order.findById(orderId).lean();
  if (!order?.user || order.anonymized || order.membershipDays != null || order.status === 'cancelled') return 0;
  const days = await orderDays(order, cfg);
  const claimed = await Order.updateOne({ _id: order._id, membershipDays: null }, { $set: { membershipDays: days } });
  if (!claimed.modifiedCount || !days) return 0;
  await grantDays(order.user, days, { source: 'order', ref: order.code, note: order.source === 'subscription' ? 'Gói định kỳ' : 'Đơn trong app' });
  return days;
}

// Đơn bị hủy / hoàn tiền sau khi đã cộng → thu hồi đúng số ngày đã cộng
export async function revokeForOrder(orderId, reason) {
  const order = await Order.findOneAndUpdate({ _id: orderId, membershipDays: { $gt: 0 }, membershipRevoked: { $ne: true } }, { $set: { membershipRevoked: true } }, { new: true }).lean();
  if (!order?.user) return 0;
  await grantDays(order.user, -order.membershipDays, { source: 'revoke', ref: order.code, note: reason });
  return order.membershipDays;
}
