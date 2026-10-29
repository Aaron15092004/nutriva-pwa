import { tokenStore } from './api.js';

// Thống kê sử dụng ẩn danh (phễu onboarding, mở app, cài app…) → /api/events. Gom nhiều sự kiện gửi 1 lần.
const BASE = import.meta.env.VITE_API_URL ?? '/api';
const ANON_KEY = 'nutriva_anon';
const OPEN_KEY = 'nutriva_open_day';
const queue = [];
let timer = null;

const safe = (fn, fallback) => {
  try {
    return fn();
  } catch {
    return fallback;
  }
};

// Mã ngẫu nhiên của thiết bị (không chứa thông tin cá nhân) — nối phễu trước & sau khi đăng ký
export const anonId = () =>
  safe(() => {
    let id = localStorage.getItem(ANON_KEY);
    if (!id) {
      id = crypto.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(ANON_KEY, id);
    }
    return id;
  }, undefined);

const standalone = () => safe(() => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true, false);

function flush(beacon = false) {
  clearTimeout(timer);
  timer = null;
  if (!queue.length) return;
  const body = JSON.stringify({ anon: anonId(), standalone: standalone(), events: queue.splice(0, 20) });
  const token = tokenStore.get();
  // Không có token: dùng sendBeacon (vẫn gửi được khi đóng tab)
  if (beacon && !token && navigator.sendBeacon) {
    navigator.sendBeacon(`${BASE}/events`, new Blob([body], { type: 'application/json' }));
    return;
  }
  fetch(`${BASE}/events`, {
    method: 'POST',
    keepalive: true,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body,
  }).catch(() => {});
}

export function track(type, props) {
  queue.push(props ? { type, props } : { type });
  if (queue.length >= 10) flush();
  else timer ??= setTimeout(flush, 3000);
}

// Mở app: tối đa 1 lần/ngày/thiết bị (tính người dùng hoạt động hằng ngày)
export function trackOpen() {
  const today = new Date().toLocaleDateString('en-CA');
  if (safe(() => localStorage.getItem(OPEN_KEY), null) === today) return;
  safe(() => localStorage.setItem(OPEN_KEY, today));
  track('app.open');
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => flush(true));
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flush(true));
  window.addEventListener('appinstalled', () => track('app.install'));
}
