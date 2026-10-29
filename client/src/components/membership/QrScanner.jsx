import { useEffect, useRef, useState } from 'react';
import { CameraOff } from 'lucide-react';
import { Sheet } from '../ui.jsx';

// Lấy mã từ nội dung QR: link https://.../activate?code=XXXXXXXXXX hoặc chính mã
export function codeFromQr(text) {
  try {
    const u = new URL(text);
    const c = u.searchParams.get('code');
    if (c) return c;
  } catch {
    /* không phải link */
  }
  return text;
}

// Quét QR bằng camera sau: BarcodeDetector (Chrome/Android) hoặc jsQR (iPhone, trình duyệt khác — tải khi cần)
export default function QrScanner({ open, onClose, onResult }) {
  const video = useRef(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return undefined;
    let stream;
    let stopped = false;
    let timer;
    setError('');
    (async () => {
      // Trình duyệt chỉ cho mở camera trên HTTPS; tem QR vẫn quét được bằng app Camera của điện thoại
      if (!window.isSecureContext || !navigator.mediaDevices) {
        setError('Không mở được camera trong trang này. Hãy quét tem bằng ứng dụng Camera của điện thoại, hoặc nhập mã bằng tay.');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      } catch (e) {
        setError(e.name === 'NotAllowedError' ? 'Bạn chưa cho phép dùng camera. Hãy bật quyền camera cho NUTRIVA trong cài đặt trình duyệt, hoặc nhập mã bằng tay.' : 'Không mở được camera trên thiết bị này — vui lòng nhập mã bằng tay.');
        return;
      }
      if (stopped) return stream.getTracks().forEach((t) => t.stop());
      const v = video.current;
      v.srcObject = stream;
      await v.play().catch(() => {});
      let detect;
      if ('BarcodeDetector' in window) {
        const d = new window.BarcodeDetector({ formats: ['qr_code'] });
        detect = async () => (await d.detect(v))[0]?.rawValue;
      } else {
        const { default: jsQR } = await import('jsqr');
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        detect = async () => {
          const w = 480;
          const h = Math.round((v.videoHeight / v.videoWidth) * w) || 360;
          canvas.width = w;
          canvas.height = h;
          ctx.drawImage(v, 0, 0, w, h);
          return jsQR(ctx.getImageData(0, 0, w, h).data, w, h)?.data;
        };
      }
      const loop = async () => {
        if (stopped) return;
        try {
          const text = v.readyState >= 2 ? await detect() : null;
          if (text) {
            stopped = true;
            navigator.vibrate?.(60);
            onResult(codeFromQr(text));
            return;
          }
        } catch {
          /* khung hình lỗi — bỏ qua */
        }
        timer = setTimeout(loop, 160);
      };
      loop();
    })();
    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [open, onResult]);

  return (
    <Sheet open={open} onClose={onClose} title="Quét mã QR trên chai">
      <div className="flex flex-col gap-4">
        {error ? (
          <p className="flex items-start gap-2 rounded-lg bg-warning px-4 py-3 text-sm text-snacks-hint">
            <CameraOff size={18} className="mt-0.5 shrink-0" aria-hidden="true" /> {error}
          </p>
        ) : (
          <div className="relative overflow-hidden rounded-xl bg-primary">
            <video ref={video} playsInline muted className="aspect-square w-full object-cover" />
            <div className="pointer-events-none absolute inset-[18%] rounded-xl border-4 border-white/90 shadow-[0_0_0_999px_rgba(0,0,0,0.35)]" aria-hidden="true" />
          </div>
        )}
        <p className="text-center text-sm text-muted">Đưa mã QR trên nhãn chai / gói hạt vào giữa khung. Mã được nhận tự động.</p>
      </div>
    </Sheet>
  );
}
