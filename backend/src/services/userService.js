import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { Role } from '../models/Role.js';
import { Branch } from '../models/Branch.js';
import { ApiError } from '../utils/ApiError.js';
import { escapeRegex } from '../utils/helpers.js';
import { recordAudit } from './auditService.js';

export const BCRYPT_ROUNDS = 12;

export function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export function serializeUser(user) {
  const u = user.toObject ? user.toObject() : user;
  const role = u.roleId && u.roleId.name ? u.roleId : null;
  const branch = u.branchId && u.branchId.name ? u.branchId : null;
  return {
    id: String(u._id),
    name: u.name,
    email: u.email,
    status: u.status,
    role: role ? { id: String(role._id), name: role.name, status: role.status, isSystem: !!role.isSystem } : null,
    branch: branch ? { id: String(branch._id), code: branch.code, name: branch.name } : null,
    lastLoginAt: u.lastLoginAt,
    createdAt: u.createdAt,
  };
}

/** Number of active users holding an active System Administrator role. */
export async function countActiveAdmins({ excludeUserId } = {}) {
  const systemRoles = await Role.find({ isSystem: true, status: 'active' }).distinct('_id');
  const filter = { roleId: { $in: systemRoles }, status: 'active' };
  if (excludeUserId) filter._id = { $ne: excludeUserId };
  return User.countDocuments(filter);
}

/** A role can only be assigned if it exists and is active. */
async function getAssignableRole(roleId) {
  const role = await Role.findById(roleId);
  if (!role) throw ApiError.badRequest('Selected role does not exist', [{ field: 'roleId', message: 'Role not found' }]);
  if (role.status !== 'active') {
    throw new ApiError(409, 'ROLE_INACTIVE', `The role "${role.name}" is inactive and cannot be assigned to users.`, [
      { field: 'roleId', message: 'Inactive roles cannot be assigned' },
    ]);
  }
  return role;
}

async function validateUserBranch(role, branchId) {
  if (branchId) {
    const branch = await Branch.findOne({ _id: branchId, status: 'active' });
    if (!branch) throw ApiError.badRequest('Selected branch does not exist or is inactive', [{ field: 'branchId', message: 'Invalid branch' }]);
  } else if (role.branchScope === 'assigned') {
    throw ApiError.badRequest('A branch is required for roles with the Assigned Branch scope', [
      { field: 'branchId', message: 'Select the user\'s branch' },
    ]);
  }
}

async function loadUser(id) {
  const user = await User.findById(id).populate('roleId').populate('branchId');
  if (!user) throw ApiError.notFound('User not found');
  return user;
}

export async function listUsers(query) {
  const filter = {};
  if (query.search) {
    const rx = { $regex: escapeRegex(query.search), $options: 'i' };
    filter.$or = [{ name: rx }, { email: rx }];
  }
  if (query.roleId) filter.roleId = query.roleId;
  if (query.branchId) filter.branchId = query.branchId;
  const users = await User.find(filter).populate('roleId', 'name status isSystem').populate('branchId', 'code name').sort({ name: 1 }).lean();
  return users.map(serializeUser);
}

export async function createUser(data, actor) {
  const role = await getAssignableRole(data.roleId);
  await validateUserBranch(role, data.branchId);
  if (await User.exists({ email: data.email })) {
    throw new ApiError(409, 'EMAIL_EXISTS', 'A user with this email already exists.', [{ field: 'email', message: 'Email already in use' }]);
  }
  const user = await User.create({
    name: data.name,
    email: data.email,
    passwordHash: await hashPassword(data.password),
    roleId: role._id,
    branchId: data.branchId || null,
  });
  await recordAudit({
    actor,
    action: 'user.created',
    entityType: 'user',
    entity: user,
    roleId: role._id,
    metadata: { email: user.email, role: role.name },
  });
  return serializeUser(await loadUser(user._id));
}

export async function changeUserRole(userId, roleId, actor) {
  if (String(userId) === String(actor._id)) {
    throw ApiError.forbidden('You cannot change your own role. Ask another System Administrator.');
  }
  const user = await loadUser(userId);
  const newRole = await getAssignableRole(roleId);
  await validateUserBranch(newRole, user.branchId?._id);

  const wasAdmin = user.roleId?.isSystem && user.roleId?.status === 'active' && user.status === 'active';
  if (wasAdmin && !newRole.isSystem && (await countActiveAdmins({ excludeUserId: user._id })) === 0) {
    throw new ApiError(409, 'LAST_ADMIN', 'This is the last active System Administrator. At least one must always exist.');
  }

  const fromRole = user.roleId ? { id: String(user.roleId._id), name: user.roleId.name } : null;
  user.roleId = newRole._id;
  await user.save();
  await recordAudit({
    actor,
    action: 'user.role_changed',
    entityType: 'user',
    entity: user,
    roleId: newRole._id,
    changes: { role: { from: fromRole?.name ?? null, to: newRole.name } },
    metadata: { fromRoleId: fromRole?.id ?? null, toRoleId: String(newRole._id) },
  });
  return serializeUser(await loadUser(user._id));
}

export async function setUserStatus(userId, status, actor) {
  if (String(userId) === String(actor._id)) {
    throw ApiError.forbidden('You cannot change your own account status.');
  }
  const user = await loadUser(userId);
  if (user.status === status) return serializeUser(user);
  if (status === 'inactive' && user.roleId?.isSystem && (await countActiveAdmins({ excludeUserId: user._id })) === 0) {
    throw new ApiError(409, 'LAST_ADMIN', 'This is the last active System Administrator. At least one must always exist.');
  }
  const before = user.status;
  user.status = status;
  await user.save();
  await recordAudit({
    actor,
    action: 'user.status_changed',
    entityType: 'user',
    entity: user,
    roleId: user.roleId?._id,
    changes: { status: { from: before, to: status } },
  });
  return serializeUser(await loadUser(user._id));
}
