import { api, ApiError } from './api.js';

// Hàng đợi offline cho thao tác ghi nhật ký (thêm món, nước, vận động).
// Mất mạng → lưu vào máy, có mạng lại → gửi lần lượt. Mỗi thao tác mang `cid` riêng nên gửi lại không bị ghi trùng.
const KEY = 'nutriva_outbox';
const MAX_ITEMS = 100;
let flushing = null;

const read = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? [];
  } catch {
    return [];
  }
};
const write = (list) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX_ITEMS)));
  } catch {
    /* bộ nhớ đầy / bị chặn */
  }
  window.dispatchEvent(new Event('nutriva:outbox'));
};

export const newCid = () => crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
export const pendingCount = () => read().length;
export const clearOutbox = () => write([]);

// Gửi ngay; mất mạng thì xếp hàng và trả về { queued: true } để giao diện cập nhật tạm thời
export async function sendOrQueue(path, body) {
  const payload = { ...body, cid: body.cid ?? newCid() };
  try {
    return await api.post(path, payload);
  } catch (e) {
    if (!(e instanceof ApiError) || e.status !== 0) throw e;
    write([...read(), { path, body: payload, at: Date.now() }]);
    return { queued: true, cid: payload.cid };
  }
}

export function flushOutbox() {
  flushing ??= (async () => {
    let list = read();
    while (list.length) {
      const [job] = list;
      try {
        await api.post(job.path, job.body);
      } catch (e) {
        // Còn mất mạng / máy chủ bận → dừng, thử lại lần sau. Lỗi dữ liệu (4xx) → bỏ thao tác đó.
        if (e instanceof ApiError && (e.status === 0 || e.status >= 500 || e.status === 429 || e.status === 401)) break;
      }
      list = read().filter((j) => j.body.cid !== job.body.cid);
      write(list);
    }
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => flushOutbox());
  // Mở app khi đã có mạng: gửi nốt phần còn tồn
  if (navigator.onLine) setTimeout(() => flushOutbox(), 2000);
}
