import { Reminder, Subscription, Product, User } from '../models/index.js';
import { sendToUser } from './push.js';
import { placeOrder } from './orders.js';
import { audit } from './audit.js';
import { membershipConfig } from './membership.js';
import { wasteExpired } from './inventory.js';

// Bộ lập lịch chạy trong tiến trình server (mỗi phút):
//  1) Gửi web push cho nhắc nhở đến giờ (theo múi giờ APP_TZ)
//  2) Mỗi ngày, tạo đơn giao hàng cho các gói định kỳ có lịch giao hôm nay
// Chạy nhiều instance vẫn an toàn: mỗi nhắc nhở / gói định kỳ được "giữ chỗ" nguyên tử trước khi xử lý.

const TZ = process.env.APP_TZ || 'Asia/Ho_Chi_Minh';
const WEEKDAY_CODE = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

export function nowInTz(date = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short',
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  const ymd = `${parts.year}-${parts.month}-${parts.day}`;
  const dow = new Date(`${ymd}T00:00:00Z`).getUTCDay();
  return { date: ymd, time: `${parts.hour}:${parts.minute}`, dow };
}

// Thời điểm 00:00 của ngày `ymd` theo múi giờ APP_TZ (server Render chạy giờ UTC)
export function startOfDayInTz(ymd) {
  const guess = new Date(`${ymd}T00:00:00Z`);
  const local = nowInTz(guess);
  const offset = Date.parse(`${local.date}T${local.time}:00Z`) - guess.getTime();
  return new Date(guess.getTime() - offset);
}
export const addDays = (ymd, n) => new Date(Date.parse(`${ymd}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

const REMINDER_BODY = {
  water: 'Uống một cốc nước nhé — cơ thể bạn sẽ cảm ơn!',
  milk: 'Đến giờ bữa ăn nhẹ với sữa hạt NUTRIVA rồi.',
  exercise: 'Dành vài phút vận động nhẹ nào.',
  meal: 'Đừng quên ghi lại bữa ăn của bạn.',
  other: 'NUTRIVA nhắc bạn nhé!',
};

async function runReminders() {
  const { date, time, dow } = nowInTz();
  const stamp = `${date} ${time}`;
  let due = await Reminder.find({ enabled: true, time, days: dow, lastSentAt: { $ne: stamp } }).lean();
  // Nhắc nhở thuộc gói NUTRIVA: chỉ gửi cho người có gói còn hạn (admin luôn nhận)
  const cfg = await membershipConfig();
  if (cfg.enabled && due.length) {
    const ok = new Set((await User.find({ _id: { $in: due.map((r) => r.user) }, $or: [{ 'membership.until': { $gt: new Date() } }, { role: 'admin' }] }, { _id: 1 }).lean()).map((u) => String(u._id)));
    due = due.filter((r) => ok.has(String(r.user)));
  }
  for (const r of due) {
    // Đánh dấu trước khi gửi để không gửi trùng nếu tick sau chạy chồng
    const claimed = await Reminder.updateOne({ _id: r._id, lastSentAt: { $ne: stamp } }, { lastSentAt: stamp });
    if (!claimed.modifiedCount) continue;
    await sendToUser(r.user, { title: r.title, body: REMINDER_BODY[r.kind] ?? REMINDER_BODY.other, url: '/track', tag: `reminder-${r._id}` }).catch(
      (e) => console.error('[push] reminder', e.message),
    );
  }
}

// Chia số chai/tuần cho các ngày giao: 5 chai / 3 ngày → 2,2,1
export function bottlesForDay(sub, dayCode) {
  const idx = sub.days.indexOf(dayCode);
  if (idx < 0) return 0;
  const base = Math.floor(sub.bottles / sub.days.length);
  return base + (idx < sub.bottles % sub.days.length ? 1 : 0);
}

const failedToday = new Set();
const weekNumber = (ymd) => Math.floor((Date.parse(`${ymd}T00:00:00Z`) / 86400000 + 3) / 7);

export async function generateSubscriptionOrders(today = nowInTz()) {
  const code = WEEKDAY_CODE[today.dow];
  const subs = await Subscription.find({ active: true, days: code, lastGeneratedDate: { $ne: today.date } });
  let created = 0;
  for (const sub of subs) {
    if (sub.startDate && sub.startDate > today.date) continue;
    if (sub.frequency === 'biweekly' && (weekNumber(today.date) - weekNumber(sub.startDate ?? today.date)) % 2 !== 0) continue;
    const qty = bottlesForDay(sub, code);
    const product = await Product.findOne({ slug: sub.productSlug }).lean();
    if (!qty || !product) continue;

    // Giữ chỗ trước để không tạo trùng khi chạy lại / nhiều server cùng chạy
    const claimed = await Subscription.updateOne({ _id: sub._id, lastGeneratedDate: { $ne: today.date } }, { lastGeneratedDate: today.date });
    if (!claimed.modifiedCount) continue;

    const amount = Math.round((sub.price * qty) / sub.bottles);
    let order;
    try {
      ({ order } = await placeOrder({
        user: sub.user,
        source: 'subscription',
        subscription: sub._id,
        items: [{ product: product._id, slug: product.slug, name: product.name, type: product.type, image: product.image, size: product.size, sweetness: sub.sweetness, price: Math.round(amount / qty), qty }],
        subtotal: amount,
        discount: 0,
        shippingFee: 0,
        total: amount,
        delivery: { method: 'home', date: today.date, slot: '08:00 - 12:00' },
        address: sub.address,
        payment: 'cod',
        history: [{ status: 'confirmed', at: new Date(), by: 'system' }],
      }));
    } catch (e) {
      // Trả lại chỗ giữ → tick sau thử lại (vd admin vừa nhập thêm hàng). Chỉ ghi nhật ký 1 lần/gói/ngày.
      await Subscription.updateOne({ _id: sub._id, lastGeneratedDate: today.date }, { lastGeneratedDate: sub.lastGeneratedDate ?? null });
      const key = `${sub._id}|${today.date}`;
      if (!failedToday.has(key)) {
        failedToday.add(key);
        console.error(`[scheduler] Không tạo được đơn định kỳ ${sub._id}: ${e.message}`);
        audit(null, 'subscription.generate_failed', { entity: 'Subscription', entityId: sub._id, summary: `${product.name} × ${qty}: ${e.message}`, ok: false, actor: { _id: null, email: 'system', role: 'system' } });
      }
      continue;
    }
    created++;
    await sendToUser(sub.user, {
      title: 'Gói sữa định kỳ hôm nay',
      body: `Đơn ${order.code}: ${qty} chai ${product.name} sẽ được giao trong ngày.`,
      url: `/orders/${order._id}`,
    }).catch(() => {});
  }
  if (created) console.log(`[scheduler] Tạo ${created} đơn từ gói định kỳ (${today.date})`);
  return created;
}

// Nhắc gói sắp hết hạn (mỗi người tối đa 1 lần/ngày, lúc 9:00 trở đi) → gợi ý mua thêm sữa để tự gia hạn
async function runExpiryNotices() {
  const cfg = await membershipConfig();
  const { date, time } = nowInTz();
  if (!cfg.enabled || !cfg.expiryNoticeDays || time < '09:00') return;
  const now = new Date();
  const soon = new Date(now.getTime() + cfg.expiryNoticeDays * 86400000);
  const users = await User.find({ 'membership.until': { $gt: now, $lte: soon }, 'membership.noticeDate': { $ne: date } }, { _id: 1, membership: 1 }).limit(200).lean();
  for (const u of users) {
    const claimed = await User.updateOne({ _id: u._id, 'membership.noticeDate': { $ne: date } }, { 'membership.noticeDate': date });
    if (!claimed.modifiedCount) continue;
    const days = Math.max(1, Math.ceil((new Date(u.membership.until) - now) / 86400000));
    await sendToUser(u._id, {
      title: `Gói NUTRIVA còn ${days} ngày`,
      body: 'Mua thêm sữa hạt hoặc nhập mã trên chai để tiếp tục dùng kế hoạch và nhắc nhở nhé.',
      url: '/me/membership',
      tag: 'membership-expiry',
    }).catch(() => {});
  }
}

// 1 lượt chạy (gọi mỗi phút trong tiến trình, hoặc từ cron bên ngoài khi server ngủ — xem /api/cron/tick)
export async function schedulerTick() {
  await runReminders();
  await runExpiryNotices();
  // Lô quá hạn → tự xuất hủy (không bán sữa hết hạn); bình thường chỉ là 1 truy vấn rỗng
  const expired = await wasteExpired('system').catch((e) => console.error('[inventory]', e.message));
  if (expired?.qty) console.log(`[inventory] Tự xuất hủy ${expired.qty} đơn vị từ ${expired.lots} lô quá hạn`);
  const { time } = nowInTz();
  const created = time >= '06:00' ? await generateSubscriptionOrders() : 0;
  if (failedToday.size > 500) failedToday.clear();
  return { created };
}

export function startScheduler() {
  if (process.env.SCHEDULER === 'off') return;
  const tick = () => schedulerTick().catch((e) => console.error('[scheduler]', e));
  setInterval(tick, 60_000).unref?.();
  tick();
  console.log(`[scheduler] Đang chạy (múi giờ ${TZ})`);
}

// Thông báo cho user khi admin cập nhật đơn/hỗ trợ
export async function notifyUser(userId, payload) {
  if (!(await User.exists({ _id: userId }))) return;
  await sendToUser(userId, payload).catch((e) => console.error('[push]', e.message));
}
