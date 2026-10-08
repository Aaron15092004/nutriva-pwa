import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Search, ShoppingCart, Receipt, CalendarClock, ChevronRight, X, Sparkles } from 'lucide-react';
import { FLAVORS } from '@shared/nutrition.js';
import { useApi } from '../../lib/useApi.js';
import { money } from '../../lib/format.js';
import { useCart } from '../../context/CartContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { Skeleton, ErrorNote } from '../../components/ui.jsx';
import { CircleButton, SectionHeader } from '../../components/ds/index.jsx';
import { ChipTabs } from '../../components/ds/charts.jsx';
import { HeroBackdrop } from '../../components/home/HomeHeader.jsx';
import { ProductCard, CartBar } from '../../components/shop/ShopParts.jsx';

const TABS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'milk', label: 'Sữa hạt pha sẵn' },
  { id: 'diy', label: 'Set tự làm' },
];

const strip = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');

// Banner gói sữa giao định kỳ
function SubscribeBanner({ from }) {
  return (
    <Link to="/shop/subscribe" className="relative flex min-h-36 overflow-hidden rounded-xl bg-brand-core text-white shadow-card transition active:scale-[0.99]">
      <div className="relative z-10 flex flex-1 flex-col items-start justify-center gap-2 p-4 pr-0">
        <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-1 font-secondary text-2xs font-bold uppercase tracking-wider text-brand-soft">
          <CalendarClock size={12} aria-hidden="true" /> Giao định kỳ
        </span>
        <p className="text-lg font-extrabold leading-6">Gói sữa hạt mỗi tuần</p>
        <p className="text-xs text-brand-soft">5 hoặc 10 chai, chọn ngày giao, tạm dừng bất cứ lúc nào</p>
        <span className="mt-1 inline-flex h-8 items-center gap-1 rounded-full bg-white px-4 text-xs font-bold text-brand-core">
          {from ? `Từ ${money(from)}/tuần` : 'Xem gói'} <ChevronRight size={14} aria-hidden="true" />
        </span>
      </div>
      <img src="/img/milk-pack.webp" alt="" className="w-36 shrink-0 object-cover object-[center_85%] [mask-image:linear-gradient(to_right,transparent,#000_35%)]" />
    </Link>
  );
}

export default function Shop() {
  const { user } = useAuth();
  const cart = useCart();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'all';
  const [q, setQ] = useState('');
  const { data, error, loading } = useApi('/products');
  const cfg = useApi('/shop/config');
  const { allergies, flavor } = user.profile;
  const conflict = (p) => p.ingredients.some((i) => allergies.includes(i));

  const products = data?.products ?? [];
  const list = useMemo(() => {
    const k = strip(q.trim());
    return products.filter((p) => (k ? strip(`${p.name} ${p.subtitle ?? ''}`).includes(k) : tab === 'all' || p.type === tab));
  }, [products, tab, q]);

  // Gợi ý: sữa pha sẵn đúng vị yêu thích, không chứa thành phần cần tránh
  const picks = useMemo(() => products.filter((p) => p.type === 'milk' && p.flavor === flavor && p.stock !== 0 && !conflict(p)), [products, flavor]); // eslint-disable-line react-hooks/exhaustive-deps
  const flavorLabel = FLAVORS.find((f) => f.id === flavor)?.label;
  const minPlan = cfg.data?.plans?.length ? Math.min(...cfg.data.plans.map((x) => x.price)) : null;

  return (
    <main className="relative min-h-dvh overflow-x-clip bg-gradient-to-b from-background via-surface to-background pb-[calc(var(--nav-h)+var(--safe-b)+88px)]">
      <HeroBackdrop />
      <div className="relative flex flex-col gap-6 px-4 pt-6">
        <header className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold text-brand-core [font-variation-settings:'SOFT'_100]">Cửa hàng</h1>
            <p className="font-secondary text-xs font-medium text-secondary">Sữa hạt tươi & set tự làm tại nhà</p>
          </div>
          <span className="flex gap-2">
            <CircleButton icon={Receipt} label="Đơn hàng của tôi" onClick={() => navigate('/orders')} className="bg-white text-primary shadow-pill" size={44} />
            <span className="relative">
              <CircleButton icon={ShoppingCart} label={`Giỏ hàng, ${cart.count} sản phẩm`} onClick={() => navigate('/cart')} className="bg-white text-primary shadow-pill" size={44} />
              {cart.count > 0 && (
                <span className="pointer-events-none absolute -right-1 -top-1 grid h-5 min-w-[20px] place-items-center rounded-full bg-warm-main px-1 font-secondary text-2xs font-bold text-white" aria-hidden="true">
                  {cart.count}
                </span>
              )}
            </span>
          </span>
        </header>

        <label className="flex h-12 items-center gap-2 rounded-full bg-white px-4 shadow-pill focus-within:ring-2 focus-within:ring-brand-soft">
          <Search size={20} className="shrink-0 text-subtle" aria-hidden="true" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm sữa hạt, set tự làm…"
            aria-label="Tìm sản phẩm"
            className="h-full min-w-0 flex-1 bg-transparent text-base text-primary outline-none placeholder:text-subtle [&::-webkit-search-cancel-button]:hidden"
          />
          {q && (
            <button type="button" onClick={() => setQ('')} aria-label="Xóa tìm kiếm" className="grid h-8 w-8 place-items-center rounded-full text-subtle hover:bg-surface">
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </label>

        {!q && <SubscribeBanner from={minPlan} />}

        {!q && picks.length > 0 && (
          <section aria-labelledby="picks-title" className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Sparkles size={20} className="text-brand-main" aria-hidden="true" />
              <h2 id="picks-title" className="flex-1 text-lg font-extrabold text-primary">Hợp khẩu vị của bạn</h2>
              <span className="rounded-full bg-white px-2 py-1 font-secondary text-xs font-semibold text-brand-dark shadow-pill">{flavorLabel}</span>
            </div>
            <div className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {picks.map((p) => (
                <ProductCard key={p.slug} p={p} className="w-44 shrink-0 snap-start" />
              ))}
            </div>
          </section>
        )}

        <section aria-labelledby="all-title" className="flex flex-col gap-4">
          {q ? (
            <SectionHeader id="all-title" title={`Kết quả cho “${q}”`} />
          ) : (
            <>
              <h2 id="all-title" className="sr-only">Sản phẩm</h2>
              <ChipTabs items={TABS} value={tab} onChange={(t) => setParams({ tab: t }, { replace: true })} label="Danh mục" />
            </>
          )}
          <ErrorNote error={error} />
          {loading ? (
            <div className="grid grid-cols-2 gap-4">
              {[0, 1, 2, 3].map((i) => <Skeleton key={i} h={260} />)}
            </div>
          ) : list.length ? (
            <div className="grid grid-cols-2 gap-4">
              {list.map((p) => <ProductCard key={p.slug} p={p} conflict={conflict(p)} />)}
            </div>
          ) : (
            <p className="rounded-xl bg-white p-6 text-center text-sm text-muted shadow-card">Không tìm thấy sản phẩm phù hợp.</p>
          )}
        </section>
      </div>
      <CartBar />
    </main>
  );
}
