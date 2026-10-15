import mongoose from 'mongoose';

const branchSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, maxlength: 10 },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    city: { type: String, trim: true, maxlength: 100, default: '' },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  },
  { timestamps: true }
);

export const Branch = mongoose.model('Branch', branchSchema);
