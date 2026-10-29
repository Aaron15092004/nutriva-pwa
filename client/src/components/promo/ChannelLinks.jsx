import { Facebook, Instagram, Globe, MessageCircle, ShoppingBag, Store, Music2, ExternalLink } from 'lucide-react';
import { useApi } from '../../lib/useApi.js';
import { track } from '../../lib/track.js';
import { Sheet } from '../ui.jsx';
import { cx } from '../ds/index.jsx';

// Màu nhận diện từng sàn / mạng xã hội (nền icon). Chữ luôn dùng màu chữ của app.
const LOOK = {
  shopee: { icon: ShoppingBag, bg: '#EE4D2D' },
  tiktok: { icon: Music2, bg: '#111111' },
  lazada: { icon: Store, bg: '#1A1F71' },
  facebook: { icon: Facebook, bg: '#1877F2' },
  zalo: { icon: MessageCircle, bg: '#0068FF' },
  instagram: { icon: Instagram, bg: '#D62976' },
  website: { icon: Globe, bg: '#567324' },
};

// Kênh bán hàng chính thức do admin cấu hình (/shop/config)
export function useChannels() {
  const { data } = useApi('/shop/config');
  return data?.channels ?? [];
}

const onOpen = (c, from) => track('channel.click', { channel: c.id, from });

// Lưới nút mở gian hàng trên Shopee, TikTok Shop, Facebook…  (mở tab mới)
export default function ChannelLinks({ channels: given, from, compact = false, chips = false, className = '' }) {
  const fetched = useChannels();
  const channels = given ?? fetched;
  if (!channels.length) return null;
  // Dạng chip nhỏ một hàng (trong sheet / thẻ): icon màu sàn + tên
  if (chips)
    return (
      <ul className={cx('flex flex-wrap gap-2', className)}>
        {channels.map((c) => {
          const look = LOOK[c.id] ?? LOOK.website;
          const Icon = look.icon;
          return (
            <li key={c.id}>
              <a href={c.url} target="_blank" rel="noopener noreferrer" onClick={() => onOpen(c, from)} className="inline-flex h-10 items-center gap-2 rounded-full bg-white pl-1 pr-4 text-sm font-bold text-primary shadow-pill transition hover:shadow-card active:scale-[0.98]">
                <span className="grid size-8 place-items-center rounded-full text-white" style={{ background: look.bg }} aria-hidden="true">
                  <Icon size={16} />
                </span>
                {c.label}
                <span className="sr-only">(mở trang mới)</span>
              </a>
            </li>
          );
        })}
      </ul>
    );
  return (
    <ul className={cx('grid gap-2', compact ? 'grid-cols-4' : 'grid-cols-2', className)}>
      {channels.map((c) => {
        const look = LOOK[c.id] ?? LOOK.website;
        const Icon = look.icon;
        return (
          <li key={c.id}>
            <a
              href={c.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onOpen(c, from)}
              className={cx(
                'flex items-center gap-2 rounded-lg bg-white shadow-pill transition hover:shadow-card active:scale-[0.98]',
                compact ? 'min-h-[72px] flex-col justify-center p-2 text-center' : 'min-h-14 p-2 pr-4',
              )}
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-full text-white" style={{ background: look.bg }} aria-hidden="true">
                <Icon size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className={cx('block font-bold leading-4 text-primary', compact ? 'text-xs' : 'truncate text-sm')}>{c.label}</span>
                {!compact && c.note && <span className="block truncate text-xs text-muted">{c.note}</span>}
              </span>
              {!compact && <ExternalLink size={14} className="shrink-0 text-subtle" aria-hidden="true" />}
              <span className="sr-only">(mở trang mới)</span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

// Sheet "Mua NUTRIVA ở đâu?" (mở từ trang Cá nhân / Cài đặt)
export function ChannelSheet({ open, onClose, from = 'sheet' }) {
  const channels = useChannels();
  return (
    <Sheet open={open} onClose={onClose} title="Kênh bán hàng chính thức">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-secondary">Ngoài đặt ngay trong app, bạn có thể mua sữa hạt NUTRIVA tại các gian hàng chính thức dưới đây để nhận voucher của từng sàn.</p>
        {channels.length ? <ChannelLinks channels={channels} from={from} /> : <p className="text-sm text-muted">Cửa hàng chưa cập nhật kênh bán hàng.</p>}
      </div>
    </Sheet>
  );
}
