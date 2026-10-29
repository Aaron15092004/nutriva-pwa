import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, MailCheck } from 'lucide-react';
import { api } from '../../lib/api.js';
import { ErrorNote } from '../../components/ui.jsx';
import { CircleButton } from '../../components/ds/index.jsx';
import { TextField, PrimaryButton } from '../../components/ds/form.jsx';
import { HeroBackdrop } from '../../components/home/HomeHeader.jsx';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState(location.state?.email ?? '');
  const [sent, setSent] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const d = await api.post('/auth/forgot', { email: email.trim() });
      setSent(d.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative flex min-h-dvh flex-col overflow-x-clip bg-gradient-to-b from-background via-surface to-background px-4 pb-[calc(24px+var(--safe-b))] pt-[max(16px,env(safe-area-inset-top))]">
      <HeroBackdrop />
      <div className="relative flex flex-1 flex-col gap-8">
        <CircleButton icon={ArrowLeft} label="Quay lại" onClick={() => navigate('/login')} className="bg-white text-primary shadow-pill" size={48} iconSize={22} />
        <header className="flex flex-col gap-2">
          <h1 className="font-display text-3xl font-bold text-brand-core [font-variation-settings:'SOFT'_100]">Quên mật khẩu</h1>
          <p className="text-base text-secondary">Nhập email đã đăng ký, NUTRIVA sẽ gửi link để bạn đặt mật khẩu mới.</p>
        </header>

        {sent ? (
          <section role="status" className="flex flex-col items-center gap-4 rounded-xl bg-white p-6 text-center shadow-card">
            <span className="grid size-16 place-items-center rounded-full bg-brand-light text-brand-dark">
              <MailCheck size={32} aria-hidden="true" />
            </span>
            <p className="text-base font-semibold text-primary">{sent}</p>
            <p className="text-sm text-muted">Link có hiệu lực trong 30 phút. Tài khoản đăng nhập bằng Google thì dùng nút “Tiếp tục với Google”.</p>
            <PrimaryButton type="button" variant="outline" className="w-full" onClick={() => navigate('/login')}>
              Về trang đăng nhập
            </PrimaryButton>
          </section>
        ) : (
          <form className="flex flex-col gap-4 rounded-xl bg-white p-4 shadow-card" onSubmit={submit}>
            <TextField id="email" label="Email" icon={Mail} type="email" autoComplete="email" inputMode="email" required placeholder="ban@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <ErrorNote error={error} />
            <PrimaryButton type="submit" loading={loading} className="w-full">
              Gửi link đặt lại
            </PrimaryButton>
          </form>
        )}
      </div>
    </main>
  );
}
