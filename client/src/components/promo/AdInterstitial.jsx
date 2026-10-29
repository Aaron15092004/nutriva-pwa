import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { X, ChevronRight } from 'lucide-react';
import { useApi } from '../../lib/useApi.js';
import { api } from '../../lib/api.js';
import { track } from '../../lib/track.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { SmartLink, safeLink } from './PromoCarousel.jsx';

// Quảng cáo toàn màn hình khi chuyển trang. Giới hạn (admin cấu hình): sau mỗi N lần chuyển trang,
// cách lần trước ≥ M phút (tính cả popup khi mở app), tối đa K lần/ngày. Không chen vào thanh toán, đăng nhập, kích hoạt mã, chat.
const STATE_KEY = 'nutriva_ad_state';
export const LAST_AD_KEY = 'nutriva_last_ad_at';
const BLOCK = /^\/(checkout|cart|onboarding|login|welcome|forgot-password|reset-password|activate|assistant|admin|me\/membership|orders\/)/;
const NEW_ACCOUNT_MS = 30 * 60 * 1000;

const read = () => {
  try {
    return JSON.parse(localStorage.getItem(STATE_KEY)) ?? {};
  } catch {
    return {};
  }
};
const write = (s) => {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(s));
  } catch {
    /* bộ nhớ bị chặn */
  }
};
export const markAdShown = () => {
  try {
    localStorage.setItem(LAST_AD_KEY, String(Date.now()));
  } catch {
    /* bộ nhớ bị chặn */
  }
};
const lastAdAt = () => {
  try {
    return Number(localStorage.getItem(LAST_AD_KEY) ?? 0);
  } catch {
    return Date.now();
  }
};

export default function AdInterstitial() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const cfg = useApi('/shop/config').data?.interstitial;
  const { data } = useApi(cfg?.enabled ? '/promos?placement=interstitial' : null);
  const promos = data?.promos ?? [];
  const [ad, setAd] = useState(null);
  const [left, setLeft] = useState(0);
  const first = useRef(true);
  const dialog = useRef(null);

  // Đếm lần chuyển trang & quyết định có hiện quảng cáo không
  useEffect(() => {
    if (first.current) {
      first.current = false; // lần mở app đầu tiên dành cho popup
      return;
    }
    if (!cfg?.enabled || !promos.length || BLOCK.test(pathname) || ad) return;
    if (user?.createdAt && Date.now() - new Date(user.createdAt) < NEW_ACCOUNT_MS) return;
    if (cfg.skipMembers && user?.membership?.until && new Date(user.membership.until) > new Date()) return;
    const today = new Date().toLocaleDateString('en-CA');
    const s = read();
    const st = s.day === today ? s : { day: today, shown: 0, nav: 0, next: 0 };
    st.nav += 1;
    const due = st.nav >= cfg.everyNav && st.shown < cfg.maxPerDay && Date.now() - lastAdAt() >= cfg.minMinutes * 60000 && document.body.style.overflow !== 'hidden';
    if (due) {
      const p = promos[st.next % promos.length];
      st.nav = 0;
      st.shown += 1;
      st.next += 1;
      setAd(p);
      setLeft(cfg.skipSeconds ?? 3);
      markAdShown();
      api.post(`/promos/${p._id}/hit`, { kind: 'view' }).catch(() => {});
      track('ad.view', { id: p._id });
    }
    write(st);
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // Đếm ngược nút bỏ qua + khóa cuộn trang
  useEffect(() => {
    if (!ad) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.focus();
    const t = setInterval(() => setLeft((x) => (x > 0 ? x - 1 : 0)), 1000);
    return () => {
      clearInterval(t);
      document.body.style.overflow = prev;
    };
  }, [ad]);

  useEffect(() => {
    if (!ad) return undefined;
    const onKey = (e) => e.key === 'Escape' && left === 0 && setAd(null);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [ad, left]);

  if (!ad) return null;
  const close = () => left === 0 && setAd(null);
  const click = () => {
    api.post(`/promos/${ad._id}/hit`, { kind: 'click' }).catch(() => {});
    track('ad.click', { id: ad._id });
    setAd(null);
  };
  const imageOnly = ad.theme === 'image';
  const total = Math.max(1, cfg?.skipSeconds ?? 3);
  return createPortal(
    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-primary/70 p-4 backdrop-blur-[2px] animate-[fade_0.2s_ease]">
      <div ref={dialog} role="dialog" aria-modal="true" aria-label={ad.title} tabIndex={-1} className="ad-pop relative flex w-full max-w-md flex-col overflow-hidden rounded-2xl bg-background shadow-float outline-none">
        <span className="absolute left-4 top-4 z-10 rounded-full bg-primary/55 px-2 py-0.5 font-secondary text-2xs font-bold uppercase tracking-wider text-white backdrop-blur-sm">Quảng cáo</span>
        <button
          type="button"
          onClick={close}
          disabled={left > 0}
          aria-label={left > 0 ? `Có thể đóng sau ${left} giây` : 'Đóng quảng cáo'}
          className="absolute right-3 top-3 z-10 grid size-11 place-items-center rounded-full bg-primary/55 font-secondary text-sm font-bold text-white backdrop-blur-sm transition disabled:cursor-default"
        >
          {/* Vòng đếm ngược: chạy hết vòng thì hiện nút đóng */}
          <svg viewBox="0 0 44 44" className="absolute inset-0 size-11 -rotate-90" aria-hidden="true">
            <circle cx="22" cy="22" r="19" fill="none" stroke="rgba(255,255,255,.25)" strokeWidth="3" />
            <circle cx="22" cy="22" r="19" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeDasharray="119.4" className="ad-ring" style={{ animationDuration: `${total}s` }} />
          </svg>
          {left > 0 ? <span className="relative">{left}</span> : <X size={20} className="relative" aria-hidden="true" />}
        </button>
        <SmartLink to={ad.link} onClick={click} className="block">
          {ad.image && <img src={ad.image} alt={imageOnly ? ad.title : ''} className="aspect-[16/9] w-full object-cover" />}
        </SmartLink>
        <div className="flex flex-col gap-2 p-5">
          {!imageOnly && <p className="font-display text-2xl font-bold leading-8 text-brand-core [font-variation-settings:'SOFT'_100]">{ad.title}</p>}
          {ad.subtitle && <p className="text-sm text-secondary">{ad.subtitle}</p>}
          {safeLink(ad.link) && (
            <SmartLink to={ad.link} onClick={click} className="mt-2 flex h-14 items-center justify-center gap-1 rounded-full bg-brand-dark text-base font-bold text-white transition active:scale-[0.98]">
              {ad.ctaLabel || 'Xem ngay'} <ChevronRight size={18} aria-hidden="true" />
            </SmartLink>
          )}
          <button type="button" onClick={close} disabled={left > 0} className="min-h-11 text-sm font-semibold text-muted disabled:opacity-50">
            {left > 0 ? `Bỏ qua sau ${left} giây` : 'Để sau'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
