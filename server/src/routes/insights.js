import { Router } from 'express';
import mongoose from 'mongoose';
import { User, Order, Event, Metric, AuditLog, ChatMessage, DailyLog, Subscription, WeightEntry } from '../models/index.js';
import { ah, requireAuth, requireAdmin, HttpError } from '../middleware/auth.js';
import { nowInTz, startOfDayInTz, addDays } from '../services/scheduler.js';
import { profileAge } from '../../../shared/nutrition.js';

// Thống kê cho admin: người dùng (tăng trưởng, hoạt động, phễu onboarding, giữ chân), lưu lượng API, nhật ký thao tác, chất lượng trợ lý.
const router = Router();
router.use(requireAuth, requireAdmin);

const TZ = process.env.APP_TZ || 'Asia/Ho_Chi_Minh';
const dayOf = (field) => ({ $dateToString: { format: '%Y-%m-%d', date: field, timezone: TZ } });
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const clampInt = (v, min, max, def) => Math.min(max, Math.max(min, Math.floor(Number(v)) || def));

// Điền ngày trống (biểu đồ liên tục)
function fillDays(rows, from, days, pick = (r) => r) {
  const map = new Map(rows.map((r) => [r._id, r]));
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(from, i);
    return { date, ...pick(map.get(date) ?? {}) };
  });
}

// ---- Tổng quan người dùng ----
router.get(
  '/users',
  ah(async (req, res) => {
    const days = clampInt(req.query.days, 7, 90, 30);
    const now = new Date();
    const today = nowInTz(now).date;
    const fromDay = addDays(today, -(days - 1));
    const from = startOfDayInTz(fromDay);
    const startToday = startOfDayInTz(today);
    const d7 = new Date(now - 7 * 86400000);
    const d30 = new Date(now - 30 * 86400000);

    const [total, admins, google, newToday, new7, new30, dau, wau, mau, signupsByDay, activeByDay, platforms, installs, funnelRaw, starts, cohort, loggers, subs, buyers] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'admin' }),
      User.countDocuments({ googleId: { $type: 'string' } }),
      User.countDocuments({ createdAt: { $gte: startToday } }),
      User.countDocuments({ createdAt: { $gte: d7 } }),
      User.countDocuments({ createdAt: { $gte: d30 } }),
      User.countDocuments({ lastActiveAt: { $gte: startToday } }),
      User.countDocuments({ lastActiveAt: { $gte: d7 } }),
      User.countDocuments({ lastActiveAt: { $gte: d30 } }),
      User.aggregate([{ $match: { createdAt: { $gte: from } } }, { $group: { _id: dayOf('$createdAt'), n: { $sum: 1 } } }]),
      // Hoạt động theo ngày: thiết bị/người mở app (sự kiện app.open)
      Event.aggregate([
        { $match: { type: 'app.open', at: { $gte: from } } },
        { $group: { _id: { d: dayOf('$at'), who: { $ifNull: [{ $toString: '$user' }, '$anon'] } }, user: { $max: { $cond: [{ $ifNull: ['$user', false] }, 1, 0] } } } },
        { $group: { _id: '$_id.d', visitors: { $sum: 1 }, members: { $sum: '$user' } } },
      ]),
      Event.aggregate([
        { $match: { type: 'app.open', at: { $gte: d30 } } },
        { $group: { _id: { p: '$platform', who: { $ifNull: [{ $toString: '$user' }, '$anon'] } }, standalone: { $max: { $cond: ['$props.standalone', 1, 0] } } } },
        { $group: { _id: '$_id.p', n: { $sum: 1 }, installed: { $sum: '$standalone' } } },
      ]),
      Event.countDocuments({ type: 'app.install', at: { $gte: d30 } }),
      // Phễu onboarding: số thiết bị đã tới từng bước
      Event.aggregate([
        { $match: { type: 'onboarding.step', at: { $gte: d30 } } },
        { $group: { _id: { step: '$props.step', who: { $ifNull: ['$anon', { $toString: '$user' }] } } } },
        { $group: { _id: '$_id.step', n: { $sum: 1 } } },
      ]),
      Event.aggregate([{ $match: { type: 'onboarding.start', at: { $gte: d30 } } }, { $group: { _id: { $ifNull: ['$anon', { $toString: '$user' }] } } }, { $count: 'n' }]),
      // Giữ chân: người đăng ký 8–37 ngày trước còn quay lại sau ngày thứ 7
      User.aggregate([
        { $match: { createdAt: { $gte: new Date(now - 37 * 86400000), $lt: new Date(now - 8 * 86400000) } } },
        { $group: { _id: null, n: { $sum: 1 }, back: { $sum: { $cond: [{ $gte: ['$lastActiveAt', { $add: ['$createdAt', 7 * 86400000] }] }, 1, 0] } } } },
      ]),
      DailyLog.distinct('user', { updatedAt: { $gte: d7 } }).then((a) => a.length),
      Subscription.distinct('user', { active: true }).then((a) => a.length),
      Order.distinct('user', { status: { $ne: 'cancelled' }, createdAt: { $gte: d30 } }).then((a) => a.length),
    ]);

    const signupFunnel = await Event.aggregate([
      { $match: { type: 'user.signup', at: { $gte: d30 } } },
      { $group: { _id: '$props.method', n: { $sum: 1 } } },
    ]);

    res.json({
      totals: { total, admins, google, newToday, new7, new30, dau, wau, mau, stickiness: mau ? Math.round((dau / mau) * 100) : 0 },
      engagement: { loggers7: loggers, activeSubscribers: subs, buyers30: buyers, installs30: installs },
      retentionD7: cohort[0] ? { cohort: cohort[0].n, returned: cohort[0].back, rate: cohort[0].n ? Math.round((cohort[0].back / cohort[0].n) * 100) : 0 } : null,
      daily: fillDays(
        [...signupsByDay.map((r) => ({ _id: r._id, signups: r.n })), ...activeByDay.map((r) => ({ _id: r._id, visitors: r.visitors, members: r.members }))].reduce((acc, r) => {
          const cur = acc.find((x) => x._id === r._id);
          if (cur) Object.assign(cur, r);
          else acc.push({ ...r });
          return acc;
        }, []),
        fromDay,
        days,
        (r) => ({ signups: r.signups ?? 0, visitors: r.visitors ?? 0, members: r.members ?? 0 }),
      ),
      platforms: platforms.map((p) => ({ platform: p._id ?? 'unknown', devices: p.n, installed: p.installed })).sort((a, b) => b.devices - a.devices),
      funnel: { starts: starts[0]?.n ?? 0, steps: Object.fromEntries(funnelRaw.map((f) => [f._id, f.n])), signups: Object.fromEntries(signupFunnel.map((s) => [s._id ?? 'email', s.n])) },
    });
  }),
);

// ---- Chi tiết 1 người dùng: hồ sơ, hoạt động, đơn hàng, nhật ký thao tác ----
router.get(
  '/users/:id',
  ah(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(404, 'Không tìm thấy người dùng');
    const found = await User.findById(req.params.id).select('-tokenVersion').lean();
    if (!found) throw new HttpError(404, 'Không tìm thấy người dùng');
    const { passwordHash, ...user } = found;
    user.hasPassword = Boolean(passwordHash);
    const id = user._id;
    const [orders, logDays, lastLog, weights, chats, chatDown, subs, audit, events, platforms] = await Promise.all([
      Order.aggregate([{ $match: { user: id } }, { $group: { _id: null, n: { $sum: 1 }, spent: { $sum: { $cond: [{ $ne: ['$status', 'cancelled'] }, '$total', 0] } }, last: { $max: '$createdAt' } } }]),
      DailyLog.countDocuments({ user: id }),
      DailyLog.findOne({ user: id }).sort({ date: -1 }).select('date').lean(),
      WeightEntry.find({ user: id }).sort({ date: 1 }).select('date kg -_id').lean(),
      ChatMessage.countDocuments({ user: id, role: 'user' }),
      ChatMessage.countDocuments({ user: id, rating: 'down' }),
      Subscription.find({ user: id }).select('productName bottles active days').lean(),
      AuditLog.find({ $or: [{ actor: id }, { entity: 'User', entityId: String(id) }] }).sort({ at: -1 }).limit(30).lean(),
      Event.aggregate([{ $match: { user: id, at: { $gte: new Date(Date.now() - 30 * 86400000) } } }, { $group: { _id: '$type', n: { $sum: 1 }, last: { $max: '$at' } } }, { $sort: { n: -1 } }]),
      Event.distinct('platform', { user: id }),
    ]);
    res.json({
      user: { ...user, profile: user.profile && { ...user.profile, age: profileAge(user.profile) } },
      stats: {
        orders: orders[0]?.n ?? 0,
        spent: orders[0]?.spent ?? 0,
        lastOrderAt: orders[0]?.last ?? null,
        logDays,
        lastLogDate: lastLog?.date ?? null,
        questions: chats,
        downvotes: chatDown,
        platforms,
      },
      weights,
      subscriptions: subs,
      events30: events.map((e) => ({ type: e._id, n: e.n, last: e.last })),
      audit,
    });
  }),
);

// Điền các mốc không có request bằng 0 (biểu đồ liên tục, không nối thẳng qua khoảng trống)
function fillBuckets(rows, from, unit) {
  const byTime = new Map(rows.map((r) => [new Date(r._id).getTime(), r]));
  const empty = { count: 0, s4xx: 0, s5xx: 0, sumMs: 0, p95: 0 };
  const times = [];
  if (unit >= 1440) {
    for (let d = nowInTz(from).date, end = nowInTz().date; d <= end; d = addDays(d, 1)) times.push(startOfDayInTz(d).getTime());
  } else {
    const step = unit * 60000;
    for (let t = Math.floor(from.getTime() / step) * step; t <= Date.now(); t += step) times.push(t);
  }
  return times.map((t) => ({ ...empty, ...byTime.get(t), _id: new Date(t) }));
}

// ---- Lưu lượng API (gom theo phút trong collection metrics) ----
router.get(
  '/traffic',
  ah(async (req, res) => {
    const hours = clampInt(req.query.hours, 1, 24 * 14, 24);
    const from = new Date(Date.now() - hours * 3600000);
    // Độ chi tiết biểu đồ: ≤ 6 giờ → 5 phút; ≤ 48 giờ → 1 giờ; còn lại → 1 ngày
    const unit = hours <= 6 ? 5 : hours <= 48 ? 60 : 1440;
    const bucket = unit === 1440 ? { $dateTrunc: { date: '$minute', unit: 'day', timezone: TZ } } : { $dateTrunc: { date: '$minute', unit: 'minute', binSize: unit } };
    const [series, routes, totals] = await Promise.all([
      Metric.aggregate([
        { $match: { minute: { $gte: from } } },
        { $group: { _id: bucket, count: { $sum: '$count' }, s4xx: { $sum: '$s4xx' }, s5xx: { $sum: '$s5xx' }, sumMs: { $sum: '$sumMs' }, p95: { $max: '$p95' } } },
        { $sort: { _id: 1 } },
      ]),
      Metric.aggregate([
        { $match: { minute: { $gte: from } } },
        { $group: { _id: '$route', count: { $sum: '$count' }, s4xx: { $sum: '$s4xx' }, s5xx: { $sum: '$s5xx' }, sumMs: { $sum: '$sumMs' }, maxMs: { $max: '$maxMs' }, p95: { $max: '$p95' } } },
        { $sort: { count: -1 } },
        { $limit: 60 },
      ]),
      Metric.aggregate([
        { $match: { minute: { $gte: from } } },
        { $group: { _id: null, count: { $sum: '$count' }, s4xx: { $sum: '$s4xx' }, s5xx: { $sum: '$s5xx' }, sumMs: { $sum: '$sumMs' } } },
      ]),
    ]);
    const t = totals[0] ?? { count: 0, s4xx: 0, s5xx: 0, sumMs: 0 };
    const peakMinute = await Metric.aggregate([
      { $match: { minute: { $gte: from } } },
      { $group: { _id: '$minute', count: { $sum: '$count' } } },
      { $sort: { count: -1 } },
      { $limit: 1 },
    ]);
    res.json({
      hours,
      unitMinutes: unit,
      totals: {
        requests: t.count,
        perMinute: Math.round((t.count / Math.max(1, hours * 60)) * 100) / 100,
        peakPerMinute: peakMinute[0]?.count ?? 0,
        peakAt: peakMinute[0]?._id ?? null,
        errorRate: t.count ? Math.round((t.s5xx / t.count) * 10000) / 100 : 0,
        clientErrorRate: t.count ? Math.round((t.s4xx / t.count) * 10000) / 100 : 0,
        avgMs: t.count ? Math.round(t.sumMs / t.count) : 0,
      },
      series: fillBuckets(series, from, unit).map((s) => ({ at: s._id, count: s.count, s4xx: s.s4xx, s5xx: s.s5xx, avgMs: s.count ? Math.round(s.sumMs / s.count) : 0, p95: s.p95 })),
      routes: routes.map((r) => ({ route: r._id, count: r.count, s4xx: r.s4xx, s5xx: r.s5xx, avgMs: r.count ? Math.round(r.sumMs / r.count) : 0, p95: r.p95, maxMs: r.maxMs })),
    });
  }),
);

// ---- Nhật ký thao tác ----
router.get(
  '/audit',
  ah(async (req, res) => {
    const limit = clampInt(req.query.limit, 10, 200, 50);
    const where = {};
    const str = (k) => (typeof req.query[k] === 'string' && req.query[k].trim() ? req.query[k].trim() : null);
    if (str('action')) where.action = str('action').endsWith('.') ? { $regex: `^${escapeRe(str('action'))}` } : str('action');
    if (str('entity')) where.entity = str('entity');
    if (str('entityId')) where.entityId = str('entityId');
    if (mongoose.isValidObjectId(str('actor'))) where.actor = str('actor');
    if (req.query.ok === 'false') where.ok = false;
    if (str('q')) {
      const re = { $regex: escapeRe(str('q')), $options: 'i' };
      where.$or = [{ actorEmail: re }, { summary: re }, { entityId: re }, { ip: re }];
    }
    if (str('before') && !Number.isNaN(Date.parse(str('before')))) where.at = { $lt: new Date(str('before')) };
    const [items, actions] = await Promise.all([
      AuditLog.find(where).sort({ at: -1 }).limit(limit + 1).lean(),
      AuditLog.distinct('action'),
    ]);
    const more = items.length > limit;
    res.json({ items: items.slice(0, limit), more, next: more ? items[limit - 1].at : null, actions: actions.sort() });
  }),
);

// Tóm tắt bảo mật: đăng nhập sai nhiều theo IP / tài khoản (24 giờ)
router.get(
  '/security',
  ah(async (req, res) => {
    const from = new Date(Date.now() - 86400000);
    const [byIp, byEmail, resets, deletes] = await Promise.all([
      AuditLog.aggregate([{ $match: { action: 'auth.login_failed', at: { $gte: from } } }, { $group: { _id: '$ip', n: { $sum: 1 }, last: { $max: '$at' } } }, { $sort: { n: -1 } }, { $limit: 10 }]),
      AuditLog.aggregate([{ $match: { action: 'auth.login_failed', at: { $gte: from } } }, { $group: { _id: '$actorEmail', n: { $sum: 1 }, last: { $max: '$at' } } }, { $sort: { n: -1 } }, { $limit: 10 }]),
      AuditLog.countDocuments({ action: { $in: ['auth.password_reset', 'user.password_reset'] }, at: { $gte: from } }),
      AuditLog.countDocuments({ action: { $in: ['auth.delete_account', 'user.delete'] }, at: { $gte: from } }),
    ]);
    res.json({ failedByIp: byIp, failedByEmail: byEmail, passwordResets: resets, accountDeletes: deletes });
  }),
);

// ---- Chất lượng trợ lý Nuti ----
router.get(
  '/assistant',
  ah(async (req, res) => {
    const d30 = new Date(Date.now() - 30 * 86400000);
    const [totals, byDay, downs] = await Promise.all([
      ChatMessage.aggregate([
        { $match: { role: 'assistant', createdAt: { $gte: d30 } } },
        { $group: { _id: null, n: { $sum: 1 }, ai: { $sum: { $cond: ['$ai', 1, 0] } }, up: { $sum: { $cond: [{ $eq: ['$rating', 'up'] }, 1, 0] } }, down: { $sum: { $cond: [{ $eq: ['$rating', 'down'] }, 1, 0] } }, users: { $addToSet: '$user' } } },
      ]),
      ChatMessage.aggregate([{ $match: { role: 'user', createdAt: { $gte: d30 } } }, { $group: { _id: dayOf('$createdAt'), n: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
      ChatMessage.find({ role: 'assistant', rating: 'down' }).sort({ createdAt: -1 }).limit(20).populate('user', 'name email').lean(),
    ]);
    // Câu hỏi ngay trước mỗi câu trả lời bị chê
    const questions = await Promise.all(downs.map((m) => ChatMessage.findOne({ user: m.user?._id, role: 'user', _id: { $lt: m._id } }).sort({ _id: -1 }).select('text').lean()));
    const t = totals[0];
    res.json({
      totals: t ? { answers: t.n, aiAnswers: t.ai, up: t.up, down: t.down, users: t.users.length } : { answers: 0, aiAnswers: 0, up: 0, down: 0, users: 0 },
      byDay: byDay.map((d) => ({ date: d._id, questions: d.n })),
      downvoted: downs.map((m, i) => ({ id: m._id, at: m.createdAt, user: m.user, question: questions[i]?.text ?? '', answer: m.text, ai: m.ai })),
    });
  }),
);

export default router;
