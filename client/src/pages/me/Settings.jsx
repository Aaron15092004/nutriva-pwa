import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, Target, Ban, Package, RefreshCw, ShieldCheck, Headphones, LogOut, Ruler, BarChart3, Download, Bell, CheckCircle2, LayoutDashboard } from 'lucide-react';
import { GOALS, FLAVORS, ingredientName } from '@shared/nutrition.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { usePwa } from '../../context/PwaContext.jsx';
import { useCart } from '../../context/CartContext.jsx';
import { TopBar } from '../../components/ui.jsx';

function Row({ to, icon: Icon, label, sub, onClick, danger }) {
  const content = (
    <>
      <Icon size={20} color={danger ? 'var(--danger)' : undefined} />
      <span className="grow">
        <span style={{ display: 'block', color: danger ? 'var(--danger)' : undefined }}>{label}</span>
        {sub && <span className="xs muted">{sub}</span>}
      </span>
      {!danger && <ChevronRight size={20} className="chev" />}
    </>
  );
  return to ? <Link to={to} className="list-row">{content}</Link> : <button className="list-row" onClick={onClick}>{content}</button>;
}

export default function Settings() {
  const { user, logout } = useAuth();
  const pwa = usePwa();
  const cart = useCart();
  const navigate = useNavigate();
  const p = user.profile;

  const doLogout = () => {
    if (!window.confirm('Đăng xuất khỏi NUTRIVA?')) return;
    cart.clear();
    logout();
    navigate('/welcome', { replace: true });
  };

  return (
    <>
      <TopBar title="Cài đặt" />
      <main className="page no-nav stack-lg">
      {pwa.showInstall && (
        <section className="install-banner">
          <Download size={22} />
          <div className="grow">
            <div className="strong">{pwa.installedOnDevice ? 'Ứng dụng đã được cài' : 'Cài đặt ứng dụng'}</div>
            <div className="xs" style={{ opacity: 0.9 }}>{pwa.installedOnDevice ? 'Mở NUTRIVA từ màn hình chính' : 'Thêm NUTRIVA vào màn hình chính'}</div>
          </div>
          <button className="btn" onClick={pwa.install}>{pwa.installedOnDevice ? 'Mở app' : 'Cài đặt'}</button>
        </section>
      )}
      {pwa.installed && (
        <div className="notice info"><CheckCircle2 size={18} /> NUTRIVA đã được cài đặt trên thiết bị này.</div>
      )}

      {user.role === 'admin' && (
        <Link to="/admin" className="card card-link" style={{ background: 'var(--green-900)', color: '#fff' }}>
          <span className="icon-tile" style={{ background: 'rgba(255,255,255,.15)', color: '#fff' }}><LayoutDashboard size={22} /></span>
          <span className="grow"><b style={{ display: 'block' }}>Trang quản trị</b><span className="small" style={{ opacity: 0.85 }}>Đơn hàng, sản phẩm, người dùng, cài đặt</span></span>
          <ChevronRight size={20} />
        </Link>
      )}

      <section className="card" style={{ padding: '4px 14px' }}>
        <Row to="/me/edit" icon={Ruler} label="Hồ sơ dinh dưỡng" sub={`${p.heightCm} cm • ${String(p.weightKg).replace('.', ',')} kg • vòng eo ${p.waistCm} cm`} />
        <Row to="/me/edit?step=habits" icon={Target} label="Mục tiêu & sở thích" sub={`${GOALS.find((g) => g.id === p.goal)?.label} • ${FLAVORS.find((f) => f.id === p.flavor)?.label}`} />
        <Row to="/me/edit?step=allergy" icon={Ban} label="Dị ứng & thực phẩm cần tránh" sub={p.allergies.length ? p.allergies.map(ingredientName).join(', ') : 'Không có'} />
        <Row to="/track" icon={BarChart3} label="Theo dõi tiến độ" sub="Nước, vận động, mức tuân thủ theo tuần" />
        <Row to="/track/reminders" icon={Bell} label="Nhắc nhở" />
      </section>

      <section className="card" style={{ padding: '4px 14px' }}>
        <Row to="/orders" icon={Package} label="Đơn hàng của tôi" />
        <Row to="/me/subscriptions" icon={RefreshCw} label="Gói định kỳ" />
      </section>

      <section className="card" style={{ padding: '4px 14px' }}>
        <Row to="/me/privacy" icon={ShieldCheck} label="Quyền riêng tư & dữ liệu" />
        <Row to="/me/support" icon={Headphones} label="Hỗ trợ" />
      </section>

      <section className="card" style={{ padding: '4px 14px' }}>
        <Row icon={LogOut} label="Đăng xuất" onClick={doLogout} danger />
      </section>
      <p className="xs muted center">NUTRIVA • Phiên bản 1.0</p>
      </main>
    </>
  );
}
