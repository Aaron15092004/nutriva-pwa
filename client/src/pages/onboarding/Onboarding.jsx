import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Mail, Lock, ShieldCheck, Eye, EyeOff, Check } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { ErrorNote } from '../../components/ui.jsx';
import { CircleButton, cx } from '../../components/ds/index.jsx';
import { TextField, PrimaryButton, BottomBar } from '../../components/ds/form.jsx';
import { EMPTY_PROFILE, StepBasic, StepHabits, StepAllergy, validateBasic, toProfile } from '../../components/ProfileForm.jsx';

const DRAFT_KEY = 'nutriva_onboarding';

const STEPS = [
  { title: 'Hiểu bạn hơn', sub: 'Vài thông tin cơ bản để NUTRIVA tính nhu cầu năng lượng và đồng hành cùng bạn.' },
  { title: 'Nhịp sống & sở thích', sub: 'Giúp NUTRIVA cá nhân hóa gợi ý theo lối sống và khẩu vị của bạn.' },
  { title: 'Thực phẩm cần tránh', sub: 'Cho chúng tôi biết nếu bạn dị ứng hoặc cần tránh một số thực phẩm.' },
  { title: 'Lưu kế hoạch của bạn', sub: 'Tạo tài khoản để lưu hồ sơ và đồng bộ kế hoạch trên mọi thiết bị.' },
];

const loadDraft = () => {
  try {
    return { ...EMPTY_PROFILE, ...JSON.parse(sessionStorage.getItem(DRAFT_KEY)) };
  } catch {
    return EMPTY_PROFILE;
  }
};

// Thanh tiến độ 4 bước (3 bước hồ sơ + tạo tài khoản)
function Progress({ step }) {
  return (
    <div className="flex flex-1 flex-col gap-2">
      <span className="font-secondary text-xs font-semibold text-secondary">{step < 3 ? `Bước ${step + 1}/3` : 'Bước cuối'}</span>
      <div className="grid grid-cols-4 gap-1" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="h-1.5 overflow-hidden rounded-full bg-white/80">
            <span className={cx('block h-full rounded-full bg-teal-main transition-[width] duration-300 ease-out', i <= step ? 'w-full' : 'w-0')} />
          </span>
        ))}
      </div>
    </div>
  );
}

export default function Onboarding() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [step, setStep] = useState(0);
  const [v, setV] = useState(loadDraft);
  const [errors, setErrors] = useState({});
  const [consent, setConsent] = useState(false);
  const [account, setAccount] = useState({ email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');

  useEffect(() => {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(v));
    } catch {
      /* bộ nhớ bị chặn */
    }
  }, [v]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [step]);

  const set = (patch) => {
    setV((prev) => ({ ...prev, ...patch }));
    setErrors((prev) => {
      const next = { ...prev };
      Object.keys(patch).forEach((k) => delete next[k]);
      return next;
    });
  };

  const next = () => {
    if (step === 0) {
      const e = validateBasic(v);
      setErrors(e);
      if (Object.keys(e).length) {
        document.querySelector('[aria-invalid="true"]')?.focus();
        return;
      }
    }
    if (step === 2 && !consent) {
      setErrors({ consent: 'Vui lòng đồng ý để NUTRIVA tạo gợi ý cho bạn' });
      return;
    }
    setStep((s) => s + 1);
  };

  const back = () => (step === 0 ? navigate('/welcome') : setStep((s) => s - 1));

  const submit = async (e) => {
    e.preventDefault();
    setServerError('');
    setSubmitting(true);
    try {
      await register({ ...account, name: v.name.trim(), profile: toProfile(v), consent });
      sessionStorage.removeItem(DRAFT_KEY);
      navigate('/', { replace: true });
    } catch (err) {
      setServerError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const s = STEPS[step];
  return (
    <>
      <main className="relative min-h-dvh overflow-x-clip bg-gradient-to-b from-teal-light via-background to-background px-4 pb-[calc(112px+var(--safe-b))] pt-[max(16px,env(safe-area-inset-top))]">
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-4">
            <CircleButton icon={ArrowLeft} label={step === 0 ? 'Quay lại trang chào' : 'Bước trước'} onClick={back} className="bg-white text-primary shadow-pill" size={48} iconSize={22} />
            <Progress step={step} />
          </div>

          {/* key theo bước → nội dung mới mờ dần vào */}
          <div key={step} className="page-fade flex flex-col gap-6">
            <header className="flex flex-col gap-2">
              <h1 className="font-display text-3xl font-bold text-teal-core [font-variation-settings:'SOFT'_100]">{s.title}</h1>
              <p className="text-base text-secondary">{s.sub}</p>
            </header>

            {step === 0 && <StepBasic v={v} set={set} errors={errors} />}
            {step === 1 && <StepHabits v={v} set={set} />}
            {step === 2 && (
              <div className="flex flex-col gap-6">
                <StepAllergy v={v} set={set} />
                <label className={cx('flex cursor-pointer items-start gap-4 rounded-xl border-2 bg-white p-4 transition', consent ? 'border-teal-main' : errors.consent ? 'border-warm-dark' : 'border-border')}>
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={consent}
                    onChange={(e) => {
                      setConsent(e.target.checked);
                      setErrors({});
                    }}
                  />
                  <span
                    className={cx('mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 transition peer-focus-visible:ring-2 peer-focus-visible:ring-teal-soft', consent ? 'border-teal-main bg-teal-main text-white' : 'border-divider bg-white text-transparent')}
                    aria-hidden="true"
                  >
                    <Check size={16} strokeWidth={3} />
                  </span>
                  <span className="text-sm text-secondary">
                    Tôi đồng ý để NUTRIVA dùng thông tin trên để gợi ý sản phẩm và kế hoạch dinh dưỡng phù hợp. Thông tin chỉ dùng để cá nhân hóa, không chia sẻ cho bên thứ ba.
                  </span>
                </label>
                {errors.consent && <p className="-mt-4 text-xs font-semibold text-warm-dark">{errors.consent}</p>}
                <p className="flex items-start gap-2 rounded-lg bg-info p-4 text-sm text-secondary">
                  <ShieldCheck size={20} className="shrink-0 text-water-icon" aria-hidden="true" />
                  Có dị ứng hoặc lưu ý sức khỏe? Hãy kiểm tra kỹ thành phần trước khi dùng gợi ý.
                </p>
              </div>
            )}
            {step === 3 && (
              <form id="account-form" className="flex flex-col gap-4 rounded-xl bg-white p-4 shadow-card" onSubmit={submit} noValidate>
                <TextField id="email" label="Email" icon={Mail} type="email" inputMode="email" autoComplete="email" required placeholder="ban@email.com" value={account.email} onChange={(e) => setAccount({ ...account, email: e.target.value })} />
                <TextField
                  id="password"
                  label="Mật khẩu"
                  icon={Lock}
                  type={showPw ? 'text' : 'password'}
                  autoComplete="new-password"
                  minLength={6}
                  required
                  hint="Tối thiểu 6 ký tự."
                  value={account.password}
                  onChange={(e) => setAccount({ ...account, password: e.target.value })}
                  trailing={
                    <button type="button" onClick={() => setShowPw(!showPw)} aria-label={showPw ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} className="-mr-2 grid h-10 w-10 place-items-center rounded-full text-subtle hover:bg-surface">
                      {showPw ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
                    </button>
                  }
                />
                <ErrorNote error={serverError} />
                <p className="text-center text-sm text-muted">
                  Đã có tài khoản?{' '}
                  <Link to="/login" className="font-bold text-teal-dark hover:text-teal-deep">
                    Đăng nhập
                  </Link>
                </p>
              </form>
            )}
          </div>
        </div>
      </main>

      <BottomBar>
        {step < 3 ? (
          <PrimaryButton onClick={next} className="flex-1">
            {step === 2 ? 'Tạo kế hoạch của tôi' : 'Tiếp tục'} <ChevronRight size={20} aria-hidden="true" />
          </PrimaryButton>
        ) : (
          <PrimaryButton type="submit" form="account-form" loading={submitting} className="flex-1">
            Tạo tài khoản & bắt đầu
          </PrimaryButton>
        )}
      </BottomBar>
    </>
  );
}
