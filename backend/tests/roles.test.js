import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestApp, teardownTestApp, auth, rolePayload } from './helpers.js';

let ctx;
before(async () => {
  ctx = await setupTestApp();
});
after(teardownTestApp);

describe('Authentication & authorization', () => {
  it('rejects requests without a token', async () => {
    const res = await ctx.api.get('/api/roles');
    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
  });

  it('rejects an invalid / tampered token', async () => {
    const res = await ctx.api.get('/api/roles').set(auth(ctx.adminToken + 'x'));
    assert.equal(res.status, 401);
  });

  it('rejects wrong passwords with a generic message', async () => {
    const res = await ctx.api.post('/api/auth/login').send({ email: 'admin@test.local', password: 'wrong-password' });
    assert.equal(res.status, 401);
    assert.equal(res.body.error.message, 'Invalid email or password.');
  });

  it('never returns password hashes', async () => {
    const res = await ctx.api.get('/api/auth/me').set(auth(ctx.adminToken));
    assert.equal(res.status, 200);
    assert.equal(res.body.data.isAdmin, true);
    assert.ok(!JSON.stringify(res.body).includes('passwordHash'));
  });

  it('has no public registration endpoint', async () => {
    for (const path of ['/api/auth/register', '/api/users']) {
      const res = await ctx.api.post(path).send({ name: 'x', email: 'x@y.z', password: 'Abcdefgh1234', role: 'admin' });
      assert.ok([401, 404].includes(res.status), `${path} returned ${res.status}`);
    }
    assert.equal(await ctx.models.User.countDocuments({ email: 'x@y.z' }), 0);
  });

  it('non-administrators cannot list, create, edit, clone or change status of roles', async () => {
    const roleId = await ctx.roleId('Customer Service Officer');
    const h = auth(ctx.managerToken);
    const results = await Promise.all([
      ctx.api.get('/api/roles').set(h),
      ctx.api.post('/api/roles').set(h).send(rolePayload()),
      ctx.api.put(`/api/roles/${roleId}`).set(h).send(rolePayload()),
      ctx.api.post(`/api/roles/${roleId}/clone`).set(h).send({ name: 'Sneaky clone' }),
      ctx.api.patch(`/api/roles/${roleId}/status`).set(h).send({ status: 'inactive' }),
      ctx.api.put(`/api/roles/${roleId}/permissions`).set(h).send({ permissions: ['loan.approve'] }),
      ctx.api.get('/api/audit-logs').set(h),
    ]);
    for (const res of results) assert.equal(res.status, 403, JSON.stringify(res.body));
  });

  it('a user cannot grant themselves extra privileges by editing their own role', async () => {
    const ownRoleId = await ctx.roleId('Branch Manager');
    const res = await ctx.api
      .put(`/api/roles/${ownRoleId}/permissions`)
      .set(auth(ctx.managerToken))
      .send({ permissions: ['loan.approve', 'loan.delete'] });
    assert.equal(res.status, 403);
  });
});

describe('Role creation rules', () => {
  it('creates a valid role and writes an audit log', async () => {
    const payload = rolePayload({ name: 'Loan Officer' });
    const res = await ctx.api.post('/api/roles').set(auth(ctx.adminToken)).send(payload);
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.data.name, 'Loan Officer');
    assert.equal(res.body.data.status, 'active');
    assert.equal(res.body.data.isSystem, false);

    const logs = await ctx.api.get(`/api/audit-logs?roleId=${res.body.data.id}`).set(auth(ctx.adminToken));
    assert.equal(logs.status, 200);
    assert.ok(logs.body.data.some((l) => l.action === 'role.created'));
  });

  it('rejects duplicate role names, including case-insensitive duplicates', async () => {
    const exact = await ctx.api.post('/api/roles').set(auth(ctx.adminToken)).send(rolePayload({ name: 'Branch Manager' }));
    assert.equal(exact.status, 409);
    assert.equal(exact.body.error.code, 'ROLE_NAME_EXISTS');

    const differentCase = await ctx.api.post('/api/roles').set(auth(ctx.adminToken)).send(rolePayload({ name: '  branch   MANAGER ' }));
    assert.equal(differentCase.status, 409);
  });

  it('rejects a role without permissions', async () => {
    const res = await ctx.api.post('/api/roles').set(auth(ctx.adminToken)).send(rolePayload({ permissions: [] }));
    assert.equal(res.status, 400);
    assert.match(res.body.error.message, /at least one permission/i);
  });

  it('rejects unknown permission keys supplied by the client', async () => {
    const res = await ctx.api.post('/api/roles').set(auth(ctx.adminToken)).send(rolePayload({ permissions: ['dashboard.view', 'superuser.all'] }));
    assert.equal(res.status, 400);
    assert.match(res.body.error.message, /Unknown permission/);
  });

  it('rejects names longer than 100 characters', async () => {
    const res = await ctx.api.post('/api/roles').set(auth(ctx.adminToken)).send(rolePayload({ name: 'x'.repeat(101) }));
    assert.equal(res.status, 400);
  });

  it('rejects attempts to set protected fields such as isSystem', async () => {
    const res = await ctx.api.post('/api/roles').set(auth(ctx.adminToken)).send({ ...rolePayload(), isSystem: true });
    assert.equal(res.status, 400);
  });

  it('rejects Selected Branches scope with no branches', async () => {
    const res = await ctx.api.post('/api/roles').set(auth(ctx.adminToken)).send(rolePayload({ branchScope: 'selected', branchIds: [] }));
    assert.equal(res.status, 400);
    assert.match(res.body.error.message, /at least one branch/i);
  });

  it('rejects branch IDs that do not exist or are malformed', async () => {
    const missing = await ctx.api
      .post('/api/roles')
      .set(auth(ctx.adminToken))
      .send(rolePayload({ branchScope: 'selected', branchIds: ['64b000000000000000000000'] }));
    assert.equal(missing.status, 400);

    const malformed = await ctx.api.post('/api/roles').set(auth(ctx.adminToken)).send(rolePayload({ branchScope: 'selected', branchIds: ['not-an-id'] }));
    assert.equal(malformed.status, 400);
  });

  it('accepts valid selected branches', async () => {
    const res = await ctx.api
      .post('/api/roles')
      .set(auth(ctx.adminToken))
      .send(rolePayload({ branchScope: 'selected', branchIds: [await ctx.branchId('TSR'), await ctx.branchId('KTM')] }));
    assert.equal(res.status, 201);
    assert.equal(res.body.data.branches.length, 2);
  });

  it('validates approval settings', async () => {
    const limitWithoutLevel = await ctx.api.post('/api/roles').set(auth(ctx.adminToken)).send(rolePayload({ approvalLevel: 0, approvalLimit: 5000 }));
    assert.equal(limitWithoutLevel.status, 400);

    const negative = await ctx.api.post('/api/roles').set(auth(ctx.adminToken)).send(rolePayload({ approvalLevel: 1, approvalLimit: -1 }));
    assert.equal(negative.status, 400);

    const fractional = await ctx.api.post('/api/roles').set(auth(ctx.adminToken)).send(rolePayload({ approvalLevel: 1.5 }));
    assert.equal(fractional.status, 400);

    const ok = await ctx.api.post('/api/roles').set(auth(ctx.adminToken)).send(rolePayload({ approvalLevel: 3, approvalLimit: 250000 }));
    assert.equal(ok.status, 201);
    assert.equal(ok.body.data.approvalLimit, 250000);
  });
});

describe('Listing, searching and sorting', () => {
  it('filters by status and searches by name', async () => {
    const inactive = await ctx.api.get('/api/roles?status=inactive').set(auth(ctx.adminToken));
    assert.equal(inactive.status, 200);
    assert.ok(inactive.body.data.every((r) => r.status === 'inactive'));

    const search = await ctx.api.get('/api/roles?search=account').set(auth(ctx.adminToken));
    assert.deepEqual(search.body.data.map((r) => r.name), ['Accountant']);
  });

  it('sorts by assigned user count', async () => {
    const res = await ctx.api.get('/api/roles?sortBy=userCount&sortOrder=desc').set(auth(ctx.adminToken));
    const counts = res.body.data.map((r) => r.userCount);
    assert.deepEqual(counts, [...counts].sort((a, b) => b - a));
    assert.equal(res.body.data[0].name, 'Customer Service Officer'); // 3 demo users
  });

  it('rejects invalid query parameters', async () => {
    const res = await ctx.api.get('/api/roles?sortBy=password').set(auth(ctx.adminToken));
    assert.equal(res.status, 400);
  });

  it('rejects malformed role IDs', async () => {
    const res = await ctx.api.get('/api/roles/123').set(auth(ctx.adminToken));
    assert.equal(res.status, 400);
  });
});

describe('Cloning', () => {
  it('produces a new, separate role with the source settings', async () => {
    const sourceId = await ctx.roleId('Accountant');
    const res = await ctx.api.post(`/api/roles/${sourceId}/clone`).set(auth(ctx.adminToken)).send({ name: 'Senior Accountant' });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const clone = res.body.data;
    assert.notEqual(clone.id, sourceId);
    assert.equal(clone.clonedFrom, sourceId);

    const source = (await ctx.api.get(`/api/roles/${sourceId}`).set(auth(ctx.adminToken))).body.data;
    assert.deepEqual([...clone.permissions].sort(), [...source.permissions].sort());
    assert.equal(clone.branchScope, source.branchScope);
    assert.deepEqual([...clone.branchIds].sort(), [...source.branchIds].sort());
    assert.equal(clone.approvalLevel, source.approvalLevel);
    assert.equal(clone.userCount, 0);

    // Changing the clone must not affect the source
    await ctx.api.put(`/api/roles/${clone.id}/permissions`).set(auth(ctx.adminToken)).send({ permissions: ['dashboard.view'] });
    const sourceAfter = (await ctx.api.get(`/api/roles/${sourceId}`).set(auth(ctx.adminToken))).body.data;
    assert.deepEqual(sourceAfter.permissions, source.permissions);
  });

  it('requires a new unique name', async () => {
    const sourceId = await ctx.roleId('Accountant');
    const dup = await ctx.api.post(`/api/roles/${sourceId}/clone`).set(auth(ctx.adminToken)).send({ name: 'accountant' });
    assert.equal(dup.status, 409);
    const missing = await ctx.api.post(`/api/roles/${sourceId}/clone`).set(auth(ctx.adminToken)).send({});
    assert.equal(missing.status, 400);
  });

  it('cloning the System Administrator produces a normal, unprotected role', async () => {
    const sysId = await ctx.roleId('System Administrator');
    const res = await ctx.api.post(`/api/roles/${sysId}/clone`).set(auth(ctx.adminToken)).send({ name: 'Admin Copy', branchScope: 'all' });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.isSystem, false);
  });
});

describe('Permission updates', () => {
  it('validates permission updates', async () => {
    const roleId = await ctx.roleId('Regional Auditor');
    const empty = await ctx.api.put(`/api/roles/${roleId}/permissions`).set(auth(ctx.adminToken)).send({ permissions: [] });
    assert.equal(empty.status, 400);

    const unknown = await ctx.api.put(`/api/roles/${roleId}/permissions`).set(auth(ctx.adminToken)).send({ permissions: ['dashboard.fly'] });
    assert.equal(unknown.status, 400);

    const notArray = await ctx.api.put(`/api/roles/${roleId}/permissions`).set(auth(ctx.adminToken)).send({ permissions: 'loan.view' });
    assert.equal(notArray.status, 400);

    const ok = await ctx.api
      .put(`/api/roles/${roleId}/permissions`)
      .set(auth(ctx.adminToken))
      .send({ permissions: ['dashboard.view', 'reports.view', 'reports.view', 'loan.view'] });
    assert.equal(ok.status, 200);
    assert.deepEqual(ok.body.data.permissions, ['dashboard.view', 'loan.view', 'reports.view']); // de-duplicated

    const logs = await ctx.api.get(`/api/audit-logs?roleId=${roleId}&action=role.permissions_changed`).set(auth(ctx.adminToken));
    assert.equal(logs.body.data.length, 1);
    assert.ok(logs.body.data[0].metadata.removed.length > 0);
  });

  it('the System Administrator role permissions cannot be changed', async () => {
    const sysId = await ctx.roleId('System Administrator');
    const res = await ctx.api.put(`/api/roles/${sysId}/permissions`).set(auth(ctx.adminToken)).send({ permissions: ['dashboard.view'] });
    assert.equal(res.status, 403);
  });

  it('logs branch scope and approval changes separately on update', async () => {
    const created = await ctx.api.post('/api/roles').set(auth(ctx.adminToken)).send(rolePayload({ name: 'Audit Trail Role' }));
    const id = created.body.data.id;
    const res = await ctx.api
      .put(`/api/roles/${id}`)
      .set(auth(ctx.adminToken))
      .send(rolePayload({ name: 'Audit Trail Role', branchScope: 'selected', branchIds: [await ctx.branchId('HQ')], approvalLevel: 2, approvalLimit: 1000 }));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const logs = await ctx.api.get(`/api/audit-logs?roleId=${id}`).set(auth(ctx.adminToken));
    const actions = logs.body.data.map((l) => l.action);
    assert.ok(actions.includes('role.branch_scope_changed'));
    assert.ok(actions.includes('role.approval_changed'));
  });
});
