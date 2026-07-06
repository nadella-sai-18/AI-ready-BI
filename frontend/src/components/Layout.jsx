import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import IntegrationButtons from "./IntegrationButtons.jsx";
import { Icon } from "./Icons.jsx";

const NAV = [
  { to: "/", label: "Dashboard", end: true, icon: "dashboard" },
  { to: "/students", label: "Students", icon: "students" },
  { to: "/faculty", label: "Faculty", icon: "faculty" },
  { to: "/programs", label: "Branches", icon: "programs" },
  { to: "/academic-years", label: "Academic Years", icon: "academic" },
  { to: "/semesters", label: "Semesters", icon: "semesters" },
  { to: "/courses", label: "Courses", icon: "courses" },
  { to: "/attendance", label: "Attendance", icon: "attendance" },
  { to: "/exams", label: "Exams", icon: "exams" },
  { to: "/marks", label: "Marks", icon: "marks" },
  { to: "/competencies", label: "Competencies", icon: "competencies" },
];

function SidebarContent({ onNavigate }) {
  return (
    <div className="flex h-full flex-col bg-brand-950 text-brand-100">
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 font-bold text-white shadow-lg shadow-brand-900/40">
          AI
        </div>
        <div>
          <div className="text-sm font-semibold text-white">AI-Ready BI</div>
          <div className="text-xs text-brand-300">College Analytics</div>
        </div>
      </div>

      <div className="px-5 pb-2 pt-2 text-[11px] font-semibold uppercase tracking-wider text-brand-400/80">
        Menu
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                isActive
                  ? "bg-brand-600 text-white shadow-sm"
                  : "text-brand-200 hover:bg-white/5 hover:text-white"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  name={item.icon}
                  className={`h-[18px] w-[18px] ${isActive ? "text-white" : "text-brand-300 group-hover:text-white"}`}
                />
                {item.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="space-y-3 border-t border-white/10 px-4 py-4">
        <div className="px-1 text-[11px] font-semibold uppercase tracking-wider text-brand-400/80">
          Integrations
        </div>
        <IntegrationButtons compact />
        <div className="flex items-center gap-2 px-1 text-xs text-brand-300">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          System online
        </div>
      </div>
    </div>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const currentLabel = NAV.find((n) => n.to === location.pathname)?.label || "Dashboard";

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 flex-shrink-0 md:block">
        <div className="sticky top-0 h-screen">
          <SidebarContent />
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-slate-900/50 animate-fade-in"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-64 shadow-2xl animate-slide-in-right">
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur md:px-6">
          <div className="flex items-center gap-3">
            <button
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Icon name="menu" />
            </button>
            <div>
              <div className="text-xs text-slate-400">College Analytics Management</div>
              <div className="text-sm font-semibold text-slate-800">{currentLabel}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <div className="text-sm font-medium text-slate-700">{user?.username}</div>
              <div className="text-xs text-slate-400">{user?.role}</div>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-semibold text-white shadow-sm">
              {user?.username?.[0]?.toUpperCase() || "U"}
            </div>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-50 hover:text-slate-800"
            >
              <Icon name="logout" className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="mx-auto max-w-7xl animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
