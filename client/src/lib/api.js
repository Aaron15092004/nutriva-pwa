const BASE = import.meta.env.VITE_API_URL ?? '/api';
const TOKEN_KEY = 'nutriva_token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  constructor(status, message, data = {}) {
    super(message);
    this.status = status;
    this.data = data; // toàn bộ JSON lỗi (vd code: 'NEEDS_ONBOARDING')
  }
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Server báo đang chạy bản build khác bản app này → service worker còn giữ bản cũ, báo AppBanners kiểm tra & cập nhật
let staleNotified = false;
const checkBuild = (res) => {
  const b = res.headers.get('X-App-Build');
  if (!staleNotified && b && import.meta.env.PROD && typeof __BUILD_ID__ !== 'undefined' && b !== __BUILD_ID__) {
    staleNotified = true;
    window.dispatchEvent(new Event('nutriva:stale'));
  }
};
const RETRY_STATUS = new Set([502, 503, 504]);

async function request(method, path, body, attempt = 0) {
  const headers = { 'Content-Type': 'application/json' };
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    // Đọc dữ liệu: thử lại 1 lần (mạng chập chờn, server vừa thức dậy)
    if (method === 'GET' && attempt === 0) return wait(800).then(() => request(method, path, body, 1));
    throw new ApiError(0, navigator.onLine === false ? 'Bạn đang ngoại tuyến. Kết nối mạng rồi thử lại nhé.' : 'Không kết nối được máy chủ. Vui lòng thử lại.');
  }
  if (method === 'GET' && attempt === 0 && RETRY_STATUS.has(res.status)) return wait(1200).then(() => request(method, path, body, 1));
  checkBuild(res);
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Chỉ 401 mới đăng xuất (token hết hạn / bị thu hồi). 503 = máy chủ bận tạm thời → giữ phiên.
    if (res.status === 401 && token && tokenStore.get() === token) window.dispatchEvent(new Event('nutriva:logout'));
    // Tính năng cần gói NUTRIVA → mở màn hình kích hoạt (PaywallSheet)
    if (data.code === 'MEMBERSHIP_REQUIRED') window.dispatchEvent(new CustomEvent('nutriva:paywall', { detail: { message: data.message } }));
    const fallback = res.status === 429 ? 'Bạn thao tác quá nhanh, thử lại sau ít phút' : res.status >= 500 ? 'Máy chủ đang bận, vui lòng thử lại' : 'Đã có lỗi xảy ra';
    throw new ApiError(res.status, data.message ?? fallback, data);
  }
  // Ghi thành công → báo cho cache GET (useApi) biết dữ liệu có thể đã cũ
  if (method !== 'GET' && !/\/(quote|events|hit)$/.test(path)) window.dispatchEvent(new Event('nutriva:mutated'));
  return data;
}

// Gửi file (multipart) kèm token đăng nhập
async function upload(path, file, field = 'file', filename) {
  const body = new FormData();
  body.append(field, file, filename ?? file.name ?? 'upload');
  const token = tokenStore.get();
  let res;
  try {
    res = await fetch(`${BASE}${path}`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body });
  } catch {
    throw new ApiError(0, 'Không có kết nối mạng. Vui lòng thử lại.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.message ?? 'Tải lên thất bại');
  return data;
}

export const api = {
  upload,
  get: (p) => request('GET', p),
  post: (p, b) => request('POST', p, b ?? {}),
  put: (p, b) => request('PUT', p, b ?? {}),
  patch: (p, b) => request('PATCH', p, b ?? {}),
  del: (p) => request('DELETE', p),
};
