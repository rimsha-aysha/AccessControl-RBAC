import { Role } from '../models/Role.js';
import { User } from '../models/User.js';
import { Branch } from '../models/Branch.js';
import { AuditLog } from '../models/AuditLog.js';
import { Permission } from '../models/Permission.js';
import { getUserCounts } from './roleService.js';
import { getAccessibleBranchIds } from './branchService.js';

const SCOPE_LABELS = { assigned: 'Assigned Branch', selected: 'Selected Branches', all: 'All Branches' };

function branchText(role) {
  if (role.branchScope !== 'selected') return SCOPE_LABELS[role.branchScope];
  return (role.branchIds || []).map((b) => b.name).join('; ');
}

/**
 * Each report returns { title, columns, rows } so the same data can be rendered
 * as a table in the UI or exported to CSV.
 */
async function roleSummary() {
  const roles = await Role.find().populate('branchIds', 'name').sort({ normalizedName: 1 }).lean();
  const counts = await getUserCounts();
  return {
    title: 'Role Summary',
    columns: [
      { key: 'name', label: 'Role' },
      { key: 'status', label: 'Status' },
      { key: 'branchScope', label: 'Branch Scope' },
      { key: 'branches', label: 'Branches' },
      { key: 'approvalLevel', label: 'Approval Level' },
      { key: 'approvalLimit', label: 'Approval Limit' },
      { key: 'permissionCount', label: 'Permissions' },
      { key: 'userCount', label: 'Users' },
      { key: 'createdAt', label: 'Created' },
    ],
    rows: roles.map((r) => ({
      id: String(r._id),
      name: r.name,
      status: r.status,
      branchScope: SCOPE_LABELS[r.branchScope],
      branches: branchText(r),
      approvalLevel: r.approvalLevel,
      approvalLimit: r.approvalLimit ?? '',
      permissionCount: r.permissions.length,
      userCount: counts.get(String(r._id)) || 0,
      createdAt: r.createdAt,
    })),
  };
}

async function permissionMatrix() {
  const [roles, permissions] = await Promise.all([
    Role.find().sort({ normalizedName: 1 }).lean(),
    Permission.find().sort({ sortOrder: 1 }).lean(),
  ]);
  return {
    title: 'Permission Matrix',
    columns: [
      { key: 'name', label: 'Role' },
      { key: 'status', label: 'Status' },
      ...permissions.map((p) => ({ key: p.key, label: p.key })),
    ],
    rows: roles.map((r) => {
      const has = new Set(r.permissions);
      const row = { id: String(r._id), name: r.name, status: r.status };
      for (const p of permissions) row[p.key] = has.has(p.key) ? 'Yes' : '';
      return row;
    }),
  };
}

/** Users and their roles - restricted to the branches the requesting user may access. */
async function roleAssignment(auth) {
  const accessible = getAccessibleBranchIds(auth);
  const filter = accessible === null ? {} : { branchId: { $in: accessible } };
  const users = await User.find(filter)
    .populate('roleId', 'name status')
    .populate('branchId', 'code name')
    .sort({ name: 1 })
    .lean();
  return {
    title: 'Role Assignment',
    scopeNote: accessible === null ? 'All branches' : 'Limited to your accessible branches',
    columns: [
      { key: 'userName', label: 'User' },
      { key: 'email', label: 'Email' },
      { key: 'roleName', label: 'Role' },
      { key: 'roleStatus', label: 'Role Status' },
      { key: 'branch', label: 'Branch' },
      { key: 'userStatus', label: 'User Status' },
    ],
    rows: users.map((u) => ({
      id: String(u._id),
      userName: u.name,
      email: u.email,
      roleName: u.roleId?.name ?? '(no role)',
      roleStatus: u.roleId?.status ?? '',
      branch: u.branchId ? `${u.branchId.name} (${u.branchId.code})` : '-',
      userStatus: u.status,
    })),
  };
}

async function inactiveRoles() {
  const roles = await Role.find({ status: 'inactive' }).sort({ updatedAt: -1 }).lean();
  const counts = await getUserCounts(roles.map((r) => r._id));
  return {
    title: 'Inactive Roles',
    columns: [
      { key: 'name', label: 'Role' },
      { key: 'description', label: 'Description' },
      { key: 'userCount', label: 'Users Still Assigned' },
      { key: 'permissionCount', label: 'Permissions' },
      { key: 'updatedAt', label: 'Last Updated' },
    ],
    rows: roles.map((r) => ({
      id: String(r._id),
      name: r.name,
      description: r.description,
      userCount: counts.get(String(r._id)) || 0,
      permissionCount: r.permissions.length,
      updatedAt: r.updatedAt,
    })),
  };
}

const REPORTS = {
  'role-summary': roleSummary,
  'permission-matrix': permissionMatrix,
  'role-assignment': roleAssignment,
  'inactive-roles': inactiveRoles,
};

export function buildReport(name, auth) {
  return REPORTS[name](auth);
}

/* ---------------------------------------------------------- dashboard + approvals */

export async function getDashboardStats(auth) {
  const [roleStats, totalUsers, totalPermissions, totalBranches, counts] = await Promise.all([
    Role.aggregate([
      {
        $facet: {
          byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
          byScope: [{ $group: { _id: '$branchScope', count: { $sum: 1 } } }],
          withApproval: [{ $match: { approvalLevel: { $gt: 0 } } }, { $count: 'count' }],
        },
      },
    ]),
    User.countDocuments(),
    Permission.countDocuments(),
    Branch.countDocuments({ status: 'active' }),
    getUserCounts(),
  ]);
  const facet = roleStats[0];
  const byStatus = Object.fromEntries(facet.byStatus.map((s) => [s._id, s.count]));
  const byScope = Object.fromEntries(facet.byScope.map((s) => [s._id, s.count]));

  const topRoleIds = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topRoleDocs = await Role.find({ _id: { $in: topRoleIds.map(([id]) => id) } }, 'name status').lean();
  const nameById = new Map(topRoleDocs.map((r) => [String(r._id), r]));

  const stats = {
    roles: {
      total: (byStatus.active || 0) + (byStatus.inactive || 0),
      active: byStatus.active || 0,
      inactive: byStatus.inactive || 0,
      withApproval: facet.withApproval[0]?.count || 0,
    },
    branchScopes: { assigned: byScope.assigned || 0, selected: byScope.selected || 0, all: byScope.all || 0 },
    users: totalUsers,
    permissions: totalPermissions,
    branches: totalBranches,
    topRoles: topRoleIds
      .filter(([id]) => nameById.has(id))
      .map(([id, count]) => ({ id, name: nameById.get(id).name, status: nameById.get(id).status, userCount: count })),
    recentActivity: null,
  };

  // Audit information is visible only to System Administrators.
  if (auth.isAdmin) {
    const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(6).lean();
    stats.recentActivity = logs.map((l) => ({
      id: String(l._id),
      action: l.action,
      actorName: l.actorName,
      entityName: l.entityName,
      entityType: l.entityType,
      roleId: l.roleId ? String(l.roleId) : null,
      createdAt: l.createdAt,
    }));
  }
  return stats;
}

export async function getApprovalLevels() {
  const roles = await Role.find().sort({ approvalLevel: 1, normalizedName: 1 }).lean();
  const counts = await getUserCounts(roles.map((r) => r._id));
  const levels = new Map();
  for (const r of roles) {
    if (!levels.has(r.approvalLevel)) levels.set(r.approvalLevel, []);
    levels.get(r.approvalLevel).push({
      id: String(r._id),
      name: r.name,
      status: r.status,
      approvalLimit: r.approvalLimit ?? null,
      userCount: counts.get(String(r._id)) || 0,
      approvePermissions: r.permissions.filter((p) => p.endsWith('.approve')),
      isSystem: !!r.isSystem,
    });
  }
  return [...levels.entries()].map(([level, items]) => {
    const limits = items.map((i) => i.approvalLimit).filter((v) => v !== null);
    return {
      level,
      roles: items,
      roleCount: items.length,
      minLimit: limits.length ? Math.min(...limits) : null,
      maxLimit: limits.length ? Math.max(...limits) : null,
      hasUnlimited: level > 0 && items.some((i) => i.approvalLimit === null),
    };
  });
}
