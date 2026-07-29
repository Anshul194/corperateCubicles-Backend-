import mongoose from 'mongoose';

const querySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },

    category: {
      type: String,
      enum: ['technical', 'billing', 'course', 'general', 'other'],
      default: 'general'
    },
    status: {
      type: String,
      enum: ['new', 'in_progress', 'resolved', 'closed'],
      default: 'new'
    },
    // assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
    isDeleted: { type: Boolean, default: false }
  },
  { timestamps: true }
);

export default mongoose.model('Query', querySchema);
