import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { PERMISSIONS } from '../config/permissions.js';
import { asyncHandler as h } from '../utils/helpers.js';
import { authenticate, requireAdmin, requirePermission } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import * as S from '../validators/schemas.js';
import * as auth from '../controllers/authController.js';
import * as roles from '../controllers/roleController.js';
import * as misc from '../controllers/miscController.js';

const router = Router();

// Slow down password guessing. Disabled in tests so the suite can log in many times.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.isTest ? 1000 : 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, error: { code: 'TOO_MANY_REQUESTS', message: 'Too many login attempts. Try again in 15 minutes.' } },
});

router.get('/health', (_req, res) => res.json({ success: true, data: { status: 'ok' } }));

/* ---- Authentication (there is intentionally NO public registration endpoint) ---- */
router.post('/auth/login', loginLimiter, validate({ body: S.loginSchema }), h(auth.login));
router.get('/auth/me', authenticate, h(auth.me));

/* ---- Everything below requires a valid token ---- */
router.use(authenticate);

router.get('/dashboard/stats', requirePermission(PERMISSIONS.DASHBOARD_VIEW), h(misc.dashboard));
router.get('/branches', h(misc.branches));

/* ---- Role management: System Administrators only ---- */
const roleRouter = Router();
roleRouter.use(requireAdmin);
roleRouter.get('/', validate({ query: S.listRolesQuery }), h(roles.list));
roleRouter.post('/', validate({ body: S.createRoleSchema }), h(roles.create));
roleRouter.get('/:id', validate({ params: S.idParams }), h(roles.get));
roleRouter.put('/:id', validate({ params: S.idParams, body: S.updateRoleSchema }), h(roles.update));
roleRouter.delete('/:id', validate({ params: S.idParams }), h(roles.remove));
roleRouter.patch('/:id/status', validate({ params: S.idParams, body: S.roleStatusSchema }), h(roles.updateStatus));
roleRouter.post('/:id/clone', validate({ params: S.idParams, body: S.cloneRoleSchema }), h(roles.clone));
roleRouter.put('/:id/permissions', validate({ params: S.idParams, body: S.rolePermissionsSchema }), h(roles.updatePermissions));
router.use('/roles', roleRouter);

router.get('/permissions', requireAdmin, h(misc.permissions));
router.get('/approval-levels', requireAdmin, h(misc.approvalLevels));
router.get('/audit-logs', requireAdmin, validate({ query: S.auditQuery }), h(misc.auditLogs));

/* ---- User role assignment: System Administrators only ---- */
router.get('/users', requireAdmin, validate({ query: S.listUsersQuery }), h(misc.listUsers));
router.post('/users', requireAdmin, validate({ body: S.createUserSchema }), h(misc.createUser));
router.patch('/users/:id/role', requireAdmin, validate({ params: S.idParams, body: S.userRoleSchema }), h(misc.changeUserRole));
router.patch('/users/:id/status', requireAdmin, validate({ params: S.idParams, body: S.userStatusSchema }), h(misc.changeUserStatus));

/* ---- Reports: reports.view (CSV export additionally needs reports.export) ---- */
router.get(
  '/reports/:report',
  requirePermission(PERMISSIONS.REPORTS_VIEW),
  validate({ params: S.reportParams, query: S.reportQuery }),
  h(misc.report)
);

export default router;
