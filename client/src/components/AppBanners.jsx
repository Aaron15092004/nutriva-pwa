import { useEffect, useState } from 'react';
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

// Thanh thông báo trên cùng: mất mạng (kèm số thao tác đang chờ gửi) và có phiên bản app mới
export default function AppBanners() {
  const online = useOnline();
  const pending = usePending();
  const [dismissed, setDismissed] = useState(false);
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    // App mở lâu (PWA ít khi đóng hẳn): kiểm tra bản mới mỗi giờ
    onRegisteredSW(url, reg) {
      if (reg) setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
    },
  });

  useEffect(() => {
    if (online) flushOutbox();
  }, [online]);

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
