import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import compression from 'compression';
import mongoose from 'mongoose';
import { connectDB } from './config/db.js';
import { seedIfEmpty } from './seed.js';
import { initPush, getPublicKey } from './services/push.js';
import { startScheduler } from './services/scheduler.js';
import { ah, HttpError } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import logRoutes from './routes/logs.js';
import planRoutes from './routes/plan.js';
import mealPlanRoutes from './routes/meal-plans.js';
import shopRoutes from './routes/shop.js';
import careRoutes from './routes/care.js';
import adminRoutes from './routes/admin.js';

const isProd = process.env.NODE_ENV === 'production';
if (!process.env.JWT_SECRET) {
  if (isProd) throw new Error('Thiếu JWT_SECRET trong môi trường production');
  process.env.JWT_SECRET = 'nutriva-dev-secret';
}

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
const origins = (process.env.CLIENT_ORIGIN ?? '').split(',').map((s) => s.trim()).filter(Boolean);
app.use(cors({ origin: origins.length ? origins : true }));
app.use(compression());
app.use(express.json({ limit: '200kb' }));

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

app.use('/api/auth', authRoutes);
app.use('/api/plan', planRoutes);
app.use('/api/meal-plans', mealPlanRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', shopRoutes);
app.use('/api', logRoutes);
app.use('/api', careRoutes);
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
  if (err.name === 'ValidationError') {
    const first = Object.values(err.errors ?? {})[0];
    return res.status(400).json({ message: `Dữ liệu không hợp lệ: ${first?.path ?? ''}`, details: err.message });
  }
  if (err.name === 'CastError') return res.status(400).json({ message: 'Mã không hợp lệ' });
  if (err.code === 11000) return res.status(409).json({ message: `Giá trị đã tồn tại: ${Object.keys(err.keyValue ?? {}).join(', ')}` });
  if (err.name === 'MulterError') return res.status(400).json({ message: 'Ảnh quá lớn (tối đa 3 MB)' });
  const status = err.status ?? 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ message: status >= 500 ? 'Lỗi máy chủ, vui lòng thử lại' : err.message });
});

const PORT = process.env.PORT ?? 5000;
await connectDB();
await seedIfEmpty();
await initPush();
startScheduler();
app.listen(PORT, () => console.log(`[api] NUTRIVA server chạy tại http://localhost:${PORT}`));
