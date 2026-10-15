import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Copy, Grid3x3, History, Lock, Pencil, Power, Trash2 } from 'lucide-react';
import { api } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { useToast } from '../context/ToastContext.jsx';
import { formatDate, formatDateTime, formatMoney, SCOPE_HELP, SCOPE_LABELS } from '../lib/format.js';
import { Alert, Badge, Button, Card, EmptyState, ErrorState, PageHeader, Spinner, StatusBadge } from '../components/ui.jsx';
import { ConfirmDialog } from '../components/Modal.jsx';
import AuditEntry from '../components/AuditEntry.jsx';

const BASE = '/settings/access-control/roles';

function Detail({ label, children }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm text-slate-800">{children}</dd>
    </div>
  );
}

export default function RoleDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { data: role, loading, error, reload } = useApi(`/roles/${id}`);
  const history = useApi(`/audit-logs?roleId=${id}&limit=20`);
  const [confirm, setConfirm] = useState(null); // 'status' | 'delete'
  const [busy, setBusy] = useState(false);

  if (error) return <div className="card"><ErrorState message={error.message} onRetry={reload} /></div>;
  if (loading || !role) return <Spinner label="Loading role..." />;

  const actionLabels = { view: 'View', create: 'Create', edit: 'Edit', delete: 'Delete', approve: 'Approve', export: 'Export' };

  const run = async () => {
    setBusy(true);
    try {
      if (confirm === 'delete') {
        const res = await api.del(`/roles/${role.id}`);
        toast.success(res.message);
        navigate(BASE);
        return;
      }
      const res = await api.patch(`/roles/${role.id}/status`, { status: role.status === 'active' ? 'inactive' : 'active' });
      toast.success(res.message);
      setConfirm(null);
      reload();
      history.reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            {role.name}
            {role.isSystem && <Lock className="h-5 w-5 text-amber-600" aria-label="Protected role" />}
          </span>
        }
        description={role.description || 'No description provided.'}
        breadcrumbs={[{ label: 'Settings', to: '/settings' }, { label: 'Roles', to: BASE }, { label: role.name }]}
        actions={
          <>
            <Button variant="secondary" icon={Copy} to={`${BASE}/${role.id}/clone`}>Clone</Button>
            {!role.isSystem && (
              <Button variant="secondary" icon={Grid3x3} to={`/settings/access-control/permissions?role=${role.id}`}>Permissions</Button>
            )}
            {!role.isSystem && (
              <Button variant={role.status === 'active' ? 'danger' : 'success'} icon={Power} onClick={() => setConfirm('status')}>
                {role.status === 'active' ? 'Deactivate' : 'Activate'}
              </Button>
            )}
            <Button icon={Pencil} to={`${BASE}/${role.id}/edit`}>Edit</Button>
          </>
        }
      />

      {role.isSystem && (
        <div className="mb-6">
          <Alert tone="warning" title="Protected system role">
            This role cannot be deleted or deactivated, and always grants every permission across all branches. At least one active System Administrator must exist at all times.
          </Alert>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Overview">
            <dl className="grid gap-5 sm:grid-cols-2">
              <Detail label="Status"><StatusBadge status={role.status} /></Detail>
              <Detail label="Assigned users">
                <Link to={`/settings/access-control/users?roleId=${role.id}`} className="font-medium text-brand-700 hover:underline">{role.userCount} user(s)</Link>
              </Detail>
              <Detail label="Branch scope">
                <Badge color={role.branchScope === 'all' ? 'violet' : role.branchScope === 'selected' ? 'blue' : 'gray'}>{SCOPE_LABELS[role.branchScope]}</Badge>
                <p className="mt-1 text-xs text-slate-500">{SCOPE_HELP[role.branchScope]}</p>
              </Detail>
              <Detail label="Selected branches">
                {role.branchScope === 'selected' ? (
                  <div className="flex flex-wrap gap-1.5">
                    {role.branches.map((b) => <Badge key={b.id} color="blue">{b.name} ({b.code})</Badge>)}
                  </div>
                ) : (
                  <span className="text-slate-500">Not applicable</span>
                )}
              </Detail>
              <Detail label="Approval level">{role.approvalLevel === 0 ? 'Level 0 (no approval authority)' : `Level ${role.approvalLevel}`}</Detail>
              <Detail label="Approval limit">{role.approvalLevel === 0 ? <span className="text-slate-500">Not applicable</span> : formatMoney(role.approvalLimit)}</Detail>
              <Detail label="Created">{formatDateTime(role.createdAt)}{role.createdBy && <span className="text-slate-500"> by {role.createdBy.name}</span>}</Detail>
              <Detail label="Last updated">{formatDateTime(role.updatedAt)}{role.updatedBy && <span className="text-slate-500"> by {role.updatedBy.name}</span>}</Detail>
              {role.clonedFromRole && (
                <Detail label="Cloned from">
                  <Link to={`${BASE}/${role.clonedFromRole.id}`} className="text-brand-700 hover:underline">{role.clonedFromRole.name}</Link>
                </Detail>
              )}
            </dl>
          </Card>

          <Card title="Permissions" description={`${role.permissionCount} permission(s) across ${role.groupedPermissions.length} module(s)`}>
            {role.groupedPermissions.length === 0 ? (
              <EmptyState title="No permissions" description="This role has no permissions. Add at least one before activating it." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {role.groupedPermissions.map((g) => (
                  <li key={g.module} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
                    <span className="w-48 shrink-0 text-sm font-medium text-slate-800">{g.label}</span>
                    <div className="flex flex-wrap gap-1.5">
                      {g.actions.map((a) => <Badge key={a} color={a === 'approve' ? 'amber' : a === 'delete' ? 'red' : 'blue'}>{actionLabels[a]}</Badge>)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Change history" bodyClassName="p-0" actions={<History className="h-4 w-4 text-slate-400" aria-hidden />}>
            {history.loading && !history.data ? (
              <Spinner />
            ) : history.error ? (
              <ErrorState message={history.error.message} onRetry={history.reload} />
            ) : history.data?.length ? (
              <ol className="divide-y divide-slate-100">
                {history.data.map((entry) => (
                  <li key={entry.id} className="px-5 py-3"><AuditEntry entry={entry} compact /></li>
                ))}
              </ol>
            ) : (
              <EmptyState icon={History} title="No history" description="Changes to this role will be recorded here." />
            )}
          </Card>
          {!role.isSystem && (
            <Card title="Danger zone">
              <p className="text-sm text-slate-600">
                {role.userCount > 0
                  ? `This role is assigned to ${role.userCount} user(s), so it cannot be deleted. Reassign those users or deactivate the role instead.`
                  : 'This role is not assigned to any users and can be permanently deleted.'}
              </p>
              <Button variant="danger" icon={Trash2} className="mt-4" disabled={role.userCount > 0} onClick={() => setConfirm('delete')}>Delete role</Button>
            </Card>
          )}
          <p className="px-1 text-xs text-slate-400">Role ID: {role.id} · Created {formatDate(role.createdAt)}</p>
        </div>
      </div>

      <ConfirmDialog
        open={!!confirm}
        loading={busy}
        tone={confirm === 'status' && role.status === 'inactive' ? 'success' : 'danger'}
        title={confirm === 'delete' ? 'Delete role?' : role.status === 'active' ? 'Deactivate role?' : 'Activate role?'}
        confirmLabel={confirm === 'delete' ? 'Delete role' : role.status === 'active' ? 'Deactivate' : 'Activate'}
        message={
          confirm === 'delete' ? (
            <p><strong>{role.name}</strong> will be permanently deleted. This cannot be undone.</p>
          ) : role.status === 'active' ? (
            <>
              <p><strong>{role.name}</strong> will be deactivated and can no longer be assigned to users.</p>
              {role.userCount > 0 && <p className="mt-2 font-medium text-red-700">{role.userCount} user(s) with this role will lose access immediately.</p>}
            </>
          ) : (
            <p><strong>{role.name}</strong> will be activated and its users regain access.</p>
          )
        }
        onConfirm={run}
        onCancel={() => setConfirm(null)}
      />
    </>
  );
}

