import { categoryOf } from '../../theme/activities.js';
import { cx } from '../ds/index.jsx';

// Ảnh hoạt động (nếu admin đã tải lên) hoặc ô icon theo nhóm
export default function ActivityThumb({ activity, size = 40, iconSize = 20, className = '' }) {
  const c = categoryOf(activity.category);
  if (activity.image) {
    return <img src={activity.image} alt="" loading="lazy" className={cx('shrink-0 rounded-md object-cover', className)} style={{ width: size, height: size }} />;
  }
  return (
    <span className={cx('grid shrink-0 place-items-center rounded-md', c.tile, className)} style={{ width: size, height: size }} aria-hidden="true">
      <c.icon size={iconSize} />
    </span>
  );
}
