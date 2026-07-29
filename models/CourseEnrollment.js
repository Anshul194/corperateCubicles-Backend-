import mongoose from 'mongoose';
const { Schema } = mongoose;

const courseEnrollmentSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['course', 'courseBundle', 'groupCourse', 'coursePlan'], required: true }, // <-- added 'coursePlan'
  courseId: { type: Schema.Types.ObjectId, ref: 'Course' },
  courseBundleId: { type: Schema.Types.ObjectId, ref: 'CourseBundle' },
  coursePlanId: { type: Schema.Types.ObjectId, ref: 'CoursePlan' }, // <-- added plan support
  lastVideoPlayed: { type: Schema.Types.ObjectId, ref: 'Video', default: null },
  enrolledAt: { type: Date, default: Date.now },
  accessType: { 
    type: String, 
    enum: ['lifetime', 'limited', 'subscription', 'month', 'year', 'day', 'Month', 'Year', 'Day'], // <-- add 'year' and 'day'
    default: 'lifetime' 
  },
  accessExpiry: { type: Date }, // Expiry date for limited/subscription access
  status: { type: String, enum: ['active', 'completed', 'cancelled', 'expired'], default: 'active' },
  completedLessons: [{ type: Schema.Types.ObjectId, ref: 'Lesson' }],
  progressPercentage: { type: Number, default: 0 },
  certificateIssued: { type: Boolean, default: false },
  certificateIssuedAt: { type: Date },
  enrollmentSource: { type: String, enum: ['open', 'invite', 'purchase', 'subscription', 'admin','import'], default: 'purchase' },
  isWithdrawn: { type: Boolean, default: false },
  withdrawnAt: { type: Date, default: null },
  iscompleted: { type: Boolean, default: false },
  orderId: { type: Schema.Types.ObjectId, ref: 'Order', default: null },
  addToRevenue: { type: Boolean, default: false }, // <-- add this
  pricePaid: { type: Number, default: 0 } // <-- add this
}, { timestamps: true });

// Validation Logic
courseEnrollmentSchema.pre('validate', function (next) {
  const hasCourse = !!this.courseId;
  const hasBundle = !!this.courseBundleId;
  const hasPlan = !!this.coursePlanId;

  // Allow courseId+coursePlanId if type is 'coursePlan'
  if (this.type === 'coursePlan') {
    if (!hasPlan) return next(new Error('type is coursePlan but coursePlanId is missing.'));
    // courseId is optional for coursePlan, but if present, it's allowed
    if (hasBundle) return next(new Error('Only one of courseId/coursePlanId or courseBundleId should be provided.'));
    return next();
  }

  // Only one of courseId, courseBundleId, or coursePlanId should be provided
  const count = [hasCourse, hasBundle].filter(Boolean).length;
  if (count > 1) return next(new Error('Only one of courseId, courseBundleId, or coursePlanId should be provided.'));
  if (count === 0) return next(new Error('At least one of courseId, courseBundleId, or coursePlanId must be provided.'));
  if (this.type === 'course' && !hasCourse) return next(new Error('type is course but courseId is missing.'));
  if (this.type === 'courseBundle' && !hasBundle) return next(new Error('type is courseBundle but courseBundleId is missing.'));
  if (this.type === 'coursePlan' && !hasPlan) return next(new Error('type is coursePlan but coursePlanId is missing.'));
  next();
});

// Pre-save hook to update status to 'expired' if accessExpiry is exceeded
courseEnrollmentSchema.pre('save', function (next) {
  if (
    this.accessExpiry &&
    new Date() > this.accessExpiry &&
    this.status !== 'expired'
  ) {
    this.status = 'expired';
  }
  next();
});

// Instance method to check if completion is allowed
courseEnrollmentSchema.methods.canComplete = function () {
  return this.status !== 'expired';
};

courseEnrollmentSchema.index(
  { userId: 1, courseId: 1 },
  { unique: false, partialFilterExpression: { courseId: { $exists: true } } }
);
courseEnrollmentSchema.index(
  { userId: 1, courseBundleId: 1 },
  { unique: false, partialFilterExpression: { courseBundleId: { $exists: true } } }
);

// Serves the hot active-enrollment lookups that filter by courseId alone
// (getCourseById / ProgressController: find({ courseId, status: 'active' }).select('userId')).
// Including userId makes the query fully covered, avoiding document fetches.
courseEnrollmentSchema.index({ courseId: 1, status: 1, userId: 1 });

// Supports expiry sweeps that filter on accessExpiry.
courseEnrollmentSchema.index({ accessExpiry: 1 });

// Prevent model redefinition
const CourseEnrollment = mongoose.models.CourseEnrollment || mongoose.model("CourseEnrollment", courseEnrollmentSchema);

export default CourseEnrollment;