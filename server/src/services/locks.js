import { randomUUID } from 'node:crypto';
import { Lock } from '../models/index.js';

// Khóa phân tán đơn giản trên MongoDB: chỉ 1 server giữ khóa `key` trong `ttlMs`.
// Dùng cho scheduler / migration khi chạy nhiều instance.
const OWNER = randomUUID();

export async function acquireLock(key, ttlMs) {
  const now = new Date();
  try {
    const r = await Lock.findOneAndUpdate(
      { key, $or: [{ until: { $lt: now } }, { owner: OWNER }] },
      { key, until: new Date(now.getTime() + ttlMs), owner: OWNER },
      { upsert: true, new: true },
    );
    return r?.owner === OWNER;
  } catch (e) {
    if (e.code === 11000) return false; // server khác vừa giữ khóa
    throw e;
  }
}

export async function releaseLock(key) {
  await Lock.deleteOne({ key, owner: OWNER }).catch(() => {});
}
