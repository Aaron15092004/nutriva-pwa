import { Lock, Check } from 'lucide-react';
import { cx } from '../ds/index.jsx';

// 7 ô = 7 ngày kế hoạch: ô đã mở (dùng thử) / hôm nay / ô bị khóa → thấy ngay "mở 3/7 ngày" nghĩa là gì
export default function TrialStrip({ free = 3, today = 0, dark = false, className = '' }) {
  return (
    <ol className={cx('grid grid-cols-7 gap-1', className)} aria-label={`Kế hoạch 7 ngày: mở ${free} ngày đầu, hôm nay là ngày ${today + 1}`}>
      {Array.from({ length: 7 }, (_, i) => {
        const open = i < free;
        const isToday = i === today && open;
        return (
          <li
            key={i}
            className={cx(
              'flex h-8 items-center justify-center rounded-md font-secondary text-2xs font-bold',
              open ? (dark ? 'bg-white/90 text-brand-core' : 'bg-brand-main text-white') : dark ? 'bg-white/10 text-white/60' : 'bg-surface text-subtle',
              isToday && (dark ? 'ring-2 ring-brand-accent ring-offset-2 ring-offset-brand-core' : 'ring-2 ring-brand-dark ring-offset-2'),
            )}
            aria-label={`Ngày ${i + 1}${open ? (i < today ? ', đã qua' : ', đang mở') : ', cần kích hoạt'}`}
          >
            {open ? i < today ? <Check size={12} aria-hidden="true" /> : `N${i + 1}` : <Lock size={11} aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
}
