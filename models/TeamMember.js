import mongoose from 'mongoose';

const teamMemberSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  role: { type: String, required: true, trim: true },
  bio: { type: String, trim: true },
  image: { type: String },
  initials: { type: String, trim: true },
  displayOrder: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

teamMemberSchema.index({ displayOrder: 1 });

export default mongoose.model('TeamMember', teamMemberSchema);
