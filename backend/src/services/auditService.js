import { AuditLog } from '../models/AuditLog.js';

function comparable(value) {
  if (Array.isArray(value)) return JSON.stringify(value.map(String).sort());
  if (value === undefined) return JSON.stringify(null);
  return JSON.stringify(value instanceof Object ? String(value) : value);
}

function plain(value) {
  if (Array.isArray(value)) return value.map(String);
  if (value && typeof value === 'object') return String(value);
  return value ?? null;
}

/** Returns { field: { from, to } } for every field whose value changed. */
export function diffFields(before, after, fields) {
  const changes = {};
  for (const field of fields) {
    if (comparable(before[field]) !== comparable(after[field])) {
      changes[field] = { from: plain(before[field]), to: plain(after[field]) };
    }
  }
  return changes;
}

/**
 * Store an audit entry. `actor` is the authenticated user document (or null for system/seed tasks).
 * Only pass non-sensitive data in `changes` / `metadata`.
 */
export async function recordAudit({ actor, action, entityType = 'role', entity, roleId, changes = {}, metadata = {} }) {
  return AuditLog.create({
    action,
    actorId: actor?._id ?? null,
    actorName: actor?.name ?? 'System',
    entityType,
    entityId: entity._id,
    entityName: entity.name ?? '',
    roleId: roleId ?? (entityType === 'role' ? entity._id : null),
    changes,
    metadata,
  });
}
