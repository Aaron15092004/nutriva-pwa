import { lazy, Suspense, useEffect, useLayoutEffect } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation, useNavigationType } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import { InstallGuide, Logo } from './components/ui.jsx';
import BottomNav from './components/BottomNav.jsx';
import Home from './pages/Home.jsx';
import Welcome from './pages/onboarding/Welcome.jsx';

// Trang tải theo nhu cầu (tách bundle); sau khi app rảnh sẽ tải trước toàn bộ để chuyển trang tức thì
const loaders = [];
const page = (load) => {
  loaders.push(load);
  return lazy(load);
};
const Onboarding = page(() => import('./pages/onboarding/Onboarding.jsx'));
const Login = page(() => import('./pages/onboarding/Login.jsx'));
const Plan = page(() => import('./pages/plan/Plan.jsx'));
const PlanAdjust = page(() => import('./pages/plan/PlanAdjust.jsx'));
const PlanDetail = page(() => import('./pages/plan/PlanDetail.jsx'));
const PlanIngredients = page(() => import('./pages/plan/PlanIngredients.jsx'));
const Why = page(() => import('./pages/plan/Why.jsx'));
const Shop = page(() => import('./pages/shop/Shop.jsx'));
const ProductDetail = page(() => import('./pages/shop/ProductDetail.jsx'));
const DiyGuide = page(() => import('./pages/shop/DiyGuide.jsx'));
const Subscribe = page(() => import('./pages/shop/Subscribe.jsx'));
const Cart = page(() => import('./pages/shop/Cart.jsx'));
const Checkout = page(() => import('./pages/shop/Checkout.jsx'));
const OrderDetail = page(() => import('./pages/shop/OrderDetail.jsx'));
const Orders = page(() => import('./pages/shop/Orders.jsx'));
const Track = page(() => import('./pages/track/Track.jsx'));
const Reminders = page(() => import('./pages/track/Reminders.jsx'));
const Assistant = page(() => import('./pages/track/Assistant.jsx'));
const Profile = page(() => import('./pages/me/Profile.jsx'));
const EditProfile = page(() => import('./pages/me/EditProfile.jsx'));
const Subscriptions = page(() => import('./pages/me/Subscriptions.jsx'));
const Privacy = page(() => import('./pages/me/Privacy.jsx'));
const Support = page(() => import('./pages/me/Support.jsx'));
const SettingsPage = page(() => import('./pages/me/Settings.jsx'));
const Activities = page(() => import('./pages/activity/Activities.jsx'));
const ActivityDetail = page(() => import('./pages/activity/ActivityDetail.jsx'));
const AdminApp = lazy(() => import('./admin/AdminApp.jsx'));

function usePreloadPages(enabled) {
  useEffect(() => {
    if (!enabled) return undefined;
    const idle = window.requestIdleCallback ?? ((cb) => setTimeout(cb, 1200));
    const cancel = window.cancelIdleCallback ?? clearTimeout;
    const id = idle(() => loaders.forEach((l) => l().catch(() => {})));
    return () => cancel(id);
  }, [enabled]);
}

// Cuộn: trang mới lên đầu; bấm Quay lại thì trở về đúng vị trí cũ
const scrollPos = new Map();
function ScrollManager() {
  const { key, pathname } = useLocation();
  const nav = useNavigationType();
  useLayoutEffect(() => {
    window.scrollTo(0, nav === 'POP' ? scrollPos.get(key) ?? 0 : 0);
    return () => scrollPos.set(key, window.scrollY);
  }, [key, pathname, nav]);
  return null;
}

// Màn hình chờ: logo lớn để tăng nhận diện thương hiệu (trùng với splash tĩnh trong index.html)
function Splash() {
  return (
    <div className="splash" role="status" aria-label="Đang tải NUTRIVA">
      <Logo size={88} />
    </div>
  );
}

// Khung tạm khi chunk của trang chưa tải xong (hiếm vì đã tải trước)
function RouteFallback() {
  return (
    <div className="flex flex-col gap-4 px-4 pt-6" aria-hidden="true">
      <div className="skeleton h-8 w-48 rounded-md" />
      <div className="skeleton h-40 rounded-xl" />
      <div className="skeleton h-24 rounded-xl" />
    </div>
  );
}

// Nội dung trang mờ dần khi chuyển route (chỉ opacity → không ảnh hưởng thanh fixed)
function Animated() {
  const { pathname } = useLocation();
  return (
    <div key={pathname} className="page-fade">
      <Suspense fallback={<RouteFallback />}>
        <Outlet />
      </Suspense>
    </div>
  );
}

function Private({ withNav }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/welcome" replace />;
  return (
    <>
      <Animated />
      {withNav && <BottomNav />}
    </>
  );
}

function PublicOnly() {
  const { user } = useAuth();
  const location = useLocation();
  return user ? <Navigate to={location.state?.from ?? '/'} replace /> : <Animated />;
}

export default function App() {
  const { ready, user } = useAuth();
  const { pathname } = useLocation();
  usePreloadPages(ready && Boolean(user));

  if (!ready) return <Splash />;

  // Khu quản trị: layout riêng, rộng toàn màn hình
  if (pathname.startsWith('/admin')) {
    if (!user) return <Navigate to="/login" replace state={{ from: pathname }} />;
    if (user.role !== 'admin') return <Navigate to="/" replace />;
    return (
      <Suspense fallback={<Splash />}>
        <AdminApp />
      </Suspense>
    );
  }

  return (
    <div className="app">
      <ScrollManager />
      <Routes>
        <Route element={<PublicOnly />}>
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/login" element={<Login />} />
        </Route>

        <Route element={<Private withNav />}>
          <Route path="/" element={<Home />} />
          <Route path="/plan" element={<Plan />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/track" element={<Track />} />
          <Route path="/me" element={<Profile />} />
        </Route>

        <Route element={<Private />}>
          <Route path="/activities" element={<Activities />} />
          <Route path="/activities/:slug" element={<ActivityDetail />} />
          <Route path="/plan/adjust/:date/:meal" element={<PlanAdjust />} />
          <Route path="/plan/templates" element={<Navigate to="/plan?tab=explore" replace />} />
          <Route path="/plan/m/:id" element={<PlanDetail />} />
          <Route path="/plan/m/:id/ingredients" element={<PlanIngredients />} />
          <Route path="/why/:slug" element={<Why />} />
          <Route path="/shop/p/:slug" element={<ProductDetail />} />
          <Route path="/shop/p/:slug/guide" element={<DiyGuide />} />
          <Route path="/shop/subscribe" element={<Subscribe />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/orders/:id" element={<OrderDetail />} />
          <Route path="/track/reminders" element={<Reminders />} />
          <Route path="/assistant" element={<Assistant />} />
          <Route path="/me/settings" element={<SettingsPage />} />
          <Route path="/me/edit" element={<EditProfile />} />
          <Route path="/me/subscriptions" element={<Subscriptions />} />
          <Route path="/me/privacy" element={<Privacy />} />
          <Route path="/me/support" element={<Support />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <InstallGuide />
    </div>
  );
}
