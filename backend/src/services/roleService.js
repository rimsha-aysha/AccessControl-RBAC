import { Role } from '../models/Role.js';
import { User } from '../models/User.js';
import { MODULES } from '../config/permissions.js';
import { ApiError } from '../utils/ApiError.js';
import { escapeRegex, normalizeName } from '../utils/helpers.js';
import { validatePermissionKeys, getAllPermissionKeys } from './permissionService.js';
import { validateBranchSelection } from './branchService.js';
import { recordAudit, diffFields } from './auditService.js';

const SYSTEM_PROTECTED_MESSAGE =
  'The System Administrator role is protected: its name, status, branch scope and permissions cannot be changed.';

/* ------------------------------------------------------------------ helpers */

export async function getUserCounts(roleIds) {
  const match = roleIds ? { roleId: { $in: roleIds } } : {};
  const rows = await User.aggregate([{ $match: match }, { $group: { _id: '$roleId', count: { $sum: 1 } } }]);
  return new Map(rows.map((r) => [String(r._id), r.count]));
}

async function findRoleOr404(id) {
  const role = await Role.findById(id);
  if (!role) throw ApiError.notFound('Role not found');
  return role;
}

async function ensureUniqueName(name, excludeId) {
  const filter = { normalizedName: normalizeName(name) };
  if (excludeId) filter._id = { $ne: excludeId };
  if (await Role.exists(filter)) {
    throw new ApiError(409, 'ROLE_NAME_EXISTS', `A role named "${name.trim()}" already exists (names are not case-sensitive).`, [
      { field: 'name', message: 'This role name is already in use' },
    ]);
  }
}

function validateApproval(approvalLevel, approvalLimit) {
  if (approvalLimit !== null && approvalLimit !== undefined && approvalLevel < 1) {
    throw ApiError.badRequest('An approval limit can only be set when the approval level is 1 or higher', [
      { field: 'approvalLimit', message: 'Set an approval level of 1 or higher to use an approval limit' },
    ]);
  }
}

/** Runs every business validation shared by create / update / clone. Returns cleaned values. */
async function prepareRoleData(data, { excludeId } = {}) {
  await ensureUniqueName(data.name, excludeId);
  validateApproval(data.approvalLevel, data.approvalLimit);
  const permissions = await validatePermissionKeys(data.permissions);
  const branchIds = await validateBranchSelection(data.branchScope, data.branchIds);
  return {
    name: data.name.trim().replace(/\s+/g, ' '),
    description: data.description ?? '',
    branchScope: data.branchScope,
    branchIds,
    approvalLevel: data.approvalLevel,
    approvalLimit: data.approvalLevel >= 1 ? data.approvalLimit ?? null : null,
    permissions,
  };
}

/** Saves and converts the Mongo duplicate-key race condition into a friendly 409. */
async function saveRole(role) {
  try {
    return await role.save();
  } catch (error) {
    if (error?.code === 11000) {
      throw new ApiError(409, 'ROLE_NAME_EXISTS', `A role named "${role.name}" already exists.`);
    }
    throw error;
  }
}

export function serializeRole(role, userCount = 0) {
  const obj = role.toObject ? role.toObject() : role;
  return {
    id: String(obj._id),
    name: obj.name,
    description: obj.description,
    status: obj.status,
    branchScope: obj.branchScope,
    branchIds: (obj.branchIds || []).map((b) => String(b._id ?? b)),
    branches: (obj.branchIds || [])
      .filter((b) => b && b.name)
      .map((b) => ({ id: String(b._id), code: b.code, name: b.name, status: b.status })),
    approvalLevel: obj.approvalLevel,
    approvalLimit: obj.approvalLimit ?? null,
    permissions: obj.permissions || [],
    permissionCount: (obj.permissions || []).length,
    isSystem: !!obj.isSystem,
    clonedFrom: obj.clonedFrom ? String(obj.clonedFrom._id ?? obj.clonedFrom) : null,
    userCount,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
}

/** Groups permission keys by module, preserving catalog order. */
export function groupPermissions(keys) {
  const set = new Set(keys);
  return MODULES.map((m) => ({
    module: m.key,
    label: m.label,
    actions: m.actions.filter((a) => set.has(`${m.key}.${a}`)),
  })).filter((g) => g.actions.length > 0);
}

/* ------------------------------------------------------------------ queries */

export async function listRoles(query) {
  const filter = {};
  if (query.search) filter.name = { $regex: escapeRegex(query.search), $options: 'i' };
  if (query.status) filter.status = query.status;
  if (query.branchScope) filter.branchScope = query.branchScope;

  const roles = await Role.find(filter).populate('branchIds', 'code name status').lean();
  const counts = await getUserCounts(roles.map((r) => r._id));
  let items = roles.map((r) => serializeRole(r, counts.get(String(r._id)) || 0));

  const direction = query.sortOrder === 'desc' ? -1 : 1;
  const sorters = {
    name: (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
    createdAt: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
    userCount: (a, b) => a.userCount - b.userCount || a.name.localeCompare(b.name),
  };
  items.sort((a, b) => direction * sorters[query.sortBy](a, b));

  const total = items.length;
  const start = (query.page - 1) * query.limit;
  items = items.slice(start, start + query.limit);
  return { items, meta: { total, page: query.page, limit: query.limit, pages: Math.max(1, Math.ceil(total / query.limit)) } };
}

export async function getRoleDetails(id) {
  const role = await Role.findById(id)
    .populate('branchIds', 'code name status')
    .populate('createdBy', 'name')
    .populate('updatedBy', 'name')
    .populate('clonedFrom', 'name');
  if (!role) throw ApiError.notFound('Role not found');
  const userCount = await User.countDocuments({ roleId: role._id });
  return {
    ...serializeRole(role, userCount),
    groupedPermissions: groupPermissions(role.permissions),
    createdBy: role.createdBy ? { id: String(role.createdBy._id), name: role.createdBy.name } : null,
    updatedBy: role.updatedBy ? { id: String(role.updatedBy._id), name: role.updatedBy.name } : null,
    clonedFromRole: role.clonedFrom ? { id: String(role.clonedFrom._id), name: role.clonedFrom.name } : null,
  };
}

/* ------------------------------------------------------------------ commands */

export async function createRole(data, actor) {
  const clean = await prepareRoleData(data);
  const role = await saveRole(
    new Role({ ...clean, status: data.status ?? 'active', createdBy: actor._id, updatedBy: actor._id })
  );
  await recordAudit({
    actor,
    action: 'role.created',
    entity: role,
    metadata: {
      status: role.status,
      branchScope: role.branchScope,
      approvalLevel: role.approvalLevel,
      permissionCount: role.permissions.length,
    },
  });
  return getRoleDetails(role._id);
}

export async function updateRole(id, data, actor) {
  const role = await findRoleOr404(id);

  if (role.isSystem) {
    // Only description and approval settings may change on the protected role.
    const allKeys = await getAllPermissionKeys();
    const sameName = normalizeName(data.name) === role.normalizedName;
    const samePermissions = [...new Set(data.permissions)].sort().join() === [...allKeys].sort().join();
    if (!sameName || data.branchScope !== 'all' || !samePermissions) {
      throw new ApiError(403, 'PROTECTED_ROLE', SYSTEM_PROTECTED_MESSAGE);
    }
  }

  const clean = await prepareRoleData(data, { excludeId: role._id });
  const before = role.toObject();
  Object.assign(role, clean, { updatedBy: actor._id });
  await saveRole(role);
  await auditRoleChanges(actor, before, role);
  return getRoleDetails(role._id);
}

/** Writes one audit entry per category of change so history is easy to read. */
async function auditRoleChanges(actor, before, after) {
  const groups = [
    ['role.updated', ['name', 'description']],
    ['role.permissions_changed', ['permissions']],
    ['role.branch_scope_changed', ['branchScope', 'branchIds']],
    ['role.approval_changed', ['approvalLevel', 'approvalLimit']],
  ];
  for (const [action, fields] of groups) {
    const changes = diffFields(before, after, fields);
    if (Object.keys(changes).length === 0) continue;
    const metadata = {};
    if (action === 'role.permissions_changed') {
      const prev = new Set(before.permissions);
      const next = new Set(after.permissions);
      metadata.added = [...next].filter((k) => !prev.has(k));
      metadata.removed = [...prev].filter((k) => !next.has(k));
      delete changes.permissions; // added/removed lists are clearer than full before/after arrays
      changes.permissionCount = { from: prev.size, to: next.size };
    }
    await recordAudit({ actor, action, entity: after, changes, metadata });
  }
}

export async function updateRolePermissions(id, permissions, actor) {
  const role = await findRoleOr404(id);
  if (role.isSystem) throw new ApiError(403, 'PROTECTED_ROLE', SYSTEM_PROTECTED_MESSAGE);

  const clean = await validatePermissionKeys(permissions);
  const before = role.toObject();
  role.permissions = clean;
  role.updatedBy = actor._id;
  await saveRole(role);
  await auditRoleChanges(actor, before, role);
  return getRoleDetails(role._id);
}

export async function setRoleStatus(id, status, actor) {
  const role = await findRoleOr404(id);
  if (role.status === status) return getRoleDetails(role._id);

  if (role.isSystem && status === 'inactive') {
    throw new ApiError(
      409,
      'PROTECTED_ROLE',
      'The System Administrator role cannot be deactivated - at least one active System Administrator must always exist.'
    );
  }
  if (status === 'active' && role.permissions.length === 0) {
    throw ApiError.badRequest('Add at least one permission before activating this role');
  }

  const before = role.status;
  role.status = status;
  role.updatedBy = actor._id;
  await saveRole(role);
  await recordAudit({
    actor,
    action: status === 'active' ? 'role.activated' : 'role.deactivated',
    entity: role,
    changes: { status: { from: before, to: status } },
    metadata: { affectedUsers: await User.countDocuments({ roleId: role._id }) },
  });
  return getRoleDetails(role._id);
}

export async function cloneRole(id, data, actor) {
  const source = await findRoleOr404(id);
  const merged = {
    name: data.name,
    description: data.description ?? source.description,
    branchScope: data.branchScope ?? source.branchScope,
    branchIds: data.branchIds ?? source.branchIds.map(String),
    approvalLevel: data.approvalLevel ?? source.approvalLevel,
    approvalLimit: data.approvalLimit !== undefined ? data.approvalLimit : source.approvalLimit,
    permissions: data.permissions ?? source.permissions,
  };
  const clean = await prepareRoleData(merged);
  // A brand-new document => new _id. isSystem is never copied, so clones are ordinary roles.
  const clone = await saveRole(
    new Role({
      ...clean,
      status: data.status ?? 'active',
      clonedFrom: source._id,
      createdBy: actor._id,
      updatedBy: actor._id,
    })
  );
  await recordAudit({
    actor,
    action: 'role.cloned',
    entity: clone,
    metadata: { sourceRoleId: String(source._id), sourceRoleName: source.name },
  });
  return getRoleDetails(clone._id);
}

export async function deleteRole(id, actor) {
  const role = await findRoleOr404(id);
  if (role.isSystem) {
    throw new ApiError(409, 'PROTECTED_ROLE', 'The System Administrator role cannot be deleted.');
  }
  const assigned = await User.countDocuments({ roleId: role._id });
  if (assigned > 0) {
    throw new ApiError(
      409,
      'ROLE_IN_USE',
      `This role is assigned to ${assigned} user(s) and cannot be deleted. Reassign those users first, or deactivate the role instead.`
    );
  }
  await role.deleteOne();
  await recordAudit({ actor, action: 'role.deleted', entity: role, metadata: { permissionCount: role.permissions.length } });
}
