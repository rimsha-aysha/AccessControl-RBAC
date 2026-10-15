import { AUDIT_LABELS, formatDateTime } from '../lib/format.js';
import { Badge } from './ui.jsx';

const TONE = {
  'role.created': 'green',
  'role.cloned': 'green',
  'role.activated': 'green',
  'role.deactivated': 'red',
  'role.deleted': 'red',
  'role.permissions_changed': 'amber',
  'role.branch_scope_changed': 'violet',
  'role.approval_changed': 'blue',
};

function show(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) return value.length ? `${value.length} item(s)` : 'none';
  return String(value);
}

/** Readable rendering of one audit log entry. */
export default function AuditEntry({ entry, compact }) {
  const changes = Object.entries(entry.changes || {});
  const { added = [], removed = [], sourceRoleName } = entry.metadata || {};
  return (
    <div className="text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge color={TONE[entry.action] || 'gray'}>{AUDIT_LABELS[entry.action] || entry.action}</Badge>
        {!compact && <span className="font-medium text-slate-900">{entry.entityName}</span>}
      </div>
      <p className="mt-1 text-xs text-slate-500">
        {entry.actorName} · <time dateTime={entry.createdAt}>{formatDateTime(entry.createdAt)}</time>
      </p>
      {(changes.length > 0 || added.length > 0 || removed.length > 0 || sourceRoleName) && (
        <ul className="mt-2 space-y-1 text-xs text-slate-600">
          {sourceRoleName && <li>Cloned from <span className="font-medium">{sourceRoleName}</span></li>}
          {changes.map(([field, { from, to }]) => (
            <li key={field}>
              <span className="font-medium">{field}</span>: <span className="text-slate-400 line-through">{show(from)}</span> → {show(to)}
            </li>
          ))}
          {added.length > 0 && <li className="text-emerald-700">+ {added.join(', ')}</li>}
          {removed.length > 0 && <li className="text-red-700">− {removed.join(', ')}</li>}
        </ul>
      )}
    </div>
  );
}
