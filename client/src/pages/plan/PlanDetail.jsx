import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ShoppingBasket, MoreVertical, Trash2, Plus, Minus, Check } from 'lucide-react';
import { MEALS } from '@shared/nutrition.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useApi, invalidate } from '../../lib/useApi.js';
import { api } from '../../lib/api.js';
import { today, parseDate } from '../../lib/format.js';
import { Sheet, Skeleton, ErrorNote, Button } from '../../components/ui.jsx';
import { CircleButton, fmt, cx } from '../../components/ds/index.jsx';
import FoodSearchList, { useFoods } from '../../components/FoodSearchList.jsx';
import { DaySummary, MealBlock, PlanItemRow, PlanPills, kcalRange } from '../../components/plan/PlanParts.jsx';

const r1 = (v) => Math.round(v * 10) / 10;
const shortDate = (s) => parseDate(s).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });

// Dựng lại dinh dưỡng cho bản nháp khi chỉnh sửa (thực phẩm theo bảng /100 g, món ăn theo giá trị 1 phần)
function resolveDraft(items, foodMap, dishUnit) {
  const list = items.map((it) => {
    if (it.dish) {
      const u = dishUnit.get(it.dish) ?? { kcal: 0, protein: 0, carb: 0, fat: 0, name: it.dish };
      const p = it.portion ?? 1;
      return { ...u, meal: it.meal, kind: 'dish', portion: p, name: it.label || u.name, grams: u.grams ? Math.round(u.grams * p) : null, kcal: Math.round(u.kcal * p), protein: r1(u.protein * p), carb: r1(u.carb * p), fat: r1(u.fat * p) };
    }
    const f = foodMap.get(it.food);
    const k = (it.grams ?? 0) / 100;
    return {
      meal: it.meal,
      kind: 'food',
      food: it.food,
      group: f?.group,
      name: it.label || f?.name || it.food,
      note: it.note,
      grams: it.grams,
      kcal: Math.round((f?.kcal ?? 0) * k),
      protein: r1((f?.protein ?? 0) * k),
      carb: r1((f?.carb ?? 0) * k),
      fat: r1((f?.fat ?? 0) * k),
    };
  });
  const sum = (arr) => arr.reduce((t, x) => ({ kcal: t.kcal + x.kcal, protein: r1(t.protein + x.protein), carb: r1(t.carb + x.carb), fat: r1(t.fat + x.fat) }), { kcal: 0, protein: 0, carb: 0, fat: 0 });
  const meals = MEALS.map((m) => {
    const arr = list.map((x, i) => ({ ...x, idx: i })).filter((x) => x.meal === m.id);
    return { meal: m.id, label: m.label, items: arr, ...sum(arr) };
  });
  return { meals, ...sum(list) };
}

// Điều khiển định lượng khi chỉnh sửa: gram (thực phẩm) hoặc khẩu phần (món ăn)
function AmountEditor({ it, onChange, onRemove }) {
  const isDish = Boolean(it.dish);
  const step = isDish ? 0.25 : 10;
  const value = isDish ? it.portion ?? 1 : it.grams;
  const set = (v) => onChange(isDish ? { portion: Math.min(5, Math.max(0.25, v)) } : { grams: Math.min(3000, Math.max(1, Math.round(v))) });
  return (
    <div className="mt-2 flex items-center gap-2">
      <CircleButton icon={Minus} label="Giảm" size={32} iconSize={16} onClick={() => set(value - step)} className="bg-surface text-primary" />
      {isDish ? (
        <span className="w-16 text-center font-secondary text-sm font-bold text-primary">{String(value).replace('.', ',')} phần</span>
      ) : (
        <label className="flex items-center gap-1">
          <input
            type="number"
            inputMode="numeric"
            min="1"
            max="3000"
            value={value ?? ''}
            onChange={(e) => onChange({ grams: e.target.value === '' ? '' : Number(e.target.value) })}
            onBlur={() => set(Number(value) || 1)}
            aria-label={`Định lượng ${it.label ?? ''} (gram)`}
            className="h-8 w-16 rounded-sm border border-border bg-white px-2 text-right font-secondary text-sm font-bold text-primary outline-none focus:border-teal-main"
          />
          <span className="text-xs text-muted">g</span>
        </label>
      )}
      <CircleButton icon={Plus} label="Tăng" size={32} iconSize={16} onClick={() => set(value + step)} className="bg-surface text-primary" />
      <CircleButton icon={Trash2} label="Xóa món" size={32} iconSize={16} onClick={onRemove} className="ml-auto bg-error text-warm-dark" />
    </div>
  );
}

export default function PlanDetail() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { setUser } = useAuth();
  const { data, setData, error, loading } = useApi(`/meal-plans/${id}`);
  const plan = data?.plan;
  const [dayIdx, setDayIdx] = useState(0);
  const [more, setMore] = useState(false);
  const [moreText, setMoreText] = useState(false);
  const [busy, setBusy] = useState('');
  const [draft, setDraft] = useState(null); // mảng ngày → danh sách món (khi đang chỉnh sửa)
  const [adding, setAdding] = useState(null); // bữa đang thêm thực phẩm
  const [title, setTitle] = useState('');
  const editing = Boolean(draft);
  const { foods } = useFoods(Boolean(plan?.mine));
  const foodMap = useMemo(() => new Map(foods.map((f) => [f.id, f])), [foods]);
  const dishUnit = useMemo(() => {
    const m = new Map();
    for (const d of plan?.days ?? []) for (const meal of d.meals) for (const it of meal.items) if (it.kind === 'dish') m.set(it.dish, { name: it.name, image: it.image, grams: it.grams / it.portion, kcal: it.kcal / it.portion, protein: it.protein / it.portion, carb: it.carb / it.portion, fat: it.fat / it.portion });
    return m;
  }, [plan]);

  // Mở chế độ chỉnh sửa ngay sau khi sao chép
  if (plan?.mine && params.get('edit') === '1' && !draft) {
    setDraft(plan.raw.map((items) => items.map((x) => ({ ...x }))));
    setParams({}, { replace: true });
  }

  if (loading) return <main className="p-4"><Skeleton h={560} /></main>;
  if (error)
    return (
      <main className="flex flex-col gap-4 p-4">
        <CircleButton icon={ArrowLeft} label="Quay lại" onClick={() => navigate(-1)} className="bg-white text-primary shadow-pill" />
        <ErrorNote error={error} />
      </main>
    );

  const day = editing ? resolveDraft(draft[dayIdx], foodMap, dishUnit) : plan.days[dayIdx];
  const back = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/plan?tab=explore'));

  const start = async () => {
    setBusy('start');
    try {
      const d = await api.post(`/meal-plans/${plan.id}/start`, { startDate: today() });
      invalidate('/meal-plans');
      setUser(d.user);
      toast('Đã bắt đầu kế hoạch — hôm nay là ngày 1');
      navigate('/plan?tab=mine');
    } catch (e) {
      toast(e.message, 'error');
      setBusy('');
    }
  };
  const stop = async () => {
    setBusy('stop');
    try {
      const d = await api.del('/meal-plans/active');
      setUser(d.user);
      setData((x) => ({ plan: { ...x.plan, active: false, startDate: null } }));
      toast('Đã dừng kế hoạch');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy('');
    }
  };
  // Kế hoạch mẫu → sao chép thành thực đơn tự tạo rồi mở chỉnh sửa; thực đơn của tôi → chỉnh sửa trực tiếp
  const customize = async () => {
    if (plan.mine) return setDraft(plan.raw.map((items) => items.map((x) => ({ ...x }))));
    setBusy('copy');
    try {
      const d = await api.post(`/meal-plans/${plan.id}/copy`);
      invalidate('/meal-plans');
      toast('Đã lưu vào Thực đơn tự tạo — bạn có thể chỉnh sửa ngay');
      navigate(`/plan/m/${d.plan.id}?edit=1`, { replace: true });
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy('');
    }
  };
  const save = async () => {
    setBusy('save');
    try {
      const d = await api.patch(`/meal-plans/${plan.id}`, { days: draft });
      invalidate('/meal-plans');
      setData({ plan: { ...d.plan, active: plan.active, startDate: plan.startDate } });
      setDraft(null);
      toast('Đã lưu thực đơn');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy('');
    }
  };
  const rename = async () => {
    setBusy('rename');
    try {
      const d = await api.patch(`/meal-plans/${plan.id}`, { title });
      invalidate('/meal-plans');
      setData({ plan: { ...d.plan, active: plan.active, startDate: plan.startDate } });
      setMore(false);
      toast('Đã đổi tên');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy('');
    }
  };
  const remove = async () => {
    if (!window.confirm(`Xóa thực đơn “${plan.title}”?`)) return;
    try {
      const d = await api.del(`/meal-plans/${plan.id}`);
      invalidate('/meal-plans');
      setUser(d.user);
      toast('Đã xóa thực đơn');
      navigate('/plan?tab=custom', { replace: true });
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const editItem = (idx, patch) =>
    setDraft((dr) =>
      dr.map((items, i) =>
        i !== dayIdx
          ? items
          : items.map((x, j) => {
              if (j !== idx) return x;
              const next = { ...x, ...patch };
              // Ghi chú "2 quả" không còn đúng khi đổi định lượng
              if (patch.grams !== undefined && /quả/.test(x.note ?? '')) delete next.note;
              return next;
            }),
      ),
    );
  const removeItem = (idx) => setDraft((dr) => dr.map((items, i) => (i !== dayIdx ? items : items.filter((_, j) => j !== idx))));
  const addFood = (f) => {
    setDraft((dr) => dr.map((items, i) => (i !== dayIdx ? items : [...items, { meal: adding, food: f.id, grams: f.serving }])));
    toast(`Đã thêm ${f.name}`);
    setAdding(null);
  };

  return (
    <>
      <main className="relative min-h-dvh overflow-x-clip bg-background pb-[calc(160px+var(--safe-b))]">
        <div className="relative aspect-[4/3] max-h-80 w-full bg-surface">
          {plan.image && <img src={plan.image} alt="" className="h-full w-full object-cover" />}
          <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 p-4 pt-[calc(16px+var(--safe-t,0px))]">
            <CircleButton icon={ArrowLeft} label="Quay lại" onClick={back} className="bg-white/95 text-primary shadow-pill" size={48} iconSize={22} />
            <span className="flex gap-2">
              <CircleButton icon={ShoppingBasket} label="Danh sách nguyên liệu" onClick={() => navigate(`/plan/m/${id}/ingredients`)} className="bg-white/95 text-primary shadow-pill" size={48} iconSize={22} />
              {plan.mine && (
                <CircleButton icon={MoreVertical} label="Tùy chọn thực đơn" onClick={() => { setTitle(plan.title); setMore(true); }} className="bg-white/95 text-primary shadow-pill" size={48} iconSize={22} />
              )}
            </span>
          </div>
        </div>

        <div className="relative -mt-6 flex flex-col gap-6 rounded-t-xl bg-background px-4 pt-6">
          <div className="flex flex-col gap-2">
            <PlanPills plan={plan} />
            <h1 className="text-2xl font-extrabold text-primary">{plan.title}</h1>
            <p className="font-secondary text-sm text-muted">
              {kcalRange(plan)}
              {plan.active && plan.startDate && <b className="text-teal-dark"> • Đang áp dụng từ {shortDate(plan.startDate)}</b>}
            </p>
            {plan.description && (
              <div>
                <p className={cx('text-sm text-secondary', !moreText && 'line-clamp-3')}>{plan.description}</p>
                <button type="button" onClick={() => setMoreText((v) => !v)} className="min-h-8 text-sm font-bold text-teal-dark hover:text-teal-deep">
                  {moreText ? 'Thu gọn' : 'Xem thêm'}
                </button>
              </div>
            )}
            {plan.imageCredit?.author && (
              <p className="text-xs text-muted">
                Ảnh: <a href={plan.imageCredit.source} target="_blank" rel="noopener noreferrer" className="underline decoration-dotted underline-offset-2">{plan.imageCredit.author}</a>
                {plan.imageCredit.license && ` • ${plan.imageCredit.license}`}
              </p>
            )}
          </div>

          <section aria-labelledby="days-title" className="flex flex-col gap-4">
            <h2 id="days-title" className="text-lg font-extrabold text-primary">Thực đơn theo ngày</h2>
            <div role="tablist" aria-label="Ngày trong kế hoạch" className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(7, plan.days.length)}, minmax(0, 1fr))` }}>
              {plan.days.map((d, i) => (
                <button
                  key={i}
                  type="button"
                  role="tab"
                  aria-selected={i === dayIdx}
                  aria-label={`Ngày ${i + 1}`}
                  onClick={() => setDayIdx(i)}
                  className={cx(
                    'mx-auto grid aspect-square w-full max-w-12 place-items-center rounded-full font-secondary text-base font-bold transition',
                    i === dayIdx ? 'bg-teal-main text-white ring-2 ring-teal-soft ring-offset-2 ring-offset-background' : 'bg-white text-primary shadow-pill hover:bg-teal-light',
                  )}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <DaySummary kcal={day.kcal} protein={day.protein} carb={day.carb} fat={day.fat} />
          </section>

          {editing && (
            <p className="rounded-lg bg-warning p-4 text-sm text-secondary">
              Đang chỉnh sửa <b>ngày {dayIdx + 1}</b> — chỉnh định lượng, xóa hoặc thêm thực phẩm cho từng bữa rồi bấm <b>Lưu thay đổi</b>.
            </p>
          )}

          {day.meals
            .filter((m) => editing || m.items.length)
            .map((m) => (
              <MealBlock
                key={m.meal}
                meal={m.meal}
                label={m.label}
                kcal={m.kcal}
                footer={
                  editing && (
                    <button type="button" onClick={() => setAdding(m.meal)} className="flex h-12 items-center justify-center gap-2 rounded-lg border-2 border-dashed border-divider text-sm font-bold text-teal-dark hover:bg-teal-light">
                      <Plus size={18} aria-hidden="true" /> Thêm thực phẩm
                    </button>
                  )
                }
              >
                {m.items.map((it, i) => (
                  <PlanItemRow key={editing ? `e-${it.idx}` : i} item={it}>
                    {editing && <AmountEditor it={draft[dayIdx][it.idx]} onChange={(p) => editItem(it.idx, p)} onRemove={() => removeItem(it.idx)} />}
                  </PlanItemRow>
                ))}
              </MealBlock>
            ))}
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto flex max-w-app flex-col gap-2 border-t border-border bg-white/95 px-4 pb-[calc(16px+var(--safe-b))] pt-2 backdrop-blur">
        {editing ? (
          <div className="flex gap-2">
            <button type="button" onClick={() => setDraft(null)} className="h-12 flex-1 rounded-full bg-surface text-base font-bold text-primary">Hủy</button>
            <Button className="h-12 flex-[2] rounded-full bg-teal-dark text-base font-bold text-white hover:bg-teal-deep" loading={busy === 'save'} onClick={save}>
              <Check size={18} aria-hidden="true" /> Lưu thay đổi
            </Button>
          </div>
        ) : (
          <>
            <button type="button" onClick={customize} disabled={Boolean(busy)} className="h-10 text-base font-bold text-teal-dark hover:text-teal-deep disabled:opacity-50">
              {plan.mine ? 'Chỉnh sửa thực đơn' : 'Tùy chỉnh & lưu'}
            </button>
            {plan.active ? (
              <Button className="h-12 rounded-full bg-surface text-base font-bold text-warm-dark" loading={busy === 'stop'} onClick={stop}>
                Dừng kế hoạch
              </Button>
            ) : (
              <Button className="h-12 rounded-full bg-teal-dark text-base font-bold text-white hover:bg-teal-deep" loading={busy === 'start'} onClick={start}>
                Bắt đầu kế hoạch
              </Button>
            )}
          </>
        )}
      </div>

      <Sheet open={Boolean(adding)} onClose={() => setAdding(null)} title={`Thêm vào ${MEALS.find((m) => m.id === adding)?.label.toLowerCase() ?? ''}`}>
        <FoodSearchList foods={foods} onPick={addFood} />
      </Sheet>

      <Sheet open={more} onClose={() => setMore(false)} title="Tùy chọn thực đơn">
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-bold text-primary">Tên thực đơn</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} className="h-12 rounded-md border border-border bg-white px-4 text-base outline-none focus:border-teal-main" />
          </label>
          <Button className="h-12 rounded-full bg-teal-dark text-base font-bold text-white" loading={busy === 'rename'} onClick={rename} disabled={!title.trim()}>
            Lưu tên
          </Button>
          <button type="button" onClick={remove} className="flex h-12 items-center justify-center gap-2 rounded-full bg-error text-base font-bold text-warm-dark">
            <Trash2 size={18} aria-hidden="true" /> Xóa thực đơn
          </button>
          <p className="text-center font-secondary text-xs text-muted">{fmt(plan.dayCount)} ngày • tạo từ kế hoạch mẫu</p>
        </div>
      </Sheet>
    </>
  );
}
