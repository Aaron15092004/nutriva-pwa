// Cắt ảnh vuông ở giữa + thu nhỏ trên trình duyệt trước khi tải lên (ảnh điện thoại thường 3–10 MB)
export async function squareImage(file, size = 512, type = 'image/webp', quality = 0.85) {
  const bitmap = await createImageBitmap(file);
  const s = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  canvas.getContext('2d').drawImage(bitmap, (bitmap.width - s) / 2, (bitmap.height - s) / 2, s, s, 0, 0, size, size);
  bitmap.close?.();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, type, quality));
  if (!blob) throw new Error('Không đọc được ảnh, hãy thử ảnh khác');
  return blob;
}
