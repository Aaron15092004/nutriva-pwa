// Design system primitives (Tailwind, lưới 8pt). Dùng lại ở mọi trang.
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { colors } from '../../theme/tokens.js';

const cx = (...c) => c.filter(Boolean).join(' ');
export { cx };

// Thanh tiến độ: track/fill nhận class Tailwind để đổi theo ngữ cảnh (bữa ăn, macro…)
export function ProgressBar({ value, max, track = 'bg-white/70', fill = 'bg-teal-main', className = '', label }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div
      className={cx('h-2 w-full overflow-hidden rounded-full', track, className)}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={Math.round(max)}
      aria-valuenow={Math.round(value)}
    >
      <div className={cx('h-full rounded-full transition-[width] duration-500 ease-out', fill)} style={{ width: `${pct}%` }} />
    </div>
  );
}

// Vòng tiến độ SVG
export function ProgressRing({ value, max, size = 128, stroke = 12, color = colors.teal.main, track = 'rgba(255,255,255,0.7)', children, className = '' }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  return (
    <div className={cx('relative grid shrink-0 place-items-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
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

// Nút tròn icon (vùng chạm 40px)
export function CircleButton({ icon: Icon, label, onClick, className = 'bg-white/85 text-primary', size = 40, iconSize = 20, ...rest }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cx(
        'grid shrink-0 place-items-center rounded-full transition duration-150 ease-out hover:brightness-95 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-dark',
        className,
      )}
      style={{ width: size, height: size }}
      {...rest}
    >
      <Icon size={iconSize} strokeWidth={2.25} aria-hidden="true" />
    </button>
  );
}

// Ô icon tròn có nền
export function IconCircle({ icon: Icon, className = 'bg-teal-main text-white', size = 48, iconSize = 24 }) {
  return (
    <span className={cx('grid shrink-0 place-items-center rounded-full', className)} style={{ width: size, height: size }} aria-hidden="true">
      <Icon size={iconSize} strokeWidth={2} />
    </span>
  );
}

// Tiêu đề section + liên kết phụ
export function SectionHeader({ title, action, to, id }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <h2 id={id} className="text-lg font-extrabold text-primary">{title}</h2>
      {action && to && (
        <Link to={to} className="inline-flex min-h-10 items-center gap-1 font-secondary text-xs font-medium text-teal-dark hover:text-teal-deep">
          {action} <ChevronRight size={16} aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}

// Viên thuốc trắng nổi (header, badge trên ảnh)
export function Pill({ as: Tag = 'span', className = '', children, ...rest }) {
  return (
    <Tag className={cx('inline-flex items-center gap-2 rounded-full bg-white shadow-pill', className)} {...rest}>
      {children}
    </Tag>
  );
}

export const fmt = (n, d = 0) => Number(n ?? 0).toLocaleString('vi-VN', { maximumFractionDigits: d });

// Ảnh đại diện (ảnh người dùng hoặc chữ cái đầu)
export function Avatar({ src, name = '', size = 64, className = '' }) {
  return src ? (
    <img src={src} alt={`Ảnh đại diện của ${name}`} className={cx('shrink-0 rounded-full object-cover', className)} style={{ width: size, height: size }} />
  ) : (
    <span
      className={cx('grid shrink-0 place-items-center rounded-full bg-white font-display font-bold text-teal-dark', className)}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      aria-hidden="true"
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
