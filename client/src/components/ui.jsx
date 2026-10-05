import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, X, Loader2, Download, Share, PlusSquare, Smartphone, Link2, Compass, Check, MoreVertical } from 'lucide-react';
import { usePwa } from '../context/PwaContext.jsx';

// Logo NUTRIVA (SVG chính thức, đã đổi sang bảng màu teal). tone="white" dùng trên nền tối.
export function Logo({ size = 28, withText = true, tone = 'color', className = '' }) {
  const suffix = tone === 'white' ? '-white' : '';
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <img src={`/brand/logo-mark${suffix}.svg`} alt={withText ? '' : 'NUTRIVA'} width={Math.round((size * 227) / 249)} height={size} style={{ height: size, width: 'auto' }} />
      {withText && (
        <img src={`/brand/logo-wordmark${suffix}.svg`} alt="NUTRIVA" height={Math.round(size * 0.5)} style={{ height: Math.round(size * 0.5), width: 'auto' }} />
      )}
    </span>
  );
}

export function TopBar({ title, back = true, onBack, actions }) {
  const navigate = useNavigate();
  return (
    <header className="topbar">
      {back ? (
        <button className="icon-btn" aria-label="Quay lại" onClick={onBack ?? (() => navigate(-1))}>
          <ArrowLeft size={22} />
        </button>
      ) : (
        <span />
      )}
      <h1>{title}</h1>
      <div className="actions">{actions}</div>
    </header>
  );
}

export function Sheet({ open, onClose, title, children }) {
  const ref = useRef();
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  // Portal ra <body>: luôn nằm trên thanh điều hướng, không phụ thuộc stacking context của trang
  return createPortal(
    <div className="sheet-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <div className="sheet-handle" />
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" aria-label="Đóng" onClick={onClose}>
            <X size={22} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function Ring({ value, max, size = 120, stroke = 12, color = 'var(--primary-600)', track = '#eff3f0', children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
        />
      </svg>
      <div className="ring-label">{children}</div>
    </div>
  );
}

export function Bar({ value, max, color }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="bar" role="progressbar" aria-valuenow={Math.round(value)} aria-valuemax={max} aria-valuemin={0}>
      <i style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export function Button({ loading, children, className = 'btn-primary', ...props }) {
  return (
    <button className={`btn ${className}`} disabled={loading || props.disabled} {...props}>
      {loading && <Loader2 size={18} className="spin" />}
      {children}
    </button>
  );
}

export function Field({ label, error, hint, children, id }) {
  return (
    <div className="field">
      {label && <label htmlFor={id}>{label}</label>}
      {children}
      {error ? <span className="field-error">{error}</span> : hint && <span className="field-hint">{hint}</span>}
    </div>
  );
}

export function Segmented({ options, value, onChange, label }) {
  return (
    <div className="segmented" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} role="tab" aria-selected={value === o.id} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({ checked, onChange, label }) {
  return <button className="switch" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} />;
}

export function Skeleton({ h = 120, style }) {
  return <div className="skeleton" style={{ height: h, ...style }} aria-hidden="true" />;
}

// Nút "Cài đặt ứng dụng" (PWA)
export function InstallButton({ className = 'btn btn-outline btn-block', label = 'Cài đặt ứng dụng' }) {
  const pwa = usePwa();
  if (!pwa.showInstall) return null;
  return (
    <button className={className} onClick={pwa.install}>
      <Download size={18} /> {pwa.installedOnDevice ? 'Mở ứng dụng' : label}
    </button>
  );
}

// Một bước hướng dẫn: số thứ tự + icon + nội dung
function GuideStep({ n, icon: Icon, children }) {
  return (
    <li className="flex items-center gap-4 rounded-lg bg-white p-4 shadow-card">
      <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full bg-teal-light text-teal-dark">
        <Icon size={20} aria-hidden="true" />
        <span className="absolute -left-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-teal-dark font-secondary text-2xs font-bold text-white">{n}</span>
      </span>
      <span className="text-sm text-secondary">{children}</span>
    </li>
  );
}

// Sheet hướng dẫn cài / mở app theo nền tảng (chỉ dùng trên điện thoại)
export function InstallGuide() {
  const pwa = usePwa();
  const [copied, setCopied] = useState(false);
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  let title = 'Cài đặt NUTRIVA';
  let intro = 'Thêm NUTRIVA vào màn hình chính để mở nhanh như ứng dụng, toàn màn hình và nhận nhắc nhở.';
  let steps;
  if (pwa.installedOnDevice) {
    title = 'Mở ứng dụng NUTRIVA';
    intro = 'NUTRIVA đã được cài trên điện thoại này.';
    steps = [
      [Smartphone, <>Chạm biểu tượng <b>NUTRIVA</b> ở màn hình chính hoặc trong danh sách ứng dụng.</>],
    ];
  } else if (pwa.ios && !pwa.iosSafari) {
    title = 'Mở bằng Safari để cài';
    intro = 'Trên iPhone/iPad, chỉ Safari mới thêm được NUTRIVA vào màn hình chính.';
    steps = [
      [Link2, <>Sao chép đường dẫn bên dưới (hoặc chọn <b>Mở bằng trình duyệt</b> / <b>Mở trong Safari</b> ở menu của ứng dụng đang dùng).</>],
      [Compass, <>Mở <b>Safari</b>, dán đường dẫn vào thanh địa chỉ.</>],
      [Share, <>Nhấn nút <b>Chia sẻ</b> rồi chọn <b>Thêm vào MH chính</b>.</>],
    ];
  } else if (pwa.ios) {
    steps = [
      [Share, <>Nhấn nút <b>Chia sẻ</b> ở thanh công cụ Safari (ô vuông có mũi tên lên).</>],
      [PlusSquare, <>Kéo xuống, chọn <b>Thêm vào MH chính</b> (Add to Home Screen).</>],
      [Check, <>Nhấn <b>Thêm</b> — biểu tượng NUTRIVA sẽ xuất hiện trên màn hình chính.</>],
    ];
  } else {
    steps = [
      [MoreVertical, <>Mở menu <b>⋮</b> của Chrome (hoặc <b>≡</b> trên Samsung Internet).</>],
      [Download, <>Chọn <b>Cài đặt ứng dụng</b> hoặc <b>Thêm vào màn hình chính</b>.</>],
      [Check, <>Nhấn <b>Cài đặt</b> để xác nhận.</>],
    ];
  }

  return (
    <Sheet open={pwa.guideOpen} onClose={pwa.closeGuide} title={title}>
      <div className="flex flex-col gap-4 pb-2">
        <p className="text-sm text-secondary">{intro}</p>
        <ol className="flex flex-col gap-2">
          {steps.map(([icon, text], i) => (
            <GuideStep key={i} n={i + 1} icon={icon}>
              {text}
            </GuideStep>
          ))}
        </ol>
        {pwa.ios && !pwa.iosSafari && !pwa.installedOnDevice && (
          <button type="button" onClick={copyLink} className="flex h-12 items-center justify-center gap-2 rounded-full bg-teal-light text-base font-bold text-teal-deep">
            {copied ? <Check size={18} aria-hidden="true" /> : <Link2 size={18} aria-hidden="true" />}
            {copied ? 'Đã sao chép đường dẫn' : 'Sao chép đường dẫn'}
          </button>
        )}
        <button type="button" onClick={pwa.closeGuide} className="h-12 rounded-full bg-teal-dark text-base font-bold text-white">
          Đã hiểu
        </button>
      </div>
    </Sheet>
  );
}

export function ErrorNote({ error }) {
  if (!error) return null;
  return <div className="form-error" role="alert">{error}</div>;
}
