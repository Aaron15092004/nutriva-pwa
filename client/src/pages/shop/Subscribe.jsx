import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Milk, ChevronRight, Truck, User, Phone, MapPin, Leaf, Candy } from 'lucide-react';
import { useApi } from '../../lib/useApi.js';
import { api } from '../../lib/api.js';
import { money } from '../../lib/format.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { TopBar, Skeleton, ErrorNote } from '../../components/ui.jsx';
import { TextField, PrimaryButton, BottomBar } from '../../components/ds/form.jsx';
import { cx } from '../../components/ds/index.jsx';

const DAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const choice = (on) => cx('flex min-h-16 items-center gap-2 rounded-lg border-2 px-4 py-2 text-left transition', on ? 'border-brand-dark bg-brand-light' : 'border-border bg-white hover:border-brand-pastel');
const legend = 'mb-2 text-base font-bold text-primary';

export default function Subscribe() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const cfg = useApi('/shop/config');
  const prods = useApi('/products?type=milk');
  const [planId, setPlanId] = useState(null);
  const [slug, setSlug] = useState(null);
  const [days, setDays] = useState(['T2', 'T4', 'T6']);
  const [frequency, setFrequency] = useState('weekly');
  const [sweetness, setSweetness] = useState(user.profile.sweetness);
  const [address, setAddress] = useState({ name: user.address?.name || user.name, phone: user.address?.phone ?? '', line: user.address?.line ?? '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const plans = cfg.data?.plans ?? [];
  const milks = (prods.data?.products ?? []).filter((p) => !p.ingredients.some((i) => user.profile.allergies.includes(i)));
  // Mặc định: gói 5 chai nếu có (phổ biến nhất), không thì gói đầu tiên admin cấu hình
  useEffect(() => {
    if (!planId && plans.length) setPlanId((plans.find((p) => p.id === 'w5') ?? plans[0]).id);
  }, [plans, planId]);
  useEffect(() => {
    if (!slug && milks.length) setSlug((milks.find((m) => m.flavor === user.profile.flavor) ?? milks[0]).slug);
  }, [milks, slug, user.profile.flavor]);

  const plan = plans.find((p) => p.id === planId);
  const tooMany = plan && days.length > plan.bottles;

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      await api.post('/subscriptions', { planId, productSlug: slug, days, frequency, sweetness, address });
      toast('Đã đăng ký gói sữa định kỳ');
      navigate('/me/subscriptions', { replace: true });
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <TopBar title="Gói sữa của bạn" fallback="/shop" />
      <main className="flex flex-col gap-6 px-4 pb-[calc(112px+var(--safe-b))] pt-2">
        <img src="/img/banners/banner-sua-hat.webp" alt="6 vị sữa hạt tươi NUTRIVA" className="aspect-[16/9] w-full rounded-xl object-cover shadow-card" />
        {(cfg.loading || prods.loading) && <Skeleton h={300} />}
        {!cfg.loading && !plans.length && <ErrorNote error="Cửa hàng chưa mở gói định kỳ — vui lòng quay lại sau." />}
        {plan && (
          <>
            <fieldset>
              <legend className={legend}>Chọn số lượng mỗi tuần</legend>
              <div className="grid grid-cols-2 gap-2" role="radiogroup">
                {plans.map((p) => (
                  <button key={p.id} type="button" role="radio" aria-checked={planId === p.id} className={choice(planId === p.id)} onClick={() => setPlanId(p.id)}>
                    <Milk size={22} className="shrink-0 text-brand-main" aria-hidden="true" />
                    <span>
                      <span className="block text-sm font-bold text-primary">{p.label}</span>
                      <span className="font-secondary text-xs text-muted">{money(p.price)}</span>
                    </span>
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="flex items-center gap-4 rounded-xl bg-white p-4 shadow-card">
              <img src="/img/products/sua-mach-nhien.webp" alt="" className="size-16 shrink-0 rounded-lg object-cover" />
              <div>
                <p className="text-xs text-muted">{plan.bottles} × 330 ml</p>
                <b className="font-secondary text-lg tabular-nums text-primary">{money(plan.price)}</b>
                <p className="text-xs text-muted">≈ {money(plan.price / plan.bottles)} / chai</p>
              </div>
            </div>

            <fieldset>
              <legend className={legend}>Chọn hương vị yêu thích</legend>
              <div className="flex flex-col gap-2" role="radiogroup">
                {milks.map((m) => (
                  <button key={m.slug} type="button" role="radio" aria-checked={slug === m.slug} className={choice(slug === m.slug)} onClick={() => setSlug(m.slug)}>
                    <img src={m.image} alt="" className="size-12 shrink-0 rounded-md object-cover" />
                    <span className={cx('text-sm', slug === m.slug ? 'font-bold text-brand-deep' : 'font-semibold text-primary')}>{m.name}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className={legend}>Chọn các ngày giao trong tuần</legend>
              <div className="grid grid-cols-7 gap-1">
                {DAYS.map((d) => {
                  const on = days.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setDays((x) => (x.includes(d) ? x.filter((y) => y !== d) : [...x, d]))}
                      className={cx('min-h-11 rounded-full border-2 text-sm transition', on ? 'border-brand-dark bg-brand-light font-bold text-brand-deep' : 'border-border bg-white text-secondary')}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
              {tooMany && <p className="mt-2 text-xs font-semibold text-warm-dark">Gói {plan.bottles} chai chỉ giao tối đa {plan.bottles} ngày/tuần.</p>}
              <p className="mt-2 text-xs text-muted">
                {plan.bottles} chai được chia đều cho {days.length || 0} ngày giao. Đơn được tạo tự động lúc 6:00 sáng ngày giao.
              </p>
            </fieldset>

            <fieldset>
              <legend className={legend}>Độ ngọt</legend>
              <div className="grid grid-cols-2 gap-2" role="radiogroup">
                {[
                  ['none', 'Không thêm đường', Leaf],
                  ['low', 'Ít ngọt', Candy],
                ].map(([id, label, I]) => (
                  <button key={id} type="button" role="radio" aria-checked={sweetness === id} className={choice(sweetness === id)} onClick={() => setSweetness(id)}>
                    <I size={20} className="shrink-0 text-brand-main" aria-hidden="true" />
                    <span className={cx('text-sm', sweetness === id ? 'font-bold text-brand-deep' : 'font-semibold text-primary')}>{label}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            <section className="flex flex-col gap-2">
              <h2 className="text-base font-bold text-primary">Địa chỉ giao</h2>
              <TextField id="sub-name" aria-label="Họ tên" icon={User} autoComplete="name" placeholder="Họ tên" value={address.name} onChange={(e) => setAddress({ ...address, name: e.target.value })} />
              <TextField id="sub-phone" aria-label="Số điện thoại" icon={Phone} type="tel" inputMode="tel" autoComplete="tel" placeholder="Số điện thoại" value={address.phone} onChange={(e) => setAddress({ ...address, phone: e.target.value })} />
              <TextField id="sub-line" aria-label="Địa chỉ" icon={MapPin} autoComplete="street-address" placeholder="Số nhà, đường, phường, quận, tỉnh/thành" value={address.line} onChange={(e) => setAddress({ ...address, line: e.target.value })} />
            </section>

            <div className="flex flex-col gap-1">
              <label htmlFor="freq" className="text-sm font-bold text-primary">Tần suất giao hàng</label>
              <div className="flex h-14 items-center gap-2 rounded-lg border border-border bg-white px-4 focus-within:border-brand-main focus-within:ring-2 focus-within:ring-brand-soft">
                <Truck size={20} className="shrink-0 text-subtle" aria-hidden="true" />
                <select id="freq" value={frequency} onChange={(e) => setFrequency(e.target.value)} className="h-full min-w-0 flex-1 bg-transparent text-base font-semibold text-primary outline-none">
                  <option value="weekly">Giao hàng mỗi tuần</option>
                  <option value="biweekly">Giao hàng 2 tuần/lần</option>
                </select>
              </div>
            </div>
            <ErrorNote error={error || cfg.error || prods.error} />
            <p className="text-center text-xs text-muted">Thanh toán khi nhận hàng. Có thể tạm dừng gói bất cứ lúc nào trong mục Cá nhân → Gói định kỳ.</p>
          </>
        )}
        <BottomBar>
          <PrimaryButton loading={saving} disabled={!plan || !slug || !days.length || tooMany} onClick={submit} className="w-full">
            Chọn gói này <ChevronRight size={20} aria-hidden="true" />
          </PrimaryButton>
        </BottomBar>
      </main>
    </>
  );
}
