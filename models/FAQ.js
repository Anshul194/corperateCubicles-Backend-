import mongoose from 'mongoose';

const faqSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true,
    trim: true
  },
  answer: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    enum: ['course', 'purchase', 'technical'],
    default: 'course'
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: false
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  sortOrder: {
    type: Number,
    default: 0 // useful for manual ordering
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Automatically update `updatedAt`
faqSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model('FAQ', faqSchema);
