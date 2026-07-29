import mongoose from "mongoose";
import NotificationService from "../utils/notificationService.js"; // Import notification service

const quizSubmissionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  quiz: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
  lessonId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson' },
  answers: [{
    question: { type: String, required: true },
    selectedOption: { 
      type: String, 
      required: true, 
      enum: ['A', 'B', 'C', 'D'] 
    }
  }],
  score: { type: Number, required: true },
  totalMarks: { type: Number, required: true },
  passed: { type: Boolean, required: true },
  totalQuestions: { type: Number, required: true },
  totalCorrectQuestions: { type: Number, required: true },
  totalWrongQuestions: { type: Number, required: true },
  percentage: { type: Number, required: true },
  is_completed: { type: Boolean, required: true }, // New field added
  submittedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Supports the hot completion-check query shape
// countDocuments({ user, courseId, is_completed: true, passed: true })
// (CourseCompletionService.checkCourseCompletion) — previously a collection scan
// per enrollment on the my-enrollments path and the hourly sweep.
quizSubmissionSchema.index({ user: 1, courseId: 1, passed: 1 });

const QuizSubmission = mongoose.models.QuizSubmission || mongoose.model('QuizSubmission', quizSubmissionSchema);
export default QuizSubmission;