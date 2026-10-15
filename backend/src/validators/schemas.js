import { z } from 'zod';
import mongoose from 'mongoose';
import { BRANCH_SCOPES, ROLE_STATUSES, MAX_APPROVAL_LEVEL, MAX_APPROVAL_LIMIT } from '../models/Role.js';
import { AUDIT_ACTIONS } from '../models/AuditLog.js';

/**
 * Request validation schemas.
 * `.strict()` rejects unknown fields, so a client cannot sneak in fields such as
 * `isSystem`, `_id` or `createdBy` to escalate privileges (mass-assignment protection).
 */

export const objectId = z
  .string({ invalid_type_error: 'ID must be a string' })
  .refine((value) => mongoose.isValidObjectId(value) && /^[a-f\d]{24}$/i.test(value), {
    message: 'Invalid ID format',
  });

export const idParams = z.object({ id: objectId });

const roleName = z
  .string({ required_error: 'Role name is required', invalid_type_error: 'Role name must be text' })
  .trim()
  .min(1, 'Role name is required')
  .max(100, 'Role name must be 100 characters or fewer');

const permissionList = z
  .array(z.string().trim().min(1).max(100), {
    required_error: 'Select at least one permission',
    invalid_type_error: 'Permissions must be a list',
  })
  .min(1, 'A role must have at least one permission')
  .max(200, 'Too many permissions');

const roleFields = {
  name: roleName,
  description: z
    .string({ invalid_type_error: 'Description must be text' })
    .trim()
    .max(500, 'Description must be 500 characters or fewer')
    .optional()
    .default(''),
  status: z.enum(ROLE_STATUSES, { errorMap: () => ({ message: 'Status must be active or inactive' }) }),
  branchScope: z.enum(BRANCH_SCOPES, {
    errorMap: () => ({ message: 'Branch scope must be assigned, selected or all' }),
  }),
  branchIds: z.array(objectId, { invalid_type_error: 'Branch IDs must be a list' }).max(500).optional().default([]),
  approvalLevel: z
    .number({ invalid_type_error: 'Approval level must be a number' })
    .int('Approval level must be a whole number')
    .min(0, 'Approval level cannot be negative')
    .max(MAX_APPROVAL_LEVEL, `Approval level cannot be greater than ${MAX_APPROVAL_LEVEL}`)
    .optional()
    .default(0),
  approvalLimit: z
    .number({ invalid_type_error: 'Approval limit must be a number' })
    .min(0, 'Approval limit cannot be negative')
    .max(MAX_APPROVAL_LIMIT, 'Approval limit is too large')
    .nullable()
    .optional()
    .default(null),
  permissions: permissionList,
};

export const createRoleSchema = z
  .object({ ...roleFields, status: roleFields.status.optional().default('active') })
  .strict();

// Status is changed only through PATCH /roles/:id/status (so it is audited and protected separately).
export const updateRoleSchema = z.object({ ...roleFields }).omit({ status: true }).strict();

// Clone: name is required; everything else falls back to the source role's values.
export const cloneRoleSchema = z
  .object({
    name: roleName,
    description: roleFields.description.removeDefault().optional(),
    status: roleFields.status.optional().default('active'),
    branchScope: roleFields.branchScope.optional(),
    branchIds: roleFields.branchIds.removeDefault().optional(),
    approvalLevel: roleFields.approvalLevel.removeDefault().optional(),
    approvalLimit: roleFields.approvalLimit.removeDefault().optional(),
    permissions: permissionList.optional(),
  })
  .strict();

export const roleStatusSchema = z.object({ status: roleFields.status }).strict();

export const rolePermissionsSchema = z.object({ permissions: permissionList }).strict();

export const listRolesQuery = z.object({
  search: z.string().trim().max(100, 'Search text is too long').optional().default(''),
  status: z.enum(['', ...ROLE_STATUSES]).optional().default(''),
  branchScope: z.enum(['', ...BRANCH_SCOPES]).optional().default(''),
  sortBy: z.enum(['name', 'createdAt', 'userCount']).optional().default('name'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
});

export const loginSchema = z
  .object({
    email: z.string({ required_error: 'Email is required' }).trim().toLowerCase().email('Enter a valid email address').max(254),
    password: z.string({ required_error: 'Password is required' }).min(1, 'Password is required').max(200),
  })
  .strict();

export const passwordRule = z
  .string({ required_error: 'Password is required' })
  .min(12, 'Password must be at least 12 characters')
  .max(200, 'Password is too long')
  .refine((p) => /[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p), {
    message: 'Password must contain upper-case, lower-case letters and a number',
  });

export const createUserSchema = z
  .object({
    name: z.string({ required_error: 'Name is required' }).trim().min(1, 'Name is required').max(100),
    email: z.string({ required_error: 'Email is required' }).trim().toLowerCase().email('Enter a valid email address').max(254),
    password: passwordRule,
    roleId: objectId,
    branchId: objectId.nullable().optional().default(null),
  })
  .strict();

export const userRoleSchema = z.object({ roleId: objectId }).strict();
export const userStatusSchema = z.object({ status: z.enum(['active', 'inactive']) }).strict();

export const listUsersQuery = z.object({
  search: z.string().trim().max(100).optional().default(''),
  roleId: z.union([z.literal(''), objectId]).optional().default(''),
  branchId: z.union([z.literal(''), objectId]).optional().default(''),
});

export const auditQuery = z.object({
  roleId: z.union([z.literal(''), objectId]).optional().default(''),
  action: z.enum(['', ...AUDIT_ACTIONS]).optional().default(''),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const reportParams = z.object({
  report: z.enum(['role-summary', 'permission-matrix', 'role-assignment', 'inactive-roles'], {
    errorMap: () => ({ message: 'Unknown report' }),
  }),
});

export const reportQuery = z.object({
  format: z.enum(['json', 'csv']).optional().default('json'),
});
