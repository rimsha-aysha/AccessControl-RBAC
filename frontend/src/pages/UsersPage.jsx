import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Power, Search, UserCog, UserPlus } from 'lucide-react';
import { api, toQuery } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { formatDateTime } from '../lib/format.js';
import { Alert, Badge, Button, EmptyState, ErrorState, Field, PageHeader, Spinner, StatusBadge } from '../components/ui.jsx';
import { ConfirmDialog, Modal } from '../components/Modal.jsx';

function CreateUserModal({ open, onClose, roles, branches, onCreated }) {
  const toast = useToast();
  const empty = { name: '', email: '', password: '', roleId: '', branchId: '' };
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const role = roles.find((r) => r.id === form.roleId);

  const close = () => {
    setForm(empty);
    setErrors({});
    setFormError('');
    onClose();
  };

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    if (!/^\S+@\S+\.\S+$/.test(form.email)) errs.email = 'Enter a valid email address';
    if (form.password.length < 12) errs.password = 'Password must be at least 12 characters';
    if (!form.roleId) errs.roleId = 'Select a role';
    if (role?.branchScope === 'assigned' && !form.branchId) errs.branchId = 'This role needs a branch';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    setFormError('');
    try {
      const res = await api.post('/users', { ...form, branchId: form.branchId || null });
      toast.success(res.message);
      onCreated();
      close();
    } catch (err) {
      setErrors(err.fieldErrors);
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Add user"
      description="Create a staff account and assign an active role."
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={saving}>Cancel</Button>
          <Button type="submit" form="create-user-form" loading={saving}>Create user</Button>
        </>
      }
    >
      <form id="create-user-form" onSubmit={submit} className="space-y-4" noValidate>
        {formError && <Alert tone="error">{formError}</Alert>}
        <Field label="Full name" htmlFor="u-name" required error={errors.name}>
          <input id="u-name" className={`input ${errors.name ? 'input-error' : ''}`} value={form.name} onChange={set('name')} maxLength={100} />
        </Field>
        <Field label="Email" htmlFor="u-email" required error={errors.email}>
          <input id="u-email" type="email" className={`input ${errors.email ? 'input-error' : ''}`} value={form.email} onChange={set('email')} autoComplete="off" />
        </Field>
        <Field label="Initial password" htmlFor="u-password" required error={errors.password} hint="At least 12 characters with upper-case, lower-case letters and a number.">
          <input id="u-password" type="password" className={`input ${errors.password ? 'input-error' : ''}`} value={form.password} onChange={set('password')} autoComplete="new-password" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Role" htmlFor="u-role" required error={errors.roleId} hint="Only active roles can be assigned.">
            <select id="u-role" className={`input ${errors.roleId ? 'input-error' : ''}`} value={form.roleId} onChange={set('roleId')}>
              <option value="">Select role...</option>
              {roles.filter((r) => r.status === 'active').map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </Field>
          <Field label="Branch" htmlFor="u-branch" required={role?.branchScope === 'assigned'} error={errors.branchId}>
            <select id="u-branch" className={`input ${errors.branchId ? 'input-error' : ''}`} value={form.branchId} onChange={set('branchId')}>
              <option value="">No branch</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
        </div>
      </form>
    </Modal>
  );
}

export default function UsersPage() {
  const { user: me } = useAuth();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const roleFilter = params.get('roleId') || '';
  const users = useApi(`/users${toQuery({ roleId: roleFilter })}`);
  const roles = useApi('/roles?limit=100');
  const branches = useApi('/branches');
  const [createOpen, setCreateOpen] = useState(false);
  const [changeRole, setChangeRole] = useState(null); // { user, roleId }
  const [statusUser, setStatusUser] = useState(null);
  const [busy, setBusy] = useState(false);

  const filtered = (users.data || []).filter((u) => {
    const q = search.trim().toLowerCase();
    return !q || u.name.toLowerCase().includes(q) || u.email.includes(q);
  });

  const saveRole = async () => {
    setBusy(true);
    try {
      const res = await api.patch(`/users/${changeRole.user.id}/role`, { roleId: changeRole.roleId });
      toast.success(`${res.data.name} is now ${res.data.role.name}`);
      setChangeRole(null);
      users.reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleStatus = async () => {
    setBusy(true);
    try {
      const res = await api.patch(`/users/${statusUser.id}/status`, { status: statusUser.status === 'active' ? 'inactive' : 'active' });
      toast.success(res.message);
      setStatusUser(null);
      users.reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const error = users.error || roles.error || branches.error;

  return (
    <>
      <PageHeader
        title="User Assignments"
        description="Assign roles to staff accounts. Only active roles can be assigned, and you cannot change your own role."
        breadcrumbs={[{ label: 'Settings', to: '/settings' }, { label: 'Access Control' }, { label: 'User Assignments' }]}
        actions={<Button icon={UserPlus} onClick={() => setCreateOpen(true)} disabled={!roles.data || !branches.data}>Add user</Button>}
      />
      <div className="card">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 md:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <label htmlFor="user-search" className="sr-only">Search users</label>
            <input id="user-search" className="input pl-9" placeholder="Search by name or email..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <label htmlFor="user-role-filter" className="sr-only">Filter by role</label>
          <select id="user-role-filter" className="input md:w-64" value={roleFilter} onChange={(e) => setParams(e.target.value ? { roleId: e.target.value } : {})}>
            <option value="">All roles</option>
            {roles.data?.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>

        {error ? (
          <ErrorState message={error.message} onRetry={() => { users.reload(); roles.reload(); branches.reload(); }} />
        ) : users.loading && !users.data ? (
          <Spinner label="Loading users..." />
        ) : filtered.length === 0 ? (
          <EmptyState icon={UserCog} title="No users found" description={search || roleFilter ? 'Try a different search or filter.' : 'Add a user to get started.'} />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th">User</th>
                  <th className="th">Role</th>
                  <th className="th">Branch</th>
                  <th className="th">Status</th>
                  <th className="th">Last sign-in</th>
                  <th className="th text-right"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filtered.map((u) => {
                  const isMe = u.id === me?.id;
                  return (
                    <tr key={u.id}>
                      <td className="td">
                        <p className="font-medium text-slate-900">{u.name} {isMe && <Badge color="blue">You</Badge>}</p>
                        <p className="text-xs text-slate-500">{u.email}</p>
                      </td>
                      <td className="td">
                        {u.role ? (
                          <span className="inline-flex items-center gap-2">
                            {u.role.name}
                            {u.role.status === 'inactive' && <Badge color="red">Role inactive</Badge>}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="td">{u.branch ? `${u.branch.name}` : <span className="text-slate-400">—</span>}</td>
                      <td className="td"><StatusBadge status={u.status} /></td>
                      <td className="td whitespace-nowrap text-xs">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : 'Never'}</td>
                      <td className="td">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="secondary" icon={UserCog} disabled={isMe} title={isMe ? 'You cannot change your own role' : undefined} onClick={() => setChangeRole({ user: u, roleId: u.role?.id || '' })}>
                            Change role
                          </Button>
                          <Button size="sm" variant="ghost" icon={Power} disabled={isMe} onClick={() => setStatusUser(u)} aria-label={`${u.status === 'active' ? 'Deactivate' : 'Activate'} ${u.name}`}>
                            {u.status === 'active' ? 'Deactivate' : 'Activate'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {roles.data && branches.data && (
        <CreateUserModal open={createOpen} onClose={() => setCreateOpen(false)} roles={roles.data} branches={branches.data} onCreated={users.reload} />
      )}

      <Modal
        open={!!changeRole}
        onClose={() => !busy && setChangeRole(null)}
        title={`Change role for ${changeRole?.user.name}`}
        description="The new role takes effect immediately, including for any active session."
        footer={
          <>
            <Button variant="secondary" onClick={() => setChangeRole(null)} disabled={busy}>Cancel</Button>
            <Button onClick={saveRole} loading={busy} disabled={!changeRole?.roleId || changeRole?.roleId === changeRole?.user.role?.id}>Assign role</Button>
          </>
        }
      >
        <Field label="Role" htmlFor="change-role" hint="Inactive roles are listed but cannot be selected.">
          <select id="change-role" className="input" value={changeRole?.roleId || ''} onChange={(e) => setChangeRole((c) => ({ ...c, roleId: e.target.value }))}>
            {roles.data?.map((r) => (
              <option key={r.id} value={r.id} disabled={r.status !== 'active'}>
                {r.name}{r.status !== 'active' ? ' (inactive)' : ''}
              </option>
            ))}
          </select>
        </Field>
      </Modal>

      <ConfirmDialog
        open={!!statusUser}
        loading={busy}
        tone={statusUser?.status === 'active' ? 'danger' : 'success'}
        title={statusUser?.status === 'active' ? 'Deactivate user?' : 'Activate user?'}
        confirmLabel={statusUser?.status === 'active' ? 'Deactivate' : 'Activate'}
        message={<p><strong>{statusUser?.name}</strong> will {statusUser?.status === 'active' ? 'no longer be able to sign in' : 'be able to sign in again'}.</p>}
        onConfirm={toggleStatus}
        onCancel={() => setStatusUser(null)}
      />
    </>
  );
}
