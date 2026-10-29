import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { ErrorNote, Logo } from '../../components/ui.jsx';
import { CircleButton } from '../../components/ds/index.jsx';
import { TextField, PrimaryButton } from '../../components/ds/form.jsx';
import { HeroBackdrop } from '../../components/home/HomeHeader.jsx';
import GoogleButton, { GOOGLE_PENDING_KEY } from '../../components/GoogleButton.jsx';
import { useToast } from '../../context/ToastContext.jsx';

export default function Login() {
  const { login, loginWithGoogle } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate(location.state?.from ?? '/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Google: tài khoản đã có → vào app; chưa có → sang onboarding (giữ phiên Google để hoàn tất ở bước cuối)
  const onGoogle = async (credential) => {
    setError('');
    setLoading(true);
    try {
      await loginWithGoogle(credential);
      navigate(location.state?.from ?? '/', { replace: true });
    } catch (err) {
      if (err.data?.code === 'NEEDS_ONBOARDING') {
        sessionStorage.setItem(GOOGLE_PENDING_KEY, JSON.stringify({ credential, email: err.data.email, name: err.data.name, at: Date.now() }));
        toast('Chào bạn mới! Trả lời vài câu hỏi để NUTRIVA tạo kế hoạch nhé');
        navigate('/onboarding');
      } else setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative flex min-h-dvh flex-col overflow-x-clip bg-gradient-to-b from-background via-surface to-background px-4 pb-[calc(24px+var(--safe-b))] pt-[max(16px,env(safe-area-inset-top))]">
      <HeroBackdrop />
      <div className="relative flex flex-1 flex-col gap-8">
        <CircleButton icon={ArrowLeft} label="Quay lại" onClick={() => navigate('/welcome')} className="bg-white text-primary shadow-pill" size={48} iconSize={22} />

        <header className="flex flex-col gap-2">
          <Logo size={36} />
          <h1 className="mt-4 font-display text-3xl font-bold text-brand-core [font-variation-settings:'SOFT'_100]">Chào mừng trở lại</h1>
          <p className="text-base text-secondary">Đăng nhập để tiếp tục kế hoạch dinh dưỡng của bạn.</p>
        </header>

        <GoogleButton onCredential={onGoogle} text="continue_with" />
        <div className="-my-4 flex items-center gap-4 text-xs text-muted" aria-hidden="true">
          <span className="h-px flex-1 bg-border" /> hoặc đăng nhập bằng email <span className="h-px flex-1 bg-border" />
        </div>

        <form className="flex flex-col gap-4 rounded-xl bg-white p-4 shadow-card" onSubmit={submit}>
          <TextField id="email" label="Email" icon={Mail} type="email" autoComplete="email" inputMode="email" required placeholder="ban@email.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <TextField
            id="password"
            label="Mật khẩu"
            icon={Lock}
            type={showPw ? 'text' : 'password'}
            autoComplete="current-password"
            required
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            trailing={
              <button type="button" onClick={() => setShowPw(!showPw)} aria-label={showPw ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} className="-mr-2 grid h-10 w-10 place-items-center rounded-full text-subtle hover:bg-surface">
                {showPw ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
              </button>
            }
          />
          <Link to="/forgot-password" state={{ email: form.email }} className="-mt-1 self-end py-2 text-sm font-bold text-brand-dark hover:text-brand-deep">
            Quên mật khẩu?
          </Link>
          <ErrorNote error={error} />
          <PrimaryButton type="submit" loading={loading} className="w-full">
            Đăng nhập
          </PrimaryButton>
        </form>

        <p className="mt-auto text-center text-sm text-muted">
          Chưa có tài khoản?{' '}
          <Link to="/onboarding" className="font-bold text-brand-dark hover:text-brand-deep">
            Bắt đầu ngay
          </Link>
        </p>
      </div>
    </main>
  );
}
