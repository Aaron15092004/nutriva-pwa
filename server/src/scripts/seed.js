// Nạp dữ liệu khởi tạo lên MongoDB (Atlas) rồi thoát — không mở cổng server.
// Dùng: npm run seed -w server
// An toàn khi chạy lại: chỉ nạp collection còn trống, chỉ bổ sung ảnh còn thiếu.
import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../config/db.js';
import { seedIfEmpty } from '../seed.js';
import { initPush } from '../services/push.js';

if (!process.env.MONGODB_URI) {
  console.error('Thiếu MONGODB_URI trong server/.env (xem docs/MONGODB_ATLAS.md).');
  process.exit(1);
}

await connectDB();
await seedIfEmpty();
await initPush();

const names = ['products', 'foods', 'dishes', 'activities', 'coupons', 'settings', 'users'];
for (const n of names) {
  const count = await mongoose.connection.db.collection(n).countDocuments();
  console.log(`  ${n.padEnd(11)} ${count}`);
}
await disconnectDB();
console.log('✔ Đã đồng bộ dữ liệu khởi tạo lên database.');
