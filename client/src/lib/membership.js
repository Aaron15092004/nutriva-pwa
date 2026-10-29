import { useState } from 'react';
import { useApi, invalidate } from './useApi.js';
import { api } from './api.js';

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

// member | expired (từng có gói) | trial (đang dùng thử) | new (chưa kích hoạt dùng thử) | over (hết dùng thử)
export const memberState = (m) => {
  if (m?.member) return 'member';
  if (m?.until) return 'expired';
  if (m?.trialLeft > 0) return 'trial';
  if (m?.trialAvailable) return 'new';
  return 'over';
};

// Nút "Kích hoạt dùng thử": gọi server (mỗi tài khoản 1 lần) rồi mở khóa kế hoạch ngay
export function useStartTrial() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const start = async () => {
    setBusy(true);
    setError('');
    try {
      const r = await api.post('/membership/trial');
      refreshLocked();
      window.dispatchEvent(new CustomEvent('nutriva:trial', { detail: r }));
      return r;
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setBusy(false);
    }
  };
  return { start, busy, error };
}

export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '');
