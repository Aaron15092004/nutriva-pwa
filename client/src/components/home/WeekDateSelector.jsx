import { addDays, weekStart, weekdayShort, dayNum, today } from '../../lib/format.js';
import { cx } from '../ds/index.jsx';

const R = 15;
const C = 2 * Math.PI * R;

// Dải 7 ngày (T2 → CN). Vòng quanh số ngày = % calo đã ăn so với mục tiêu.
export default function WeekDateSelector({ value, onChange, progress = {} }) {
  const start = weekStart(value);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const t = today();

  return (
    <nav aria-label="Chọn ngày" className="grid grid-cols-7 gap-1">
      {days.map((d) => {
        const selected = d === value;
        const pct = Math.min(1, progress[d] ?? 0);
        return (
          <button
            key={d}
            type="button"
            aria-pressed={selected}
            aria-label={`${weekdayShort(d)} ngày ${dayNum(d)}${d === t ? ', hôm nay' : ''}${pct ? `, đã ăn ${Math.round(pct * 100)}% mục tiêu` : ''}`}
            onClick={() => onChange(d)}
            className={cx(
              'mx-auto flex h-16 w-10 flex-col items-center gap-1 rounded-full pt-1 transition duration-200 ease-out',
              selected ? 'bg-brand-dark shadow-card' : 'bg-white hover:bg-brand-light',
            )}
          >
            <span className="relative grid h-8 w-8 place-items-center">
              <span className={cx('absolute inset-0 rounded-full', selected ? 'bg-brand-core' : d === t ? 'bg-brand-soft' : 'bg-weekday')} />
              {pct > 0 && (
                <svg viewBox="0 0 32 32" className="absolute inset-0 -rotate-90" aria-hidden="true">
                  <circle cx="16" cy="16" r={R} fill="none" strokeWidth="2" strokeLinecap="round" className={selected ? 'stroke-brand-accent' : 'stroke-brand-main'} strokeDasharray={C} strokeDashoffset={C * (1 - pct)} />
                </svg>
              )}
              <span className={cx('relative font-secondary text-xs font-semibold', selected ? 'text-white' : 'text-secondary')}>{dayNum(d)}</span>
            </span>
            <span className={cx('font-secondary text-2xs font-medium tracking-wide', selected ? 'text-white' : 'text-muted')}>{weekdayShort(d)}</span>
          </button>
        );
      })}
    </nav>
  );
}
