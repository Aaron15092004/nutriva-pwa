import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { MembershipGrant } from '../models/index.js';
import { ah, requireAuth } from '../middleware/auth.js';
import { status, redeem, startTrial } from '../services/membership.js';
import { audit } from '../services/audit.js';
import { track } from '../services/events.js';

const router = Router();
router.use(requireAuth);

// Chống dò mã: mỗi tài khoản tối đa 10 lần nhập SAI mỗi giờ (nhập đúng không bị tính)
const redeemLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: process.env.NODE_ENV === 'production' ? 10 : 100,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req) => `redeem:${req.user._id}`,
  message: { message: 'Bạn nhập sai mã quá nhiều lần, vui lòng thử lại sau 1 giờ' },
});

router.get(
  '/membership',
  ah(async (req, res) => {
    const history = await MembershipGrant.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(20).select('days source ref note createdAt untilAfter').lean();
    res.json({ membership: await status(req.user), history });
  }),
);

// Người dùng tự bấm "Kích hoạt dùng thử" (mỗi tài khoản 1 lần)
router.post(
  '/membership/trial',
  ah(async (req, res) => {
    const user = await startTrial(req.user);
    await audit(req, 'membership.trial', { entity: 'User', entityId: user._id, summary: 'Kích hoạt dùng thử' });
    track('membership.trial', { user, req });
    res.json({ membership: await status(user), trialStart: user.membership.trialStart });
  }),
);

router.post(
  '/membership/redeem',
  redeemLimiter,
  ah(async (req, res) => {
    try {
      const r = await redeem(req.user, req.body?.code);
      await audit(req, 'membership.redeem', { entity: 'User', entityId: req.user._id, summary: `+${r.days} ngày` });
      track('membership.redeem', { user: req.user, req, props: { days: r.days, via: req.body?.via === 'qr' ? 'qr' : 'manual' } });
      req.user.membership = { ...(req.user.membership?.toObject?.() ?? {}), until: r.until };
      res.json({ days: r.days, reward: r.reward, until: r.until, membership: await status(req.user) });
    } catch (e) {
      await audit(req, 'membership.redeem_failed', { ok: false, entity: 'User', entityId: req.user._id, summary: e.message?.slice(0, 120) });
      throw e;
    }
  }),
);

export default router;
