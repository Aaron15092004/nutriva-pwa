import { Metric } from '../models/index.js';

// Đo lưu lượng API: gom số request / lỗi / độ trễ theo phút × nhóm route trong bộ nhớ, mỗi phút ghi 1 lần vào DB.
// Route được chuẩn hóa (id → :id) để không tạo hàng nghìn nhóm.
const buckets = new Map(); // key `${minute}|${route}` → { count, s4xx, s5xx, sumMs, maxMs, samples[] }
const MAX_SAMPLES = 200;

// Nhóm route: ghép tiền tố thực tế của URL với mẫu route đã khớp (vd /api/orders/:id).
// Không dùng req.baseUrl: khi handler báo lỗi, Express đã trả baseUrl về rỗng trước lúc ghi số liệu.
const normalize = (req, res) => {
  const path = (req.originalUrl || req.url).split('?')[0];
  let route;
  if (typeof req.route?.path === 'string') {
    const segs = path.split('/').filter(Boolean);
    const rsegs = req.route.path.split('/').filter(Boolean);
    route = `/${[...segs.slice(0, Math.max(0, segs.length - rsegs.length)), ...rsegs].join('/')}`;
  } else if (res.statusCode === 404) {
    route = '/api/(không tồn tại)'; // không tách theo từng URL lạ (tránh phình dữ liệu khi bị quét)
  } else {
    route = `${req.baseUrl ?? ''}${req.path ?? ''}` || path; // bị chặn trước khi vào route (giới hạn tần suất, JSON lỗi...)
  }
  return `${req.method} ${route.replace(/[a-f0-9]{24}/gi, ':id').replace(/\d{4}-\d{2}-\d{2}/g, ':date')}`;
};

export function metrics(req, res, next) {
  if (!req.path.startsWith('/api') && !req.originalUrl.startsWith('/api')) return next();
  const t0 = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    const minute = Math.floor(Date.now() / 60000) * 60000;
    const key = `${minute}|${normalize(req, res)}`;
    let b = buckets.get(key);
    if (!b) buckets.set(key, (b = { count: 0, s4xx: 0, s5xx: 0, sumMs: 0, maxMs: 0, samples: [] }));
    b.count++;
    if (res.statusCode >= 500) b.s5xx++;
    else if (res.statusCode >= 400) b.s4xx++;
    b.sumMs += ms;
    b.maxMs = Math.max(b.maxMs, ms);
    if (b.samples.length < MAX_SAMPLES) b.samples.push(ms);
    else b.samples[Math.floor(Math.random() * MAX_SAMPLES)] = ms; // lấy mẫu ngẫu nhiên khi quá nhiều
  });
  next();
}

const p95 = (arr) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * 0.95))];
};

// Ghi các phút đã kết thúc vào DB
export async function flushMetrics(all = false) {
  const current = Math.floor(Date.now() / 60000) * 60000;
  const docs = [];
  for (const [key, b] of buckets) {
    const [minute, route] = key.split('|');
    if (!all && Number(minute) >= current) continue;
    docs.push({ minute: new Date(Number(minute)), route, count: b.count, s4xx: b.s4xx, s5xx: b.s5xx, sumMs: Math.round(b.sumMs), maxMs: Math.round(b.maxMs), p95: Math.round(p95(b.samples)) });
    buckets.delete(key);
  }
  if (docs.length) await Metric.insertMany(docs, { ordered: false }).catch((e) => console.error('[metrics]', e.message));
}

export function startMetricsFlush() {
  const t = setInterval(() => flushMetrics().catch(() => {}), 60_000);
  t.unref?.();
}
