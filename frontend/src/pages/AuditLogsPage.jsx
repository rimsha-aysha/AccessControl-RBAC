import { useState } from 'react';
import { Link } from 'react-router-dom';
import { History } from 'lucide-react';
import { toQuery } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { AUDIT_LABELS } from '../lib/format.js';
import { Button, EmptyState, ErrorState, PageHeader, Spinner } from '../components/ui.jsx';
import AuditEntry from '../components/AuditEntry.jsx';

export default function AuditLogsPage() {
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const { data, meta, loading, error, reload } = useApi(`/audit-logs${toQuery({ action, page, limit: 20 })}`);

  return (
    <>
      <PageHeader
        title="Audit Logs"
        description="A permanent record of access-control changes: who changed what, and when. Passwords and tokens are never logged."
        breadcrumbs={[{ label: 'Settings', to: '/settings' }, { label: 'Access Control' }, { label: 'Audit Logs' }]}
      />
      <div className="card">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 p-4">
          <label htmlFor="audit-action" className="text-sm font-medium text-slate-700">Action</label>
          <select id="audit-action" className="input w-full sm:w-72" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }}>
            <option value="">All actions</option>
            {Object.entries(AUDIT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          {meta && <span className="ml-auto text-sm text-slate-500">{meta.total} entries</span>}
        </div>
        {error ? (
          <ErrorState message={error.message} onRetry={reload} />
        ) : loading && !data ? (
          <Spinner />
        ) : data?.length === 0 ? (
          <EmptyState icon={History} title="No audit entries" description="Changes to roles and user assignments will appear here." />
        ) : (
          <ol className={`divide-y divide-slate-100 ${loading ? 'opacity-60' : ''}`}>
            {data.map((entry) => (
              <li key={entry.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
                <AuditEntry entry={entry} />
                {entry.entityType === 'role' && entry.action !== 'role.deleted' && (
                  <Link to={`/settings/access-control/roles/${entry.entityId}`} className="shrink-0 text-sm font-medium text-brand-700 hover:underline">View role</Link>
                )}
              </li>
            ))}
          </ol>
        )}
        {meta && meta.pages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
            <span>Page {meta.page} of {meta.pages}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button size="sm" variant="secondary" disabled={page >= meta.pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
