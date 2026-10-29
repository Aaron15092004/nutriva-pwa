import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { ErrorNote, Logo } from '../../components/ui.jsx';
import { TextField, PrimaryButton } from '../../components/ds/form.jsx';
import { HeroBackdrop } from '../../components/home/HomeHeader.jsx';

// Mở từ link trong email: /reset-password?token=...
export default function ResetPassword() {
  const { resetPassword } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (pw.length < 6) return setError('Mật khẩu cần ít nhất 6 ký tự');
    if (pw !== confirm) return setError('Hai mật khẩu chưa khớp');
    setError('');
    setLoading(true);
    try {
      await resetPassword(token, pw);
      toast('Đã đặt mật khẩu mới — các thiết bị khác đã được đăng xuất');
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const eye = (
    <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} className="-mr-2 grid h-10 w-10 place-items-center rounded-full text-subtle hover:bg-surface">
      {show ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
    </button>
  );

  return (
    <main className="relative flex min-h-dvh flex-col overflow-x-clip bg-gradient-to-b from-background via-surface to-background px-4 pb-[calc(24px+var(--safe-b))] pt-[max(24px,env(safe-area-inset-top))]">
      <HeroBackdrop />
      <div className="relative flex flex-1 flex-col gap-8">
        <header className="flex flex-col gap-2">
          <Logo size={36} />
          <h1 className="mt-4 font-display text-3xl font-bold text-brand-core [font-variation-settings:'SOFT'_100]">Đặt mật khẩu mới</h1>
          <p className="text-base text-secondary">Sau khi đổi, mọi thiết bị đang đăng nhập khác sẽ bị đăng xuất.</p>
        </header>

        {token ? (
          <form className="flex flex-col gap-4 rounded-xl bg-white p-4 shadow-card" onSubmit={submit}>
            <TextField id="pw" label="Mật khẩu mới" icon={Lock} type={show ? 'text' : 'password'} autoComplete="new-password" required minLength={6} value={pw} onChange={(e) => setPw(e.target.value)} trailing={eye} hint="Ít nhất 6 ký tự" />
            <TextField id="pw2" label="Nhập lại mật khẩu" icon={Lock} type={show ? 'text' : 'password'} autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            <ErrorNote error={error} />
            <PrimaryButton type="submit" loading={loading} className="w-full">
              Lưu mật khẩu
            </PrimaryButton>
          </form>
        ) : (
          <ErrorNote error="Link không hợp lệ — hãy mở đúng link trong email hoặc yêu cầu link mới." />
        )}

        <p className="text-center text-sm text-muted">
          Link hết hạn?{' '}
          <Link to="/forgot-password" className="font-bold text-brand-dark hover:text-brand-deep">
            Gửi lại link
          </Link>
        </p>
      </div>
    </main>
  );
}
