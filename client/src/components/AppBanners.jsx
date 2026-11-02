import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { WifiOff, Sparkles, X } from 'lucide-react';
import { pendingCount, flushOutbox } from '../lib/outbox.js';

function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

function usePending() {
  const [n, setN] = useState(pendingCount);
  useEffect(() => {
    const sync = () => setN(pendingCount());
    window.addEventListener('nutriva:outbox', sync);
    return () => window.removeEventListener('nutriva:outbox', sync);
  }, []);
  return n;
}

// Đang gõ dở / đang mở hộp thoại → không tự tải lại (mất dữ liệu đang nhập)
const busy = () => {
  const el = document.activeElement;
  return Boolean((el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) || document.querySelector('[role="dialog"]'));
};

// Thanh thông báo trên cùng: mất mạng (kèm số thao tác đang chờ gửi) và có phiên bản app mới.
// Bản mới được áp dụng tự động vào lúc an toàn: vừa mở app (< 20 giây), khi chuyển trang, hoặc khi app bị ẩn (chuyển sang app khác);
// chỉ hiện nút "Cập nhật" khi người dùng đang gõ dở.
export default function AppBanners() {
  const online = useOnline();
  const pending = usePending();
  const { pathname } = useLocation();
  const [dismissed, setDismissed] = useState(false);
  const loadedAt = useRef(Date.now());
  const regRef = useRef(null);
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(url, reg) {
      if (!reg) return;
      regRef.current = reg;
      const check = () => reg.update().catch(() => {});
      // PWA trên điện thoại ít khi đóng hẳn: kiểm tra bản mới mỗi 15 phút, khi mở lại app và khi có mạng lại
      setInterval(check, 15 * 60 * 1000);
      document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check());
      window.addEventListener('online', check);
    },
  });

  // Server báo đang chạy bản khác (X-App-Build) → kiểm tra bản mới ngay
  useEffect(() => {
    const onStale = () => regRef.current?.update().catch(() => {});
    window.addEventListener('nutriva:stale', onStale);
    // Nút "Kiểm tra bản mới" (Cài đặt): tìm bản mới; có thì cập nhật ngay, không có thì tải lại trang cho chắc
    const onCheck = async () => {
      const reg = regRef.current;
      try {
        await reg?.update();
      } catch {
        /* mất mạng */
      }
      if (reg?.waiting) updateServiceWorker(true);
      else window.location.reload();
    };
    window.addEventListener('nutriva:check-update', onCheck);
    return () => {
      window.removeEventListener('nutriva:stale', onStale);
      window.removeEventListener('nutriva:check-update', onCheck);
    };
  }, [updateServiceWorker]);

  useEffect(() => {
    if (online) flushOutbox();
  }, [online]);

  // Có bản mới: vừa mở app → áp dụng ngay; đang dùng dở → chờ chuyển trang hoặc app bị ẩn (vẫn hiện nút "Cập nhật")
  useEffect(() => {
    if (!needRefresh) return undefined;
    if (Date.now() - loadedAt.current < 20000 && !busy()) {
      updateServiceWorker(true);
      return undefined;
    }
    const onHide = () => document.visibilityState === 'hidden' && updateServiceWorker(true);
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [needRefresh, updateServiceWorker]);

  // Chuyển trang = lúc an toàn để nạp bản mới
  const firstPath = useRef(pathname);
  useEffect(() => {
    if (needRefresh && pathname !== firstPath.current && !busy()) updateServiceWorker(true);
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[90] flex flex-col items-center gap-2 px-4 pt-[max(8px,env(safe-area-inset-top))]">
      {!online && (
        <div role="status" className="pointer-events-auto flex max-w-md items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-lg">
          <WifiOff size={16} aria-hidden="true" />
          <span>Bạn đang ngoại tuyến{pending ? ` — ${pending} thay đổi sẽ được gửi khi có mạng` : ''}</span>
        </div>
      )}
      {online && pending > 0 && (
        <div role="status" className="pointer-events-auto rounded-full bg-brand-light px-4 py-2 text-sm font-semibold text-brand-deep shadow">
          Đang đồng bộ {pending} thay đổi…
        </div>
      )}
      {needRefresh && !dismissed && (
        <div role="alert" className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl bg-white p-3 pl-4 shadow-lg ring-1 ring-border">
          <Sparkles size={20} className="shrink-0 text-brand-main" aria-hidden="true" />
          <p className="flex-1 text-sm font-semibold text-primary">NUTRIVA có phiên bản mới</p>
          <button type="button" className="h-10 rounded-full bg-brand-dark px-4 text-sm font-bold text-white" onClick={() => updateServiceWorker(true)}>
            Cập nhật
          </button>
          <button type="button" aria-label="Để sau" className="grid size-10 place-items-center rounded-full text-subtle" onClick={() => setDismissed(true)}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
