/**
 * Shared test setup: an isolated, throw-away in-memory MongoDB per test file.
 * Tests never touch your development or production database.
 */
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-only-secret-that-is-at-least-32-characters-long';

const { MongoMemoryServer } = await import('mongodb-memory-server');
const mongoose = (await import('mongoose')).default;
const request = (await import('supertest')).default;
const { connectDatabase } = await import('../src/config/db.js');
const { createApp } = await import('../src/app.js');
const { seedBaseData, seedDemoUsers, createInitialAdmin } = await import('../src/seed/seedData.js');
const { Role } = await import('../src/models/Role.js');
const { Branch } = await import('../src/models/Branch.js');
const { User } = await import('../src/models/User.js');
const { hashPassword } = await import('../src/services/userService.js');

export const ADMIN = { name: 'Test Admin', email: 'admin@test.local', password: 'AdminPassw0rd!' };
export const STAFF_PASSWORD = 'StaffPassw0rd!';

let mongod;

export async function setupTestApp() {
  mongod = await MongoMemoryServer.create();
  await connectDatabase(mongod.getUri(), 'rbac_test');
  await seedBaseData();
  await seedDemoUsers(STAFF_PASSWORD);
  await createInitialAdmin(ADMIN);
  const app = createApp();
  const api = request(app);

  const login = async (email, password) => {
    const res = await api.post('/api/auth/login').send({ email, password });
    if (res.status !== 200) throw new Error(`login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
    return res.body.data.token;
  };

  const ctx = {
    api,
    adminToken: await login(ADMIN.email, ADMIN.password),
    managerToken: await login('anita.menon@demo.local', STAFF_PASSWORD), // Branch Manager @ TVM
    auditorToken: await login('meera.pillai@demo.local', STAFF_PASSWORD), // Regional Auditor, all branches
    login,
    models: { Role, Branch, User },
    hashPassword,
    roleId: async (name) => String((await Role.findOne({ name }))._id),
    branchId: async (code) => String((await Branch.findOne({ code }))._id),
  };
  return ctx;
}

export async function teardownTestApp() {
  await mongoose.disconnect();
  await mongod?.stop();
}

export const auth = (token) => ({ Authorization: `Bearer ${token}` });

let counter = 0;
/** A valid role payload; override any field. */
export function rolePayload(overrides = {}) {
  counter += 1;
  return {
    name: `Test Role ${Date.now()}-${counter}`,
    description: 'Created by tests',
    branchScope: 'all',
    branchIds: [],
    approvalLevel: 0,
    approvalLimit: null,
    permissions: ['dashboard.view', 'customers.view'],
    ...overrides,
  };
}
