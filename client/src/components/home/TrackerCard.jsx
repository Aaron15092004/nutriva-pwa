import { Plus } from 'lucide-react';
import { IconCircle, CircleButton, cx } from '../ds/index.jsx';

// Thẻ theo dõi nhanh (nước, vận động…). Bấm nội dung để mở chi tiết, bấm + để ghi nhanh.
export default function TrackerCard({ icon, iconClass, cardClass, title, subtitle, onOpen, onAdd, addLabel }) {
  return (
    <article className={cx('flex items-center gap-4 rounded-lg p-4 shadow-card', cardClass)}>
      <IconCircle icon={icon} className={iconClass} />
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 flex-col items-start gap-1 text-left">
        <span className="text-base font-bold text-primary">{title}</span>
        <span className="font-secondary text-xs text-secondary">{subtitle}</span>
      </button>
      <CircleButton icon={Plus} label={addLabel} onClick={onAdd} className="bg-white text-primary" />
    </article>
  );
}
