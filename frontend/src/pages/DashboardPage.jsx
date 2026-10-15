import { Link } from 'react-router-dom';
import { ShieldCheck, ShieldOff, Users, KeyRound, Building2, Grid3x3, ArrowRight, Layers, History, Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useApi } from '../lib/useApi.js';
import { AUDIT_LABELS, SCOPE_LABELS, timeAgo } from '../lib/format.js';
import { Button, Card, EmptyState, ErrorState, PageHeader, Spinner, StatCard, StatusBadge } from '../components/ui.jsx';
import { ERP_MODULES } from '../components/AppLayout.jsx';

function Welcome() {
  const { user, can } = useAuth();
  const modules = ERP_MODULES.filter((m) => can(`${m.key}.view`));
  return (
    <>
      <PageHeader title={`Welcome, ${user?.name}`} description="Your role does not include the Dashboard. Use the navigation to open the modules you can access." />
      <Card title="Your modules">
        {modules.length ? (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {modules.map((m) => (
              <li key={m.key}>
                <Link to={`/modules/${m.key}`} className="flex items-center gap-3 rounded-lg border border-slate-200 p-4 hover:border-brand-300 hover:bg-brand-50/40">
                  <m.icon className="h-5 w-5 text-brand-700" aria-hidden /> <span className="text-sm font-medium">{m.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No modules assigned" description="Ask a System Administrator to grant your role at least one module permission." />
        )}
      </Card>
    </>
  );
}

export default function DashboardPage() {
  const { can, isAdmin, user } = useAuth();
  const { data, loading, error, reload } = useApi(can('dashboard.view') ? '/dashboard/stats' : null);

  if (!can('dashboard.view')) return <Welcome />;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`Good to see you, ${user?.name}. Here is an overview of roles and access across the organisation.`}
        actions={
          isAdmin && (
            <>
              <Button variant="secondary" icon={Grid3x3} to="/settings/access-control/permissions">
                Permission Matrix
              </Button>
              <Button icon={Plus} to="/settings/access-control/roles/new">
                New role
              </Button>
            </>
          )
        }
      />
      {loading && !data && <Spinner />}
      {error && <div className="card"><ErrorState message={error.message} onRetry={reload} /></div>}
      {data && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total roles" value={data.roles.total} icon={ShieldCheck} hint={`${data.roles.withApproval} with approval authority`} to={isAdmin ? '/settings/access-control/roles' : undefined} />
            <StatCard label="Active roles" value={data.roles.active} icon={ShieldCheck} tone="green" to={isAdmin ? '/settings/access-control/roles?status=active' : undefined} />
            <StatCard label="Inactive roles" value={data.roles.inactive} icon={ShieldOff} tone="gray" to={isAdmin ? '/settings/access-control/roles?status=inactive' : undefined} />
            <StatCard label="Users" value={data.users} icon={Users} tone="amber" hint={`${data.branches} active branches · ${data.permissions} permissions`} to={isAdmin ? '/settings/access-control/users' : undefined} />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card title="Roles by branch scope" className="lg:col-span-1">
              <ul className="space-y-4">
                {Object.entries(SCOPE_LABELS).map(([key, label]) => {
                  const count = data.branchScopes[key];
                  const pct = data.roles.total ? Math.round((count / data.roles.total) * 100) : 0;
                  return (
                    <li key={key}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span className="text-slate-600">{label}</span>
                        <span className="font-medium text-slate-900">{count}</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${label}: ${pct}%`}>
                        <div className="h-2 rounded-full bg-brand-600" style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>

            <Card title="Most assigned roles" className="lg:col-span-2" bodyClassName="p-0">
              {data.topRoles.length === 0 ? (
                <EmptyState icon={Users} title="No users assigned yet" description="Assign users to roles to see the distribution here." />
              ) : (
                <table className="min-w-full divide-y divide-slate-100">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="th">Role</th>
                      <th className="th">Status</th>
                      <th className="th text-right">Users</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.topRoles.map((r) => (
                      <tr key={r.id}>
                        <td className="td font-medium text-slate-900">
                          {isAdmin ? <Link to={`/settings/access-control/roles/${r.id}`} className="hover:text-brand-700 hover:underline">{r.name}</Link> : r.name}
                        </td>
                        <td className="td"><StatusBadge status={r.status} /></td>
                        <td className="td text-right font-medium">{r.userCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          </div>

          {isAdmin && (
            <div className="grid gap-6 lg:grid-cols-3">
              <Card title="Quick links" className="lg:col-span-1" bodyClassName="p-2">
                {[
                  { to: '/settings/access-control/roles', icon: ShieldCheck, label: 'Manage roles', text: 'Create, edit, clone and activate roles' },
                  { to: '/settings/access-control/permissions', icon: KeyRound, label: 'Permission matrix', text: 'Configure module permissions per role' },
                  { to: '/settings/access-control/approval-levels', icon: Layers, label: 'Approval levels', text: 'Review approval tiers and limits' },
                  { to: '/reports', icon: Building2, label: 'Reports', text: 'Role summary, assignments and exports' },
                ].map((l) => (
                  <Link key={l.to} to={l.to} className="group flex items-center gap-3 rounded-md p-3 hover:bg-slate-50">
                    <div className="rounded-md bg-brand-50 p-2 text-brand-700"><l.icon className="h-4 w-4" aria-hidden /></div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900">{l.label}</p>
                      <p className="truncate text-xs text-slate-500">{l.text}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-brand-600" aria-hidden />
                  </Link>
                ))}
              </Card>
              <Card
                title="Recent activity"
                className="lg:col-span-2"
                bodyClassName="p-0"
                actions={<Link to="/settings/access-control/audit-logs" className="text-sm font-medium text-brand-700 hover:underline">View all</Link>}
              >
                {data.recentActivity?.length ? (
                  <ul className="divide-y divide-slate-100">
                    {data.recentActivity.map((a) => (
                      <li key={a.id} className="flex items-start gap-3 px-5 py-3">
                        <div className="mt-0.5 rounded-full bg-slate-100 p-1.5"><History className="h-3.5 w-3.5 text-slate-500" aria-hidden /></div>
                        <div className="min-w-0 flex-1 text-sm">
                          <p className="text-slate-800">
                            <span className="font-medium">{AUDIT_LABELS[a.action] || a.action}</span> · {a.entityName}
                          </p>
                          <p className="text-xs text-slate-500">by {a.actorName}</p>
                        </div>
                        <time className="shrink-0 text-xs text-slate-400" dateTime={a.createdAt}>{timeAgo(a.createdAt)}</time>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState icon={History} title="No activity yet" description="Changes to roles and assignments will appear here." />
                )}
              </Card>
            </div>
          )}
        </div>
      )}
    </>
  );
}
