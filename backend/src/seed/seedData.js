import crypto from 'node:crypto';
import { Branch } from '../models/Branch.js';
import { Role } from '../models/Role.js';
import { User } from '../models/User.js';
import { ALL_PERMISSION_KEYS, MODULES } from '../config/permissions.js';
import { normalizeName } from '../utils/helpers.js';
import { syncPermissions } from '../services/permissionService.js';
import { hashPassword } from '../services/userService.js';

/**
 * Sample data for demonstration. Every function here is IDEMPOTENT:
 * running it again never creates duplicates and never overwrites existing records
 * (it uses "insert if missing" semantics).
 */

export const SYSTEM_ROLE_NAME = 'System Administrator';

export const SAMPLE_BRANCHES = [
  { code: 'HQ', name: 'Head Office', city: 'Kochi' },
  { code: 'TVM', name: 'Thiruvananthapuram Branch', city: 'Thiruvananthapuram' },
  { code: 'KZD', name: 'Kozhikode Branch', city: 'Kozhikode' },
  { code: 'TSR', name: 'Thrissur Branch', city: 'Thrissur' },
  { code: 'KTM', name: 'Kottayam Branch', city: 'Kottayam' },
];

const BUSINESS_MODULES = ['customers', 'membership', 'savings', 'rd', 'loan', 'chitty'];
const keys = (modules, actions) => modules.flatMap((m) => actions.map((a) => `${m}.${a}`)).filter((k) => ALL_PERMISSION_KEYS.includes(k));
const allViews = MODULES.map((m) => `${m.key}.view`);

const SAMPLE_ROLES = [
  {
    name: 'Branch Manager',
    description: 'Manages day-to-day operations of a single branch and approves mid-value transactions.',
    branchScope: 'assigned',
    approvalLevel: 2,
    approvalLimit: 500000,
    permissions: [
      ...allViews,
      ...keys(BUSINESS_MODULES, ['create', 'edit']),
      ...keys(['membership', 'savings', 'rd', 'loan', 'chitty'], ['approve']),
      'reports.export',
    ],
  },
  {
    name: 'Accountant',
    description: 'Handles accounts for Head Office and Thiruvananthapuram, with low-value approval rights.',
    branchScope: 'selected',
    branchCodes: ['HQ', 'TVM'],
    approvalLevel: 1,
    approvalLimit: 100000,
    permissions: [
      'dashboard.view',
      ...keys(['savings', 'rd', 'loan', 'chitty'], ['view', 'export']),
      ...keys(['savings', 'rd'], ['approve']),
      'reports.view',
      'reports.export',
    ],
  },
  {
    name: 'Customer Service Officer',
    description: 'Front-desk staff who onboard customers and open accounts at their branch.',
    branchScope: 'assigned',
    approvalLevel: 0,
    approvalLimit: null,
    permissions: ['dashboard.view', ...keys(['customers'], ['view', 'create', 'edit']), ...keys(['membership', 'savings', 'rd'], ['view', 'create'])],
  },
  {
    name: 'Regional Auditor',
    description: 'Read-only access across all branches for internal audit.',
    branchScope: 'all',
    approvalLevel: 0,
    approvalLimit: null,
    permissions: [...allViews, ...keys(BUSINESS_MODULES, ['export']), 'reports.export'],
  },
  {
    name: 'Legacy Teller',
    description: 'Retired role kept for history. Replaced by Customer Service Officer.',
    status: 'inactive',
    branchScope: 'assigned',
    approvalLevel: 0,
    approvalLimit: null,
    permissions: ['dashboard.view', 'savings.view', 'savings.create'],
  },
];

const DEMO_USERS = [
  { name: 'Anita Menon', email: 'anita.menon@demo.local', role: 'Branch Manager', branch: 'TVM' },
  { name: 'Rahul Nair', email: 'rahul.nair@demo.local', role: 'Branch Manager', branch: 'KZD' },
  { name: 'Fathima Rasheed', email: 'fathima.rasheed@demo.local', role: 'Accountant', branch: 'HQ' },
  { name: 'Joseph Thomas', email: 'joseph.thomas@demo.local', role: 'Customer Service Officer', branch: 'TVM' },
  { name: 'Divya Suresh', email: 'divya.suresh@demo.local', role: 'Customer Service Officer', branch: 'KZD' },
  { name: 'Arun Kumar', email: 'arun.kumar@demo.local', role: 'Customer Service Officer', branch: 'TSR' },
  { name: 'Meera Pillai', email: 'meera.pillai@demo.local', role: 'Regional Auditor', branch: 'HQ' },
];

async function insertIfMissing(Model, filter, doc) {
  const now = new Date();
  // timestamps:false stops Mongoose adding `$set: { updatedAt }`, so existing records stay completely untouched.
  const result = await Model.updateOne(
    filter,
    { $setOnInsert: { ...doc, createdAt: now, updatedAt: now } },
    { upsert: true, runValidators: true, timestamps: false }
  );
  return result.upsertedCount > 0;
}

/** Permissions, branches, the System Administrator role and sample business roles. */
export async function seedBaseData() {
  await syncPermissions();

  let branchesCreated = 0;
  for (const b of SAMPLE_BRANCHES) {
    if (await insertIfMissing(Branch, { code: b.code }, { ...b, status: 'active' })) branchesCreated++;
  }
  const branches = await Branch.find({ code: { $in: SAMPLE_BRANCHES.map((b) => b.code) } }).lean();
  const branchByCode = new Map(branches.map((b) => [b.code, b._id]));

  let rolesCreated = 0;
  if (!(await Role.exists({ isSystem: true }))) {
    await Role.create({
      name: SYSTEM_ROLE_NAME,
      description: 'Full access to every module and to access-control administration. Protected role.',
      status: 'active',
      branchScope: 'all',
      approvalLevel: 5,
      approvalLimit: null,
      permissions: ALL_PERMISSION_KEYS,
      isSystem: true,
    });
    rolesCreated++;
  }

  for (const r of SAMPLE_ROLES) {
    const { branchCodes = [], ...rest } = r;
    const doc = {
      status: 'active',
      ...rest,
      normalizedName: normalizeName(r.name),
      branchIds: branchCodes.map((code) => branchByCode.get(code)).filter(Boolean),
      permissions: [...new Set(r.permissions)],
      isSystem: false,
    };
    if (await insertIfMissing(Role, { normalizedName: doc.normalizedName }, doc)) rolesCreated++;
  }
  return { branchesCreated, rolesCreated };
}

/**
 * Demo staff users so reports and user counts have meaningful data.
 * If `password` is not provided, a random one is used and the demo users cannot sign in.
 * Existing users are never modified (passwords are never reset).
 */
export async function seedDemoUsers(password) {
  const passwordHash = await hashPassword(password || crypto.randomBytes(32).toString('hex'));
  const roles = await Role.find({ name: { $in: [...new Set(DEMO_USERS.map((u) => u.role))] } }).lean();
  const branches = await Branch.find().lean();
  let created = 0;
  for (const u of DEMO_USERS) {
    const role = roles.find((r) => r.name === u.role);
    const branch = branches.find((b) => b.code === u.branch);
    if (!role || role.status !== 'active' || !branch) continue; // never assign inactive roles
    const doc = { name: u.name, email: u.email, passwordHash, roleId: role._id, branchId: branch._id, status: 'active' };
    if (await insertIfMissing(User, { email: u.email }, doc)) created++;
  }
  return created;
}

/**
 * Creates the first System Administrator. Does nothing (and never resets the password)
 * if a user with the email already exists.
 */
export async function createInitialAdmin({ name, email, password }) {
  const normalizedEmail = email.trim().toLowerCase();
  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) return { created: false, user: existing };

  const systemRole = await Role.findOne({ isSystem: true });
  if (!systemRole) throw new Error('System Administrator role not found. Run "npm run seed" first.');
  const hq = await Branch.findOne({ code: 'HQ' });
  const user = await User.create({
    name: name.trim(),
    email: normalizedEmail,
    passwordHash: await hashPassword(password),
    roleId: systemRole._id,
    branchId: hq?._id ?? null,
  });
  return { created: true, user };
}
