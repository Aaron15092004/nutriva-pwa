import mongoose from 'mongoose';
import multer from 'multer';
import { Readable } from 'node:stream';

// Lưu file ảnh vào MongoDB GridFS (bucket "uploads"), phục vụ qua GET /api/files/:id
const bucket = () => new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'uploads' });

export const imageUpload = (maxMb = 3) =>
  multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxMb * 1024 * 1024 },
    fileFilter: (req, file, cb) => cb(null, /^image\/(png|jpe?g|webp|gif|avif)$/.test(file.mimetype)),
  });

export async function saveImage(file, meta = {}) {
  const id = await new Promise((resolve, reject) => {
    const stream = bucket().openUploadStream(file.originalname || 'image', { metadata: { contentType: file.mimetype, ...meta } });
    Readable.from(file.buffer).pipe(stream).on('error', reject).on('finish', () => resolve(stream.id));
  });
  return `/api/files/${id}`;
}

// Xóa file nếu URL trỏ vào GridFS của mình (bỏ qua ảnh tĩnh / URL ngoài)
export async function deleteImage(url) {
  const m = /^\/api\/files\/([a-f0-9]{24})$/.exec(url ?? '');
  if (!m) return;
  await bucket()
    .delete(new mongoose.Types.ObjectId(m[1]))
    .catch(() => {});
}
