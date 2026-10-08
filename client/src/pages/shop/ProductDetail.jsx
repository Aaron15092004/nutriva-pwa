import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Share2, ShoppingCart, Leaf, Candy, ChevronDown, ChevronRight, Nut, Droplet, PlayCircle, CheckCircle2, AlertTriangle, HelpCircle, BookOpen, Package, Flame } from 'lucide-react';
import { ingredientName, FLAVORS } from '@shared/nutrition.js';
import { useApi } from '../../lib/useApi.js';
import { money, num } from '../../lib/format.js';
import { useCart } from '../../context/CartContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { Skeleton, ErrorNote } from '../../components/ui.jsx';
import { CircleButton, cx } from '../../components/ds/index.jsx';
import { MacroLine } from '../../components/plan/PlanParts.jsx';
import ProductImage from '../../components/ProductImage.jsx';
import { QtyStepper } from '../../components/shop/ShopParts.jsx';

// Mục mở/đóng: chiều cao chuyển động bằng grid-rows 0fr → 1fr (mượt, không cần đo DOM)
function Accordion({ icon: Icon, title, aside, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border last:border-b-0">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex min-h-14 w-full items-center gap-4 text-left">
        <Icon size={20} className="shrink-0 text-brand-dark" aria-hidden="true" />
        <span className="flex-1 text-base font-bold text-primary">{title}</span>
        {aside}
        <ChevronDown size={20} className={cx('shrink-0 text-subtle transition-transform duration-200', open && 'rotate-180')} aria-hidden="true" />
      </button>
      <div className={cx('grid transition-[grid-template-rows] duration-200 ease-out', open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
        <div className="overflow-hidden">
          <div className="pb-4 pl-10 text-sm text-secondary">{children}</div>
        </div>
      </div>
    </div>
  );
}

function SweetOption({ active, icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cx(
        'flex h-14 items-center justify-center gap-2 rounded-lg border-2 text-sm font-bold transition',
        active ? 'border-brand-main bg-brand-light text-brand-deep' : 'border-border bg-white text-secondary hover:border-brand-soft',
      )}
    >
      <Icon size={20} aria-hidden="true" /> {label}
    </button>
  );
}

export default function ProductDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const cart = useCart();
  const toast = useToast();
  const { data, error, loading } = useApi(`/products/${slug}`);
  const [qty, setQty] = useState(1);
  const [sweet, setSweet] = useState(user.profile.sweetness);
  const [more, setMore] = useState(false);

  const p = data?.product;
  const conflicts = p ? p.ingredients.filter((i) => user.profile.allergies.includes(i)) : [];
  const isDiy = p?.type === 'diy';
  const soldOut = p?.stock === 0;
  const maxQty = Math.min(50, p?.stock ?? 50);
  const back = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/shop'));

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: p.name, url });
      else {
        await navigator.clipboard.writeText(url);
        toast('Đã sao chép liên kết');
      }
    } catch {
      /* người dùng hủy chia sẻ */
    }
  };

  const addToCart = () => {
    cart.add(p, qty, isDiy ? 'none' : sweet);
    toast(`Đã thêm ${qty} sản phẩm vào giỏ`);
  };

  if (loading)
    return (
      <main className="flex flex-col gap-4">
        <Skeleton h={320} style={{ borderRadius: 0 }} />
        <div className="flex flex-col gap-4 px-4">
          <Skeleton h={32} />
          <Skeleton h={120} />
        </div>
      </main>
    );
  if (error || !p)
    return (
      <main className="flex flex-col gap-4 p-4">
        <CircleButton icon={ArrowLeft} label="Quay lại" onClick={back} className="bg-white text-primary shadow-pill" />
        <ErrorNote error={error ?? 'Không tìm thấy sản phẩm'} />
      </main>
    );

  const n = p.nutrition;
  return (
    <>
      <main className="relative min-h-dvh overflow-x-clip bg-background pb-[calc(120px+var(--safe-b))]">
        <div className="relative bg-brand-light">
          <ProductImage product={p} ratio={isDiy ? '292/252' : '4/3'} />
          <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4">
            <CircleButton icon={ArrowLeft} label="Quay lại" onClick={back} className="bg-white/95 text-primary shadow-pill" size={48} iconSize={22} />
            <span className="flex gap-2">
              <CircleButton icon={Share2} label="Chia sẻ" onClick={share} className="bg-white/95 text-primary shadow-pill" size={48} iconSize={20} />
              <span className="relative">
                <CircleButton icon={ShoppingCart} label={`Giỏ hàng, ${cart.count} sản phẩm`} onClick={() => navigate('/cart')} className="bg-white/95 text-primary shadow-pill" size={48} iconSize={20} />
                {cart.count > 0 && (
                  <span className="pointer-events-none absolute -right-1 -top-1 grid h-5 min-w-[20px] place-items-center rounded-full bg-warm-main px-1 font-secondary text-2xs font-bold text-white" aria-hidden="true">
                    {cart.count}
                  </span>
                )}
              </span>
            </span>
          </div>
        </div>

        <div className="relative -mt-6 flex flex-col gap-6 rounded-t-xl bg-background px-4 pt-6">
          <section className="flex flex-col gap-2">
            <span className="flex flex-wrap gap-2">
              <span className="rounded-full bg-brand-light px-4 py-1 font-secondary text-xs font-bold text-brand-deep">{isDiy ? 'Set tự làm tại nhà' : 'Sữa hạt pha sẵn'}</span>
              <span className="rounded-full bg-surface px-4 py-1 font-secondary text-xs font-semibold text-secondary">{FLAVORS.find((f) => f.id === p.flavor)?.label}</span>
              {p.stock != null && p.stock > 0 && p.stock <= 10 && <span className="rounded-full bg-warm-light px-4 py-1 font-secondary text-xs font-bold text-warm-dark">Chỉ còn {p.stock}</span>}
            </span>
            <h1 className="text-2xl font-extrabold text-primary">{p.name}</h1>
            <p className="text-sm text-muted">{p.subtitle?.includes(p.size) ? p.subtitle : [p.subtitle, p.size].filter(Boolean).join(' • ')}</p>
            <p className="font-secondary text-2xl font-bold text-brand-dark">{money(p.price)}</p>
            {p.description && (
              <div>
                <p className={cx('text-sm text-secondary', !more && 'line-clamp-3')}>{p.description}</p>
                {p.description.length > 160 && (
                  <button type="button" onClick={() => setMore((v) => !v)} className="min-h-8 text-sm font-bold text-brand-dark hover:text-brand-deep">
                    {more ? 'Thu gọn' : 'Xem thêm'}
                  </button>
                )}
              </div>
            )}
          </section>

          {conflicts.length > 0 && (
            <div role="alert" className="flex items-start gap-2 rounded-lg bg-error p-4 text-sm text-warm-dark">
              <AlertTriangle size={20} className="shrink-0" aria-hidden="true" />
              <span>
                Sản phẩm chứa <b>{conflicts.map(ingredientName).join(', ')}</b> — nằm trong danh sách thực phẩm bạn cần tránh.
              </span>
            </div>
          )}

          <section aria-label="Dinh dưỡng" className="flex items-center gap-4 rounded-xl bg-white p-4 shadow-card">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-warm-light text-warm-main" aria-hidden="true">
              <Flame size={24} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-baseline gap-1">
                <b className="font-secondary text-xl text-primary">{num(n.kcal)}</b>
                <span className="text-sm text-muted">kcal / {isDiy ? '330 ml thành phẩm' : 'chai'}</span>
              </p>
              <MacroLine protein={n.protein} carb={n.carb} fat={n.fat} />
            </div>
          </section>

          {isDiy ? (
            <section className="flex flex-col gap-2 rounded-xl bg-breakfast-card p-4">
              <h2 className="text-base font-bold text-primary">Trong set có</h2>
              {[...p.ingredients.map((i) => `${ingredientName(i)} đã chọn lọc`), ...p.extraIngredients, 'Hướng dẫn chi tiết kèm theo'].map((t) => (
                <span key={t} className="flex items-center gap-2 text-sm text-secondary">
                  <CheckCircle2 size={18} className="shrink-0 text-brand-dark" aria-hidden="true" /> {t}
                </span>
              ))}
            </section>
          ) : (
            <>
              <section className="flex flex-col gap-2">
                <h2 className="text-base font-bold text-primary">Thành phần chính</h2>
                <div className="flex flex-wrap gap-2">
                  {p.ingredients.map((i) => (
                    <span key={i} className="inline-flex h-9 items-center gap-1 rounded-full bg-white px-4 text-sm text-secondary shadow-pill">
                      <Nut size={16} className="text-cookie" aria-hidden="true" /> {ingredientName(i)}
                    </span>
                  ))}
                  {p.extraIngredients.map((x) => (
                    <span key={x} className="inline-flex h-9 items-center gap-1 rounded-full bg-white px-4 text-sm text-secondary shadow-pill">
                      <Leaf size={16} className="text-brand-main" aria-hidden="true" /> {x}
                    </span>
                  ))}
                  <span className="inline-flex h-9 items-center gap-1 rounded-full bg-white px-4 text-sm text-secondary shadow-pill">
                    <Droplet size={16} className="text-water-icon" aria-hidden="true" /> Nước
                  </span>
                </div>
              </section>
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-2 text-base font-bold text-primary">Chọn độ ngọt</legend>
                <div className="grid grid-cols-2 gap-2">
                  <SweetOption active={sweet === 'none'} icon={Leaf} label="Không thêm đường" onClick={() => setSweet('none')} />
                  <SweetOption active={sweet === 'low'} icon={Candy} label="Ít ngọt" onClick={() => setSweet('low')} />
                </div>
              </fieldset>
            </>
          )}

          <section className="rounded-xl bg-white px-4 shadow-card">
            {isDiy && (
              <Link to={`/shop/p/${p.slug}/guide`} className="flex min-h-14 items-center gap-4 border-b border-border">
                <BookOpen size={20} className="text-brand-dark" aria-hidden="true" />
                <span className="flex-1 text-base font-bold text-primary">Hướng dẫn chế biến</span>
                <ChevronRight size={20} className="text-subtle" aria-hidden="true" />
              </Link>
            )}
            <Accordion icon={Nut} title="Thành phần & dị ứng">
              Chứa: {[...p.ingredients.map(ingredientName), ...p.extraIngredients].join(', ')}. Sản xuất trên dây chuyền có chế biến các loại hạt khác — có thể nhiễm chéo.
            </Accordion>
            <Accordion icon={Package} title={isDiy ? 'Thông tin bảo quản' : 'Bảo quản & hạn dùng'}>{p.storage}</Accordion>
          </section>

          {!isDiy && (
            <Link to={`/why/${p.slug}`} className="inline-flex min-h-10 items-center gap-2 self-start text-sm font-bold text-brand-dark hover:text-brand-deep">
              <HelpCircle size={18} aria-hidden="true" /> Vì sao sản phẩm này hợp với bạn?
            </Link>
          )}

          {data.sibling && (
            <Link to={`/shop/p/${data.sibling.slug}`} replace className="flex items-center gap-4 rounded-xl bg-white p-4 shadow-card transition hover:shadow-float active:scale-[0.99]">
              <ProductImage product={data.sibling} ratio="1/1" className="w-16 shrink-0 rounded-md" />
              <span className="min-w-0 flex-1">
                <b className="block text-base text-primary">{isDiy ? 'Mua sữa pha sẵn' : 'Muốn tự làm tại nhà?'}</b>
                <span className="text-sm text-muted">
                  {isDiy ? 'Chai 330 ml, tiện lợi mỗi ngày' : 'Set nguyên liệu cùng dòng'} — {money(data.sibling.price)}
                </span>
              </span>
              <ChevronRight size={20} className="text-subtle" aria-hidden="true" />
            </Link>
          )}
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto flex max-w-app items-center gap-4 border-t border-border bg-white/95 px-4 pb-[calc(12px+var(--safe-b))] pt-3 backdrop-blur">
        {isDiy ? (
          <>
            <button type="button" disabled={soldOut} onClick={addToCart} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full border-2 border-brand-dark text-base font-bold text-brand-dark transition active:scale-[0.98] disabled:opacity-50">
              <ShoppingCart size={18} aria-hidden="true" /> {soldOut ? 'Hết hàng' : 'Thêm vào giỏ'}
            </button>
            <Link to={`/shop/p/${p.slug}/guide`} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-brand-dark text-base font-bold text-white transition hover:bg-brand-deep active:scale-[0.98]">
              <PlayCircle size={18} aria-hidden="true" /> Xem cách làm
            </Link>
          </>
        ) : (
          <>
            <QtyStepper value={qty} onChange={setQty} max={maxQty} />
            <button type="button" disabled={soldOut} onClick={addToCart} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-brand-dark px-4 text-base font-bold text-white transition hover:bg-brand-deep active:scale-[0.98] disabled:opacity-50">
              {soldOut ? 'Hết hàng' : <>Thêm • {money(p.price * qty)}</>}
            </button>
          </>
        )}
      </div>
    </>
  );
}
