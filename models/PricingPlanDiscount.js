import mongoose from 'mongoose';

const pricingPlanDiscountSchema = new mongoose.Schema(
  {
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
      index: true,
    },
    language: { type: String, required: true },
    title: { type: String, required: true},
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    discount: {
      type: Number,
      required: true,
      min: 0,
    },
    discountType: {
      type: String,
      required: true,
      enum: ['percentage', 'amount'],
      default: 'percentage',
    },
    capacity: {
      type: Number,
      min: 1,
      default: null, // null = unlimited
    },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model('PricingPlanDiscount', pricingPlanDiscountSchema);