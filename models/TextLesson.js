import mongoose from 'mongoose';

const textLessonSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  subTitle: {
    type: String,
    trim: true
  },
  language: {
    type: String,
    required: true,
    default: 'English',
    enum: ['English', 'Spanish', 'French', 'German', 'Chinese', 'Japanese', 'Hindi', 'Arabic']
  },
  accessibility: {
    type: String,
    enum: ['Free', 'Paid','free','paid'],
    default: 'Free',
    required: true
  },
  attachments: [{
    fileName: {
      type: String,
      required: true
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  summary: {
    type: String,
    required: true,
  },
  content: {
    type: String,
    required: true,
    minlength: 50
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  lesson: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lesson',
  },
  order: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
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
textLessonSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});


const TextLesson = mongoose.models.TextLesson || mongoose.model('TextLesson', textLessonSchema);
export default TextLesson;
