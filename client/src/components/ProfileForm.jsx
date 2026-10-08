import {
  User, CalendarDays, Ruler, Scale, CircleDot, BarChart3, Heart, TrendingUp, TrendingDown,
  Armchair, Footprints, Bike, Dumbbell, Leaf, Utensils, Ban, Nut, Sprout, Coffee, Candy, Milk, CookingPot, CheckCircle2, Check,
} from 'lucide-react';
import { TextField, ChoiceGroup } from './ds/form.jsx';
import { cx } from './ds/index.jsx';
import {
  GOALS, ACTIVITY_LEVELS, DIETS, FLAVORS, SWEETNESS, PREFERENCES, INGREDIENTS,
  calcBMI, bmiCategory, calcWHtR, whtrCategory,
} from '@shared/nutrition.js';

const GOAL_ICON = { maintain: Heart, gain: TrendingUp, lose: TrendingDown };
const ACT_ICON = { sedentary: Armchair, light: Footprints, moderate: Bike, active: Dumbbell };
const DIET_ICON = { 'flex-veg': Leaf, normal: Utensils, restricted: Ban };
const FLAVOR_ICON = { 'beo-nhe': Nut, 'thanh-nhe': Sprout, 'dam-vi': Coffee };
const SWEET_ICON = { none: Leaf, low: Candy };
const PREF_ICON = { ready: Milk, diy: CookingPot };

export const EMPTY_PROFILE = {
  name: '',
  gender: 'female',
  age: '',
  heightCm: '',
  weightKg: '',
  waistCm: '',
  goal: 'maintain',
  activity: 'light',
  diet: 'normal',
  flavor: 'beo-nhe',
  sweetness: 'none',
  preference: 'ready',
  allergies: [],
  noAllergy: false,
  healthNote: '',
};

const RANGES = {
  age: [10, 100, 'Tuổi từ 10 đến 100'],
  heightCm: [100, 230, 'Chiều cao từ 100 đến 230 cm'],
  weightKg: [25, 250, 'Cân nặng từ 25 đến 250 kg'],
  waistCm: [40, 200, 'Vòng eo từ 40 đến 200 cm'],
};

export function validateBasic(v, needName = true) {
  const errors = {};
  if (needName && !v.name.trim()) errors.name = 'Vui lòng nhập tên của bạn';
  for (const [k, [min, max, msg]] of Object.entries(RANGES)) {
    const n = Number(v[k]);
    if (!v[k] || Number.isNaN(n) || n < min || n > max) errors[k] = msg;
  }
  return errors;
}

export const toProfile = (v) => ({
  gender: v.gender,
  age: Number(v.age),
  heightCm: Number(v.heightCm),
  weightKg: Number(v.weightKg),
  waistCm: Number(v.waistCm),
  goal: v.goal,
  activity: v.activity,
  diet: v.diet,
  flavor: v.flavor,
  sweetness: v.sweetness,
  preference: v.preference,
  allergies: v.noAllergy ? [] : v.allergies,
  healthNote: v.healthNote.trim(),
});

const TONE = { good: 'bg-success text-recipe', warn: 'bg-warning text-cookie', bad: 'bg-error text-warm-dark' };

function NumberField({ id, label, icon, unit, value, onChange, error, hint, step = '1' }) {
  return (
    <TextField id={id} label={label} icon={icon} unit={unit} error={error} hint={hint} type="number" inputMode="decimal" step={step} value={value} onChange={(e) => onChange(e.target.value)} />
  );
}

// BMI & tỉ lệ eo/chiều cao tính trực tiếp khi nhập
export function HealthPreview({ v }) {
  const h = Number(v.heightCm);
  const w = Number(v.weightKg);
  const waist = Number(v.waistCm);
  const ok = h >= 100 && w >= 25;
  const bmi = ok ? calcBMI(w, h) : null;
  const whtr = ok && waist >= 40 ? calcWHtR(waist, h) : null;
  const items = [
    { label: 'BMI tham khảo', value: bmi, cat: bmi && bmiCategory(bmi) },
    { label: 'Eo / Chiều cao', value: whtr, cat: whtr && whtrCategory(whtr) },
  ];
  return (
    <section aria-live="polite" aria-label="Chỉ số sức khỏe" className="flex items-center gap-4 rounded-xl bg-white p-4 shadow-card">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand-light text-brand-dark" aria-hidden="true">
        <BarChart3 size={24} />
      </span>
      <div className="grid flex-1 grid-cols-2 gap-2">
        {items.map((x) => (
          <div key={x.label} className="min-w-0">
            <p className="font-secondary text-xs text-muted">{x.label}</p>
            <p className="flex flex-wrap items-center gap-1">
              <b className="font-secondary text-xl text-primary">{x.value != null ? String(x.value).replace('.', ',') : '--'}</b>
              {x.cat && <span className={cx('rounded-full px-2 py-0.5 font-secondary text-2xs font-bold', TONE[x.cat.tone])}>{x.cat.label}</span>}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function StepBasic({ v, set, errors, showName = true }) {
  return (
    <div className="flex flex-col gap-6">
      {showName && (
        <TextField id="name" label="Tên của bạn" icon={User} autoComplete="given-name" placeholder="Ví dụ: Minh Anh" value={v.name} onChange={(e) => set({ name: e.target.value })} error={errors.name} />
      )}

      <ChoiceGroup
        label="Giới tính (để tính năng lượng chính xác)"
        options={[{ id: 'female', label: 'Nữ' }, { id: 'male', label: 'Nam' }]}
        value={v.gender}
        onChange={(gender) => set({ gender })}
        cols={2}
        layout="row"
      />

      <div className="grid grid-cols-2 gap-4">
        <NumberField id="age" label="Tuổi" icon={CalendarDays} unit="tuổi" value={v.age} onChange={(age) => set({ age })} error={errors.age} />
        <NumberField id="waist" label="Vòng eo" icon={CircleDot} unit="cm" step="0.5" value={v.waistCm} onChange={(waistCm) => set({ waistCm })} error={errors.waistCm} />
        <NumberField id="height" label="Chiều cao" icon={Ruler} unit="cm" value={v.heightCm} onChange={(heightCm) => set({ heightCm })} error={errors.heightCm} />
        <NumberField id="weight" label="Cân nặng" icon={Scale} unit="kg" step="0.1" value={v.weightKg} onChange={(weightKg) => set({ weightKg })} error={errors.weightKg} />
      </div>
      <p className="-mt-4 text-xs text-muted">Vòng eo: đo ngang rốn, thở ra nhẹ nhàng — dùng để tính tỉ lệ eo/chiều cao (WHtR).</p>

      <HealthPreview v={v} />

      <ChoiceGroup label="Mục tiêu của bạn" options={GOALS} value={v.goal} onChange={(goal) => set({ goal })} icons={GOAL_ICON} />
    </div>
  );
}

export function StepHabits({ v, set }) {
  return (
    <div className="flex flex-col gap-6">
      <ChoiceGroup label="Mức độ hoạt động hằng ngày" options={ACTIVITY_LEVELS} value={v.activity} onChange={(activity) => set({ activity })} icons={ACT_ICON} cols={2} layout="row" />
      <ChoiceGroup label="Thói quen ăn uống" options={DIETS} value={v.diet} onChange={(diet) => set({ diet })} icons={DIET_ICON} />
      <ChoiceGroup label="Hương vị yêu thích" options={FLAVORS} value={v.flavor} onChange={(flavor) => set({ flavor })} icons={FLAVOR_ICON} />
      <ChoiceGroup label="Mức ngọt" options={SWEETNESS} value={v.sweetness} onChange={(sweetness) => set({ sweetness })} icons={SWEET_ICON} cols={2} layout="row" />
      <ChoiceGroup label="Bạn thích" options={PREFERENCES} value={v.preference} onChange={(preference) => set({ preference })} icons={PREF_ICON} cols={2} layout="row" />
    </div>
  );
}

export function StepAllergy({ v, set }) {
  const toggle = (id) =>
    set({
      noAllergy: false,
      allergies: v.allergies.includes(id) ? v.allergies.filter((a) => a !== id) : [...v.allergies, id],
    });
  return (
    <div className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-bold text-primary">Dị ứng hoặc không dung nạp</legend>
        <div className="flex flex-wrap gap-2">
          {INGREDIENTS.map((i) => {
            const on = v.allergies.includes(i.id);
            return (
              <button
                type="button"
                key={i.id}
                aria-pressed={on}
                onClick={() => toggle(i.id)}
                className={cx(
                  'inline-flex h-10 items-center gap-1 rounded-full border-2 px-4 text-sm font-semibold transition active:scale-95',
                  on ? 'border-warm-main bg-warm-light text-warm-dark' : 'border-border bg-white text-secondary hover:border-warm-soft',
                )}
              >
                {on && <Check size={14} strokeWidth={3} aria-hidden="true" />}
                {i.name}
              </button>
            );
          })}
        </div>
      </fieldset>

      <button
        type="button"
        aria-pressed={v.noAllergy}
        onClick={() => set({ noAllergy: !v.noAllergy, allergies: [] })}
        className={cx(
          'flex min-h-14 items-center gap-2 rounded-lg border-2 px-4 text-left text-sm font-bold transition active:scale-[0.98]',
          v.noAllergy ? 'border-brand-main bg-brand-light text-brand-deep' : 'border-border bg-white text-primary hover:border-brand-soft',
        )}
      >
        <CheckCircle2 size={22} className={v.noAllergy ? 'text-brand-dark' : 'text-subtle'} aria-hidden="true" /> Không có dị ứng đã biết
      </button>

      <div className="flex flex-col gap-1">
        <label htmlFor="note" className="text-sm font-bold text-primary">
          Lưu ý sức khỏe khác <span className="font-normal text-muted">(tùy chọn)</span>
        </label>
        <textarea
          id="note"
          maxLength={200}
          rows={3}
          placeholder="Ví dụ: tiểu đường, mỡ máu, huyết áp… hoặc các lưu ý khác."
          value={v.healthNote}
          onChange={(e) => set({ healthNote: e.target.value })}
          className="resize-none rounded-lg border border-border bg-white p-4 text-base text-primary outline-none transition placeholder:text-subtle focus:border-brand-main focus:ring-2 focus:ring-brand-soft"
        />
        <p className="text-right font-secondary text-xs text-muted">{v.healthNote.length}/200</p>
      </div>
    </div>
  );
}
