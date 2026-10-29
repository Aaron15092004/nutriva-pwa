import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { connectDB, disconnectDB } from './config/db.js';
import { seedIfEmpty } from './seed.js';
import { runMigrations } from './migrations/index.js';
import { initPush, getPublicKey } from './services/push.js';
import { startScheduler, schedulerTick } from './services/scheduler.js';
import { watchCacheVersion } from './services/catalog.js';
import { CLIENT_EVENTS, track } from './services/events.js';
import { metrics, flushMetrics, startMetricsFlush } from './middleware/metrics.js';
import { apiLimiter, eventsLimiter } from './middleware/limits.js';
import { ah, HttpError } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import logRoutes from './routes/logs.js';
import planRoutes from './routes/plan.js';
import mealPlanRoutes from './routes/meal-plans.js';
import shopRoutes from './routes/shop.js';
import careRoutes from './routes/care.js';
import adminRoutes from './routes/admin.js';
import insightRoutes from './routes/insights.js';
import membershipRoutes from './routes/membership.js';
import inventoryRoutes from './routes/inventory.js';

const isProd = process.env.NODE_ENV === 'production';
if (!process.env.JWT_SECRET) {
  if (isProd) throw new Error('Thiếu JWT_SECRET trong môi trường production');
  process.env.JWT_SECRET = 'nutriva-dev-secret';
}

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

// Header bảo mật + CSP: chỉ cho tải script/khung từ chính app và Google Sign-In
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://accounts.google.com/gsi/client'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://accounts.google.com/gsi/style'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        fontSrc: ["'self'", 'data:'],
        connectSrc: ["'self'", 'https://accounts.google.com/gsi/'],
        frameSrc: ['https://accounts.google.com/gsi/'],
        workerSrc: ["'self'", 'blob:'],
        manifestSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: isProd ? [] : null,
      },
    },
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' }, // popup Google Sign-In
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'same-site' },
  }),
);

// CORS: production chạy chung 1 domain → chỉ mở cho các origin khai báo trong CLIENT_ORIGIN
const origins = (process.env.CLIENT_ORIGIN ?? '').split(',').map((s) => s.trim()).filter(Boolean);
app.use(cors({ origin: origins.length ? origins : !isProd }));
app.use(compression());
app.use(metrics);
app.use(express.json({ limit: '200kb' }));
app.use('/api', apiLimiter);

app.get('/api/health', (req, res) => res.json({ ok: true, db: mongoose.connection.readyState === 1 }));

// Ảnh upload từ trang Admin (MongoDB GridFS)
app.get(
  '/api/files/:id',
  ah(async (req, res) => {
    let id;
    try {
      id = new mongoose.Types.ObjectId(req.params.id);
    } catch {
      throw new HttpError(404, 'Không tìm thấy ảnh');
    }
    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'uploads' });
    const [file] = await bucket.find({ _id: id }).toArray();
    if (!file) throw new HttpError(404, 'Không tìm thấy ảnh');
    res.set('Content-Type', file.metadata?.contentType ?? 'application/octet-stream');
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    bucket.openDownloadStream(id).pipe(res);
  }),
);

// Khóa công khai VAPID (không cần đăng nhập)
app.get('/api/push/public-key', ah(async (req, res) => res.json({ publicKey: await getPublicKey() })));

// Sự kiện thống kê từ client (mở app, cài app, phễu onboarding...). Đăng nhập không bắt buộc.
app.post(
  '/api/events',
  eventsLimiter,
  ah(async (req, res) => {
    const list = (Array.isArray(req.body?.events) ? req.body.events : [req.body]).slice(0, 20);
    let user = null;
    const header = req.headers.authorization ?? '';
    if (header.startsWith('Bearer ')) {
      try {
        user = jwt.verify(header.slice(7), process.env.JWT_SECRET).sub;
      } catch {
        /* token hết hạn: ghi như khách */
      }
    }
    const anon = typeof req.body?.anon === 'string' ? req.body.anon.slice(0, 40) : undefined;
    const standalone = req.body?.standalone === true;
    await Promise.all(
      list
        .filter((e) => CLIENT_EVENTS.has(e?.type))
        .map((e) => {
          const props = e.props && typeof e.props === 'object' ? Object.fromEntries(Object.entries(e.props).slice(0, 8).map(([k, v]) => [k.slice(0, 30), typeof v === 'string' ? v.slice(0, 60) : typeof v === 'number' || typeof v === 'boolean' ? v : null])) : undefined;
          return track(e.type, { user, anon, props: { ...props, standalone }, req });
        }),
    );
    res.status(204).end();
  }),
);

// Cron bên ngoài (vd cron-job.org gọi mỗi 5–10 phút): giữ nhắc nhở & gói định kỳ chạy đúng giờ khi server miễn phí bị "ngủ".
// Header: Authorization: Bearer <CRON_SECRET>
app.post(
  '/api/cron/tick',
  ah(async (req, res) => {
    const secret = process.env.CRON_SECRET;
    const given = (req.headers.authorization ?? '').replace(/^Bearer /, '');
    const ok = secret && given.length === secret.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(secret));
    if (!ok) throw new HttpError(401, 'Sai CRON_SECRET');
    res.json({ ok: true, ...(await schedulerTick()) });
  }),
);

app.use('/api/auth', authRoutes);
app.use('/api/plan', planRoutes);
app.use('/api/meal-plans', mealPlanRoutes);
app.use('/api/admin/insights', insightRoutes);
app.use('/api/admin/inventory', inventoryRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', shopRoutes);
app.use('/api', logRoutes);
app.use('/api', careRoutes);
app.use('/api', membershipRoutes);
app.use('/api', (req, res) => res.status(404).json({ message: 'Không tìm thấy API' }));

// Phục vụ bản build của client (production: chạy chung 1 server)
const clientDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
if (fs.existsSync(clientDist)) {
  // File có hash trong tên (assets/) cache 1 năm; còn lại (index.html, sw.js, manifest) luôn kiểm tra lại
  app.use(
    express.static(clientDist, {
      index: false,
      setHeaders: (res, file) => {
        if (file.includes(`${path.sep}assets${path.sep}`)) res.set('Cache-Control', 'public, max-age=31536000, immutable');
        else if (/\.(webp|png|svg|jpg|woff2)$/.test(file)) res.set('Cache-Control', 'public, max-age=604800');
        else res.set('Cache-Control', 'no-cache');
      },
    }),
  );
  app.get('*', (req, res) => res.sendFile(path.join(clientDist, 'index.html'), { headers: { 'Cache-Control': 'no-cache' } }));
}

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ message: 'Dữ liệu gửi lên không đúng định dạng' });
  if (err.type === 'entity.too.large') return res.status(413).json({ message: 'Dữ liệu gửi lên quá lớn' });
  if (err.name === 'ValidationError') {
    const first = Object.values(err.errors ?? {})[0];
    return res.status(400).json({ message: `Dữ liệu không hợp lệ: ${first?.path ?? ''}`, details: err.message });
  }
  if (err.name === 'CastError') return res.status(400).json({ message: 'Mã không hợp lệ' });
  if (err.code === 11000) return res.status(409).json({ message: `Giá trị đã tồn tại: ${Object.keys(err.keyValue ?? {}).join(', ')}` });
  if (err.name === 'MulterError') return res.status(400).json({ message: 'Ảnh quá lớn (tối đa 3 MB)' });
  // Mất kết nối DB tạm thời → 503 (client hiện "thử lại", không đăng xuất)
  if (/MongoNetwork|MongoServerSelection|MongoNotConnected/.test(err.name ?? '')) {
    console.error('[db]', err.message);
    return res.status(503).json({ message: 'Máy chủ đang bận, vui lòng thử lại sau giây lát' });
  }
  const status = err.status ?? 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ message: status >= 500 ? 'Lỗi máy chủ, vui lòng thử lại' : err.message, ...(err.code === 'MEMBERSHIP_REQUIRED' ? { code: err.code } : {}) });
});

const PORT = process.env.PORT ?? 5000;
await connectDB();
// Seed trước (DB mới: nạp đủ dữ liệu mẫu), migration sau (DB cũ: bổ sung phần còn thiếu — đều chạy lại an toàn)
await seedIfEmpty();
await runMigrations();
await initPush();
startScheduler();
startMetricsFlush();
watchCacheVersion();
const server = app.listen(PORT, () => console.log(`[api] NUTRIVA server chạy tại http://localhost:${PORT}`));

// Tắt êm (Render gửi SIGTERM khi deploy/ngủ): ngừng nhận request, ghi nốt số liệu lưu lượng, đóng DB
let closing = false;
async function shutdown(signal) {
  if (closing) return;
  closing = true;
  console.log(`[api] ${signal} — đang tắt...`);
  const force = setTimeout(() => process.exit(0), 10_000);
  force.unref();
  server.close();
  await flushMetrics(true).catch(() => {});
  await disconnectDB().catch(() => {});
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
