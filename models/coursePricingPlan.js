import mongoose from 'mongoose';

const { Schema } = mongoose;

const pricingPlanSchema = new Schema({
  course: {
    type: Schema.Types.ObjectId,
    ref: 'Course',
    required: true,
  },
  type: {
    type: String,
    enum: ['free', 'one-time', 'subscription'],
    required: true,
  },
  price: {
    type: Number,
    default: 0,
    min: 0,
  },
  discount: {
    type: Number,
    default: 0,
    min: 0,
  },
  durationInDays: {
    type: Number,
    default: 0,
    min: 0,
  },
  currency: {
    type: String,
    default: 'INR',
    uppercase: true,
    trim: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  features: {
    type: [String],
    default: [],
  }
}, {
  timestamps: true,
});

pricingPlanSchema.index({ course: 1, type: 1 });

export default mongoose.model('CoursePricingPlan', pricingPlanSchema);