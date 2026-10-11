// Nút "Tiếp tục với Google" (Google Identity Services). Trả về ID token qua onCredential.
// Tự ẩn khi server chưa cấu hình GOOGLE_CLIENT_ID.
import { useEffect, useRef, useState } from 'react';
import { useApi } from '../lib/useApi.js';

// Phiên Google chờ hoàn tất onboarding (người mới bấm Google ở trang Đăng nhập)
export const GOOGLE_PENDING_KEY = 'nutriva_google_pending';

let gisPromise = null;
const loadGis = () =>
  (gisPromise ??= new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve(window.google);
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => resolve(window.google);
    s.onerror = () => {
      gisPromise = null;
      reject(new Error('Không tải được dịch vụ đăng nhập Google'));
    };
    document.head.appendChild(s);
  }));

// GIS chỉ nên initialize 1 lần cho mỗi client_id; callback trỏ tới nút đang hiển thị
let initializedFor = null;
let currentCallback = null;

export function useGoogleClientId() {
  const { data } = useApi('/auth/config');
  return data?.googleClientId ?? null;
}

export default function GoogleButton({ onCredential, text = 'continue_with', className = '' }) {
  const clientId = useGoogleClientId();
  const ref = useRef(null);
  const [error, setError] = useState('');

  useEffect(() => {
    currentCallback = (resp) => resp?.credential && onCredential(resp.credential);
  }, [onCredential]);

  useEffect(() => {
    if (!clientId || !ref.current) return;
    let cancelled = false;
    loadGis()
      .then((google) => {
        if (cancelled || !ref.current) return;
        if (initializedFor !== clientId) {
          google.accounts.id.initialize({
            client_id: clientId,
            callback: (resp) => currentCallback?.(resp),
            ux_mode: 'popup',
            auto_select: false,
            itp_support: true,
            use_fedcm_for_prompt: true,
          });
          initializedFor = clientId;
        }
        google.accounts.id.renderButton(ref.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text,
          locale: 'vi',
          logo_alignment: 'center',
          width: Math.min(400, Math.max(220, ref.current.clientWidth)),
        });
      })
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [clientId, text]);

  if (!clientId) return null;
  return (
    <div className={className}>
      {/* Google tự vẽ nút vào đây (chiều cao 44px) */}
      <div ref={ref} className="flex min-h-11 w-full justify-center" />
      {error && <p className="mt-1 text-center text-xs text-warm-dark">{error}</p>}
    </div>
  );
}
