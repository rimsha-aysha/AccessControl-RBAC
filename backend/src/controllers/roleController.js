import { sendSuccess } from '../utils/helpers.js';
import * as roleService from '../services/roleService.js';

export async function list(req, res) {
  const { items, meta } = await roleService.listRoles(req.valid.query);
  sendSuccess(res, items, { meta });
}

export async function get(req, res) {
  sendSuccess(res, await roleService.getRoleDetails(req.valid.params.id));
}

export async function create(req, res) {
  const role = await roleService.createRole(req.valid.body, req.auth.user);
  sendSuccess(res, role, { status: 201, message: 'Role created successfully' });
}

export async function update(req, res) {
  const role = await roleService.updateRole(req.valid.params.id, req.valid.body, req.auth.user);
  sendSuccess(res, role, { message: 'Role updated successfully' });
}

export async function updateStatus(req, res) {
  const { status } = req.valid.body;
  const role = await roleService.setRoleStatus(req.valid.params.id, status, req.auth.user);
  sendSuccess(res, role, { message: `Role ${status === 'active' ? 'activated' : 'deactivated'} successfully` });
}

export async function clone(req, res) {
  const role = await roleService.cloneRole(req.valid.params.id, req.valid.body, req.auth.user);
  sendSuccess(res, role, { status: 201, message: 'Role cloned successfully' });
}

export async function updatePermissions(req, res) {
  const role = await roleService.updateRolePermissions(req.valid.params.id, req.valid.body.permissions, req.auth.user);
  sendSuccess(res, role, { message: 'Permissions updated successfully' });
}

export async function remove(req, res) {
  await roleService.deleteRole(req.valid.params.id, req.auth.user);
  sendSuccess(res, null, { message: 'Role deleted successfully' });
}
