import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const NAV_ITEMS = [
  { to: "/", label: "儀表板", icon: "◱", end: true },
  { to: "/devices", label: "設備清單", icon: "▤" },
  { to: "/import", label: "Excel 匯入", icon: "⇪" },
  { to: "/history", label: "歷史紀錄", icon: "⟲" },
];

export default function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">HD</span>
          <div className="brand-text">
            <strong>POS 硬碟汰換</strong>
            <span>全館管理後台</span>
          </div>
        </div>
        <nav className="nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user-chip">
            <span className="user-dot" />
            <span className="user-email">{user?.email}</span>
          </div>
          <button className="btn-ghost" onClick={logout}>
            登出
          </button>
        </div>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
