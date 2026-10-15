import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, ArrowUpDown, Copy, Eye, Lock, Pencil, Plus, Power, Search, ShieldCheck, Trash2, X } from 'lucide-react';
import { api, toQuery } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { formatApproval, formatDate, SCOPE_LABELS } from '../lib/format.js';
import { useToast } from '../context/ToastContext.jsx';
import { Badge, Button, EmptyState, ErrorState, PageHeader, Spinner, StatusBadge } from '../components/ui.jsx';
import { ConfirmDialog } from '../components/Modal.jsx';

const BASE = '/settings/access-control/roles';

function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function SortHeader({ field, label, sortBy, sortOrder, onSort, className = '' }) {
  const active = sortBy === field;
  const Icon = !active ? ArrowUpDown : sortOrder === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th className={`th ${className}`} aria-sort={active ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" onClick={() => onSort(field)} className={`inline-flex items-center gap-1 uppercase hover:text-slate-800 ${active ? 'text-slate-800' : ''}`}>
        {label}
        <Icon className="h-3.5 w-3.5" aria-hidden />
      </button>
    </th>
  );
}

export default function RolesPage() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [searchText, setSearchText] = useState(params.get('search') || '');
  const search = useDebounced(searchText);
  const filters = {
    status: params.get('status') || '',
    branchScope: params.get('branchScope') || '',
    sortBy: params.get('sortBy') || 'name',
    sortOrder: params.get('sortOrder') || 'asc',
    page: Number(params.get('page')) || 1,
  };

  const update = (changes) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (!('page' in changes)) next.delete('page');
    setParams(next, { replace: true });
  };

  useEffect(() => {
    if (search !== (params.get('search') || '')) update({ search });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const query = toQuery({ search: params.get('search') || '', ...filters, limit: 15 });
  const { data: roles, meta, loading, error, reload } = useApi(`/roles${query}`);

  const [confirm, setConfirm] = useState(null); // { type: 'status' | 'delete', role }
  const [busy, setBusy] = useState(false);

  // Clicking the active column flips the order; a new column starts A→Z for names, newest/largest first otherwise.
  const onSort = (field) => {
    const sortOrder = filters.sortBy === field ? (filters.sortOrder === 'asc' ? 'desc' : 'asc') : field === 'name' ? 'asc' : 'desc';
    update({ sortBy: field, sortOrder });
  };

  const runConfirmed = async () => {
    const { type, role } = confirm;
    setBusy(true);
    try {
      if (type === 'delete') {
        const res = await api.del(`/roles/${role.id}`);
        toast.success(res.message);
      } else {
        const status = role.status === 'active' ? 'inactive' : 'active';
        const res = await api.patch(`/roles/${role.id}/status`, { status });
        toast.success(`${role.name}: ${res.message.toLowerCase()}`);
      }
      setConfirm(null);
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const hasFilters = params.get('search') || filters.status || filters.branchScope;

  return (
    <>
      <PageHeader
        title="Roles"
        description="Roles group permissions, branch scope and approval authority. Assign roles to users to control what they can do."
        breadcrumbs={[{ label: 'Settings', to: '/settings' }, { label: 'Access Control' }, { label: 'Roles' }]}
        actions={
          <Button icon={Plus} to={`${BASE}/new`}>
            New role
          </Button>
        }
      />

      <div className="card">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <label htmlFor="role-search" className="sr-only">Search roles by name</label>
            <input id="role-search" className="input pl-9" placeholder="Search roles by name..." value={searchText} onChange={(e) => setSearchText(e.target.value)} maxLength={100} />
          </div>
          <div className="grid grid-cols-2 gap-3 md:flex">
            <label className="sr-only" htmlFor="filter-status">Filter by status</label>
            <select id="filter-status" className="input md:w-40" value={filters.status} onChange={(e) => update({ status: e.target.value })}>
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <label className="sr-only" htmlFor="filter-scope">Filter by branch scope</label>
            <select id="filter-scope" className="input md:w-48" value={filters.branchScope} onChange={(e) => update({ branchScope: e.target.value })}>
              <option value="">All branch scopes</option>
              {Object.entries(SCOPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          {hasFilters && (
            <Button
              variant="ghost"
              icon={X}
              onClick={() => {
                setSearchText('');
                setParams({}, { replace: true });
              }}
            >
              Clear
            </Button>
          )}
        </div>

        {error ? (
          <ErrorState message={error.message} onRetry={reload} />
        ) : loading && !roles ? (
          <Spinner label="Loading roles..." />
        ) : roles?.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title={hasFilters ? 'No roles match your filters' : 'No roles yet'}
            description={hasFilters ? 'Try a different search term or clear the filters.' : 'Create your first role to start assigning permissions.'}
            action={!hasFilters && <Button icon={Plus} to={`${BASE}/new`}>New role</Button>}
          />
        ) : (
          <div className={`overflow-x-auto ${loading ? 'opacity-60' : ''}`}>
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <SortHeader field="name" label="Role" {...filters} onSort={onSort} />
                  <th className="th">Status</th>
                  <th className="th">Branch scope</th>
                  <th className="th">Approval</th>
                  <SortHeader field="userCount" label="Users" {...filters} onSort={onSort} className="text-right" />
                  <SortHeader field="createdAt" label="Created" {...filters} onSort={onSort} />
                  <th className="th text-right"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {roles.map((role) => (
                  <tr key={role.id} className="hover:bg-slate-50/60">
                    <td className="td max-w-xs">
                      <Link to={`${BASE}/${role.id}`} className="flex items-center gap-1.5 font-medium text-slate-900 hover:text-brand-700 hover:underline">
                        {role.name}
                        {role.isSystem && <Lock className="h-3.5 w-3.5 text-amber-600" aria-label="Protected role" />}
                      </Link>
                      {role.description && <p className="mt-0.5 truncate text-xs text-slate-500" title={role.description}>{role.description}</p>}
                    </td>
                    <td className="td"><StatusBadge status={role.status} /></td>
                    <td className="td">
                      <Badge color={role.branchScope === 'all' ? 'violet' : role.branchScope === 'selected' ? 'blue' : 'gray'}>{SCOPE_LABELS[role.branchScope]}</Badge>
                      {role.branchScope === 'selected' && (
                        <p className="mt-1 text-xs text-slate-500">{role.branches.map((b) => b.code).join(', ')}</p>
                      )}
                    </td>
                    <td className="td whitespace-nowrap text-xs">{formatApproval(role.approvalLevel, role.approvalLimit)}</td>
                    <td className="td text-right font-medium">{role.userCount}</td>
                    <td className="td whitespace-nowrap">{formatDate(role.createdAt)}</td>
                    <td className="td">
                      <div className="flex justify-end gap-0.5">
                        <IconLink to={`${BASE}/${role.id}`} icon={Eye} label={`View ${role.name}`} />
                        <IconLink to={`${BASE}/${role.id}/edit`} icon={Pencil} label={`Edit ${role.name}`} />
                        <IconLink to={`${BASE}/${role.id}/clone`} icon={Copy} label={`Clone ${role.name}`} />
                        {!role.isSystem && (
                          <>
                            <IconButton
                              icon={Power}
                              label={role.status === 'active' ? `Deactivate ${role.name}` : `Activate ${role.name}`}
                              className={role.status === 'active' ? 'hover:text-red-600' : 'hover:text-emerald-600'}
                              onClick={() => setConfirm({ type: 'status', role })}
                            />
                            <IconButton
                              icon={Trash2}
                              label={role.userCount > 0 ? `${role.name} is assigned to users and cannot be deleted` : `Delete ${role.name}`}
                              className="hover:text-red-600"
                              disabled={role.userCount > 0}
                              onClick={() => setConfirm({ type: 'delete', role })}
                            />
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {meta && meta.total > 0 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
            <span>
              Showing {(meta.page - 1) * meta.limit + 1}–{Math.min(meta.page * meta.limit, meta.total)} of {meta.total} roles
            </span>
            {meta.pages > 1 && (
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" disabled={meta.page <= 1} onClick={() => update({ page: String(meta.page - 1) })}>Previous</Button>
                <Button size="sm" variant="secondary" disabled={meta.page >= meta.pages} onClick={() => update({ page: String(meta.page + 1) })}>Next</Button>
              </div>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!confirm}
        loading={busy}
        tone={confirm?.type === 'status' && confirm.role.status === 'inactive' ? 'success' : 'danger'}
        title={
          confirm?.type === 'delete' ? 'Delete role?' : confirm?.role.status === 'active' ? 'Deactivate role?' : 'Activate role?'
        }
        confirmLabel={confirm?.type === 'delete' ? 'Delete role' : confirm?.role.status === 'active' ? 'Deactivate' : 'Activate'}
        message={
          confirm?.type === 'delete' ? (
            <p>
              <strong>{confirm.role.name}</strong> will be permanently deleted. This cannot be undone.
            </p>
          ) : confirm?.role.status === 'active' ? (
            <>
              <p>
                <strong>{confirm.role.name}</strong> will be deactivated and can no longer be assigned to users.
              </p>
              {confirm.role.userCount > 0 && (
                <p className="mt-2 font-medium text-red-700">
                  {confirm.role.userCount} user(s) currently have this role and will lose access immediately.
                </p>
              )}
            </>
          ) : (
            <p>
              <strong>{confirm?.role.name}</strong> will be activated. Users with this role regain its permissions immediately.
            </p>
          )
        }
        onConfirm={runConfirmed}
        onCancel={() => setConfirm(null)}
      />
    </>
  );
}

function IconLink({ to, icon: Icon, label }) {
  return (
    <Link to={to} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-700" title={label} aria-label={label}>
      <Icon className="h-4 w-4" />
    </Link>
  );
}

function IconButton({ icon: Icon, label, className = '', ...props }) {
  return (
    <button type="button" className={`rounded-md p-1.5 text-slate-400 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent ${className}`} title={label} aria-label={label} {...props}>
      <Icon className="h-4 w-4" />
    </button>
  );
}
