import { Reminder, Subscription, Order, Product, User } from '../models/index.js';
import { sendToUser } from './push.js';

// Bộ lập lịch chạy trong tiến trình server (mỗi phút):
//  1) Gửi web push cho nhắc nhở đến giờ (theo múi giờ APP_TZ)
//  2) Mỗi ngày, tạo đơn giao hàng cho các gói định kỳ có lịch giao hôm nay
// Lưu ý: nếu chạy nhiều instance server, chỉ bật SCHEDULER ở 1 instance.

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
  const due = await Reminder.find({ enabled: true, time, days: dow, lastSentAt: { $ne: stamp } }).lean();
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

    // Giữ chỗ trước để không tạo trùng khi chạy lại
    const claimed = await Subscription.updateOne({ _id: sub._id, lastGeneratedDate: { $ne: today.date } }, { lastGeneratedDate: today.date });
    if (!claimed.modifiedCount) continue;

    const amount = Math.round((sub.price * qty) / sub.bottles);
    const order = await Order.create({
      user: sub.user,
      code: `NTV-S${Date.now().toString(36).toUpperCase().slice(-6)}`,
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
    });
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

export function startScheduler() {
  if (process.env.SCHEDULER === 'off') return;
  const tick = async () => {
    try {
      await runReminders();
      const { time } = nowInTz();
      if (time >= '06:00') await generateSubscriptionOrders();
    } catch (e) {
      console.error('[scheduler]', e);
    }
  };
  setInterval(tick, 60_000);
  tick();
  console.log(`[scheduler] Đang chạy (múi giờ ${TZ})`);
}

// Thông báo cho user khi admin cập nhật đơn/hỗ trợ
export async function notifyUser(userId, payload) {
  if (!(await User.exists({ _id: userId }))) return;
  await sendToUser(userId, payload).catch((e) => console.error('[push]', e.message));
}
