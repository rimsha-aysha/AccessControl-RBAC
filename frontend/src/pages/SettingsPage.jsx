import { Link } from 'react-router-dom';
import { ArrowRight, Grid3x3, History, Layers, ShieldCheck, UserCog } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { Card, PageHeader } from '../components/ui.jsx';

const LINKS = [
  { to: '/settings/access-control/roles', icon: ShieldCheck, label: 'Roles', text: 'Create, edit, clone, activate and deactivate roles.' },
  { to: '/settings/access-control/permissions', icon: Grid3x3, label: 'Permission Matrix', text: 'Configure which module actions each role may perform.' },
  { to: '/settings/access-control/approval-levels', icon: Layers, label: 'Approval Levels', text: 'Review approval tiers and monetary limits.' },
  { to: '/settings/access-control/users', icon: UserCog, label: 'User Assignments', text: 'Create staff accounts and assign roles.' },
  { to: '/settings/access-control/audit-logs', icon: History, label: 'Audit Logs', text: 'See who changed what, and when.' },
];

export default function SettingsPage() {
  const { isAdmin, session, user } = useAuth();
  return (
    <>
      <PageHeader title="Settings" description="System configuration and administration." />
      {isAdmin ? (
        <Card title="Access Control" description="Manage roles, permissions, branch access and approval levels.">
          <ul className="grid gap-3 md:grid-cols-2">
            {LINKS.map((l) => (
              <li key={l.to}>
                <Link to={l.to} className="group flex items-start gap-3 rounded-lg border border-slate-200 p-4 hover:border-brand-300 hover:bg-brand-50/40">
                  <div className="rounded-md bg-brand-50 p-2 text-brand-700"><l.icon className="h-5 w-5" aria-hidden /></div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-900">{l.label}</p>
                    <p className="mt-0.5 text-sm text-slate-500">{l.text}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-brand-600" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <Card title="Your account">
          <dl className="grid gap-4 sm:grid-cols-3 text-sm">
            <div><dt className="text-slate-500">Name</dt><dd className="mt-1 font-medium">{user?.name}</dd></div>
            <div><dt className="text-slate-500">Role</dt><dd className="mt-1 font-medium">{session?.role?.name}</dd></div>
            <div><dt className="text-slate-500">Branch</dt><dd className="mt-1 font-medium">{user?.branch?.name || '—'}</dd></div>
          </dl>
          <p className="mt-6 text-sm text-slate-500">Access Control settings are available to System Administrators only.</p>
        </Card>
      )}
    </>
  );
}
