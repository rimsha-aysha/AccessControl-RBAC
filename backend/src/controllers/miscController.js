import { sendSuccess } from '../utils/helpers.js';
import { toCsv } from '../utils/csv.js';
import { ApiError } from '../utils/ApiError.js';
import { PERMISSIONS } from '../config/permissions.js';
import { AuditLog } from '../models/AuditLog.js';
import { getPermissionCatalog } from '../services/permissionService.js';
import { listBranches } from '../services/branchService.js';
import { buildReport, getDashboardStats, getApprovalLevels } from '../services/reportService.js';
import * as userService from '../services/userService.js';

export async function permissions(_req, res) {
  sendSuccess(res, await getPermissionCatalog());
}

export async function branches(req, res) {
  const items = await listBranches(req.auth);
  sendSuccess(
    res,
    items.map((b) => ({ id: String(b._id), code: b.code, name: b.name, city: b.city, status: b.status }))
  );
}

export async function dashboard(req, res) {
  sendSuccess(res, await getDashboardStats(req.auth));
}

export async function approvalLevels(_req, res) {
  sendSuccess(res, await getApprovalLevels());
}

export async function report(req, res) {
  const { report: name } = req.valid.params;
  const { format } = req.valid.query;
  const data = await buildReport(name, req.auth);

  if (format === 'csv') {
    if (!req.auth.permissions.has(PERMISSIONS.REPORTS_EXPORT)) {
      throw ApiError.forbidden('Missing permission: reports.export');
    }
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${name}-${stamp}.csv"`);
    return res.send(toCsv(data.columns, data.rows));
  }
  sendSuccess(res, data);
}

export async function auditLogs(req, res) {
  const { roleId, action, page, limit } = req.valid.query;
  const filter = {};
  if (roleId) filter.roleId = roleId;
  if (action) filter.action = action;
  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    AuditLog.countDocuments(filter),
  ]);
  sendSuccess(
    res,
    items.map((l) => ({
      id: String(l._id),
      action: l.action,
      actorId: l.actorId ? String(l.actorId) : null,
      actorName: l.actorName,
      entityType: l.entityType,
      entityId: String(l.entityId),
      entityName: l.entityName,
      roleId: l.roleId ? String(l.roleId) : null,
      changes: l.changes,
      metadata: l.metadata,
      createdAt: l.createdAt,
    })),
    { meta: { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) } }
  );
}

/* ---------------------------------------------------------------- users */

export async function listUsers(req, res) {
  sendSuccess(res, await userService.listUsers(req.valid.query));
}

export async function createUser(req, res) {
  const user = await userService.createUser(req.valid.body, req.auth.user);
  sendSuccess(res, user, { status: 201, message: 'User created successfully' });
}

export async function changeUserRole(req, res) {
  const user = await userService.changeUserRole(req.valid.params.id, req.valid.body.roleId, req.auth.user);
  sendSuccess(res, user, { message: 'User role updated successfully' });
}

export async function changeUserStatus(req, res) {
  const user = await userService.setUserStatus(req.valid.params.id, req.valid.body.status, req.auth.user);
  sendSuccess(res, user, { message: 'User status updated successfully' });
}
