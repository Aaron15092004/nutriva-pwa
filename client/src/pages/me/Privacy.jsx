import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Download, Trash2, Lock } from 'lucide-react';
import { useToast } from '../../context/ToastContext.jsx';
import { api } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useCart } from '../../context/CartContext.jsx';
import { TopBar, Button, ErrorNote } from '../../components/ui.jsx';

export default function Privacy() {
  const { user, logout } = useAuth();
  const cart = useCart();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();
  const [pw, setPw] = useState({ current: '', next: '' });
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState('');

  const changePassword = async (e) => {
    e.preventDefault();
    setPwBusy(true);
    setPwError('');
    try {
      await api.post('/auth/me/password', pw);
      setPw({ current: '', next: '' });
      toast('Đã đổi mật khẩu');
    } catch (err) {
      setPwError(err.message);
    } finally {
      setPwBusy(false);
    }
  };

  const exportData = async () => {
    setBusy(true);
    try {
      const [orders, subs, reminders] = await Promise.all([api.get('/orders'), api.get('/subscriptions'), api.get('/reminders')]);
      const blob = new Blob([JSON.stringify({ user, ...orders, ...subs, ...reminders }, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'nutriva-du-lieu-cua-toi.json';
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const deleteAccount = async () => {
    if (!window.confirm('Xóa vĩnh viễn tài khoản và toàn bộ dữ liệu? Thao tác này không thể hoàn tác.')) return;
    setBusy(true);
    try {
      await api.del('/auth/me');
      cart.clear();
      logout();
      navigate('/welcome', { replace: true });
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <>
      <TopBar title="Quyền riêng tư & dữ liệu" />
      <main className="page no-nav stack-lg">
        <div className="card row" style={{ alignItems: 'flex-start' }}>
          <span className="icon-tile"><ShieldCheck size={22} /></span>
          <div className="stack" style={{ gap: 6 }}>
            <b>NUTRIVA dùng dữ liệu của bạn như thế nào?</b>
            <p className="small muted">Thông tin cơ thể, thói quen và thực phẩm cần tránh chỉ được dùng để tính chỉ số sức khỏe, tạo kế hoạch ăn uống và gợi ý sản phẩm phù hợp. Chúng tôi không bán hay chia sẻ dữ liệu cho bên thứ ba.</p>
            <p className="xs muted">Bạn đã đồng ý điều khoản khi tạo tài khoản.</p>
          </div>
        </div>
        <form className="card stack" onSubmit={changePassword}>
          <h2 className="title-sm row" style={{ gap: 6 }}><Lock size={18} color="var(--primary-600)" /> Đổi mật khẩu</h2>
          <div className="input-wrap"><input type="password" autoComplete="current-password" aria-label="Mật khẩu hiện tại" placeholder="Mật khẩu hiện tại" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></div>
          <div className="input-wrap"><input type="password" autoComplete="new-password" aria-label="Mật khẩu mới" placeholder="Mật khẩu mới (≥ 6 ký tự)" minLength={6} value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></div>
          <ErrorNote error={pwError} />
          <Button type="submit" className="btn-soft btn-block" loading={pwBusy} disabled={!pw.current || pw.next.length < 6}>Cập nhật mật khẩu</Button>
        </form>
        <Button className="btn-outline btn-block" loading={busy} onClick={exportData}><Download size={18} /> Tải xuống dữ liệu của tôi</Button>
        <Button className="btn-danger btn-block" disabled={busy} onClick={deleteAccount}><Trash2 size={18} /> Xóa tài khoản</Button>
        <ErrorNote error={error} />
      </main>
    </>
  );
}
