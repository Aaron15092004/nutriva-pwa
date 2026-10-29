import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { Order, Product, Coupon } from '../models/index.js';
import { HttpError } from '../middleware/auth.js';
import { recordSale, recordReturn } from './inventory.js';

// Mã đơn ngẫu nhiên dễ đọc (bỏ 0/O/1/I) — 32^7 ≈ 34 tỉ khả năng, không đoán được thứ tự như timestamp.
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export const orderCode = (prefix = 'NTV') => `${prefix}-${[...crypto.randomBytes(7)].map((b) => ALPHABET[b % 32]).join('')}`;

// ---- Transaction: Atlas / replica set hỗ trợ; MongoDB standalone thì chạy tuần tự + hoàn tác thủ công ----
let txSupported;
async function supportsTx() {
  if (txSupported === undefined) {
    try {
      const hello = await mongoose.connection.db.admin().command({ hello: 1 });
      txSupported = Boolean(hello.setName || hello.msg === 'isdbgrid');
    } catch {
      txSupported = false;
    }
    if (!txSupported) console.warn('[db] MongoDB không hỗ trợ transaction (standalone) — dùng chế độ hoàn tác thủ công');
  }
  return txSupported;
}

export async function inTransaction(fn) {
  if (!(await supportsTx())) return fn(null);
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

const restockItems = (items, session) =>
  Promise.all(items.map((i) => Product.updateOne({ _id: i.product, stock: { $ne: null } }, { $inc: { stock: i.qty } }, { session })));

// Đặt đơn: trừ tồn kho (không âm) + dùng 1 lượt mã giảm giá + tạo đơn — hoặc tất cả, hoặc không gì cả.
// data.clientRequestId: bấm "Đặt hàng" 2 lần / mạng chập chờn gửi lại → trả về đúng đơn đã tạo, không tạo đơn thứ 2.
export async function placeOrder(data, { couponId } = {}) {
  if (data.clientRequestId) {
    const existing = await Order.findOne({ user: data.user, clientRequestId: data.clientRequestId });
    if (existing) return { order: existing, duplicate: true };
  }
  try {
    const order = await inTransaction(async (session) => {
      const taken = [];
      try {
        for (const l of data.items) {
          const r = await Product.updateOne(
            { _id: l.product, $or: [{ stock: null }, { stock: { $gte: l.qty } }] },
            [{ $set: { stock: { $cond: [{ $eq: ['$stock', null] }, null, { $subtract: ['$stock', l.qty] }] } } }],
            { session },
          );
          if (!r.matchedCount) throw new HttpError(409, `"${l.name}" vừa hết hàng`);
          taken.push(l);
        }
        if (couponId) {
          const r = await Coupon.updateOne(
            { _id: couponId, active: true, $or: [{ maxUses: null }, { $expr: { $lt: ['$usedCount', '$maxUses'] } }] },
            { $inc: { usedCount: 1 } },
            { session },
          );
          if (!r.modifiedCount) throw new HttpError(409, 'Mã giảm giá vừa hết lượt sử dụng');
        }
        const [created] = await Order.create([{ ...data, code: orderCode(data.source === 'subscription' ? 'NTV-S' : 'NTV') }], { session });
        await recordSale(created, session); // phiếu xuất kho + trừ lô (cùng transaction)
        return created;
      } catch (e) {
        if (!session) {
          await restockItems(taken);
          if (couponId && !(e instanceof HttpError)) await Coupon.updateOne({ _id: couponId, usedCount: { $gt: 0 } }, { $inc: { usedCount: -1 } });
        }
        throw e;
      }
    });
    return { order, duplicate: false };
  } catch (e) {
    // Hai request trùng khóa chạy song song: request sau thua ở chỉ mục unique → trả về đơn của request trước
    if (e.code === 11000 && data.clientRequestId && e.keyPattern?.clientRequestId) {
      const existing = await Order.findOne({ user: data.user, clientRequestId: data.clientRequestId });
      if (existing) return { order: existing, duplicate: true };
    }
    throw e;
  }
}

// Luồng trạng thái hợp lệ. Admin được sửa nhầm giữa các bước đang xử lý; "đã hủy" là trạng thái cuối
// (kho đã hoàn lại — mở lại sẽ lệch tồn kho, cần tạo đơn mới).
export const ORDER_STATUSES = ['confirmed', 'preparing', 'shipping', 'done', 'cancelled'];
export const PAYMENT_STATUSES = ['unpaid', 'paid', 'refunded'];
export function canMove(from, to) {
  if (!ORDER_STATUSES.includes(to)) return false;
  return from !== 'cancelled' && from !== to;
}

// Hủy đơn nguyên tử: chỉ 1 lệnh hủy thắng → hoàn kho + trả lượt mã giảm giá đúng 1 lần (kể cả khi user & admin cùng bấm).
export async function cancelOrder(filter, { by, from = ['confirmed', 'preparing', 'shipping', 'done'] }) {
  return inTransaction(async (session) => {
    const order = await Order.findOneAndUpdate(
      { ...filter, status: { $in: from } },
      { $set: { status: 'cancelled' }, $push: { history: { status: 'cancelled', at: new Date(), by } } },
      { new: true, session },
    );
    if (!order) return null;
    await restockItems(order.items, session);
    await recordReturn(order, by, session);
    if (order.coupon) await Coupon.updateOne({ code: order.coupon, usedCount: { $gt: 0 } }, { $inc: { usedCount: -1 } }, { session });
    return order;
  });
}
