import mongoose from 'mongoose';
import { normalizeName } from '../utils/helpers.js';

export const ROLE_STATUSES = ['active', 'inactive'];
export const BRANCH_SCOPES = ['assigned', 'selected', 'all'];
export const MAX_APPROVAL_LEVEL = 10;
export const MAX_APPROVAL_LIMIT = 1_000_000_000_000; // 1 trillion - sanity cap

const roleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    // Lower-cased copy of `name` with a unique index => case-insensitive uniqueness at DB level.
    normalizedName: { type: String, required: true, unique: true },
    description: { type: String, trim: true, maxlength: 500, default: '' },
    status: { type: String, enum: ROLE_STATUSES, default: 'active' },
    branchScope: { type: String, enum: BRANCH_SCOPES, default: 'assigned' },
    branchIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Branch' }],
    approvalLevel: {
      type: Number,
      default: 0,
      min: 0,
      max: MAX_APPROVAL_LEVEL,
      validate: { validator: Number.isInteger, message: 'Approval level must be a whole number' },
    },
    approvalLimit: { type: Number, default: null, min: 0, max: MAX_APPROVAL_LIMIT },
    permissions: [{ type: String, trim: true }],
    // The protected System Administrator role. Cannot be set through the API.
    isSystem: { type: Boolean, default: false, immutable: true },
    clonedFrom: { type: mongoose.Schema.Types.ObjectId, ref: 'Role', default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

roleSchema.pre('validate', function setNormalizedName(next) {
  this.normalizedName = normalizeName(this.name);
  next();
});

roleSchema.index({ status: 1 });
roleSchema.index({ branchScope: 1 });
roleSchema.index({ isSystem: 1 });

export const Role = mongoose.model('Role', roleSchema);
