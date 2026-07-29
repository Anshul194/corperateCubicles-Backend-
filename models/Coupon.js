import mongoose from 'mongoose';
const { Schema } = mongoose;

const couponSchema = new Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },

    // Discount Type: 'flat' or 'percentage'
    discountType: {
      type: String,
      enum: ['flat', 'percentage'],
      required: true,
    },

    // Flat discount amount (e.g. ₹500 off)
    discountAmount: {
      type: Number,
      default: 0,
    },

    // Percentage discount (e.g. 20% off)
    discountPercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    // Maximum discount allowed (for percentage type)
    maxDiscountValue: {
      type: Number,
      default: 0,
    },

    // Minimum order value required to apply coupon
    minOrderAmount: {
      type: Number,
      default: 0,
    },

    // How many times total this coupon can be used (global)
    usageLimit: {
      type: Number,
      default: 0, // 0 = unlimited
    },

    // How many times per user
    usageLimitPerUser: {
      type: Number,
      default: 1,
    },

    // Validity period
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },

    // Is coupon active
    isActive: {
      type: Boolean,
      default: true,
    },

    // Track which users used it (for limit per user)
    usedBy: [
      {
        userId: { type: Schema.Types.ObjectId, ref: 'User' },
        usageCount: { type: Number, default: 0 },
      },
    ],

    
    applicableCourses: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Course',
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model('Coupon', couponSchema);
