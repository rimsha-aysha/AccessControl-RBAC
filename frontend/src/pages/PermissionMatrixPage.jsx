import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Info, Lock, RotateCcw, Save, ShieldCheck } from 'lucide-react';
import { api } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { useToast } from '../context/ToastContext.jsx';
import PermissionMatrix from '../components/PermissionMatrix.jsx';
import { Alert, Button, Card, EmptyState, ErrorState, PageHeader, Spinner, StatusBadge } from '../components/ui.jsx';
import { ConfirmDialog } from '../components/Modal.jsx';

const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

export default function PermissionMatrixPage() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const catalog = useApi('/permissions');
  const roles = useApi('/roles?limit=100&sortBy=name');
  const selectedId = params.get('role') || '';
  const role = useApi(selectedId ? `/roles/${selectedId}` : null);

  const [draft, setDraft] = useState([]);
  const [pendingRoleId, setPendingRoleId] = useState(null); // switching with unsaved changes
  const [confirmSave, setConfirmSave] = useState(false);
  const [saving, setSaving] = useState(false);

  // Default to the first editable role.
  useEffect(() => {
    if (!selectedId && roles.data?.length) {
      const first = roles.data.find((r) => !r.isSystem) || roles.data[0];
      setParams({ role: first.id }, { replace: true });
    }
  }, [roles.data, selectedId, setParams]);

  useEffect(() => {
    if (role.data) setDraft(role.data.permissions);
  }, [role.data]);

  const dirty = role.data && !sameSet(draft, role.data.permissions);
  const diff = useMemo(() => {
    if (!role.data) return { added: [], removed: [] };
    return {
      added: draft.filter((k) => !role.data.permissions.includes(k)),
      removed: role.data.permissions.filter((k) => !draft.includes(k)),
    };
  }, [draft, role.data]);

  const selectRole = (id) => {
    if (dirty) setPendingRoleId(id);
    else setParams({ role: id });
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await api.put(`/roles/${role.data.id}/permissions`, { permissions: draft });
      toast.success(`${res.message} for ${res.data.name}`);
      role.setData(res.data);
      setConfirmSave(false);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const error = catalog.error || roles.error;
  const isSystem = role.data?.isSystem;

  return (
    <>
      <PageHeader
        title="Permission Matrix"
        description="Choose a role, then tick the actions it may perform in each module. Changes apply only to the selected role."
        breadcrumbs={[{ label: 'Settings', to: '/settings' }, { label: 'Access Control' }, { label: 'Permission Matrix' }]}
      />
      {error ? (
        <div className="card"><ErrorState message={error.message} onRetry={() => { catalog.reload(); roles.reload(); }} /></div>
      ) : !catalog.data || !roles.data ? (
        <Spinner />
      ) : roles.data.length === 0 ? (
        <div className="card"><EmptyState icon={ShieldCheck} title="No roles" description="Create a role first." action={<Button to="/settings/access-control/roles/new">New role</Button>} /></div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-4">
          <Card title="Roles" className="min-w-0 lg:col-span-1" bodyClassName="p-2">
            <ul className="max-h-[32rem] space-y-0.5 overflow-y-auto" role="listbox" aria-label="Select a role">
              {roles.data.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={r.id === selectedId}
                    onClick={() => selectRole(r.id)}
                    className={`flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm ${
                      r.id === selectedId ? 'bg-brand-50 font-medium text-brand-800 ring-1 ring-brand-200' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate">{r.name}</span>
                      {r.isSystem && <Lock className="h-3.5 w-3.5 shrink-0 text-amber-600" aria-label="Protected" />}
                    </span>
                    <span className={`shrink-0 text-xs ${r.status === 'active' ? 'text-slate-400' : 'text-slate-400 line-through'}`}>{r.permissionCount}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          <div className="min-w-0 space-y-4 lg:col-span-3">
            {role.error ? (
              <div className="card"><ErrorState message={role.error.message} onRetry={role.reload} /></div>
            ) : !role.data ? (
              <Spinner />
            ) : (
              <>
                <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-semibold text-slate-900">{role.data.name}</h2>
                      <StatusBadge status={role.data.status} />
                    </div>
                    <p className="mt-0.5 text-sm text-slate-500">
                      {role.data.userCount} user(s) assigned ·{' '}
                      <Link to={`/settings/access-control/roles/${role.data.id}`} className="text-brand-700 hover:underline">View role details</Link>
                    </p>
                  </div>
                  {!isSystem && (
                    <div className="flex gap-2">
                      <Button variant="secondary" icon={RotateCcw} disabled={!dirty || saving} onClick={() => setDraft(role.data.permissions)}>Reset</Button>
                      <Button icon={Save} disabled={!dirty || draft.length === 0} onClick={() => setConfirmSave(true)}>Save changes</Button>
                    </div>
                  )}
                </div>

                {isSystem ? (
                  <Alert tone="warning" title="Protected role">The System Administrator role always has every permission. Its permissions cannot be edited.</Alert>
                ) : (
                  <Alert tone="info">
                    <span className="flex items-start gap-2">
                      <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                      <span>
                        You are editing <strong>{role.data.name}</strong>. Saved changes take effect immediately for all {role.data.userCount} user(s) with this role.
                      </span>
                    </span>
                  </Alert>
                )}
                {!isSystem && draft.length === 0 && <Alert tone="error">A role must have at least one permission. Select at least one before saving.</Alert>}
                {dirty && (
                  <p className="text-sm text-amber-700" role="status">
                    Unsaved changes: {diff.added.length} added, {diff.removed.length} removed.
                  </p>
                )}

                <Card bodyClassName="p-4">
                  <PermissionMatrix catalog={catalog.data} value={draft} onChange={setDraft} readOnly={isSystem} />
                </Card>
              </>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmSave}
        loading={saving}
        tone="success"
        title="Save permission changes?"
        confirmLabel="Save permissions"
        message={
          <>
            <p>
              This updates <strong>{role.data?.name}</strong> and affects <strong>{role.data?.userCount} user(s)</strong> immediately.
            </p>
            {diff.added.length > 0 && <p className="mt-2 text-emerald-700">Adding: {diff.added.join(', ')}</p>}
            {diff.removed.length > 0 && <p className="mt-1 text-red-700">Removing: {diff.removed.join(', ')}</p>}
          </>
        }
        onConfirm={save}
        onCancel={() => setConfirmSave(false)}
      />
      <ConfirmDialog
        open={!!pendingRoleId}
        title="Discard unsaved changes?"
        confirmLabel="Discard changes"
        message={<p>You have unsaved permission changes for <strong>{role.data?.name}</strong>. Switching roles will discard them.</p>}
        onConfirm={() => {
          setParams({ role: pendingRoleId });
          setPendingRoleId(null);
        }}
        onCancel={() => setPendingRoleId(null)}
      />
    </>
  );
}
