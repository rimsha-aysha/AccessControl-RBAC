import { useState } from 'react';
import { Download, FileBarChart, Grid3x3, ShieldOff, Users } from 'lucide-react';
import { api } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { formatDate } from '../lib/format.js';
import { Badge, Button, EmptyState, ErrorState, PageHeader, Spinner, StatusBadge } from '../components/ui.jsx';

const REPORTS = [
  { key: 'role-summary', label: 'Role Summary', icon: FileBarChart, text: 'Every role with scope, approval settings, permission and user counts.' },
  { key: 'permission-matrix', label: 'Permission Matrix', icon: Grid3x3, text: 'Which permissions each role holds.' },
  { key: 'role-assignment', label: 'Role Assignment', icon: Users, text: 'Users and their assigned roles, limited to branches you can access.' },
  { key: 'inactive-roles', label: 'Inactive Roles', icon: ShieldOff, text: 'Deactivated roles and users still assigned to them.' },
];

function Cell({ column, value }) {
  if (column === 'status' || column === 'roleStatus' || column === 'userStatus') return value ? <StatusBadge status={value} /> : '—';
  if (column === 'createdAt' || column === 'updatedAt') return formatDate(value);
  if (column === 'approvalLimit') return value === '' ? '—' : Number(value).toLocaleString('en-IN');
  if (value === 'Yes') return <span className="font-semibold text-emerald-600" aria-label="Yes">✓</span>;
  return value === '' || value === null || value === undefined ? <span className="text-slate-300">—</span> : String(value);
}

export default function ReportsPage() {
  const { can } = useAuth();
  const toast = useToast();
  const [active, setActive] = useState('role-summary');
  const [downloading, setDownloading] = useState(false);
  const { data, loading, error, reload } = useApi(`/reports/${active}`);
  const current = REPORTS.find((r) => r.key === active);

  const download = async () => {
    setDownloading(true);
    try {
      await api.download(`/reports/${active}?format=csv`, `${active}.csv`);
      toast.success(`${current.label} exported to CSV`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDownloading(false);
    }
  };

  const isMatrix = active === 'permission-matrix';

  return (
    <>
      <PageHeader
        title="Reports"
        description="Live access-control reports generated from the database."
        actions={
          can('reports.export') ? (
            <Button variant="secondary" icon={Download} loading={downloading} onClick={download} disabled={!data?.rows?.length}>Export CSV</Button>
          ) : (
            <span className="text-xs text-slate-500">CSV export requires the Reports → Export permission</span>
          )
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" role="tablist" aria-label="Reports">
        {REPORTS.map((r) => (
          <button
            key={r.key}
            type="button"
            role="tab"
            aria-selected={active === r.key}
            onClick={() => setActive(r.key)}
            className={`card flex items-start gap-3 p-4 text-left transition ${active === r.key ? 'border-brand-500 ring-1 ring-brand-500' : 'hover:border-slate-300'}`}
          >
            <div className={`rounded-md p-2 ${active === r.key ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-500'}`}><r.icon className="h-4 w-4" aria-hidden /></div>
            <div>
              <p className="text-sm font-semibold text-slate-900">{r.label}</p>
              <p className="mt-0.5 text-xs text-slate-500">{r.text}</p>
            </div>
          </button>
        ))}
      </div>

      <div className="card" role="tabpanel" aria-label={current.label}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">{current.label}</h2>
          <div className="flex items-center gap-2">
            {data?.scopeNote && <Badge color="blue">{data.scopeNote}</Badge>}
            {data && <span className="text-sm text-slate-500">{data.rows.length} row(s)</span>}
          </div>
        </div>
        {error ? (
          <ErrorState message={error.message} onRetry={reload} />
        ) : loading || !data ? (
          <Spinner label="Generating report..." />
        ) : data.rows.length === 0 ? (
          <EmptyState icon={FileBarChart} title="No data" description={active === 'inactive-roles' ? 'All roles are currently active.' : 'There is nothing to show for this report yet.'} />
        ) : (
          <div className="max-h-[36rem] overflow-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="sticky top-0 z-10 bg-slate-50">
                <tr>
                  {data.columns.map((c) => (
                    <th key={c.key} className={`th ${isMatrix && c.key.includes('.') ? 'text-center normal-case' : ''}`}>
                      {isMatrix && c.key.includes('.') ? (
                        <span className="flex flex-col items-center leading-tight">
                          <span>{c.key.split('.')[0]}</span>
                          <span className="font-normal text-slate-400">{c.key.split('.')[1]}</span>
                        </span>
                      ) : (
                        c.label
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {data.rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/60">
                    {data.columns.map((c) => (
                      <td key={c.key} className={`td ${c.key === 'name' || c.key === 'userName' ? 'whitespace-nowrap font-medium text-slate-900' : ''} ${isMatrix && c.key.includes('.') ? 'text-center' : ''}`}>
                        <Cell column={c.key} value={row[c.key]} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
