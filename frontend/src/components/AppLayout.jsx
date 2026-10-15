import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  IdCard,
  PiggyBank,
  CalendarClock,
  Landmark,
  Coins,
  FileBarChart,
  Settings,
  ShieldCheck,
  Grid3x3,
  Layers,
  UserCog,
  History,
  Menu,
  X,
  LogOut,
  ChevronDown,
  Building2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export const ERP_MODULES = [
  { key: 'customers', label: 'Customers', icon: Users },
  { key: 'membership', label: 'Membership', icon: IdCard },
  { key: 'savings', label: 'Savings', icon: PiggyBank },
  { key: 'rd', label: 'RD', icon: CalendarClock },
  { key: 'loan', label: 'Loan', icon: Landmark },
  { key: 'chitty', label: 'Chitty', icon: Coins },
];

const ACCESS_CONTROL_LINKS = [
  { to: '/settings/access-control/roles', label: 'Roles', icon: ShieldCheck },
  { to: '/settings/access-control/permissions', label: 'Permission Matrix', icon: Grid3x3 },
  { to: '/settings/access-control/approval-levels', label: 'Approval Levels', icon: Layers },
  { to: '/settings/access-control/users', label: 'User Assignments', icon: UserCog },
  { to: '/settings/access-control/audit-logs', label: 'Audit Logs', icon: History },
];

function NavItem({ to, icon: Icon, label, end, nested }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${nested ? 'pl-9' : ''} ${
          isActive ? 'bg-[#D3E7FF] text-[#1E3A5F]' : 'text-[#1E3A5F] hover:bg-[#DDEEFF]'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-[#1E3A5F]' : 'text-[#1E3A5F]/80 group-hover:text-[#1E3A5F]'}`} aria-hidden />
          <span className="truncate">{label}</span>
          {isActive && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#1E3A5F]" aria-hidden />}
        </>
      )}
    </NavLink>
  );
}

function Sidebar({ onNavigate }) {
  const { can, isAdmin } = useAuth();
  const location = useLocation();
  const inSettings = location.pathname.startsWith('/settings');
  const [settingsOpen, setSettingsOpen] = useState(inSettings);
  useEffect(() => {
    if (inSettings) setSettingsOpen(true);
  }, [inSettings]);

  return (
    <nav className="flex h-full flex-col bg-[#EAF4FF]" aria-label="Main navigation" onClick={(e) => e.target.closest('a') && onNavigate?.()}>
      <div className="flex h-16 items-center gap-2.5 border-b border-[#1E3A5F]/10 px-5">
        <div className="rounded-md bg-brand-600 p-1.5">
          <ShieldCheck className="h-5 w-5 text-white" aria-hidden />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-[#1E3A5F]">Co-op ERP</p>
          <p className="text-[11px] text-[#1E3A5F]/70">Co-operative Banking Suite</p>
        </div>
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {can('dashboard.view') && <NavItem to="/" end icon={LayoutDashboard} label="Dashboard" />}

        <p className="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-[#1E3A5F]/70">Operations</p>
        {ERP_MODULES.filter((m) => can(`${m.key}.view`)).map((m) => (
          <NavItem key={m.key} to={`/modules/${m.key}`} icon={m.icon} label={m.label} />
        ))}
        {can('reports.view') && <NavItem to="/reports" icon={FileBarChart} label="Reports" />}

        <p className="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-[#1E3A5F]/70">Administration</p>
        <button
          type="button"
          onClick={() => setSettingsOpen((o) => !o)}
          aria-expanded={settingsOpen}
          className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium ${inSettings ? 'text-[#1E3A5F]' : 'text-[#1E3A5F] hover:bg-[#DDEEFF]'}`}
        >
          <Settings className="h-4 w-4 text-[#1E3A5F]/80" aria-hidden />
          Settings
          <ChevronDown className={`ml-auto h-4 w-4 text-[#1E3A5F]/70 transition-transform ${settingsOpen ? 'rotate-180' : ''}`} aria-hidden />
        </button>
        {settingsOpen && (
          <div className="space-y-1">
            <NavItem to="/settings" end icon={Settings} label="Overview" nested />
            {isAdmin && (
              <>
                <p className="pl-9 pt-2 text-[11px] font-medium text-[#1E3A5F]/70">Access Control</p>
                {ACCESS_CONTROL_LINKS.map((l) => (
                  <NavItem key={l.to} {...l} nested />
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}

function initials(name = '') {
  return name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default function AppLayout() {
  const { user, session, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">
        <Sidebar />
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setMobileOpen(false)} aria-hidden />
          <aside className="relative h-full w-72 max-w-[85%]">
            <button
              type="button"
              className="absolute right-3 top-4 z-10 rounded p-1 text-[#1E3A5F]/70 hover:text-[#1E3A5F]"
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation"
            >
              <X className="h-5 w-5" />
            </button>
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6">
          <button type="button" className="rounded-md p-2 text-slate-500 hover:bg-slate-100 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden items-center gap-2 text-sm text-slate-500 sm:flex">
            <Building2 className="h-4 w-4" aria-hidden />
            <span>{user?.branch ? user.branch.name : 'All branches'}</span>
          </div>

          <div className="relative ml-auto">
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-slate-100"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-800">{initials(user?.name)}</div>
              <div className="hidden text-left leading-tight sm:block">
                <p className="text-sm font-medium text-slate-800">{user?.name}</p>
                <p className="text-xs text-slate-500">{session?.role?.name}</p>
              </div>
              <ChevronDown className="h-4 w-4 text-slate-400" aria-hidden />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} aria-hidden />
                <div role="menu" className="absolute right-0 z-20 mt-2 w-60 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                  <div className="border-b border-slate-100 px-3 py-2">
                    <p className="truncate text-sm font-medium text-slate-800">{user?.name}</p>
                    <p className="truncate text-xs text-slate-500">{user?.email}</p>
                  </div>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={logout}
                    className="mt-1 flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                  >
                    <LogOut className="h-4 w-4" aria-hidden /> Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
