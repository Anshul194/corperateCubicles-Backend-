import mongoose, { Schema } from 'mongoose';

const orderSchema = new Schema({
    orderNo: { type: String, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    items: [{
        courseId: { type: Schema.Types.ObjectId, ref: 'Course' },
        courseBundleId: { type: Schema.Types.ObjectId, ref: 'CourseBundle' },
        coursePlanId: { type: Schema.Types.ObjectId, ref: 'CoursePlan' }, // <-- add plan support
        type: { type: String, enum: ['course', 'courseBundle', 'coursePlan'], required: true },
        pricePaid: { type: mongoose.Types.Decimal128, required: true },
        currency: { type: String, required: true }
    }],
    subTotal: { type: mongoose.Types.Decimal128, required: true },
    discount: { type: mongoose.Types.Decimal128, default: 0 },
    tax: { type: mongoose.Types.Decimal128, default: 0 },
    gstRate: { type: mongoose.Types.Decimal128, default: 0 },
    grandTotal: { type: mongoose.Types.Decimal128, required: true },
    // ✅ GST/company info for order
    company: {
        name: { type: String, trim: true },
        gstNumber: { type: String, default: null }
    },
    payment: {
        provider: { type: String, enum: ['stripe', 'razorpay', 'paypal', 'free'], required: true },
        paymentIntent: { type: String, default: null }, // Store payment intent or transaction ID
        status: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' }
    },
    meta: { type: Schema.Types.Mixed },
    isRefunded: { type: Boolean, default: false },
    invoice_url: { type: String } // PDF invoice file name only
}, { timestamps: true });

// Index to support per-user order lookups (getMyPurchases, per-user analytics scans)
// and sort-by-recency on the createdAt component.
orderSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model('Order', orderSchema);