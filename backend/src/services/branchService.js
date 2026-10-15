import { Branch } from '../models/Branch.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Validates branch IDs for a role's branch scope.
 * Only "selected" scope keeps branch IDs; other scopes always store an empty list.
 */
export async function validateBranchSelection(branchScope, branchIds = []) {
  if (branchScope !== 'selected') return [];

  const unique = [...new Set(branchIds.map(String))];
  if (unique.length === 0) {
    throw ApiError.badRequest('Select at least one branch for the Selected Branches scope', [
      { field: 'branchIds', message: 'Select at least one branch' },
    ]);
  }
  const count = await Branch.countDocuments({ _id: { $in: unique }, status: 'active' });
  if (count !== unique.length) {
    throw ApiError.badRequest('One or more selected branches do not exist or are inactive', [
      { field: 'branchIds', message: 'Invalid branch selection' },
    ]);
  }
  return unique;
}

/**
 * Branch IDs the authenticated user may access, or `null` meaning "all branches".
 * This is the single backend rule used to restrict branch-level data.
 */
export function getAccessibleBranchIds(auth) {
  const { role, user, isAdmin } = auth;
  if (isAdmin || role.branchScope === 'all') return null;
  if (role.branchScope === 'selected') return role.branchIds.map((id) => String(id._id ?? id));
  const own = user.branchId?._id ?? user.branchId;
  return own ? [String(own)] : [];
}

export async function listBranches(auth) {
  const accessible = getAccessibleBranchIds(auth);
  const filter = accessible === null ? {} : { _id: { $in: accessible } };
  return Branch.find(filter).sort({ name: 1 }).lean();
}
