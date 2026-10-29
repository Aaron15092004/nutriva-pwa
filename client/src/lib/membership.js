import { useApi, invalidate } from './useApi.js';

// Trạng thái gói sử dụng (dùng chung cache /membership)
export function useMembership() {
  const { data, reload, setData, loading } = useApi('/membership');
  return { m: data?.membership ?? null, history: data?.history ?? [], reload, setData, loading };
}

// Mở màn hình mời kích hoạt từ bất kỳ đâu
export const openPaywall = (message) => window.dispatchEvent(new CustomEvent('nutriva:paywall', { detail: { message } }));

// Sau khi kích hoạt / gia hạn: các trang kế hoạch & nhắc nhở cần tải lại
export const refreshLocked = () => {
  for (const prefix of ['/membership', '/plan', '/meal-plans', '/reminders']) invalidate(prefix);
};

// member | expired (từng có gói) | trial (còn ngày dùng thử) | over (hết dùng thử, chưa từng kích hoạt)
export const memberState = (m) => (m?.member ? 'member' : m?.until ? 'expired' : m?.trialLeft > 0 ? 'trial' : 'over');

export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '');
