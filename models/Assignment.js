import mongoose from 'mongoose';

const assignmentSchema = new mongoose.Schema({
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  lessonId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lesson',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  subject: {
    type: String,
  },
  language: {
    type: String,
    default: 'English',
    enum: ['English', 'Hindi', 'Spanish', 'French', 'German']
  },
  description: {
    type: String,
  },
  score: {
    type: Number,
    default: 0
  },
  maxScore: {
    type: Number,
    default: 100
  },
  duration: {
    type: Number,
    default: 60 // in minutes
  },
  remarks: {
    type: String,
  },

  materials: {
    type: String // URL or path to the materials
  },

  attachmentFile: {
    type: String // File URL or path
  },
  documentFile: {
    type: String // File URL or path
  },
  maxAttempts: {
    type: Number,
    default: 1, // Default to 1 attempt
    min: [1, 'Maximum attempts must be at least 1'], // Validation for minimum attempts
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Assignment = mongoose.models.Assignment || mongoose.model('Assignment', assignmentSchema);


export default Assignment;
