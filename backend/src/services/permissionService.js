import { Permission } from '../models/Permission.js';
import { Role } from '../models/Role.js';
import { ACTIONS, MODULES, PERMISSION_CATALOG } from '../config/permissions.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Idempotently copy the permission catalog (config/permissions.js) into MongoDB.
 * Safe to run on every startup.
 */
export async function syncPermissions() {
  await Permission.bulkWrite(
    PERMISSION_CATALOG.map((p) => ({
      updateOne: { filter: { key: p.key }, update: { $set: p }, upsert: true },
    }))
  );
  // Remove permissions that no longer exist in the catalog, and strip them from roles.
  const validKeys = PERMISSION_CATALOG.map((p) => p.key);
  const stale = await Permission.find({ key: { $nin: validKeys } }).distinct('key');
  if (stale.length) {
    await Permission.deleteMany({ key: { $in: stale } });
    await Role.updateMany({ permissions: { $in: stale } }, { $pull: { permissions: { $in: stale } } });
  }
  // The protected System Administrator role always holds the complete catalog (only written if it differs).
  const expected = [...validKeys].sort().join();
  for (const role of await Role.find({ isSystem: true }, 'permissions').lean()) {
    if ([...role.permissions].sort().join() !== expected) {
      await Role.updateOne({ _id: role._id }, { $set: { permissions: validKeys } });
    }
  }
}

export async function getPermissionCatalog() {
  const permissions = await Permission.find().sort({ sortOrder: 1 }).lean();
  return {
    actions: ACTIONS,
    modules: MODULES,
    permissions: permissions.map(({ key, module, action, description }) => ({ key, module, action, description })),
  };
}

/**
 * Validate client-supplied permission keys against the database.
 * Returns a de-duplicated, catalog-ordered list.
 */
export async function validatePermissionKeys(keys) {
  const unique = [...new Set(keys)];
  if (unique.length === 0) {
    throw ApiError.badRequest('A role must have at least one permission', [
      { field: 'permissions', message: 'A role must have at least one permission' },
    ]);
  }
  const found = await Permission.find({ key: { $in: unique } }).sort({ sortOrder: 1 }).lean();
  const foundKeys = new Set(found.map((p) => p.key));
  const unknown = unique.filter((key) => !foundKeys.has(key));
  if (unknown.length) {
    throw ApiError.badRequest(`Unknown permission(s): ${unknown.slice(0, 5).join(', ')}`, [
      { field: 'permissions', message: 'One or more permissions are not recognised' },
    ]);
  }
  return found.map((p) => p.key);
}

export async function getAllPermissionKeys() {
  return (await Permission.find().sort({ sortOrder: 1 }).lean()).map((p) => p.key);
}
