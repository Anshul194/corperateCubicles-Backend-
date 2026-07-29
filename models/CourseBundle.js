// models/CourseBundle.js
import mongoose from 'mongoose';

const courseBundleSchema = new mongoose.Schema({
  title: { type: String, required: true },
  subtitle: { type: String },
  slug: { type: String, required: true, unique: true },
  description: { type: String},
  language: { type: String, default: 'English' },
  level: { type: String, enum: ['Beginner', 'Intermediate', 'Advanced'] },
  thumbnail: { type: String },
  banner: { type: String }, 
  video: { type: String },
  enrolledStudents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], 

  price: { type: Number, required: true },
  discount: { type: Number, default: 0 },
  currency: { type: String, default: 'INR' },

  courses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],

  certificate: { type: Boolean, default: false },
  downloadable: { type: Boolean, default: false },
  featured: { type: Boolean, default: false },
  private: { type: Boolean, default: false },
  popular: { type: Boolean, default: false },

  accessType: { type: String, enum: ['lifetime', 'limited'], default: 'lifetime' },
  accessPeriod: { type: String }, 

  tags: [{ type: String }],
  seoTitle: { type: String },
  seoDescription: { type: String },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

courseBundleSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

export default mongoose.model('CourseBundle', courseBundleSchema);
