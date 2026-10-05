import { useEffect, useState } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { LayoutDashboard, Receipt, Milk, Apple, Soup, TicketPercent, Users, RefreshCw, Headphones, Settings, ArrowLeft, Menu, Flame, CalendarRange } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../lib/api.js';
import { Logo } from '../components/ui.jsx';
import ResourcePage from './ResourcePage.jsx';
import * as R from './resources.jsx';
import Dashboard from './Dashboard.jsx';
import Orders from './Orders.jsx';
import UsersPage from './Users.jsx';
import Subscriptions from './Subscriptions.jsx';
import Support from './Support.jsx';
import SettingsPage from './Settings.jsx';
import './admin.css';

const NAV = [
  { to: '/admin', label: 'Tổng quan', icon: LayoutDashboard, end: true },
  { to: '/admin/orders', label: 'Đơn hàng', icon: Receipt, badge: 'pending' },
  { to: '/admin/products', label: 'Sản phẩm', icon: Milk },
  { to: '/admin/foods', label: 'Thực phẩm', icon: Apple },
  { to: '/admin/dishes', label: 'Món ăn', icon: Soup },
  { to: '/admin/meal-plans', label: 'Kế hoạch ăn mẫu', icon: CalendarRange },
  { to: '/admin/activities', label: 'Hoạt động đốt calo', icon: Flame },
  { to: '/admin/coupons', label: 'Mã giảm giá', icon: TicketPercent },
  { to: '/admin/users', label: 'Người dùng', icon: Users },
  { to: '/admin/subscriptions', label: 'Gói định kỳ', icon: RefreshCw },
  { to: '/admin/support', label: 'Hỗ trợ', icon: Headphones, badge: 'openSupport' },
  { to: '/admin/settings', label: 'Cài đặt', icon: Settings },
];

export default function AdminApp() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState({});

  useEffect(() => {
    setOpen(false);
    api.get('/admin/stats').then(setCounts).catch(() => {});
  }, [pathname]);

  useEffect(() => {
    document.title = 'NUTRIVA Admin';
    return () => {
      document.title = 'NUTRIVA';
    };
  }, []);

  return (
    <div className="admin">
      <div className="admin-mobilebar">
        <button className="icon-btn" aria-label="Mở menu" onClick={() => setOpen(true)}><Menu size={22} /></button>
        <b>NUTRIVA Admin</b>
      </div>
      <nav className={`admin-side ${open ? 'open' : ''}`} aria-label="Quản trị">
        <div className="brand">
          <Logo size={32} tone="white" />
        </div>
        {NAV.map(({ to, label, icon: Icon, end, badge }) => (
          <NavLink key={to} to={to} end={end}>
            <Icon size={19} /> {label}
            {badge && counts[badge] > 0 && <span className="count">{counts[badge]}</span>}
          </NavLink>
        ))}
        <div className="foot stack" style={{ gap: 4 }}>
          <NavLink to="/"><ArrowLeft size={19} /> Về ứng dụng</NavLink>
          <span className="xs" style={{ padding: '4px 12px', opacity: 0.7 }}>{user.email}</span>
        </div>
      </nav>
      {open && <div className="a-drawer-backdrop" style={{ zIndex: 65 }} onClick={() => setOpen(false)} />}
      <main className="admin-main">
        <Routes>
          <Route path="/admin">
          <Route index element={<Dashboard />} />
          <Route path="orders" element={<Orders />} />
          <Route path="products" element={<ResourcePage key="p" config={R.products} />} />
          <Route path="foods" element={<ResourcePage key="f" config={R.foods} />} />
          <Route path="dishes" element={<ResourcePage key="d" config={R.dishes} />} />
          <Route path="meal-plans" element={<ResourcePage key="mp" config={R.mealPlans} />} />
          <Route path="activities" element={<ResourcePage key="a" config={R.activities} />} />
          <Route path="coupons" element={<ResourcePage key="c" config={R.coupons} />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="subscriptions" element={<Subscriptions />} />
          <Route path="support" element={<Support />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
          </Route>
        </Routes>
      </main>
    </div>
  );
}
