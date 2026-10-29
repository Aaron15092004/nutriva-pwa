import { Router } from 'express';
import mongoose from 'mongoose';
import { Reminder, SupportRequest, PushSubscription, DailyLog, PlanChoice, ChatMessage } from '../models/index.js';
import { ah, requireAuth, HttpError, MembershipRequired } from '../middleware/auth.js';
import { hasAccess } from '../services/membership.js';
import { assistantLimiter } from '../middleware/limits.js';
import { track } from '../services/events.js';
import { replyByRules, card } from '../services/assistant.js';
import { askClaude, claudeEnabled } from '../services/claude.js';
import { sendToUser } from '../services/push.js';
import { loadProducts, loadDishes } from '../services/catalog.js';
import { buildDay } from '../services/plan.js';
import { nowInTz } from '../services/scheduler.js';
import { computeHealth } from '../../../shared/nutrition.js';

const router = Router();

router.use(requireAuth);

// ---- Web Push ----
router.post(
  '/push/subscribe',
  ah(async (req, res) => {
    const { endpoint, keys } = req.body?.subscription ?? {};
    if (!endpoint?.startsWith('https://') || !keys?.p256dh || !keys?.auth) throw new HttpError(400, 'Đăng ký thông báo không hợp lệ');
    await PushSubscription.findOneAndUpdate(
      { endpoint },
      { user: req.user._id, endpoint, keys, userAgent: (req.headers['user-agent'] ?? '').slice(0, 200) },
      { upsert: true },
    );
    res.status(201).json({ ok: true });
  }),
);

router.post(
  '/push/unsubscribe',
  ah(async (req, res) => {
    await PushSubscription.deleteOne({ endpoint: req.body?.endpoint, user: req.user._id });
    res.json({ ok: true });
  }),
);

router.post(
  '/push/test',
  ah(async (req, res) => {
    const sent = await sendToUser(req.user._id, { title: 'NUTRIVA', body: 'Thông báo đã hoạt động trên thiết bị này!', url: '/track/reminders' });
    if (!sent) throw new HttpError(400, 'Thiết bị chưa bật thông báo');
    res.json({ sent });
  }),
);

// ---- Nhắc nhở ----
const KINDS = ['water', 'milk', 'exercise', 'meal', 'other'];

function cleanReminder(body) {
  const out = {};
  if (body.title !== undefined) {
    if (!body.title?.trim()) throw new HttpError(400, 'Nhập tên nhắc nhở');
    out.title = body.title.trim().slice(0, 60);
  }
  if (body.time !== undefined) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(body.time)) throw new HttpError(400, 'Giờ không hợp lệ');
    out.time = body.time;
  }
  if (body.days !== undefined) out.days = [...new Set(body.days.map(Number).filter((d) => d >= 0 && d <= 6))];
  if (body.kind !== undefined) out.kind = KINDS.includes(body.kind) ? body.kind : 'other';
  if (typeof body.enabled === 'boolean') out.enabled = body.enabled;
  return out;
}

// Nhắc nhở là tính năng của gói NUTRIVA: xem được, nhưng thêm / bật / đổi lịch cần gói còn hạn
// (máy chủ cũng chỉ gửi nhắc cho người đang có gói — xem services/scheduler.js)
const NEED_REMINDERS = 'Nhắc nhở uống nước, uống sữa, vận động cần kích hoạt gói NUTRIVA — nhập mã trên chai sữa để mở khóa';
router.get(
  '/reminders',
  ah(async (req, res) => res.json({ reminders: await Reminder.find({ user: req.user._id }).sort({ time: 1 }).lean(), locked: !(await hasAccess(req.user)) })),
);

router.post(
  '/reminders',
  ah(async (req, res) => {
    if (!(await hasAccess(req.user))) throw new MembershipRequired(NEED_REMINDERS);
    const data = cleanReminder({ kind: 'other', days: [1, 2, 3, 4, 5], ...req.body });
    if (!data.title || !data.time) throw new HttpError(400, 'Nhập tên và giờ nhắc');
    res.status(201).json({ reminder: await Reminder.create({ ...data, user: req.user._id }) });
  }),
);

router.patch(
  '/reminders/:id',
  ah(async (req, res) => {
    // Tắt thì luôn được; bật hoặc đổi giờ/ngày cần gói còn hạn
    const changes = cleanReminder(req.body);
    if (!(Object.keys(changes).length === 1 && changes.enabled === false) && !(await hasAccess(req.user))) throw new MembershipRequired(NEED_REMINDERS);
    const reminder = await Reminder.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, changes, { new: true });
    if (!reminder) throw new HttpError(404, 'Không tìm thấy nhắc nhở');
    res.json({ reminder });
  }),
);

router.delete(
  '/reminders/:id',
  ah(async (req, res) => {
    await Reminder.deleteOne({ _id: req.params.id, user: req.user._id });
    res.status(204).end();
  }),
);

// ---- Trợ lý NUTRIVA ----
// Lịch sử trò chuyện lưu ở server (đổi máy vẫn còn) — ngữ cảnh gửi Claude lấy từ DB, không tin dữ liệu client gửi lên.
const HISTORY_TURNS = 12;
function toTurns(messages, message) {
  const turns = messages
    .filter((m) => !m.error && m.text?.trim())
    .map((m) => ({ role: m.role, content: m.text.slice(0, 2000) }))
    .slice(-HISTORY_TURNS);
  turns.push({ role: 'user', content: message });
  while (turns.length && turns[0].role !== 'user') turns.shift(); // lượt đầu phải là user
  // Claude yêu cầu xen kẽ user/assistant: gộp các lượt liền nhau cùng vai trò
  return turns.reduce((out, t) => {
    const last = out[out.length - 1];
    if (last?.role === t.role) last.content += `\n\n${t.content}`;
    else out.push({ ...t });
    return out;
  }, []);
}
const publicMessage = (m, products = []) => {
  const p = m.product && products.find((x) => x.slug === m.product);
  return { id: m._id, role: m.role, text: m.text, product: p ? card(p) : undefined, link: m.link?.to ? m.link : undefined, ai: m.ai, rating: m.rating ?? null, at: m.createdAt };
};

router.get('/assistant/status', (req, res) => res.json({ ai: claudeEnabled() }));

router.get(
  '/assistant/history',
  ah(async (req, res) => {
    const where = { user: req.user._id };
    if (mongoose.isValidObjectId(req.query.before)) where._id = { $lt: req.query.before };
    const [items, products] = await Promise.all([ChatMessage.find(where).sort({ _id: -1 }).limit(40).lean(), loadProducts()]);
    res.json({ messages: items.reverse().map((m) => publicMessage(m, products)), more: items.length === 40 });
  }),
);

router.delete(
  '/assistant/history',
  ah(async (req, res) => {
    await ChatMessage.deleteMany({ user: req.user._id });
    res.status(204).end();
  }),
);

// Đánh giá câu trả lời 👍/👎 (admin xem để cải thiện nội dung)
router.post(
  '/assistant/messages/:id/rating',
  ah(async (req, res) => {
    const rating = ['up', 'down'].includes(req.body?.rating) ? req.body.rating : null;
    const m = await ChatMessage.findOneAndUpdate({ _id: req.params.id, user: req.user._id, role: 'assistant' }, { rating }, { new: true }).lean();
    if (!m) throw new HttpError(404, 'Không tìm thấy tin nhắn');
    res.json({ message: publicMessage(m, await loadProducts()) });
  }),
);

router.post(
  '/assistant',
  assistantLimiter,
  ah(async (req, res) => {
    const message = (req.body.message ?? '').toString().trim().slice(0, 1000);
    if (!message) throw new HttpError(400, 'Nhập câu hỏi');
    const [products, dishes, past] = await Promise.all([
      loadProducts(),
      loadDishes(),
      ChatMessage.find({ user: req.user._id }).sort({ _id: -1 }).limit(HISTORY_TURNS).lean(),
    ]);
    const asked = await ChatMessage.create({ user: req.user._id, role: 'user', text: message });

    let reply;
    let ai = false;
    if (claudeEnabled()) {
      const profile = req.user.profile.toObject();
      const { date } = nowInTz();
      const [log, choices] = await Promise.all([
        DailyLog.findOne({ user: req.user._id, date }).lean(),
        PlanChoice.find({ user: req.user._id, date }).lean(),
      ]);
      const eaten = Object.values(log?.meals ?? {})
        .flat()
        .reduce((s, i) => ({ kcal: s.kcal + i.kcal, protein: s.protein + i.protein, carb: s.carb + i.carb, fat: s.fat + i.fat }), { kcal: 0, protein: 0, carb: 0, fat: 0 });
      const today = {
        date,
        eaten,
        waterMl: log?.waterMl ?? 0,
        exerciseMin: (log?.exercises ?? []).reduce((s, e) => s + e.minutes, 0),
        plan: buildDay(profile, date, { products, dishes }, choices),
      };
      try {
        reply = await askClaude({ history: toTurns(past.reverse(), message), user: { name: req.user.name, profile }, health: computeHealth(profile), products, today });
        ai = true;
      } catch (e) {
        console.error('[assistant]', e.status ?? '', e.message);
        // API lỗi → vẫn trả lời bằng chế độ dự phòng
      }
    }
    reply ??= replyByRules(message, req.user, products);

    const saved = await ChatMessage.create({
      user: req.user._id,
      role: 'assistant',
      text: (reply.text ?? '').slice(0, 4000),
      product: reply.product?.slug ?? (typeof reply.product === 'string' ? reply.product : undefined),
      link: reply.link,
      ai,
    });
    track('assistant.ask', { user: req.user, req, props: { ai } });
    res.json({ ...reply, ai, id: saved._id, askedId: asked._id });
  }),
);

// ---- Hỗ trợ / Trao đổi với chuyên gia ----
router.get(
  '/support',
  ah(async (req, res) => res.json({ requests: await SupportRequest.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(50).lean() })),
);

router.post(
  '/support',
  ah(async (req, res) => {
    const message = (req.body.message ?? '').toString().trim();
    if (message.length < 5) throw new HttpError(400, 'Mô tả ngắn gọn nhu cầu của bạn (ít nhất 5 ký tự)');
    const request = await SupportRequest.create({
      user: req.user._id,
      topic: ['expert', 'order', 'general'].includes(req.body.topic) ? req.body.topic : 'general',
      message: message.slice(0, 1000),
    });
    res.status(201).json({ request });
  }),
);

export default router;
