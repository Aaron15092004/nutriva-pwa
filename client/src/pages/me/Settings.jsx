import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, Target, Ban, Package, RefreshCw, ShieldCheck, Headphones, LogOut, Ruler, BarChart3, Download, Bell, CheckCircle2, LayoutDashboard, Store } from 'lucide-react';
import { ChannelSheet, useChannels } from '../../components/promo/ChannelLinks.jsx';
import { GOALS, FLAVORS, ingredientName } from '@shared/nutrition.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { usePwa } from '../../context/PwaContext.jsx';
import { TopBar } from '../../components/ui.jsx';
import { cx } from '../../components/ds/index.jsx';

function Row({ to, icon: Icon, label, sub, onClick, danger }) {
  const content = (
    <>
      <Icon size={20} aria-hidden="true" className={cx('shrink-0', danger ? 'text-warm-dark' : 'text-brand-dark')} />
      <span className="min-w-0 flex-1">
        <span className={cx('block text-base font-semibold', danger ? 'text-warm-dark' : 'text-primary')}>{label}</span>
        {sub && <span className="block truncate text-xs text-muted">{sub}</span>}
      </span>
      {!danger && <ChevronRight size={20} aria-hidden="true" className="shrink-0 text-divider" />}
    </>
  );
  const cls = 'flex min-h-14 w-full items-center gap-4 border-b border-surface py-3 text-left last:border-0';
  return to ? (
    <Link to={to} className={cls}>
      {content}
    </Link>
  ) : (
    <button type="button" className={cls} onClick={onClick}>
      {content}
    </button>
  );
}

const Group = ({ children }) => <section className="rounded-xl bg-white px-4 shadow-card">{children}</section>;

export default function Settings() {
  const { user, logout } = useAuth();
  const pwa = usePwa();
  const navigate = useNavigate();
  const p = user.profile;
  const channels = useChannels();
  const [channelsOpen, setChannelsOpen] = useState(false);

  const doLogout = () => {
    if (!window.confirm('Đăng xuất khỏi NUTRIVA?')) return;
    logout();
    navigate('/welcome', { replace: true });
  };

  return (
    <>
      <TopBar title="Cài đặt" fallback="/me" />
      <main className="flex flex-col gap-6 px-4 pb-[calc(32px+var(--safe-b))] pt-2">
        {pwa.showInstall && (
          <section className="flex items-center gap-4 rounded-xl bg-brand-core p-4 text-white shadow-card">
            <Download size={22} aria-hidden="true" className="shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">{pwa.installedOnDevice ? 'Ứng dụng đã được cài' : 'Cài đặt ứng dụng'}</p>
              <p className="text-xs text-brand-soft">{pwa.installedOnDevice ? 'Mở NUTRIVA từ màn hình chính' : 'Thêm NUTRIVA vào màn hình chính'}</p>
            </div>
            <button type="button" className="h-10 shrink-0 rounded-full bg-white px-4 text-sm font-bold text-brand-core" onClick={pwa.install}>
              {pwa.installedOnDevice ? 'Mở app' : 'Cài đặt'}
            </button>
          </section>
        )}
        {pwa.installed && (
          <p className="flex items-center gap-2 rounded-lg bg-info px-4 py-3 text-sm font-semibold text-secondary">
            <CheckCircle2 size={18} aria-hidden="true" className="text-water-icon" /> NUTRIVA đã được cài đặt trên thiết bị này.
          </p>
        )}

        {user.role === 'admin' && (
          <Link to="/admin" className="flex items-center gap-4 rounded-xl bg-brand-core p-4 text-white shadow-card">
            <span className="grid size-12 place-items-center rounded-full bg-white/15">
              <LayoutDashboard size={22} aria-hidden="true" />
            </span>
            <span className="flex-1">
              <span className="block font-bold">Trang quản trị</span>
              <span className="text-sm text-brand-soft">Tổng quan, đơn hàng, người dùng, nhật ký</span>
            </span>
            <ChevronRight size={20} aria-hidden="true" />
          </Link>
        )}

        <Group>
          <Row to="/me/edit" icon={Ruler} label="Hồ sơ dinh dưỡng" sub={`${p.heightCm} cm • ${String(p.weightKg).replace('.', ',')} kg • vòng eo ${p.waistCm} cm${p.waistEstimated ? ' (ước tính)' : ''}`} />
          <Row to="/me/edit?step=habits" icon={Target} label="Mục tiêu & sở thích" sub={`${GOALS.find((g) => g.id === p.goal)?.label} • ${FLAVORS.find((f) => f.id === p.flavor)?.label}`} />
          <Row to="/me/edit?step=allergy" icon={Ban} label="Dị ứng & thực phẩm cần tránh" sub={p.allergies.length ? p.allergies.map(ingredientName).join(', ') : 'Không có'} />
          <Row to="/track" icon={BarChart3} label="Theo dõi tiến độ" sub="Nước, vận động, mức tuân thủ theo tuần" />
          <Row to="/track/reminders" icon={Bell} label="Nhắc nhở" />
        </Group>

        <Group>
          <Row to="/orders" icon={Package} label="Đơn hàng của tôi" />
          <Row to="/me/subscriptions" icon={RefreshCw} label="Gói định kỳ" />
          {channels.length > 0 && <Row icon={Store} label="Kênh bán hàng chính thức" sub={channels.map((c) => c.label).join(' • ')} onClick={() => setChannelsOpen(true)} />}
        </Group>

        <Group>
          <Row to="/me/privacy" icon={ShieldCheck} label="Quyền riêng tư & bảo mật" sub="Mật khẩu, thiết bị đăng nhập, dữ liệu của tôi" />
          <Row to="/me/support" icon={Headphones} label="Hỗ trợ" />
        </Group>

        <Group>
          <Row icon={LogOut} label="Đăng xuất" onClick={doLogout} danger />
        </Group>
        <p className="text-center text-xs text-muted">NUTRIVA • Phiên bản 1.2</p>
        <ChannelSheet open={channelsOpen} onClose={() => setChannelsOpen(false)} from="settings" />
      </main>
    </>
  );
}
