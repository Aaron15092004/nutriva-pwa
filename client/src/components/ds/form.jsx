// Thành phần form theo design system (Tailwind, lưới 8pt): ô nhập, nhóm lựa chọn dạng thẻ, nút chính, thanh nút cố định.
import { forwardRef } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { cx } from './index.jsx';

// Ô nhập có nhãn, icon, đơn vị, lỗi & gợi ý ngay dưới ô
export const TextField = forwardRef(function TextField({ id, label, icon: Icon, unit, error, hint, trailing, className = '', ...input }, ref) {
  return (
    <div className={cx('flex flex-col gap-1', className)}>
      {label && (
        <label htmlFor={id} className="text-sm font-bold text-primary">
          {label}
        </label>
      )}
      <div
        className={cx(
          'flex h-14 items-center gap-2 rounded-lg border bg-white px-4 transition focus-within:ring-2',
          error ? 'border-warm-dark focus-within:ring-warm-soft' : 'border-border focus-within:border-teal-main focus-within:ring-teal-soft',
        )}
      >
        {Icon && <Icon size={20} className="shrink-0 text-subtle" aria-hidden="true" />}
        <input
          ref={ref}
          id={id}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
          className="h-full min-w-0 flex-1 bg-transparent text-base text-primary outline-none placeholder:text-subtle"
          {...input}
        />
        {unit && <span className="shrink-0 font-secondary text-sm text-muted">{unit}</span>}
        {trailing}
      </div>
      {error ? (
        <p id={`${id}-err`} className="text-xs font-semibold text-warm-dark">{error}</p>
      ) : (
        hint && <p id={`${id}-hint`} className="text-xs text-muted">{hint}</p>
      )}
    </div>
  );
});

// Nhóm lựa chọn dạng thẻ (chọn 1): icon + nhãn + mô tả, thẻ đang chọn viền teal và dấu tích
export function ChoiceGroup({ label, options, value, onChange, icons, cols = 3, layout = 'stack' }) {
  const row = layout === 'row';
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-bold text-primary">{label}</legend>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {options.map((o) => {
          const Icon = icons?.[o.id];
          const on = value === o.id;
          return (
            <button
              type="button"
              key={o.id}
              aria-pressed={on}
              onClick={() => onChange(o.id)}
              className={cx(
                'relative flex rounded-lg border-2 p-2 text-left transition duration-150 active:scale-[0.98]',
                row ? 'min-h-14 items-center gap-2 px-4' : 'min-h-24 flex-col items-center justify-center gap-1 text-center',
                on ? 'border-teal-main bg-teal-light' : 'border-border bg-white hover:border-teal-soft',
              )}
            >
              {Icon && <Icon size={22} className={cx('shrink-0', on ? 'text-teal-dark' : 'text-subtle')} aria-hidden="true" />}
              <span className="min-w-0">
                <span className={cx('block text-sm font-bold leading-5', on ? 'text-teal-deep' : 'text-primary')}>{o.label}</span>
                {o.desc && <span className="block font-secondary text-xs text-muted">{o.desc}</span>}
              </span>
              {on && (
                <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-teal-main text-white" aria-hidden="true">
                  <Check size={12} strokeWidth={3} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

// Nút chính / phụ (cao 56px, bo tròn)
export function PrimaryButton({ loading, children, variant = 'primary', className = '', ...props }) {
  const styles = {
    primary: 'bg-teal-dark text-white hover:bg-teal-deep',
    outline: 'border-2 border-teal-dark bg-white text-teal-dark hover:bg-teal-light',
    soft: 'bg-white text-primary shadow-pill hover:bg-teal-light',
  };
  return (
    <button
      type="button"
      disabled={loading || props.disabled}
      className={cx('inline-flex h-14 items-center justify-center gap-2 rounded-full px-6 text-base font-bold transition duration-150 active:scale-[0.98] disabled:opacity-60', styles[variant], className)}
      {...props}
    >
      {loading && <Loader2 size={18} className="animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}

// Thanh nút cố định ở đáy màn hình (trang không có thanh điều hướng)
export function BottomBar({ children, className = '' }) {
  return (
    <div className={cx('fixed inset-x-0 bottom-0 z-20 mx-auto flex max-w-app items-center gap-4 border-t border-border bg-white/95 px-4 pb-[calc(12px+var(--safe-b))] pt-3 backdrop-blur', className)}>
      {children}
    </div>
  );
}
