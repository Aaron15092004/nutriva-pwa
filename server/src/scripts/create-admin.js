// Tạo (hoặc nâng quyền) tài khoản admin.
// Dùng: npm run create-admin -w server -- <email> <mật khẩu> [tên]
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { connectDB, disconnectDB } from '../config/db.js';
import { User } from '../models/index.js';

const [email, password, name = 'Quản trị viên'] = process.argv.slice(2);
if (!email || !password || password.length < 6) {
  console.error('Cách dùng: npm run create-admin -w server -- <email> <mật khẩu ≥ 6 ký tự> [tên]');
  process.exit(1);
}
if (!process.env.MONGODB_URI) {
  console.error('Cần đặt MONGODB_URI trong server/.env trước (xem docs/MONGODB_ATLAS.md).');
  process.exit(1);
}

await connectDB();
const passwordHash = await bcrypt.hash(password, 10);
const existing = await User.findOne({ email: email.toLowerCase() });
if (existing) {
  existing.role = 'admin';
  existing.passwordHash = passwordHash;
  await existing.save();
  console.log(`✔ Đã nâng quyền admin và đặt lại mật khẩu cho ${email}`);
} else {
  await User.create({
    email,
    passwordHash,
    name,
    role: 'admin',
    consentAt: new Date(),
    // Hồ sơ mặc định để tài khoản admin vẫn dùng được phần app người dùng
    profile: { gender: 'female', age: 30, heightCm: 160, weightKg: 55, waistCm: 70 },
  });
  console.log(`✔ Đã tạo tài khoản admin ${email}`);
}
await disconnectDB();
