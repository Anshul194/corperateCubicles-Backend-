// models/User.js
import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  fullName: { type: String, trim: true, required: true },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
    // match: [/^\S+@\S+\.\S+$/, 'Invalid email format']
  },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ['admin', 'instructor', 'student','news_editor'],
    default: 'student'
  },

  is_verify: { type: Boolean, default: false }, // New field for email verification

  // Common fields
  profilePicture: { type: String, default: 'default-profile.png' },
  bio: { type: String, trim: true },
  phone: { type: String, trim: true },

  // Student-specific
  enrolledCourses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
  progress: [{
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
    completedLessons: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Lesson' }]
  }],

  // Instructor-specific
  teachingCourses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
  qualifications: [{ type: String, trim: true }],

  // Admin-specific
  isActive: { type: Boolean, default: true },

 documentation: [
  {
    name: { type: String, trim: true},
    Doc: { type: String }
  }
],



  // Optional address fields
  address: {
    street: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    zipCode: { type: String, trim: true }
  },

  // Optional education fields
  education: [{
    institution: { type: String, trim: true },
    degree: { type: String, trim: true },
    fieldOfStudy: { type: String, trim: true },
    startDate: { type: Date },
    endDate: { type: Date }
  }],

  status: { type: String, enum: ['active', 'inactive'], default: 'active' },

  // Optional skills
  skills: [{ type: String, trim: true }],

  // Password reset fields
  passwordChangedAt: { type: Date },
  passwordResetToken: { type: String, default: null },
  passwordResetExpiry: { type: Date, default: null },

otp: { type: String, default: null },
otpExpiry: { type: Date, default: null },
otpAttempts: { type: Number, default: 0 },
emailVerified: { type: Boolean, default: false },
mobileVerified: { type: Boolean, default: false },
isBanned: { type: Boolean, default: false },
banReason: { type: String },
isShadowBanned: { type: Boolean, default: false },

  // Skip device approval on login when true
  skipDeviceApproval: { type: Boolean, default: false },


// gstNumber and CompanyName grouped under company
company: {
  name: { type: String, trim: true },
  gstNumber: { type: String, default: null }
},

}, { timestamps: true });

// Indexes
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1 });
userSchema.index({ passwordResetToken: 1 });
userSchema.index({ passwordResetExpiry: 1 });
userSchema.index({ isShadowBanned: 1 });

export default mongoose.models.User || mongoose.model('User', userSchema);
