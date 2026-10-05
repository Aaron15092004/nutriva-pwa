const BASE = import.meta.env.VITE_API_URL ?? '/api';
const TOKEN_KEY = 'nutriva_token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError(0, 'Không có kết nối mạng. Vui lòng thử lại.');
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token) window.dispatchEvent(new Event('nutriva:logout'));
    throw new ApiError(res.status, data.message ?? 'Đã có lỗi xảy ra');
  }
  // Ghi thành công → báo cho cache GET (useApi) biết dữ liệu có thể đã cũ
  if (method !== 'GET') window.dispatchEvent(new Event('nutriva:mutated'));
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
