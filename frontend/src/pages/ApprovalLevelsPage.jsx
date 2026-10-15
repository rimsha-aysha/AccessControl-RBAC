import { Link } from 'react-router-dom';
import { Layers, Lock, Pencil } from 'lucide-react';
import { useApi } from '../lib/useApi.js';
import { formatMoney } from '../lib/format.js';
import { Alert, Badge, Card, EmptyState, ErrorState, PageHeader, Spinner, StatusBadge } from '../components/ui.jsx';

const BASE = '/settings/access-control/roles';

export default function ApprovalLevelsPage() {
  const { data: levels, loading, error, reload } = useApi('/approval-levels');

  return (
    <>
      <PageHeader
        title="Approval Levels"
        description="Review approval tiers configured across roles. Higher levels can approve larger or more sensitive transactions, up to each role's limit."
        breadcrumbs={[{ label: 'Settings', to: '/settings' }, { label: 'Access Control' }, { label: 'Approval Levels' }]}
      />
      <div className="mb-6">
        <Alert tone="info">
          Approval settings are configured per role. To change a level or limit, open the role and choose <strong>Edit</strong>. A role at level 1 or higher with no limit can approve any amount.
        </Alert>
      </div>

      {error ? (
        <div className="card"><ErrorState message={error.message} onRetry={reload} /></div>
      ) : loading && !levels ? (
        <Spinner />
      ) : !levels?.length ? (
        <div className="card"><EmptyState icon={Layers} title="No roles configured" /></div>
      ) : (
        <div className="space-y-4">
          {[...levels].reverse().map((lvl) => (
            <Card
              key={lvl.level}
              bodyClassName="p-0"
              title={
                <span className="flex items-center gap-3">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${lvl.level === 0 ? 'bg-slate-100 text-slate-600' : 'bg-brand-700 text-white'}`}>
                    {lvl.level}
                  </span>
                  {lvl.level === 0 ? 'Level 0 · No approval authority' : `Level ${lvl.level}`}
                </span>
              }
              description={
                lvl.level === 0
                  ? `${lvl.roleCount} role(s) cannot approve transactions`
                  : `${lvl.roleCount} role(s) · limits ${lvl.minLimit !== null ? formatMoney(lvl.minLimit) : ''}${lvl.maxLimit !== null && lvl.maxLimit !== lvl.minLimit ? ` – ${formatMoney(lvl.maxLimit)}` : ''}${lvl.hasUnlimited ? `${lvl.minLimit !== null ? ' · ' : ''}includes unlimited` : ''}`
              }
            >
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="th">Role</th>
                      <th className="th">Status</th>
                      <th className="th text-right">Approval limit</th>
                      <th className="th">Approve permissions</th>
                      <th className="th text-right">Users</th>
                      <th className="th"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lvl.roles.map((r) => (
                      <tr key={r.id}>
                        <td className="td font-medium text-slate-900">
                          <Link to={`${BASE}/${r.id}`} className="inline-flex items-center gap-1.5 hover:text-brand-700 hover:underline">
                            {r.name}
                            {r.isSystem && <Lock className="h-3.5 w-3.5 text-amber-600" aria-label="Protected" />}
                          </Link>
                        </td>
                        <td className="td"><StatusBadge status={r.status} /></td>
                        <td className="td whitespace-nowrap text-right">{lvl.level === 0 ? '—' : formatMoney(r.approvalLimit)}</td>
                        <td className="td">
                          {r.approvePermissions.length ? (
                            <div className="flex flex-wrap gap-1">
                              {r.approvePermissions.map((p) => <Badge key={p} color="amber">{p.split('.')[0]}</Badge>)}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">None</span>
                          )}
                          {lvl.level > 0 && r.approvePermissions.length === 0 && (
                            <p className="mt-1 text-xs text-amber-700">Has an approval level but no Approve permissions.</p>
                          )}
                        </td>
                        <td className="td text-right">{r.userCount}</td>
                        <td className="td text-right">
                          <Link to={`${BASE}/${r.id}/edit`} className="inline-flex rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-700" aria-label={`Edit ${r.name}`} title="Edit approval settings">
                            <Pencil className="h-4 w-4" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
