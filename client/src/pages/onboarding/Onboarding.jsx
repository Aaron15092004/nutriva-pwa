import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ChevronRight, Check, Mail, Lock, User, Eye, EyeOff, ShieldCheck, Milk,
  Scale, HeartPulse, BicepsFlexed, Shirt, SmilePlus, BatteryCharging, Shuffle, HeartCrack, UsersRound, Hourglass, GraduationCap,
  MessageCircleQuestion, Carrot, UtensilsCrossed, WheatOff, Repeat, Sprout, Nut, Flower2, Bean, CandyOff, Candy, ChefHat,
  Sunrise, Dumbbell, Sun, MoonStar, ClipboardCheck, NotebookPen, CircleOff,
  Clock3,
} from 'lucide-react';
import { ACTIVITY_LEVELS, DIETS, INGREDIENTS, FLAVORS, calcBMI, bmiCategory, calcWHtR, whtrCategory, computeHealth } from '@shared/nutrition.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { track } from '../../lib/track.js';
import { ErrorNote } from '../../components/ui.jsx';
import { CircleButton, cx, fmt } from '../../components/ds/index.jsx';
import { TextField, PrimaryButton, BottomBar } from '../../components/ds/form.jsx';
import GoogleButton, { GOOGLE_PENDING_KEY } from '../../components/GoogleButton.jsx';
import { OptionList, RulerPicker, WheelPicker, LevelBars, GenderIcon, BodyFigure } from '../../components/onboarding/Pickers.jsx';
import { GoalSetScene, CompareScene, EasyLogScene, RecommendScene, ResultsScene, LoadingScene, Confetti, ProjectionChart } from '../../components/onboarding/Scenes.jsx';

const DRAFT_KEY = 'nutriva_onboarding_v2';
const THIS_YEAR = new Date().getFullYear();
const r1 = (n) => Math.round(n * 10) / 10;

const DEFAULTS = {
  goal: 'lose',
  gender: 'female',
  birthYear: THIS_YEAR - 25,
  heightCm: 158,
  weightKg: 55,
  targetWeightKg: 50,
  waistCm: 70,
  activity: 'light',
  diet: 'normal',
  flavor: 'beo-nhe',
  sweetness: 'none',
  preference: 'ready',
  allergies: [],
  noAllergy: false,
};
const BY_GENDER = { female: { heightCm: 158, weightKg: 55 }, male: { heightCm: 168, weightKg: 65 } };

const loadDraft = () => {
  try {
    const d = JSON.parse(sessionStorage.getItem(DRAFT_KEY));
    return d ? { v: { ...DEFAULTS, ...d.v }, survey: d.survey ?? {}, stepId: d.stepId, touched: d.touched ?? {} } : null;
  } catch {
    return null;
  }
};
const readPending = () => {
  try {
    const p = JSON.parse(sessionStorage.getItem(GOOGLE_PENDING_KEY));
    return p && Date.now() - p.at < 50 * 60 * 1000 ? p : null; // ID token Google hết hạn sau ~1 giờ
  } catch {
    return null;
  }
};

// Ước tính vòng eo khi người dùng chưa đo (chỉ để khởi đầu — kéo để chỉnh)
const estimateWaist = (v) => Math.round(v.heightCm * (v.gender === 'male' ? 0.45 : 0.43) + (calcBMI(v.weightKg, v.heightCm) - 21.5) * 1.6);
// Mức cân nặng mục tiêu an toàn (BMI 18,5–24,9)
const targetRange = (v) => {
  const m2 = (v.heightCm / 100) ** 2;
  const lo = Math.max(30, r1(18.5 * m2));
  const hi = Math.min(200, r1(24.9 * m2));
  if (v.goal === 'lose') return { min: Math.min(lo, r1(v.weightKg - 0.5)), max: r1(v.weightKg - 0.5) };
  return { min: r1(v.weightKg + 0.5), max: Math.max(hi, r1(v.weightKg + 1)) };
};

const toProfile = (v, touched = {}) => ({
  gender: v.gender,
  birthYear: v.birthYear,
  age: THIS_YEAR - v.birthYear,
  waistEstimated: !touched.waist, // người dùng chưa chỉnh vòng eo → số ước tính
  heightCm: v.heightCm,
  weightKg: v.weightKg,
  waistCm: v.waistCm,
  targetWeightKg: v.goal === 'maintain' ? null : v.targetWeightKg,
  goal: v.goal,
  activity: v.activity,
  diet: v.diet,
  flavor: v.flavor,
  sweetness: v.sweetness,
  preference: v.preference,
  allergies: v.noAllergy ? [] : v.allergies,
  healthNote: '',
});

const TONE = { good: 'bg-success text-recipe', warn: 'bg-warning text-cookie', bad: 'bg-error text-warm-dark' };
function InfoCard({ children, delay = 0 }) {
  return (
    <div className="ob-item rounded-xl bg-white p-4 text-sm text-secondary shadow-card" style={{ animationDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

// ---- Danh sách lựa chọn của từng câu hỏi ----
// Icon không nền (cỡ 30, nét 2.25), mỗi lựa chọn một màu trong bảng màu app
const C = { brand: 'text-brand-dark', leaf: 'text-brand-main', warm: 'text-warm-main', blue: 'text-water-icon', cookie: 'text-cookie', night: 'text-dinner-hint', red: 'text-warm-dark', mute: 'text-subtle' };
const OPT = {
  goal: [
    { id: 'lose', label: 'Giảm cân', desc: 'Giảm mỡ, cơ thể nhẹ nhõm hơn', icon: Scale, color: C.warm },
    { id: 'maintain', label: 'Duy trì sức khỏe', desc: 'Ăn uống cân bằng mỗi ngày', icon: HeartPulse, color: C.brand },
    { id: 'gain', label: 'Tăng cân, tăng cơ', desc: 'Khỏe khoắn, săn chắc hơn', icon: BicepsFlexed, color: C.blue },
  ],
  gender: [
    { id: 'female', label: 'Nữ', render: <GenderIcon />, color: C.red },
    { id: 'male', label: 'Nam', render: <GenderIcon male />, color: C.blue },
  ],
  motivation: [
    { id: 'look', label: 'Muốn thay đổi vóc dáng', icon: Shirt, color: C.cookie },
    { id: 'confidence', label: 'Muốn tự tin, yêu bản thân hơn', icon: SmilePlus, color: C.warm },
    { id: 'health', label: 'Muốn cải thiện sức khỏe', icon: HeartPulse, color: C.brand },
    { id: 'energy', label: 'Muốn tràn đầy năng lượng mỗi ngày', icon: BatteryCharging, color: C.blue },
  ],
  obstacle: [
    { id: 'habits', label: 'Thói quen ăn uống thất thường', icon: Shuffle, color: C.warm },
    { id: 'emotional', label: 'Ăn theo cảm xúc, khi căng thẳng', icon: HeartCrack, color: C.red },
    { id: 'support', label: 'Thiếu người đồng hành', icon: UsersRound, color: C.blue },
    { id: 'busy', label: 'Lịch trình quá bận rộn', icon: Hourglass, color: C.cookie },
    { id: 'knowledge', label: 'Thiếu kiến thức dinh dưỡng', icon: GraduationCap, color: C.brand },
    { id: 'other', label: 'Lý do khác', icon: MessageCircleQuestion, color: C.mute },
  ],
  activity: ACTIVITY_LEVELS.map((a, i) => ({ id: a.id, label: a.label, desc: a.desc, render: <LevelBars level={i + 1} /> })),
  diet: [
    { id: 'flex-veg', label: DIETS.find((d) => d.id === 'flex-veg').label, desc: 'Ưu tiên rau, đậu, hạt', icon: Carrot, color: C.warm },
    { id: 'normal', label: DIETS.find((d) => d.id === 'normal').label, desc: 'Ăn đa dạng các nhóm thực phẩm', icon: UtensilsCrossed, color: C.brand },
    { id: 'restricted', label: DIETS.find((d) => d.id === 'restricted').label, desc: 'Ví dụ: ít tinh bột, không sữa bò', icon: WheatOff, color: C.cookie },
  ],
  milkHabit: [
    { id: 'daily', label: 'Ngày nào cũng uống', icon: Milk, color: C.brand },
    { id: 'sometimes', label: 'Thỉnh thoảng mới uống', icon: Repeat, color: C.blue },
    { id: 'never', label: 'Chưa uống bao giờ', desc: 'Mình sẽ gợi ý vị dễ uống nhất cho bạn', icon: Sprout, color: C.leaf },
  ],
  flavor: [
    { id: 'beo-nhe', label: 'Béo nhẹ', desc: 'Óc chó, hạnh nhân, macca — thơm béo dịu', icon: Nut, color: C.cookie },
    { id: 'thanh-nhe', label: 'Thanh nhẹ', desc: 'Hạt sen, hạt điều — mát, nhẹ nhàng', icon: Flower2, color: C.leaf },
    { id: 'dam-vi', label: 'Đậm vị', desc: 'Cacao, mè đen, gạo lứt rang — đậm đà', icon: Bean, color: C.red },
  ],
  sweetness: [
    { id: 'none', label: 'Không thêm đường', desc: 'Chỉ ngọt tự nhiên từ hạt', icon: CandyOff, color: C.brand },
    { id: 'low', label: 'Ít ngọt', desc: 'Ngọt nhẹ, dễ uống hơn', icon: Candy, color: C.warm },
  ],
  preference: [
    { id: 'ready', label: 'Sữa pha sẵn', desc: 'Giao tận nơi, mở nắp là uống', icon: Milk, color: C.blue },
    { id: 'diy', label: 'Tự làm tại nhà', desc: 'Gói hạt định lượng sẵn + hướng dẫn từng bước', icon: ChefHat, color: C.warm },
  ],
  milkTimes: [
    { id: 'breakfast', label: 'Bữa sáng', desc: 'Nhanh gọn, no lâu', icon: Sunrise, color: C.warm },
    { id: 'workout', label: 'Sau khi tập luyện', desc: 'Bổ sung đạm thực vật', icon: Dumbbell, color: C.blue },
    { id: 'afternoon', label: 'Bữa phụ buổi chiều', desc: 'Thay đồ ăn vặt nhiều đường', icon: Sun, color: C.cookie },
    { id: 'night', label: 'Trước khi ngủ', desc: 'Nhẹ bụng, dễ ngủ', icon: MoonStar, color: C.night },
    { id: 'anytime', label: 'Lúc nào cũng được', desc: 'Uống khi thấy tiện, không cố định giờ', icon: Clock3, color: C.brand },
  ],
  logging: [
    { id: 'every', label: 'Mọi bữa ăn', icon: ClipboardCheck, color: C.brand },
    { id: 'sometimes', label: 'Khi nào nhớ thì ghi', icon: NotebookPen, color: C.cookie },
    { id: 'never', label: 'Chưa bao giờ', icon: CircleOff, color: C.mute },
  ],
};

export default function Onboarding() {
  const navigate = useNavigate();
  const { register, loginWithGoogle } = useAuth();
  const draft = useMemo(loadDraft, []);
  const [v, setV] = useState(draft?.v ?? DEFAULTS);
  const [survey, setSurvey] = useState(draft?.survey ?? {});
  const [touched, setTouched] = useState(draft?.touched ?? {});
  const [dir, setDir] = useState('next');
  const [pending] = useState(readPending);
  const [consent, setConsent] = useState(false);
  const [emailMode, setEmailMode] = useState(false);
  const [account, setAccount] = useState({ name: pending?.name ?? '', email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const advanceTimer = useRef();

  // Danh sách bước (bỏ "cân nặng mục tiêu" khi chỉ duy trì)
  const steps = useMemo(
    () =>
      [
        'goal', 'gender', 'birth', 'height', 'weight', 'target', 'waist', 'goalset',
        'motivation', 'obstacle', 'compare', 'activity', 'diet',
        'milkHabit', 'flavor', 'sweetness', 'preference', 'milkTimes', 'allergy',
        'logging', 'easy', 'recommend', 'results', 'loading', 'ready', 'account',
      ].filter((s) => !(s === 'target' && v.goal === 'maintain')),
    [v.goal],
  );
  const [stepId, setStepId] = useState(() => (draft?.stepId && draft.stepId !== 'loading' ? draft.stepId : 'goal'));
  const idx = Math.max(0, steps.indexOf(stepId));
  const id = steps[idx];

  useEffect(() => {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ v, survey, stepId: id, touched }));
    } catch {
      /* bộ nhớ bị chặn */
    }
  }, [v, survey, id, touched]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    return () => clearTimeout(advanceTimer.current);
  }, [id]);

  const set = (patch) => setV((p) => ({ ...p, ...patch }));
  const go = useCallback(
    (d) => {
      clearTimeout(advanceTimer.current);
      setError('');
      setDir(d > 0 ? 'next' : 'back');
      if (d < 0 && idx === 0) return navigate('/welcome');
      const next = steps[Math.min(steps.length - 1, Math.max(0, idx + d))];
      // Bỏ qua màn chờ khi quay lại
      setStepId(next === 'loading' && d < 0 ? steps[idx - 2] : next);
    },
    [idx, steps, navigate],
  );
  // Chọn 1 đáp án → tự sang câu tiếp theo sau một nhịp ngắn (thấy dấu tích)
  const pick = (apply) => {
    apply();
    clearTimeout(advanceTimer.current);
    advanceTimer.current = setTimeout(() => go(1), 320);
  };

  const health = useMemo(() => computeHealth(toProfile(v)), [v]);
  const bmi = calcBMI(v.weightKg, v.heightCm);
  const bmiCat = bmiCategory(bmi);

  // Khi chọn giới tính lần đầu: đặt chiều cao/cân nặng mặc định hợp lý
  const chooseGender = (g) =>
    pick(() => {
      const patch = { gender: g };
      if (!touched.height) patch.heightCm = BY_GENDER[g].heightCm;
      if (!touched.weight) patch.weightKg = BY_GENDER[g].weightKg;
      set(patch);
    });
  const enter = (stepName) => {
    // Chuẩn bị giá trị khởi đầu khi vào một số bước
    if (stepName === 'target' && !touched.target) {
      const rg = targetRange(v);
      const t = v.goal === 'lose' ? Math.max(rg.min, r1(v.weightKg * 0.92)) : Math.min(rg.max, r1(v.weightKg + 3));
      set({ targetWeightKg: t });
    }
    if (stepName === 'waist' && !touched.waist) set({ waistCm: Math.min(150, Math.max(50, estimateWaist(v))) });
  };
  useEffect(() => enter(id), [id]); // eslint-disable-line react-hooks/exhaustive-deps
  // Phễu onboarding (admin xem bước nào người dùng hay bỏ dở)
  useEffect(() => {
    if (idx === 0) track('onboarding.start');
    track('onboarding.step', { step: id, index: idx });
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const finish = () => sessionStorage.removeItem(DRAFT_KEY);
  const profile = () => toProfile(v, touched);
  const cleanSurvey = () => ({ ...survey, milkTimes: survey.milkTimes?.length ? survey.milkTimes : ['afternoon'] });

  const submitGoogle = async (credential) => {
    if (!consent) return setError('Vui lòng đồng ý điều khoản sử dụng thông tin trước khi tiếp tục');
    setBusy(true);
    setError('');
    try {
      await loginWithGoogle(credential, { profile: profile(), consent: true, survey: cleanSurvey() });
      sessionStorage.removeItem(GOOGLE_PENDING_KEY);
      finish();
      navigate('/', { replace: true });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const submitEmail = async (e) => {
    e?.preventDefault();
    if (!consent) return setError('Vui lòng đồng ý điều khoản sử dụng thông tin trước khi tiếp tục');
    setBusy(true);
    setError('');
    try {
      await register({ ...account, name: account.name.trim(), profile: profile(), consent: true, survey: cleanSurvey() });
      finish();
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  // ---- Nội dung từng bước ----
  const T = (title, sub) => ({ title, sub });
  const lostKg = r1(Math.abs(v.weightKg - v.targetWeightKg));
  const weeks = v.goal === 'maintain' ? 0 : Math.ceil(lostKg / (v.goal === 'lose' ? 0.5 : 0.25));
  const reach = new Date(Date.now() + weeks * 7 * 86400000);
  const reachLabel = `tháng ${reach.getMonth() + 1}/${reach.getFullYear()}`;
  const flavorLabel = FLAVORS.find((f) => f.id === v.flavor)?.label.toLowerCase();

  let head;
  let body;
  let canNext = true;
  switch (id) {
    case 'goal':
      head = T('Mục tiêu chính của bạn là gì?', 'Mục tiêu giúp NUTRIVA tạo kế hoạch phù hợp riêng cho bạn.');
      body = <OptionList options={OPT.goal} value={touched.goal ? v.goal : null} onSelect={(g) => pick(() => (set({ goal: g }), setTouched((t) => ({ ...t, goal: true }))))} />;
      canNext = touched.goal;
      break;
    case 'gender':
      head = T('Giới tính của bạn?', 'Giúp tính nhu cầu năng lượng (BMR) chính xác hơn.');
      body = <OptionList options={OPT.gender} value={touched.gender ? v.gender : null} onSelect={(g) => (setTouched((t) => ({ ...t, gender: true })), chooseGender(g))} />;
      canNext = touched.gender;
      break;
    case 'birth':
      head = T('Bạn sinh năm nào?', 'Tuổi ảnh hưởng đến nhu cầu calo và dưỡng chất của cơ thể.');
      body = (
        <div className="flex min-h-[56dvh] flex-col justify-center">
          <WheelPicker
            label="Năm sinh"
            items={Array.from({ length: 91 }, (_, i) => ({ value: THIS_YEAR - 10 - i, label: String(THIS_YEAR - 10 - i) })).reverse()}
            value={v.birthYear}
            onChange={(y) => set({ birthYear: y })}
          />
          <p className="ob-item pt-6 text-center font-secondary text-lg font-semibold text-secondary">{THIS_YEAR - v.birthYear} tuổi</p>
        </div>
      );
      break;
    case 'height':
      head = T('Chiều cao của bạn?', '');
      body = <RulerPicker vertical label="Chiều cao" min={120} max={220} step={1} px={12} majorEvery={10} midEvery={5} labelEvery={10} unit="cm" figure={<BodyFigure male={v.gender === 'male'} />} value={v.heightCm} onChange={(h) => (set({ heightCm: h }), setTouched((t) => ({ ...t, height: true })))} />;
      break;
    case 'weight':
      head = T('Cân nặng hiện tại của bạn?', '');
      body = (
        <div className="flex min-h-[60dvh] flex-col justify-center gap-10">
          <RulerPicker label="Cân nặng hiện tại" min={30} max={200} step={0.1} decimals={1} px={11} majorEvery={1} midEvery={0.5} labelEvery={1} unit="kg" value={v.weightKg} onChange={(w) => (set({ weightKg: w }), setTouched((t) => ({ ...t, weight: true })))} />
          <InfoCard delay={150}>
            <p className="mb-1 flex flex-wrap items-center gap-2 text-base font-bold text-primary">
              BMI của bạn: <span className="font-secondary">{String(bmi).replace('.', ',')}</span>
              <span className={cx('rounded-full px-2 py-0.5 text-xs', TONE[bmiCat.tone])}>{bmiCat.label}</span>
            </p>
            {bmiCat.tone === 'good'
              ? 'Cân nặng của bạn đang ở mức khỏe mạnh. NUTRIVA sẽ giúp bạn duy trì và ăn uống cân bằng hơn.'
              : 'NUTRIVA sẽ dựa vào chỉ số này để điều chỉnh mức năng lượng và thực đơn phù hợp cho bạn.'}
          </InfoCard>
        </div>
      );
      break;
    case 'target': {
      const rg = targetRange(v);
      const tBmi = calcBMI(v.targetWeightKg, v.heightCm);
      head = T(v.goal === 'lose' ? 'Cân nặng bạn muốn đạt?' : 'Cân nặng mục tiêu của bạn?', `Hiện tại: ${fmt(v.weightKg, 1)} kg`);
      body = (
        <div className="flex min-h-[60dvh] flex-col justify-center gap-10">
          <RulerPicker label="Cân nặng mục tiêu" min={rg.min} max={rg.max} step={0.1} decimals={1} px={11} majorEvery={1} midEvery={0.5} labelEvery={1} unit="kg" value={Math.min(rg.max, Math.max(rg.min, v.targetWeightKg))} onChange={(w) => (set({ targetWeightKg: w }), setTouched((t) => ({ ...t, target: true })))} />
          <InfoCard delay={150}>
            <p className="mb-1 flex flex-wrap items-center gap-2 text-base font-bold text-primary">
              {v.goal === 'lose' ? 'Giảm' : 'Tăng'} <span className="font-secondary text-brand-dark">{fmt(lostKg, 1)} kg</span>
              <span className={cx('rounded-full px-2 py-0.5 text-xs', TONE[bmiCategory(tBmi).tone])}>{bmiCategory(tBmi).label}</span>
            </p>
            {v.goal === 'lose'
              ? 'Chỉ cần giảm 5–10% cân nặng đã giúp cải thiện rõ rệt sức khỏe tim mạch và chuyển hóa.'
              : 'Tăng chậm khoảng 0,25 kg mỗi tuần, kết hợp vận động, giúp phần tăng thêm chủ yếu là cơ.'}
          </InfoCard>
        </div>
      );
      break;
    }
    case 'waist': {
      const whtr = calcWHtR(v.waistCm, v.heightCm);
      const wc = whtrCategory(whtr);
      head = T('Vòng eo của bạn?', 'Đo ngang rốn khi thở ra nhẹ.');
      body = (
        <div className="flex min-h-[60dvh] flex-col justify-center gap-10">
          <RulerPicker label="Vòng eo" min={50} max={150} step={1} px={14} majorEvery={5} labelEvery={5} unit="cm" value={v.waistCm} onChange={(w) => (set({ waistCm: w }), setTouched((t) => ({ ...t, waist: true })))} />
          <InfoCard delay={150}>
            <p className="mb-1 flex flex-wrap items-center gap-2 text-base font-bold text-primary">
              Tỉ lệ eo/chiều cao: <span className="font-secondary">{String(whtr).replace('.', ',')}</span>
              {wc && <span className={cx('rounded-full px-2 py-0.5 text-xs', TONE[wc.tone])}>{wc.label}</span>}
            </p>
            Chỉ số này phản ánh mỡ vùng bụng — dưới 0,5 là mức khỏe mạnh.
          </InfoCard>
        </div>
      );
      break;
    }
    case 'goalset':
      head = T('Đã đặt mục tiêu! Phần còn lại cứ để NUTRIVA lo', '');
      body = (
        <GoalSetScene
          text={
            v.goal === 'maintain'
              ? 'Duy trì cân nặng khỏe mạnh với thực đơn cân bằng và sữa hạt mỗi ngày.'
              : `${v.goal === 'lose' ? 'Giảm' : 'Tăng'} ${fmt(lostKg, 1)} kg một cách an toàn, từng bước một. Mỗi lựa chọn nhỏ đều đưa bạn đến gần mục tiêu hơn.`
          }
        />
      );
      break;
    case 'motivation':
      head = T('Điều gì thúc đẩy bạn nhất?', '');
      body = <OptionList options={OPT.motivation} value={survey.motivation} onSelect={(x) => pick(() => setSurvey((s) => ({ ...s, motivation: x })))} />;
      canNext = Boolean(survey.motivation);
      break;
    case 'obstacle':
      head = T('Điều gì cản trở bạn nhiều nhất?', '');
      body = <OptionList options={OPT.obstacle} value={survey.obstacle} onSelect={(x) => pick(() => setSurvey((s) => ({ ...s, obstacle: x })))} />;
      canNext = Boolean(survey.obstacle);
      break;
    case 'compare':
      head = T('NUTRIVA giúp ăn uống lành mạnh đơn giản hơn', '');
      body = <CompareScene />;
      break;
    case 'activity':
      head = T('Mức độ vận động của bạn?', 'Tính cả đi bộ, làm việc nhà và tập luyện.');
      body = <OptionList options={OPT.activity} value={touched.activity ? v.activity : null} onSelect={(x) => pick(() => (set({ activity: x }), setTouched((t) => ({ ...t, activity: true }))))} />;
      canNext = touched.activity;
      break;
    case 'diet':
      head = T('Thói quen ăn uống của bạn?', '');
      body = <OptionList options={OPT.diet} value={touched.diet ? v.diet : null} onSelect={(x) => pick(() => (set({ diet: x }), setTouched((t) => ({ ...t, diet: true }))))} />;
      canNext = touched.diet;
      break;
    case 'milkHabit':
      head = T('Bạn có hay uống sữa hạt không?', 'Sữa hạt cung cấp đạm thực vật, chất béo tốt và chất xơ.');
      body = <OptionList options={OPT.milkHabit} value={survey.milkHabit} onSelect={(x) => pick(() => setSurvey((s) => ({ ...s, milkHabit: x })))} />;
      canNext = Boolean(survey.milkHabit);
      break;
    case 'flavor':
      head = T('Bạn thích hương vị sữa hạt nào?', '');
      body = <OptionList options={OPT.flavor} value={touched.flavor ? v.flavor : null} onSelect={(x) => pick(() => (set({ flavor: x }), setTouched((t) => ({ ...t, flavor: true }))))} />;
      canNext = touched.flavor;
      break;
    case 'sweetness':
      head = T('Độ ngọt bạn thích?', 'Bạn có thể đổi khi đặt mỗi đơn hàng.');
      body = <OptionList options={OPT.sweetness} value={touched.sweetness ? v.sweetness : null} onSelect={(x) => pick(() => (set({ sweetness: x }), setTouched((t) => ({ ...t, sweetness: true }))))} />;
      canNext = touched.sweetness;
      break;
    case 'preference':
      head = T('Bạn muốn dùng sữa hạt thế nào?', '');
      body = <OptionList options={OPT.preference} value={touched.preference ? v.preference : null} onSelect={(x) => pick(() => (set({ preference: x }), setTouched((t) => ({ ...t, preference: true }))))} />;
      canNext = touched.preference;
      break;
    case 'milkTimes':
      head = T('Bạn muốn uống sữa hạt vào lúc nào?', 'Có thể chọn nhiều.');
      body = (
        <OptionList
          multi
          options={OPT.milkTimes}
          value={survey.milkTimes ?? []}
          onSelect={(x) =>
            setSurvey((s) => {
              const cur = s.milkTimes ?? [];
              if (cur.includes(x)) return { ...s, milkTimes: cur.filter((y) => y !== x) };
              // "Lúc nào cũng được" đi một mình; chọn giờ cụ thể thì bỏ "lúc nào cũng được"
              return { ...s, milkTimes: x === 'anytime' ? ['anytime'] : [...cur.filter((y) => y !== 'anytime'), x] };
            })
          }
        />
      );
      canNext = (survey.milkTimes ?? []).length > 0;
      break;
    case 'allergy':
      head = T('Bạn có cần tránh loại hạt nào không?', 'Sản phẩm và thực đơn chứa thành phần này sẽ được loại khỏi gợi ý.');
      body = (
        <div className="flex flex-col gap-4">
          <button
            type="button"
            aria-pressed={v.noAllergy}
            onClick={() => pick(() => set({ noAllergy: true, allergies: [] }))}
            className={cx(
              'ob-item mt-4 flex min-h-[84px] items-center gap-4 rounded-[22px] border-2 px-5 text-left text-lg font-bold transition active:scale-[0.98]',
              v.noAllergy ? 'border-brand-main bg-brand-light text-brand-deep' : 'border-transparent bg-white text-primary shadow-card',
            )}
          >
            <span className="grid w-9 place-items-center text-brand-dark" aria-hidden="true">
              <ShieldCheck size={34} strokeWidth={2.25} />
            </span>
            <span className="flex-1">Không, mình ăn được tất cả</span>
            {v.noAllergy && (
              <span className="ob-pop grid h-7 w-7 place-items-center rounded-full bg-brand-main text-white" aria-hidden="true">
                <Check size={16} strokeWidth={3} />
              </span>
            )}
          </button>
          <p className="ob-item text-sm font-bold text-secondary" style={{ animationDelay: '80ms' }}>Hoặc chọn những loại cần tránh:</p>
          <div className="flex flex-wrap gap-3">
            {INGREDIENTS.map((it, i) => {
              const on = v.allergies.includes(it.id);
              return (
                <button
                  key={it.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => set({ noAllergy: false, allergies: on ? v.allergies.filter((a) => a !== it.id) : [...v.allergies, it.id] })}
                  className={cx(
                    'ob-item inline-flex h-12 items-center gap-1 rounded-full border-2 px-5 text-[15px] font-semibold transition active:scale-95',
                    on ? 'border-warm-main bg-warm-light text-warm-dark' : 'border-border bg-white text-secondary',
                  )}
                  style={{ animationDelay: `${120 + i * 25}ms` }}
                >
                  {on && <Check size={14} strokeWidth={3} aria-hidden="true" />}
                  {it.name}
                </button>
              );
            })}
          </div>
        </div>
      );
      canNext = v.noAllergy || v.allergies.length > 0;
      break;
    case 'logging':
      head = T('Bạn có thường ghi lại những gì mình ăn?', '');
      body = <OptionList options={OPT.logging} value={survey.logging} onSelect={(x) => pick(() => setSurvey((s) => ({ ...s, logging: x })))} />;
      canNext = Boolean(survey.logging);
      break;
    case 'easy':
      head = T('Ghi bữa ăn chỉ với vài chạm', 'Chọn món có sẵn, chỉnh khẩu phần — NUTRIVA tự tính calo và dưỡng chất.');
      body = <EasyLogScene />;
      break;
    case 'recommend':
      head = T('Kế hoạch dinh dưỡng dựa trên câu trả lời của bạn', 'Bạn có thể chỉnh lại bất cứ lúc nào trong Hồ sơ.');
      body = <RecommendScene health={health} />;
      break;
    case 'results':
      head = T('NUTRIVA hướng tới kết quả bền vững', '');
      body = <ResultsScene />;
      break;
    case 'loading':
      head = null;
      body = <LoadingScene onDone={() => go(1)} />;
      break;
    case 'ready':
      head = T('Kế hoạch của bạn đã sẵn sàng!', '');
      body = (
        <div className="flex flex-col gap-4">
          <Confetti />
          <p className="ob-item text-center text-lg font-bold text-primary">
            {v.goal === 'maintain' ? (
              <>Giữ cân nặng ổn định quanh <span className="text-brand-dark">{fmt(v.weightKg, 1)} kg</span></>
            ) : (
              <>
                Bạn có thể đạt <span className="text-warm-dark">{fmt(v.targetWeightKg, 1)} kg</span> vào khoảng <span className="text-warm-dark">{reachLabel}</span>
              </>
            )}
          </p>
          <div className="ob-item rounded-2xl bg-white p-4 shadow-card" style={{ animationDelay: '120ms' }}>
            <ProjectionChart from={v.weightKg} to={v.goal === 'maintain' ? v.weightKg : v.targetWeightKg} endLabel={v.goal === 'maintain' ? '3 tháng tới' : reachLabel} />
          </div>
          <div className="ob-item flex items-center gap-4 rounded-xl bg-brand-light p-4" style={{ animationDelay: '300ms' }}>
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white text-brand-dark" aria-hidden="true">
              <Milk size={24} />
            </span>
            <p className="text-sm text-secondary">
              Gợi ý cho bạn: <b className="text-primary">sữa hạt vị {flavorLabel}</b>, {v.sweetness === 'none' ? 'không thêm đường' : 'ít ngọt'}
              {v.preference === 'diy' ? ' — tự làm tại nhà với set hạt' : ''}. Mục tiêu mỗi ngày: <b className="text-primary">{fmt(health.targetKcal)} kcal</b>.
            </p>
          </div>
          <p className="text-center text-xs text-muted">Tốc độ an toàn: {v.goal === 'gain' ? '0,25' : '0,5'} kg/tuần. Kết quả thực tế tùy cơ địa và mức độ duy trì.</p>
        </div>
      );
      break;
    case 'account':
      head = T('Lưu kế hoạch của bạn', 'Tạo tài khoản để lưu hồ sơ và đồng bộ kế hoạch trên mọi thiết bị.');
      body = (
        <div className="flex flex-col gap-4">
          <label className={cx('ob-item flex cursor-pointer items-start gap-4 rounded-xl border-2 bg-white p-4 transition', consent ? 'border-brand-main' : 'border-border')}>
            <input type="checkbox" className="peer sr-only" checked={consent} onChange={(e) => (setConsent(e.target.checked), setError(''))} />
            <span className={cx('mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 transition peer-focus-visible:ring-2 peer-focus-visible:ring-brand-soft', consent ? 'border-brand-main bg-brand-main text-white' : 'border-divider text-transparent')} aria-hidden="true">
              <Check size={16} strokeWidth={3} />
            </span>
            <span className="text-sm text-secondary">
              Tôi đồng ý để NUTRIVA dùng thông tin trên để gợi ý sản phẩm và kế hoạch dinh dưỡng phù hợp. Thông tin chỉ dùng để cá nhân hóa, không chia sẻ cho bên thứ ba.
            </span>
          </label>

          <div className={cx('flex flex-col gap-4 transition-opacity', !consent && 'pointer-events-none opacity-40')} aria-disabled={!consent}>
            {pending ? (
              <PrimaryButton variant="outline" loading={busy} onClick={() => submitGoogle(pending.credential)} className="w-full">
                Hoàn tất với Google ({pending.email})
              </PrimaryButton>
            ) : (
              consent && <GoogleButton onCredential={submitGoogle} text="signup_with" className="ob-item" />
            )}
            {!consent && !pending && <div className="h-11 rounded-full border border-border bg-white" aria-hidden="true" />}

            <div className="flex items-center gap-4 text-xs text-muted" aria-hidden="true">
              <span className="h-px flex-1 bg-border" /> hoặc <span className="h-px flex-1 bg-border" />
            </div>

            {emailMode ? (
              <form id="email-form" onSubmit={submitEmail} className="ob-item flex flex-col gap-4 rounded-xl bg-white p-4 shadow-card" noValidate>
                <TextField id="name" label="Tên của bạn" icon={User} autoComplete="given-name" placeholder="Ví dụ: Minh Anh" value={account.name} onChange={(e) => setAccount({ ...account, name: e.target.value })} />
                <TextField id="email" label="Email" icon={Mail} type="email" inputMode="email" autoComplete="email" placeholder="ban@email.com" value={account.email} onChange={(e) => setAccount({ ...account, email: e.target.value })} />
                <TextField
                  id="password"
                  label="Mật khẩu"
                  icon={Lock}
                  type={showPw ? 'text' : 'password'}
                  autoComplete="new-password"
                  hint="Tối thiểu 6 ký tự."
                  value={account.password}
                  onChange={(e) => setAccount({ ...account, password: e.target.value })}
                  trailing={
                    <button type="button" onClick={() => setShowPw(!showPw)} aria-label={showPw ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} className="-mr-2 grid h-10 w-10 place-items-center rounded-full text-subtle hover:bg-surface">
                      {showPw ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
                    </button>
                  }
                />
              </form>
            ) : (
              <PrimaryButton variant="soft" onClick={() => setEmailMode(true)} className="w-full">
                <Mail size={18} aria-hidden="true" /> Đăng ký bằng email
              </PrimaryButton>
            )}
          </div>

          <ErrorNote error={error} />
          <p className="flex items-start gap-2 rounded-lg bg-info p-4 text-xs text-secondary">
            <ShieldCheck size={16} className="shrink-0 text-water-icon" aria-hidden="true" />
            NUTRIVA không thay thế tư vấn y tế. Có bệnh lý hoặc dị ứng nặng, hãy hỏi ý kiến bác sĩ trước khi thay đổi chế độ ăn.
          </p>
          <p className="text-center text-sm text-muted">
            Đã có tài khoản?{' '}
            <Link to="/login" className="font-bold text-brand-dark hover:text-brand-deep">
              Đăng nhập
            </Link>
          </p>
        </div>
      );
      break;
    default:
      head = null;
      body = null;
  }

  const showBar = id !== 'loading' && (id !== 'account' || emailMode);
  const progress = Math.round(((idx + 1) / steps.length) * 100);

  return (
    <>
      <main className="relative min-h-dvh overflow-x-clip bg-gradient-to-b from-brand-light via-background to-background px-4 pb-[calc(112px+var(--safe-b))] pt-[max(16px,env(safe-area-inset-top))]">
        <div className="flex flex-col gap-6">
          <div className={cx('flex items-center gap-4', id === 'loading' && 'invisible')}>
            <CircleButton icon={ArrowLeft} label={idx === 0 ? 'Quay lại trang chào' : 'Câu trước'} onClick={() => go(-1)} className="bg-white text-primary shadow-pill" size={44} />
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/80" role="progressbar" aria-label="Tiến độ" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
              <div className="h-full rounded-full bg-brand-main transition-[width] duration-500 ease-out" style={{ width: `${progress}%` }} />
            </div>
          </div>

          <div key={id} className={cx('flex flex-col gap-6', dir === 'next' ? 'ob-next' : 'ob-back')}>
            {head && (
              <header className="flex flex-col gap-2 text-center">
                <h1 className="font-display text-[28px] font-bold leading-9 text-brand-core [font-variation-settings:'SOFT'_100]">{head.title}</h1>
                {head.sub && <p className="text-base text-secondary">{head.sub}</p>}
              </header>
            )}
            {body}
          </div>
        </div>
      </main>

      {showBar && (
        <BottomBar>
          {id === 'account' ? (
            <PrimaryButton type="submit" form="email-form" loading={busy} disabled={!consent} className="flex-1">
              Tạo tài khoản & bắt đầu
            </PrimaryButton>
          ) : (
            <PrimaryButton onClick={() => go(1)} disabled={!canNext} className="flex-1">
              {id === 'ready' ? 'Lưu kế hoạch của tôi' : 'Tiếp tục'} <ChevronRight size={20} aria-hidden="true" />
            </PrimaryButton>
          )}
        </BottomBar>
      )}
    </>
  );
}
