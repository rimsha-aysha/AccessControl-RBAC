import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestApp, teardownTestApp, auth, rolePayload, ADMIN } from './helpers.js';
import { escapeCsvValue, toCsv } from '../src/utils/csv.js';

let ctx;
before(async () => {
  ctx = await setupTestApp();
});
after(teardownTestApp);

const newUser = async (overrides = {}) => ({
  name: 'New Staff',
  email: `staff${Date.now()}${Math.random().toString(16).slice(2, 6)}@test.local`,
  password: 'NewStaffPassw0rd',
  roleId: await ctx.roleId('Customer Service Officer'),
  branchId: await ctx.branchId('HQ'),
  ...overrides,
});

describe('System Administrator protection', () => {
  it('cannot deactivate the System Administrator role', async () => {
    const sysId = await ctx.roleId('System Administrator');
    const res = await ctx.api.patch(`/api/roles/${sysId}/status`).set(auth(ctx.adminToken)).send({ status: 'inactive' });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'PROTECTED_ROLE');
  });

  it('cannot delete the System Administrator role', async () => {
    const sysId = await ctx.roleId('System Administrator');
    const res = await ctx.api.delete(`/api/roles/${sysId}`).set(auth(ctx.adminToken));
    assert.equal(res.status, 409);
  });

  it('cannot rename the System Administrator role', async () => {
    const sysId = await ctx.roleId('System Administrator');
    const current = (await ctx.api.get(`/api/roles/${sysId}`).set(auth(ctx.adminToken))).body.data;
    const res = await ctx.api
      .put(`/api/roles/${sysId}`)
      .set(auth(ctx.adminToken))
      .send({ ...rolePayload(), name: 'Super User', branchScope: 'all', permissions: current.permissions });
    assert.equal(res.status, 403);
  });

  it('an admin cannot change their own role', async () => {
    const me = (await ctx.api.get('/api/auth/me').set(auth(ctx.adminToken))).body.data.user;
    const res = await ctx.api
      .patch(`/api/users/${me.id}/role`)
      .set(auth(ctx.adminToken))
      .send({ roleId: await ctx.roleId('Branch Manager') });
    assert.equal(res.status, 403);
  });

  it('an admin cannot deactivate their own account', async () => {
    const me = (await ctx.api.get('/api/auth/me').set(auth(ctx.adminToken))).body.data.user;
    const res = await ctx.api.patch(`/api/users/${me.id}/status`).set(auth(ctx.adminToken)).send({ status: 'inactive' });
    assert.equal(res.status, 403);
  });

  it('service guard refuses to demote or deactivate the last active administrator', async () => {
    const { changeUserRole, setUserStatus, countActiveAdmins } = await import('../src/services/userService.js');
    const admin = await ctx.models.User.findOne({ email: ADMIN.email });
    assert.equal(await countActiveAdmins(), 1);
    // Simulate a request from some other actor (e.g. a future automated job) targeting the only admin.
    const otherActor = { _id: '64b000000000000000000001', name: 'Job' };
    await assert.rejects(changeUserRole(admin._id, await ctx.roleId('Regional Auditor'), otherActor), { code: 'LAST_ADMIN' });
    await assert.rejects(setUserStatus(admin._id, 'inactive', otherActor), { code: 'LAST_ADMIN' });
  });

  it('another admin can be demoted while at least one admin remains', async () => {
    const second = await ctx.api
      .post('/api/users')
      .set(auth(ctx.adminToken))
      .send(await newUser({ roleId: await ctx.roleId('System Administrator'), password: 'SecondAdmin1234' }));
    assert.equal(second.status, 201, JSON.stringify(second.body));
    const secondToken = await ctx.login(second.body.data.email, 'SecondAdmin1234');

    const demote = await ctx.api
      .patch(`/api/users/${second.body.data.id}/role`)
      .set(auth(ctx.adminToken))
      .send({ roleId: await ctx.roleId('Regional Auditor') });
    assert.equal(demote.status, 200);
    // The demotion takes effect immediately for the demoted user's existing session.
    assert.equal((await ctx.api.get('/api/roles').set(auth(secondToken))).status, 403);
  });
});

describe('Role assignment', () => {
  it('inactive roles cannot be assigned to users', async () => {
    const res = await ctx.api
      .post('/api/users')
      .set(auth(ctx.adminToken))
      .send(await newUser({ roleId: await ctx.roleId('Legacy Teller') }));
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'ROLE_INACTIVE');

    const someUser = await ctx.models.User.findOne({ email: 'divya.suresh@demo.local' });
    const change = await ctx.api
      .patch(`/api/users/${someUser._id}/role`)
      .set(auth(ctx.adminToken))
      .send({ roleId: await ctx.roleId('Legacy Teller') });
    assert.equal(change.status, 409);
  });

  it('Assigned Branch roles require the user to have a branch', async () => {
    const res = await ctx.api.post('/api/users').set(auth(ctx.adminToken)).send(await newUser({ branchId: null }));
    assert.equal(res.status, 400);
  });

  it('rejects weak passwords for new users', async () => {
    const res = await ctx.api.post('/api/users').set(auth(ctx.adminToken)).send(await newUser({ password: 'short' }));
    assert.equal(res.status, 400);
  });

  it('roles assigned to users cannot be deleted, unused roles can', async () => {
    const used = await ctx.api.delete(`/api/roles/${await ctx.roleId('Accountant')}`).set(auth(ctx.adminToken));
    assert.equal(used.status, 409);
    assert.equal(used.body.error.code, 'ROLE_IN_USE');

    const created = await ctx.api.post('/api/roles').set(auth(ctx.adminToken)).send(rolePayload());
    const del = await ctx.api.delete(`/api/roles/${created.body.data.id}`).set(auth(ctx.adminToken));
    assert.equal(del.status, 200);
  });

  it('a deactivated role takes effect immediately for signed-in users', async () => {
    const created = await ctx.api.post('/api/roles').set(auth(ctx.adminToken)).send(rolePayload({ permissions: ['dashboard.view'] }));
    const user = await ctx.api
      .post('/api/users')
      .set(auth(ctx.adminToken))
      .send(await newUser({ roleId: created.body.data.id, password: 'Temporary12345' }));
    const token = await ctx.login(user.body.data.email, 'Temporary12345');
    assert.equal((await ctx.api.get('/api/dashboard/stats').set(auth(token))).status, 200);

    const deactivate = await ctx.api.patch(`/api/roles/${created.body.data.id}/status`).set(auth(ctx.adminToken)).send({ status: 'inactive' });
    assert.equal(deactivate.status, 200);
    assert.equal((await ctx.api.get('/api/dashboard/stats').set(auth(token))).status, 403);
  });
});

describe('Branch scope & reports', () => {
  it('Assigned Branch users only see users from their own branch in the Role Assignment report', async () => {
    const res = await ctx.api.get('/api/reports/role-assignment').set(auth(ctx.managerToken));
    assert.equal(res.status, 200);
    assert.ok(res.body.data.rows.length > 0);
    assert.ok(res.body.data.rows.every((r) => r.branch.includes('(TVM)')), JSON.stringify(res.body.data.rows));
  });

  it('All Branches users see every branch', async () => {
    const res = await ctx.api.get('/api/reports/role-assignment').set(auth(ctx.auditorToken));
    const branches = new Set(res.body.data.rows.map((r) => r.branch));
    assert.ok(branches.size > 1);
  });

  it('branch list respects branch scope', async () => {
    const res = await ctx.api.get('/api/branches').set(auth(ctx.managerToken));
    assert.deepEqual(res.body.data.map((b) => b.code), ['TVM']);
  });

  it('CSV export requires reports.export and escapes values', async () => {
    const csv = await ctx.api.get('/api/reports/role-summary?format=csv').set(auth(ctx.adminToken));
    assert.equal(csv.status, 200);
    assert.match(csv.headers['content-type'], /text\/csv/);
    assert.ok(csv.text.includes('"Role","Status"'));

    // Customer Service Officers have no report permissions at all
    const cso = await ctx.login('joseph.thomas@demo.local', 'StaffPassw0rd!');
    assert.equal((await ctx.api.get('/api/reports/role-summary?format=csv').set(auth(cso))).status, 403);
  });

  it('rejects unknown reports', async () => {
    const res = await ctx.api.get('/api/reports/passwords').set(auth(ctx.adminToken));
    assert.equal(res.status, 400);
  });

  it('CSV helper quotes values and neutralises formulas', () => {
    assert.equal(escapeCsvValue('a"b'), '"a""b"');
    assert.equal(escapeCsvValue('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"');
    assert.equal(escapeCsvValue(null), '""');
    assert.ok(toCsv([{ key: 'a', label: 'A' }], [{ a: 'x,y' }]).endsWith('"A"\r\n"x,y"'));
  });
});

describe('Seeding', () => {
  it('is idempotent - running it again creates nothing new', async () => {
    const { seedBaseData, seedDemoUsers } = await import('../src/seed/seedData.js');
    const before = {
      roles: await ctx.models.Role.countDocuments(),
      branches: await ctx.models.Branch.countDocuments(),
      users: await ctx.models.User.countDocuments(),
    };
    const accountantBefore = await ctx.models.Role.findOne({ name: 'Accountant' }).lean();
    const result = await seedBaseData();
    await seedDemoUsers('AnotherPassw0rd');
    assert.deepEqual(result, { branchesCreated: 0, rolesCreated: 0 });
    const accountantAfter = await ctx.models.Role.findOne({ name: 'Accountant' }).lean();
    assert.equal(accountantAfter.updatedAt.getTime(), accountantBefore.updatedAt.getTime(), 'existing roles must not be modified');
    assert.equal(await ctx.models.Role.countDocuments(), before.roles);
    assert.equal(await ctx.models.Branch.countDocuments(), before.branches);
    assert.equal(await ctx.models.User.countDocuments(), before.users);
  });

  it('initial admin setup never resets an existing password', async () => {
    const { createInitialAdmin } = await import('../src/seed/seedData.js');
    const result = await createInitialAdmin({ name: 'X', email: ADMIN.email, password: 'CompletelyDifferent1' });
    assert.equal(result.created, false);
    await ctx.login(ADMIN.email, ADMIN.password); // old password still works
  });
});
