import mongoose from 'mongoose';

const { Schema } = mongoose;

const moduleSchema = new Schema({
  courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true }, // Fixed reference
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  objectives: [{ type: String, trim: true }], // Learning objectives for this module
  
  // Ordering & Structure
  order: { type: Number, required: true },
  
  // Access Control
  unlockConditions: { 
    type: { type: String, enum: ['immediate', 'after_date', 'after_module', 'after_days'], default: 'immediate' },
    value: { type: Schema.Types.Mixed } // can be date, moduleId, or number of days
  },

  lessons: [{ type: Schema.Types.ObjectId, ref: 'Lesson' }], // Array of lesson IDs


  
  // Timing
  estimatedDuration: { type: Number }, // in minutes
  
  // Publishing
  isPublished: { type: Boolean, default: true },
  unlockDate: { type: Date },
  
  // Optional module image (local file path)
  image: { type: String, trim: true },

  // Add this field to track users for whom drip is disabled
  dripSettingDisabledFor: [{ type: Schema.Types.ObjectId, ref: 'User', default: [] }],

  // Soft Delete
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

// Compound index for course modules in order
moduleSchema.index({ courseId: 1, order: 1 });
moduleSchema.index({ courseId: 1, isPublished: 1 });

// moduleSchema.index({ title: 'text' });

export default mongoose.model('Module', moduleSchema);
