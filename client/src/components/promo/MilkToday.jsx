import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Milk, Plus, Check, ChevronRight } from 'lucide-react';
import { useApi } from '../../lib/useApi.js';
import { milkBottles, logBottle } from '../../lib/milk.js';
import { money } from '../../lib/format.js';
import { useToast } from '../../context/ToastContext.jsx';
import TrackerCard from '../home/TrackerCard.jsx';
import { ProductCard } from '../shop/ShopParts.jsx';
import { cx } from '../ds/index.jsx';

const GOAL = 1; // khuyến nghị 1–2 chai/ngày, mục tiêu tối thiểu 1

// Sữa hạt hợp với người dùng (an toàn dị ứng, đúng khẩu vị)
export function useMilkPicks() {
  const { data } = useApi('/plan/milk');
  return { milk: data?.milks?.[0], milks: data?.milks ?? [], treats: data?.treats ?? [] };
}

function useLogBottle(date, log, onLog, milk) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const add = async () => {
    setBusy(true);
    try {
      const r = await logBottle(date, log, milk);
      onLog(r.log);
      toast(r.queued ? 'Đã lưu trên máy — sẽ đồng bộ khi có mạng' : 'Đã ghi 1 chai sữa hạt vào bữa phụ');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  return { add, busy };
}

// Thẻ theo dõi nhanh ở trang chủ (cùng kiểu thẻ Nước / Vận động)
export function MilkTracker({ date, log, onLog, onOpen }) {
  const { milk } = useMilkPicks();
  const { add } = useLogBottle(date, log, onLog, milk);
  const done = milkBottles(log);
  return (
    <TrackerCard
      icon={Milk}
      iconClass="bg-brand-dark text-white"
      cardClass="bg-breakfast-card"
      title="Sữa hạt hôm nay"
      subtitle={`Đã uống ${String(done).replace('.', ',')} / ${GOAL} chai${milk ? ` • gợi ý: ${milk.name}` : ''}`}
      onOpen={onOpen}
      onAdd={add}
      addLabel="Ghi 1 chai sữa hạt 330 ml"
    />
  );
}

// Thẻ lớn ở trang Kế hoạch: sữa hạt gợi ý hôm nay + ghi nhanh + mua
export function MilkTodayCard({ date, log, onLog }) {
  const { milk } = useMilkPicks();
  const { add, busy } = useLogBottle(date, log, onLog, milk);
  if (!milk) return null;
  const done = milkBottles(log);
  const reached = done >= GOAL;
  return (
    <section aria-labelledby="milk-today" className="flex items-center gap-4 rounded-xl bg-breakfast-card p-4 shadow-card">
      <Link to={`/shop/p/${milk.slug}`} className="size-20 shrink-0 overflow-hidden rounded-lg bg-white">
        <img src={milk.image} alt="" className="h-full w-full object-cover" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h2 id="milk-today" className="text-base font-bold text-primary">Ly sữa hạt hôm nay</h2>
        <p className="line-clamp-2 text-xs text-secondary">
          {milk.name} • {milk.nutrition?.kcal} kcal/chai • {money(milk.price)}
        </p>
        <div className="mt-1 flex flex-wrap gap-2">
          <button type="button" onClick={add} disabled={busy} className={cx('inline-flex h-9 items-center gap-1 rounded-full px-4 text-xs font-bold transition active:scale-95 disabled:opacity-60', reached ? 'bg-white text-brand-deep' : 'bg-brand-dark text-white')}>
            {reached ? <Check size={14} aria-hidden="true" /> : <Plus size={14} aria-hidden="true" />}
            {reached ? `Đã uống ${String(done).replace('.', ',')} chai` : 'Đã uống 1 chai'}
          </button>
          <Link to={`/shop/p/${milk.slug}`} className="inline-flex h-9 items-center gap-1 rounded-full bg-white px-4 text-xs font-bold text-brand-deep">
            Mua <ChevronRight size={14} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}

// Hàng sản phẩm từ sữa hạt (sữa chua, pudding, granola…)
export function TreatStrip({ title = 'Ngon hơn với sữa hạt', id = 'treats-title', exclude }) {
  const { data } = useApi('/products?type=treat');
  const items = (data?.products ?? []).filter((p) => p.slug !== exclude);
  if (!items.length) return null;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 id={id} className="text-lg font-extrabold text-primary">{title}</h2>
        <Link to="/shop?tab=treat" className="inline-flex min-h-10 items-center gap-1 text-sm font-bold text-brand-dark">
          Xem tất cả <ChevronRight size={16} aria-hidden="true" />
        </Link>
      </div>
      <div className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((p) => (
          <ProductCard key={p.slug} p={p} className="w-44 shrink-0 snap-start" />
        ))}
      </div>
    </section>
  );
}
