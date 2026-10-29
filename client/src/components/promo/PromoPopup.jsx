import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { X, ChevronRight } from 'lucide-react';
import { useApi } from '../../lib/useApi.js';
import { track } from '../../lib/track.js';
import { useAuth } from '../../context/AuthContext.jsx';
import ChannelLinks from './ChannelLinks.jsx';
import { SmartLink } from './PromoCarousel.jsx';
import { markAdShown } from './AdInterstitial.jsx';

const SEEN_KEY = 'nutriva_popup_seen';
const PAGES = ['/', '/shop', '/plan', '/track'];
const NEW_ACCOUNT_MS = 30 * 60 * 1000; // vừa đăng ký xong thì chưa làm phiền

const readSeen = () => {
  try {
    return Number(localStorage.getItem(SEEN_KEY) ?? 0);
  } catch {
    return Date.now(); // không lưu được → coi như đã xem, tránh hiện mỗi lần mở
  }
};

// Popup quảng cáo khi mở app: link gian hàng Shopee / TikTok Shop / Facebook… + nút mua trong app.
// Tối đa 1 lần mỗi `everyHours` (admin cấu hình) trên mỗi thiết bị, chỉ ở các tab chính, không chen ngang khi đang mở sheet.
export default function PromoPopup() {
  const { user } = useAuth();
  const { pathname, search } = useLocation();
  const preview = new URLSearchParams(search).get('preview') === 'popup'; // admin xem trước: bỏ qua giới hạn tần suất
  const { data } = useApi('/shop/config');
  const popup = data?.popup;
  const [open, setOpen] = useState(false);
  const dialog = useRef(null);

  useEffect(() => {
    if (!popup || open || !PAGES.includes(pathname)) return undefined;
    if (preview) {
      const t = setTimeout(() => setOpen(true), 600);
      return () => clearTimeout(t);
    }
    if (user?.createdAt && Date.now() - new Date(user.createdAt) < NEW_ACCOUNT_MS) return undefined;
    if (Date.now() - readSeen() < (popup.everyHours ?? 24) * 3600 * 1000) return undefined;
    let timer;
    const tryOpen = () => {
      // Đang mở sheet/hộp thoại khác → đợi thêm
      if (document.body.style.overflow === 'hidden') timer = setTimeout(tryOpen, 3000);
      else setOpen(true);
    };
    timer = setTimeout(tryOpen, 3500);
    return () => clearTimeout(timer);
  }, [popup, pathname, open, user?.createdAt, preview]);

  useEffect(() => {
    if (!open) return undefined;
    try {
      localStorage.setItem(SEEN_KEY, String(Date.now()));
    } catch {
      /* bộ nhớ bị chặn */
    }
    track('popup.view');
    markAdShown();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.focus();
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!open || !popup) return null;
  const close = () => setOpen(false);
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-primary/60 p-4 pb-[calc(16px+var(--safe-b))] backdrop-blur-[2px] animate-[fade_0.2s_ease] sm:items-center" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="popup-title" tabIndex={-1} className="ad-pop relative max-h-[90dvh] w-full max-w-sm overflow-y-auto rounded-2xl bg-background shadow-float outline-none">
        <button type="button" onClick={close} aria-label="Đóng" className="absolute right-3 top-3 z-10 grid size-11 place-items-center rounded-full bg-primary/55 text-white backdrop-blur-sm">
          <X size={20} aria-hidden="true" />
        </button>
        {popup.image && (
          <div className="relative">
            <img src={popup.image} alt="" className="aspect-[16/9] w-full object-cover" />
            {popup.imageCredit && <span className="absolute bottom-1 right-2 max-w-[80%] truncate text-[9px] text-white/80 [text-shadow:0_1px_2px_rgba(0,0,0,.6)]">{popup.imageCredit}</span>}
          </div>
        )}
        <div className="flex flex-col gap-4 p-5">
          <div className="flex flex-col gap-1">
            <h2 id="popup-title" className="font-display text-2xl font-bold leading-8 text-brand-core [font-variation-settings:'SOFT'_100] [text-wrap:balance]">{popup.title}</h2>
            {popup.text && <p className="text-sm text-secondary">{popup.text}</p>}
          </div>
          {popup.showChannels && <ChannelLinks from="popup" chips />}
          {popup.ctaLabel && popup.ctaLink && (
            <SmartLink
              to={popup.ctaLink}
              onClick={() => {
                track('popup.click', { target: 'cta' });
                close();
              }}
              className="flex h-14 items-center justify-center gap-1 rounded-full bg-brand-dark text-base font-bold text-white transition hover:bg-brand-deep active:scale-[0.98]"
            >
              {popup.ctaLabel} <ChevronRight size={18} aria-hidden="true" />
            </SmartLink>
          )}
          <button type="button" onClick={close} className="min-h-10 text-sm font-semibold text-muted">
            Để sau
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
