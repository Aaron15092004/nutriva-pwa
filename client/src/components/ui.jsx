import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, X, Loader2, Download, Share, PlusSquare, Smartphone, Link2, Compass, Check, MoreVertical } from 'lucide-react';
import { usePwa } from '../context/PwaContext.jsx';

// Logo NUTRIVA (SVG chính thức, màu gốc của logo). tone="white" dùng trên nền tối.
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

// Thanh tiêu đề trang con. Mở thẳng từ link/thông báo (không có trang trước trong app) → nút Quay lại về `fallback`.
export function TopBar({ title, back = true, onBack, actions, fallback = '/' }) {
  const navigate = useNavigate();
  const goBack = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate(fallback, { replace: true }));
  return (
    <header className="sticky top-0 z-20 grid grid-cols-[48px_1fr_48px] items-center gap-1 bg-background/90 px-2 pb-2 pt-[max(8px,env(safe-area-inset-top))] backdrop-blur">
      {back ? (
        <button type="button" className="grid size-12 place-items-center rounded-full text-primary transition hover:bg-brand-light active:scale-95" aria-label="Quay lại" onClick={onBack ?? goBack}>
          <ArrowLeft size={22} aria-hidden="true" />
        </button>
      ) : (
        <span />
      )}
      <h1 className="truncate text-center text-lg font-bold text-primary">{title}</h1>
      <div className="flex justify-end">{actions}</div>
    </header>
  );
}

// hero: hình minh họa "trồi" lên trên mép sheet (vd: chai sữa) — heroH = chiều cao, phần chồng xuống sheet = heroOverlap.
// bare: ẩn tiêu đề (vẫn đọc được tiêu đề bằng trình đọc màn hình qua aria-label), chỉ giữ nút đóng.
export function Sheet({ open, onClose, title, children, hero, heroH = 0, heroOverlap = 0, bare = false }) {
  const ref = useRef();
  // onClose thường là hàm tạo mới mỗi lần render → giữ trong ref để effect chỉ chạy khi mở/đóng
  // (trước đây trang cha render lại là focus bị kéo về sheet → bàn phím điện thoại tự đóng khi đang gõ)
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return undefined;
    const opener = document.activeElement;
    const onKey = (e) => e.key === 'Escape' && closeRef.current();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (!ref.current?.contains(document.activeElement)) ref.current?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      if (opener instanceof HTMLElement && document.contains(opener)) opener.focus({ preventScroll: true }); // trả focus về nút đã mở sheet
    };
  }, [open]);

  if (!open) return null;
  // Portal ra <body>: luôn nằm trên thanh điều hướng, không phụ thuộc stacking context của trang
  return createPortal(
    <div className="sheet-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet-wrap" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
        {hero && (
          <div className="pointer-events-none absolute inset-x-0 z-10 flex justify-center" style={{ bottom: `calc(100% - ${heroOverlap}px)`, height: heroH }} aria-hidden="true">
            {hero}
          </div>
        )}
        <div className="sheet" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref} style={hero ? { maxHeight: `calc(92dvh - ${heroH - heroOverlap}px)`, paddingTop: heroOverlap } : undefined}>
          {bare ? (
            <button type="button" className="absolute right-2 top-2 z-20 grid size-11 place-items-center rounded-full bg-white/85 text-primary shadow-pill transition hover:bg-white active:scale-95" aria-label="Đóng" onClick={onClose}>
              <X size={20} aria-hidden="true" />
            </button>
          ) : (
            <>
              <div className="mx-auto mb-2 mt-1 h-1.5 w-10 rounded-full bg-divider" aria-hidden="true" />
              <div className="mb-4 flex items-center justify-between gap-2">
                <h2 className="text-xl font-extrabold text-brand-deep">{title}</h2>
                <button type="button" className="grid size-11 place-items-center rounded-full text-primary transition hover:bg-brand-light active:scale-95" aria-label="Đóng" onClick={onClose}>
                  <X size={22} aria-hidden="true" />
                </button>
              </div>
            </>
          )}
          {children}
        </div>
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
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden="true" className="-rotate-90">
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
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

export function Bar({ value, max, color }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="h-2 overflow-hidden rounded-full bg-surface" role="progressbar" aria-valuenow={Math.round(value)} aria-valuemax={max} aria-valuemin={0}>
      <i className="block h-full rounded-full bg-brand-main transition-[width] duration-500" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

// Nút có trạng thái đang xử lý. className kiểu cũ ("btn-primary btn-sm" — trang admin) giữ nguyên giao diện cũ;
// className Tailwind thì chỉ thêm bố cục căn giữa.
export function Button({ loading, children, className = 'btn-primary', ...props }) {
  const legacy = /btn-/.test(className);
  return (
    <button
      type="button"
      className={legacy ? `btn ${className}` : `inline-flex items-center justify-center gap-2 transition active:scale-[0.98] disabled:opacity-60 ${className}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && <Loader2 size={18} className="animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}

export function Field({ label, error, hint, children, id }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label htmlFor={id} className="text-sm font-bold text-primary">{label}</label>}
      {children}
      {error ? <span className="text-xs font-semibold text-warm-dark">{error}</span> : hint && <span className="text-xs text-muted">{hint}</span>}
    </div>
  );
}

export function Segmented({ options, value, onChange, label }) {
  return (
    <div className="grid auto-cols-fr grid-flow-col rounded-full bg-brand-soft p-1" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="tab"
          aria-selected={value === o.id}
          onClick={() => onChange(o.id)}
          className={`min-h-10 rounded-full text-sm font-semibold transition ${value === o.id ? 'bg-brand-dark text-white shadow-pill' : 'text-brand-deep'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-8 w-[52px] shrink-0 rounded-full transition-colors ${checked ? 'bg-brand-main' : 'bg-divider'}`}
    >
      <span className={`absolute left-[3px] top-[3px] size-[26px] rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : ''}`} aria-hidden="true" />
    </button>
  );
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
      <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-light text-brand-dark">
        <Icon size={20} aria-hidden="true" />
        <span className="absolute -left-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-brand-dark font-secondary text-2xs font-bold text-white">{n}</span>
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
          <button type="button" onClick={copyLink} className="flex h-12 items-center justify-center gap-2 rounded-full bg-brand-light text-base font-bold text-brand-deep">
            {copied ? <Check size={18} aria-hidden="true" /> : <Link2 size={18} aria-hidden="true" />}
            {copied ? 'Đã sao chép đường dẫn' : 'Sao chép đường dẫn'}
          </button>
        )}
        <button type="button" onClick={pwa.closeGuide} className="h-12 rounded-full bg-brand-dark text-base font-bold text-white">
          Đã hiểu
        </button>
      </div>
    </Sheet>
  );
}

export function ErrorNote({ error }) {
  if (!error) return null;
  return (
    <div className="flex items-start gap-2 rounded-lg bg-error px-4 py-3 text-sm font-semibold text-warm-dark" role="alert">
      {error}
    </div>
  );
}
