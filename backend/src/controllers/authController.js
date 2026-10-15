import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/helpers.js';
import { signToken } from '../middleware/auth.js';
import { serializeUser } from '../services/userService.js';
import { getAccessibleBranchIds } from '../services/branchService.js';


// Hash of a random value, compared when the email is unknown so response time doesn't reveal which emails exist.
let dummyHashPromise;
const getDummyHash = () => (dummyHashPromise ??= bcrypt.hash(crypto.randomUUID(), 12));

export async function login(req, res) {
  const { email, password } = req.valid.body;
  const user = await User.findOne({ email }).select('+passwordHash').populate('roleId').populate('branchId');

  const passwordOk = await bcrypt.compare(password, user?.passwordHash || (await getDummyHash()));
  // Same message for unknown email and wrong password, so attackers can't discover accounts.
  if (!user || !passwordOk) throw ApiError.unauthorized('Invalid email or password.');
  if (user.status !== 'active') throw ApiError.forbidden('Your account is inactive. Please contact a System Administrator.');
  if (!user.roleId || user.roleId.status !== 'active') {
    throw ApiError.forbidden('Your role is inactive. Please contact a System Administrator.');
  }

  user.lastLoginAt = new Date();
  await user.save();
  sendSuccess(res, { token: signToken(user._id), user: serializeUser(user) });
}

/** Returns the signed-in user with their effective permissions (used by the frontend for UI decisions). */
export async function me(req, res) {
  const { user, role, isAdmin, permissions } = req.auth;
  const accessible = getAccessibleBranchIds(req.auth);
  sendSuccess(res, {
    user: serializeUser(user),
    role: {
      id: String(role._id),
      name: role.name,
      branchScope: role.branchScope,
      approvalLevel: role.approvalLevel,
      approvalLimit: role.approvalLimit ?? null,
    },
    isAdmin,
    permissions: [...permissions],
    accessibleBranchIds: accessible, // null = all branches
  });
}
