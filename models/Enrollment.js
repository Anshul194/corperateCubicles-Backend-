// import mongoose from "mongoose";

// const enrollmentSchema = new mongoose.Schema({
//   userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
//   courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
//    CourseBundleId:  { type: mongoose.Schema.Types.ObjectId, ref: 'CourseBundle' },
//   orderId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Order' }, 
//   accessStart: { type: Date, required: true, default: Date.now },
//   accessEnd:   { type: Date },  // null = lifetime
//   isActive:    { type: Boolean, default: true }
// }, { timestamps: true });

// enrollmentSchema.index({ userId: 1, courseId: 1 }, { unique: true });

// export default mongoose.model('Enrollment', enrollmentSchema);
import mongoose from "mongoose";

const enrollmentSchema = new mongoose.Schema({
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
  CourseBundleId:  { type: mongoose.Schema.Types.ObjectId, ref: 'CourseBundle' },
  orderId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Order' }, 
  accessStart: { type: Date, required: true, default: Date.now },
  accessEnd:   { type: Date },  // null = lifetime
  isActive:    { type: Boolean, default: true }
}, { timestamps: true });

// Ensure either courseId or CourseBundleId is present, but not both
enrollmentSchema.pre('validate', function(next) {
  if (!this.courseId && !this.CourseBundleId) {
    return next(new Error('Either courseId or CourseBundleId must be provided.'));
  }
  if (this.courseId && this.CourseBundleId) {
    return next(new Error('Only one of courseId or CourseBundleId should be provided.'));
  }
  next();
});

// Optional: index on courseId and CourseBundleId (but separately since only one will be set)
enrollmentSchema.index({ userId: 1, courseId: 1 }, { unique: true, partialFilterExpression: { courseId: { $exists: true } } });
enrollmentSchema.index({ userId: 1, CourseBundleId: 1 }, { unique: true, partialFilterExpression: { CourseBundleId: { $exists: true } } });

export default mongoose.model('Enrollment', enrollmentSchema);
