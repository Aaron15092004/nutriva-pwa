import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Download, Trash2, Lock, LogOut, Eye, EyeOff } from 'lucide-react';
import { useToast } from '../../context/ToastContext.jsx';
import { api } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { TopBar, ErrorNote } from '../../components/ui.jsx';
import { IconCircle } from '../../components/ds/index.jsx';
import { TextField, PrimaryButton } from '../../components/ds/form.jsx';

export default function Privacy() {
  const { user, logout, replaceToken, setUser } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [pw, setPw] = useState({ current: '', next: '' });
  const [show, setShow] = useState(false);
  const [pwError, setPwError] = useState('');
  const hasPassword = user.hasPassword !== false;

  const changePassword = async (e) => {
    e.preventDefault();
    setBusy('pw');
    setPwError('');
    try {
      const d = await api.post('/auth/me/password', hasPassword ? pw : { next: pw.next });
      replaceToken(d.token); // các thiết bị khác bị đăng xuất, thiết bị này giữ phiên
      if (!hasPassword) setUser({ ...user, hasPassword: true });
      setPw({ current: '', next: '' });
      toast(hasPassword ? 'Đã đổi mật khẩu — các thiết bị khác đã được đăng xuất' : 'Đã đặt mật khẩu — giờ bạn có thể đăng nhập bằng email');
    } catch (err) {
      setPwError(err.message);
    } finally {
      setBusy('');
    }
  };

  const logoutAll = async () => {
    if (!window.confirm('Đăng xuất NUTRIVA trên tất cả thiết bị khác? Thiết bị này vẫn giữ đăng nhập.')) return;
    setBusy('all');
    setError('');
    try {
      replaceToken((await api.post('/auth/me/logout-all')).token);
      toast('Đã đăng xuất khỏi các thiết bị khác');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  };

  const exportData = async () => {
    setBusy('export');
    setError('');
    try {
      const [orders, subs, reminders, weights] = await Promise.all([api.get('/orders'), api.get('/subscriptions'), api.get('/reminders'), api.get('/auth/me/weights?days=365')]);
      const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), user, ...orders, ...subs, ...reminders, weights: weights.entries }, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'nutriva-du-lieu-cua-toi.json';
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  };

  const deleteAccount = async () => {
    if (!window.confirm('Xóa vĩnh viễn tài khoản? Nhật ký, kế hoạch, cân nặng, trò chuyện sẽ bị xóa. Đơn hàng cũ được giữ ở dạng ẩn danh cho mục đích kế toán. Không thể hoàn tác.')) return;
    setBusy('delete');
    try {
      await api.del('/auth/me');
      logout();
      navigate('/welcome', { replace: true });
    } catch (e) {
      setError(e.message);
      setBusy('');
    }
  };

  const eye = (
    <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} className="-mr-2 grid h-10 w-10 place-items-center rounded-full text-subtle hover:bg-surface">
      {show ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
    </button>
  );

  return (
    <>
      <TopBar title="Quyền riêng tư & dữ liệu" fallback="/me/settings" />
      <main className="flex flex-col gap-6 px-4 pb-[calc(32px+var(--safe-b))] pt-2">
        <section className="flex items-start gap-4 rounded-xl bg-white p-4 shadow-card">
          <IconCircle icon={ShieldCheck} className="bg-brand-light text-brand-dark" size={44} iconSize={22} />
          <div className="flex flex-col gap-2">
            <h2 className="text-base font-bold text-primary">NUTRIVA dùng dữ liệu của bạn như thế nào?</h2>
            <p className="text-sm text-secondary">Thông tin cơ thể, thói quen và thực phẩm cần tránh chỉ dùng để tính chỉ số sức khỏe, tạo kế hoạch ăn uống và gợi ý sản phẩm phù hợp. Chúng tôi không bán hay chia sẻ dữ liệu cho bên thứ ba.</p>
            <p className="text-xs text-muted">Bạn đã đồng ý điều khoản khi tạo tài khoản.</p>
          </div>
        </section>

        <form className="flex flex-col gap-4 rounded-xl bg-white p-4 shadow-card" onSubmit={changePassword}>
          <h2 className="flex items-center gap-2 text-base font-bold text-primary">
            <Lock size={18} className="text-brand-main" aria-hidden="true" /> {hasPassword ? 'Đổi mật khẩu' : 'Đặt mật khẩu'}
          </h2>
          {!hasPassword && <p className="-mt-2 text-sm text-secondary">Bạn đang đăng nhập bằng Google. Đặt mật khẩu để có thể đăng nhập cả bằng email.</p>}
          {hasPassword && (
            <TextField id="pw-current" label="Mật khẩu hiện tại" icon={Lock} type={show ? 'text' : 'password'} autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} trailing={eye} />
          )}
          <TextField id="pw-next" label="Mật khẩu mới" icon={Lock} type={show ? 'text' : 'password'} autoComplete="new-password" minLength={6} hint="Ít nhất 6 ký tự" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} trailing={hasPassword ? undefined : eye} />
          <ErrorNote error={pwError} />
          <PrimaryButton type="submit" variant="outline" loading={busy === 'pw'} disabled={(hasPassword && !pw.current) || pw.next.length < 6} className="w-full">
            {hasPassword ? 'Cập nhật mật khẩu' : 'Đặt mật khẩu'}
          </PrimaryButton>
        </form>

        <section className="flex flex-col gap-3">
          <PrimaryButton variant="soft" loading={busy === 'all'} onClick={logoutAll} className="w-full">
            <LogOut size={18} aria-hidden="true" /> Đăng xuất khỏi mọi thiết bị khác
          </PrimaryButton>
          <PrimaryButton variant="soft" loading={busy === 'export'} onClick={exportData} className="w-full">
            <Download size={18} aria-hidden="true" /> Tải xuống dữ liệu của tôi
          </PrimaryButton>
          <PrimaryButton variant="soft" loading={busy === 'delete'} onClick={deleteAccount} className="w-full !text-warm-dark">
            <Trash2 size={18} aria-hidden="true" /> Xóa tài khoản
          </PrimaryButton>
          <ErrorNote error={error} />
        </section>
      </main>
    </>
  );
}
