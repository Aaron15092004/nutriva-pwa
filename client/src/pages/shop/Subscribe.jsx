import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Milk, ChevronRight, Truck, User, Phone, MapPin, Leaf, Candy } from 'lucide-react';
import { useApi } from '../../lib/useApi.js';
import { api } from '../../lib/api.js';
import { money } from '../../lib/format.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { TopBar, Skeleton, ErrorNote, Button } from '../../components/ui.jsx';

const DAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

export default function Subscribe() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const cfg = useApi('/shop/config');
  const prods = useApi('/products?type=milk');
  const [planId, setPlanId] = useState('w5');
  const [slug, setSlug] = useState(null);
  const [days, setDays] = useState(['T2', 'T4', 'T6']);
  const [frequency, setFrequency] = useState('weekly');
  const [sweetness, setSweetness] = useState(user.profile.sweetness);
  const [address, setAddress] = useState({ name: user.address?.name || user.name, phone: user.address?.phone ?? '', line: user.address?.line ?? '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const milks = (prods.data?.products ?? []).filter((p) => !p.ingredients.some((i) => user.profile.allergies.includes(i)));
  useEffect(() => {
    if (!slug && milks.length) setSlug((milks.find((m) => m.flavor === user.profile.flavor) ?? milks[0]).slug);
  }, [milks, slug, user.profile.flavor]);

  const plan = cfg.data?.plans.find((p) => p.id === planId);

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
      <TopBar title="Gói sữa của bạn" />
      <main className="page has-cta stack-lg">
        <img src="/img/milk-pack.webp" alt="Các chai sữa hạt NUTRIVA" className="card" style={{ padding: 0, width: '100%', aspectRatio: '299/197', objectFit: 'cover', borderRadius: 24 }} />
        {(cfg.loading || prods.loading) && <Skeleton h={300} />}
        {plan && (
          <>
            <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="title-sm" style={{ marginBottom: 8 }}>Chọn số lượng mỗi tuần</legend>
              <div className="grid-2">
                {cfg.data.plans.map((p) => (
                  <button key={p.id} className="choice row-choice" aria-pressed={planId === p.id} onClick={() => setPlanId(p.id)}>
                    <Milk size={22} />
                    <span>{p.label}<span className="desc" style={{ display: 'block' }}>{money(p.price)}</span></span>
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="card row">
              <img src="/img/milk-pack.webp" alt="" className="thumb" />
              <div>
                <div className="xs muted">{plan.bottles} × 330 ml</div>
                <b className="title-md tabular">{money(plan.price)}</b>
                <div className="xs muted">≈ {money(plan.price / plan.bottles)} / chai</div>
              </div>
            </div>

            <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="title-sm" style={{ marginBottom: 8 }}>Chọn hương vị yêu thích</legend>
              <div className="stack" style={{ gap: 8 }}>
                {milks.map((m) => (
                  <button key={m.slug} className="choice row-choice" aria-pressed={slug === m.slug} onClick={() => setSlug(m.slug)}>
                    <img src={m.image} alt="" className="thumb sm" />
                    <span>{m.name}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="title-sm" style={{ marginBottom: 8 }}>Chọn các ngày giao trong tuần</legend>
              <div className="grid-4" style={{ gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
                {DAYS.map((d) => (
                  <button key={d} className="chip" aria-pressed={days.includes(d)} style={{ justifyContent: 'center', padding: 0 }}
                    onClick={() => setDays((s) => (s.includes(d) ? s.filter((x) => x !== d) : [...s, d]))}>
                    {d}
                  </button>
                ))}
              </div>
            </fieldset>

            {days.length > plan.bottles && <span className="field-error">Gói {plan.bottles} chai chỉ giao tối đa {plan.bottles} ngày/tuần.</span>}
            <p className="xs muted" style={{ marginTop: -8 }}>{plan.bottles} chai được chia đều cho {days.length || 0} ngày giao. Đơn được tạo tự động lúc 6:00 sáng ngày giao.</p>

            <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="title-sm" style={{ marginBottom: 8 }}>Độ ngọt</legend>
              <div className="grid-2">
                <button className="choice row-choice" aria-pressed={sweetness === 'none'} onClick={() => setSweetness('none')}><Leaf size={20} /> Không thêm đường</button>
                <button className="choice row-choice" aria-pressed={sweetness === 'low'} onClick={() => setSweetness('low')}><Candy size={20} /> Ít ngọt</button>
              </div>
            </fieldset>

            <section className="stack">
              <h2 className="title-sm">Địa chỉ giao</h2>
              <div className="input-wrap"><User size={20} /><input aria-label="Họ tên" autoComplete="name" placeholder="Họ tên" value={address.name} onChange={(e) => setAddress({ ...address, name: e.target.value })} /></div>
              <div className="input-wrap"><Phone size={20} /><input aria-label="Số điện thoại" type="tel" inputMode="tel" autoComplete="tel" placeholder="Số điện thoại" value={address.phone} onChange={(e) => setAddress({ ...address, phone: e.target.value })} /></div>
              <div className="input-wrap"><MapPin size={20} /><input aria-label="Địa chỉ" autoComplete="street-address" placeholder="Số nhà, đường, phường, quận, tỉnh/thành" value={address.line} onChange={(e) => setAddress({ ...address, line: e.target.value })} /></div>
            </section>

            <div className="field">
              <label htmlFor="freq">Tần suất giao hàng</label>
              <div className="input-wrap">
                <Truck size={20} />
                <select id="freq" value={frequency} onChange={(e) => setFrequency(e.target.value)}>
                  <option value="weekly">Giao hàng mỗi tuần</option>
                  <option value="biweekly">Giao hàng 2 tuần/lần</option>
                </select>
              </div>
            </div>
            <ErrorNote error={error || cfg.error || prods.error} />
            <p className="xs muted center">Thanh toán khi nhận hàng. Có thể tạm dừng gói bất cứ lúc nào trong mục Cá nhân → Gói định kỳ.</p>
          </>
        )}
        <div className="sticky-cta">
          <Button className="btn-primary btn-block" loading={saving} disabled={!slug || !days.length || (plan && days.length > plan.bottles)} onClick={submit}>
            Chọn gói này <ChevronRight size={20} />
          </Button>
        </div>
      </main>
    </>
  );
}
