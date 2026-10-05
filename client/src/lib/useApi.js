import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { api } from './api.js';

// Cache dữ liệu GET trong bộ nhớ (stale-while-revalidate):
// - Mở lại trang đã xem → hiện ngay dữ liệu cũ, tải bản mới ở nền (không nháy skeleton).
// - Gộp các request trùng nhau đang chạy.
// - prefetch() để tải trước dữ liệu của tab người dùng sắp mở.
const cache = new Map(); // path → { data, at }
const inflight = new Map(); // path → Promise
const listeners = new Map(); // path → Set(callback) — chỉ báo cho component dùng đúng path
const FRESH_MS = 15_000; // trong khoảng này không tải lại khi mở trang
const emit = (path) => {
  if (path) listeners.get(path)?.forEach((l) => l());
  else listeners.forEach((set) => set.forEach((l) => l()));
};

function fetchPath(path) {
  if (inflight.has(path)) return inflight.get(path);
  const p = api
    .get(path)
    .then((data) => {
      cache.set(path, { data, at: Date.now() });
      emit(path);
      return data;
    })
    .finally(() => inflight.delete(path));
  inflight.set(path, p);
  return p;
}

export function prefetch(path) {
  const c = cache.get(path);
  if (c && Date.now() - c.at < FRESH_MS) return;
  fetchPath(path).catch(() => {});
}

// Xóa cache theo tiền tố (vd sau khi đổi kế hoạch: invalidate('/meal-plans'))
export function invalidate(prefix = '') {
  for (const k of cache.keys()) if (k.startsWith(prefix)) cache.delete(k);
}
export const clearApiCache = () => {
  cache.clear();
  emit();
};

// Sau mỗi lần ghi: giữ dữ liệu để hiển thị tức thì nhưng đánh dấu cần tải lại khi mở trang
if (typeof window !== 'undefined') {
  window.addEventListener('nutriva:mutated', () => {
    for (const v of cache.values()) v.at = 0;
  });
}

const subscribeTo = (path) => (l) => {
  if (!path) return () => {};
  if (!listeners.has(path)) listeners.set(path, new Set());
  listeners.get(path).add(l);
  return () => listeners.get(path)?.delete(l);
};

// Tải dữ liệu GET; path = null để tạm dừng.
export function useApi(path) {
  const subscribe = useMemo(() => subscribeTo(path), [path]);
  const entry = useSyncExternalStore(subscribe, () => (path ? cache.get(path) : undefined));
  const [state, setState] = useState({ error: null, loading: false });

  const load = useCallback(async () => {
    if (!path) return;
    setState({ error: null, loading: true });
    try {
      await fetchPath(path);
      setState({ error: null, loading: false });
    } catch (e) {
      setState({ error: e.message, loading: false });
    }
  }, [path]);

  useEffect(() => {
    if (!path) return;
    const c = cache.get(path);
    if (c && Date.now() - c.at < FRESH_MS) return;
    load();
  }, [path, load]);

  // Cập nhật cục bộ (sau khi ghi) — cũng ghi vào cache để các trang khác thấy ngay
  const setData = useCallback(
    (updater) => {
      if (!path) return;
      const prev = cache.get(path)?.data ?? null;
      cache.set(path, { data: typeof updater === 'function' ? updater(prev) : updater, at: Date.now() });
      emit(path);
    },
    [path],
  );

  const data = entry?.data ?? null;
  return {
    data,
    error: data ? null : state.error,
    // Chỉ coi là "đang tải" khi chưa có dữ liệu nào để hiển thị
    loading: Boolean(path) && !data && (state.loading || inflight.has(path) || !state.error),
    refreshing: Boolean(data) && state.loading,
    reload: load,
    setData,
  };
}
