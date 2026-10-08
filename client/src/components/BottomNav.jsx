import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  Home,
  CalendarCheck,
  ShoppingBag,
  User,
  Plus,
  GlassWater,
  Footprints,
} from "lucide-react";
import { MEALS } from "@shared/nutrition.js";
import { MEAL_THEME } from "../theme/meals.js";
import { colors } from "../theme/tokens.js";
import { Sheet } from "./ui.jsx";
import { cx } from "./ds/index.jsx";
import { prefetch } from "../lib/useApi.js";
import { today } from "../lib/format.js";

// Dữ liệu của từng tab — tải trước khi người dùng rê/chạm vào tab để mở trang là có ngay
const PREFETCH = {
  "/": () => [`/logs/${today()}`, `/plan/day?date=${today()}`],
  "/plan": () => [`/meal-plans/today?date=${today()}`, `/logs/${today()}`, "/meal-plans"],
  "/shop": () => ["/products", "/shop/config"],
  "/me": () => ["/orders"],
};
const warm = (to) => PREFETCH[to]?.().forEach(prefetch);

const TABS = [
  { to: "/", label: "Hôm nay", icon: Home, end: true },
  { to: "/plan", label: "Kế hoạch", icon: CalendarCheck },
  null, // chỗ cho nút + ở giữa
  { to: "/shop", label: "Cửa hàng", icon: ShoppingBag },
  { to: "/me", label: "Cá nhân", icon: User },
];

// Rãnh sóng ở giữa thanh điều hướng (theo Figma): rộng 208px, sâu 48px, hai đường cong mềm
const NOTCH_W = 208;
const BAR_H = 104;
function Notch() {
  return (
    <svg
      width={NOTCH_W}
      height={BAR_H}
      viewBox={`0 0 ${NOTCH_W} ${BAR_H}`}
      className="block shrink-0"
      aria-hidden="true"
    >
      <path
        d={`M0 0C44 0 60 48 104 48C148 48 164 0 ${NOTCH_W} 0V${BAR_H}H0Z`}
        fill="#fff"
      />
    </svg>
  );
}

function Tab({ to, label, icon: Icon, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      onPointerEnter={() => warm(to)}
      onTouchStart={() => warm(to)}
      onFocus={() => warm(to)}
      className={({ isActive }) =>
        cx(
          "flex h-14 w-[72px] flex-col items-center justify-center gap-1 rounded-md text-xs transition-colors duration-150",
          isActive
            ? "font-bold text-dark"
            : "font-medium text-nav-text hover:text-primary",
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            size={24}
            strokeWidth={isActive ? 2 : 1.75}
            fill={isActive ? colors.brand.soft : "none"}
            className={isActive ? "text-dark" : "text-nav-inactive"}
            aria-hidden="true"
          />
          {label}
        </>
      )}
    </NavLink>
  );
}

// Bảng ghi nhanh mở từ nút + : điều hướng về Hôm nay với ?sheet=…
function QuickAdd({ open, onClose }) {
  const navigate = useNavigate();
  const go = (sheet) => {
    onClose();
    navigate(`/?sheet=${sheet}`);
  };
  return (
    <Sheet open={open} onClose={onClose} title="Ghi nhanh">
      <div className="grid grid-cols-2 gap-4 pb-2">
        {MEALS.map((m) => {
          const t = MEAL_THEME[m.id];
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => go(m.id)}
              className={cx(
                "flex min-h-16 items-center gap-2 rounded-lg p-4 text-left text-sm font-bold text-primary transition active:scale-[0.98]",
                t.card,
              )}
            >
              <t.icon size={24} className={t.iconColor} aria-hidden="true" />{" "}
              {m.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => go("water")}
          className="flex min-h-16 items-center gap-2 rounded-lg bg-water-card p-4 text-left text-sm font-bold text-primary transition active:scale-[0.98]"
        >
          <GlassWater
            size={24}
            className="text-water-icon"
            aria-hidden="true"
          />{" "}
          Uống nước
        </button>
        <button
          type="button"
          onClick={() => {
            onClose();
            navigate("/activities");
          }}
          className="flex min-h-16 items-center gap-2 rounded-lg bg-torch-card p-4 text-left text-sm font-bold text-primary transition active:scale-[0.98]"
        >
          <Footprints size={24} className="text-warm-main" aria-hidden="true" />{" "}
          Vận động
        </button>
      </div>
    </Sheet>
  );
}

export default function BottomNav() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <nav
        aria-label="Điều hướng chính"
        className="fixed bottom-0 left-1/2 z-30 w-full max-w-app -translate-x-1/2 drop-shadow-[0_-8px_24px_rgba(20,33,27,0.08)]"
      >
        {/* Nút giữa nằm trong lòng sóng */}
        <button
          type="button"
          aria-label="Ghi nhanh bữa ăn, nước, vận động"
          aria-haspopup="dialog"
          onClick={() => setOpen(true)}
          className="absolute left-1/2 top-[-16px] z-10 grid h-14 w-14 -translate-x-1/2 place-items-center rounded-full bg-black text-white shadow-fab transition duration-150 hover:bg-primary active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-dark"
        >
          <Plus size={24} strokeWidth={2.5} aria-hidden="true" />
        </button>
        {/* Bề mặt: 2 mảng phẳng + rãnh sóng ở giữa */}
        <div className="flex items-stretch" style={{ height: BAR_H }}>
          <div className="flex-1 bg-white" />
          <Notch />
          <div className="flex-1 bg-white" />
        </div>
        {/* Tab nằm dưới phần lõm, trải đều toàn chiều ngang */}
        <div
          className="absolute inset-x-0 bottom-0 flex h-14 items-center justify-between px-4"
          style={{ bottom: "var(--safe-b)", marginBottom: 16 }}
        >
          {TABS.map((tab, i) =>
            tab ? (
              <Tab key={tab.to} {...tab} />
            ) : (
              <span
                key={`gap-${i}`}
                className="w-16 shrink-0"
                aria-hidden="true"
              />
            ),
          )}
        </div>
        <div className="bg-white" style={{ height: "var(--safe-b)" }} />
      </nav>
      <QuickAdd open={open} onClose={() => setOpen(false)} />
    </>
  );
}
