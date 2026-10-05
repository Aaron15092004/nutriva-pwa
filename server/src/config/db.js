import mongoose from 'mongoose';

let memoryServer;

export async function connectDB() {
  let uri = process.env.MONGODB_URI;

  if (!uri) {
    if (process.env.NODE_ENV === 'production') throw new Error('Thiếu MONGODB_URI — cấu hình chuỗi kết nối MongoDB Atlas trong .env');
    // Chỉ dùng khi phát triển: MongoDB trong bộ nhớ (dữ liệu mất khi tắt server)
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    memoryServer = await MongoMemoryServer.create();
    uri = memoryServer.getUri('nutriva');
    console.warn('[db] MONGODB_URI chưa được đặt — đang dùng MongoDB TẠM trong bộ nhớ. Xem docs/MONGODB_ATLAS.md để kết nối Atlas.');
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  console.log(`[db] Đã kết nối MongoDB: ${mongoose.connection.host}/${mongoose.connection.name}`);
}

export async function disconnectDB() {
  await mongoose.disconnect();
  if (memoryServer) await memoryServer.stop();
}
