import { Router } from 'express';
import { Reminder, SupportRequest, PushSubscription, DailyLog, PlanChoice } from '../models/index.js';
import { ah, requireAuth, HttpError } from '../middleware/auth.js';
import { replyByRules } from '../services/assistant.js';
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

router.get(
  '/reminders',
  ah(async (req, res) => res.json({ reminders: await Reminder.find({ user: req.user._id }).sort({ time: 1 }).lean() })),
);

router.post(
  '/reminders',
  ah(async (req, res) => {
    const data = cleanReminder({ kind: 'other', days: [1, 2, 3, 4, 5], ...req.body });
    if (!data.title || !data.time) throw new HttpError(400, 'Nhập tên và giờ nhắc');
    res.status(201).json({ reminder: await Reminder.create({ ...data, user: req.user._id }) });
  }),
);

router.patch(
  '/reminders/:id',
  ah(async (req, res) => {
    const reminder = await Reminder.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, cleanReminder(req.body), { new: true });
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
function cleanHistory(history, message) {
  const turns = (Array.isArray(history) ? history : [])
    .filter((m) => ['user', 'assistant'].includes(m?.role) && typeof m.content === 'string' && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }))
    .slice(-12);
  turns.push({ role: 'user', content: message });
  while (turns.length && turns[0].role !== 'user') turns.shift(); // lượt đầu phải là user
  return turns;
}

router.get('/assistant/status', (req, res) => res.json({ ai: claudeEnabled() }));

router.post(
  '/assistant',
  ah(async (req, res) => {
    const message = (req.body.message ?? '').toString().trim().slice(0, 1000);
    if (!message) throw new HttpError(400, 'Nhập câu hỏi');
    const [products, dishes] = await Promise.all([loadProducts(), loadDishes()]);

    if (!claudeEnabled()) return res.json({ ...replyByRules(message, req.user, products), ai: false });

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
      const reply = await askClaude({
        history: cleanHistory(req.body.history, message),
        user: { name: req.user.name, profile },
        health: computeHealth(profile),
        products,
        today,
      });
      res.json({ ...reply, ai: true });
    } catch (e) {
      console.error('[assistant]', e.status ?? '', e.message);
      // API lỗi → vẫn trả lời bằng chế độ dự phòng
      res.json({ ...replyByRules(message, req.user, products), ai: false });
    }
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
