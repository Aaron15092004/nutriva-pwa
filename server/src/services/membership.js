import crypto from 'node:crypto';
import { User, Order, Product, ActivationCode, ActivationBatch, MembershipGrant } from '../models/index.js';
import { HttpError } from '../middleware/auth.js';
import { getSettings } from './catalog.js';
import { nowInTz, addDays } from './scheduler.js';

// Gói sử dụng app: người mới phải tự bấm "Kích hoạt dùng thử" → mở kế hoạch N ngày (N = freePlanDays), hết dùng thử là khóa hẳn.
// Nhắc nhở chỉ dành cho tài khoản còn hạn gói.
// Kích hoạt / gia hạn bằng: mã in trên chai (QR hoặc nhập tay) • đơn mua trong app đã thanh toán • admin cộng tay.
const DAY_MS = 86400000;
export const DEFAULTS = { enabled: true, freePlanDays: 3, daysPerBottle: 2, daysPerSet: 4, daysPerTreat: 0, expiryNoticeDays: 2, codesPerReward: 4, rewardDays: 3 };

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

// Ngày thứ mấy kể từ lúc kích hoạt dùng thử (theo giờ VN); chưa kích hoạt → null
export function trialDayIndex(user, date) {
  const t = user?.membership?.trialStart;
  if (!t) return null;
  const start = nowInTz(new Date(t)).date;
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / DAY_MS);
}

// Đang trong thời gian dùng thử (đã bấm kích hoạt, chưa quá N ngày)
export function trialActive(user, cfg, date = nowInTz().date) {
  const i = trialDayIndex(user, date);
  return i != null && i >= 0 && i < cfg.freePlanDays;
}

// Bấm "Kích hoạt dùng thử": mỗi tài khoản 1 lần, nguyên tử (bấm 2 lần / 2 thiết bị cùng lúc vẫn chỉ tính 1)
export async function startTrial(user) {
  const cfg = await membershipConfig();
  if (!cfg.enabled) throw new HttpError(400, 'Tính năng đang mở cho mọi người, không cần dùng thử');
  if (!(cfg.freePlanDays > 0)) throw new HttpError(400, 'Hiện chưa có chương trình dùng thử — quét mã trên chai sữa để kích hoạt');
  if (isActive(user)) throw new HttpError(400, 'Bạn đang có gói NUTRIVA còn hạn');
  const r = await User.updateOne({ _id: user._id, 'membership.trialStart': null, 'membership.until': null }, { $set: { 'membership.trialStart': new Date() } });
  if (!r.modifiedCount) throw new HttpError(409, 'Tài khoản đã dùng thử trước đây — quét mã trên chai sữa để tiếp tục');
  return User.findById(user._id);
}

export async function status(user) {
  const cfg = await membershipConfig();
  const active = isActive(user);
  const until = user.membership?.until ?? null;
  const daysLeft = active ? Math.ceil((new Date(until).getTime() - Date.now()) / DAY_MS) : 0;
  const today = nowInTz().date;
  const started = Boolean(user.membership?.trialStart);
  const trialFrom = started ? nowInTz(new Date(user.membership.trialStart)).date : null;
  return {
    enabled: cfg.enabled,
    active: !cfg.enabled || active || user.role === 'admin',
    member: active,
    until,
    daysLeft,
    expiring: active && daysLeft <= cfg.expiryNoticeDays,
    freePlanDays: cfg.freePlanDays,
    trialStarted: started,
    // Còn quyền dùng thử: chưa từng dùng thử, chưa từng có gói
    trialAvailable: cfg.enabled && cfg.freePlanDays > 0 && !started && !until && user.role !== 'admin',
    trialEnds: started ? addDays(trialFrom, cfg.freePlanDays - 1) : null,
    trialLeft: started ? Math.max(0, Math.min(cfg.freePlanDays, cfg.freePlanDays - trialDayIndex(user, today))) : 0, // số ngày dùng thử còn lại, tính cả hôm nay
    daysPerBottle: cfg.daysPerBottle,
    daysPerSet: cfg.daysPerSet,
    reward: await rewardStatus(user, cfg),
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
export async function createBatch({ name, productSlug, lot, days, quantity, packSize = 1, unit = 'chai', expiresAt, note, createdBy }) {
  const batch = await ActivationBatch.create({ name, productSlug, lot, days, quantity, packSize, unit, expiresAt, note, createdBy });
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
  let until = await grantDays(user._id, doc.days, { source: 'code', ref: prettyCode(code), note: batch.name });
  // Tích điểm: mỗi mã = 1 điểm; đủ N điểm → thưởng thêm ngày (mỗi mốc chỉ thưởng 1 lần vì đếm theo mã đã dùng)
  const cfg = await membershipConfig();
  let reward = 0;
  if (cfg.codesPerReward > 0 && cfg.rewardDays > 0) {
    const n = await ActivationCode.countDocuments({ usedBy: user._id, status: 'used' });
    if (n % cfg.codesPerReward === 0) {
      reward = cfg.rewardDays;
      until = await grantDays(user._id, reward, { source: 'reward', ref: `${n} mã`, note: `Thưởng tích đủ ${cfg.codesPerReward} mã` });
    }
  }
  return { days: doc.days, reward, until };
}

// Tiến độ tích điểm (thẻ "tem" ở trang Gói NUTRIVA)
export async function rewardStatus(user, cfg) {
  if (!(cfg.codesPerReward > 0 && cfg.rewardDays > 0)) return null;
  const n = await ActivationCode.countDocuments({ usedBy: user._id, status: 'used' });
  return { every: cfg.codesPerReward, days: cfg.rewardDays, codes: n, progress: n % cfg.codesPerReward, rewards: Math.floor(n / cfg.codesPerReward) };
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
