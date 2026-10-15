import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ALL_PERMISSION_KEYS } from '../config/permissions.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/helpers.js';

export function signToken(userId) {
  return jwt.sign({ sub: String(userId) }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
    issuer: env.jwtIssuer,
    algorithm: 'HS256',
  });
}

/**
 * Verifies the JWT and loads the user + role FRESH from the database on every request.
 * We never trust role or permission claims inside the token, so a role change or
 * deactivation takes effect immediately.
 */
export const authenticate = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) throw ApiError.unauthorized();

  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret, { issuer: env.jwtIssuer, algorithms: ['HS256'] });
  } catch {
    throw ApiError.unauthorized('Your session is invalid or has expired. Please sign in again.');
  }

  const user = await User.findById(payload.sub).populate('roleId').populate('branchId');
  if (!user || user.status !== 'active') {
    throw ApiError.unauthorized('Your account is not active.');
  }
  const role = user.roleId;
  if (!role || role.status !== 'active') {
    throw ApiError.forbidden('Your role is inactive. Please contact a System Administrator.');
  }

  const isAdmin = role.isSystem === true;
  req.auth = {
    user,
    role,
    isAdmin,
    // System Administrators implicitly hold every permission.
    permissions: new Set(isAdmin ? ALL_PERMISSION_KEYS : role.permissions),
  };
  next();
});

/** Only active System Administrators may continue. */
export function requireAdmin(req, _res, next) {
  if (!req.auth?.isAdmin) {
    return next(ApiError.forbidden('Only System Administrators can perform this action.'));
  }
  next();
}

/** User must hold ALL of the listed permission keys. */
export function requirePermission(...keys) {
  return (req, _res, next) => {
    const missing = keys.filter((key) => !req.auth?.permissions.has(key));
    if (missing.length) {
      return next(ApiError.forbidden(`Missing permission: ${missing.join(', ')}`));
    }
    next();
  };
}
