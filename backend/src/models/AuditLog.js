import mongoose from 'mongoose';

export const AUDIT_ACTIONS = [
  'role.created',
  'role.updated',
  'role.cloned',
  'role.activated',
  'role.deactivated',
  'role.deleted',
  'role.permissions_changed',
  'role.branch_scope_changed',
  'role.approval_changed',
  'user.created',
  'user.role_changed',
  'user.status_changed',
];

/**
 * Append-only record of important access-control changes.
 * Never store passwords, password hashes or tokens here.
 */
const auditLogSchema = new mongoose.Schema(
  {
    action: { type: String, enum: AUDIT_ACTIONS, required: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    actorName: { type: String, default: 'System' },
    entityType: { type: String, enum: ['role', 'user'], required: true },
    entityId: { type: mongoose.Schema.Types.ObjectId, required: true },
    entityName: { type: String, default: '' },
    // Related role (for user events it is the newly assigned role) - lets role history include user events.
    roleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Role', default: null },
    // { field: { from, to } }
    changes: { type: mongoose.Schema.Types.Mixed, default: {} },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ roleId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1 });

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
