import mongoose from 'mongoose';
import NotificationService from "../utils/notificationService.js"; //// Import notification service

const assignmentSubmissionSchema = new mongoose.Schema({
  assignmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment', required: true },
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  lessonId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson', required: true },
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  submissionText: { type: String},
  submissionFile: { type: String },
  submittedAt: { type: Date, default: Date.now },
  scoreGiven: { type: Number, default: null },
  feedback: { type: String},
  gradedAt: { type: Date },
  status: {
    type: String,
    enum: ['submitted', 'graded', 'resubmitted'],
    default: 'submitted'
  },
  is_complete: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

//// Indexes to support common query/sort patterns and avoid full-collection scans
assignmentSubmissionSchema.index({ submittedBy: 1 });
assignmentSubmissionSchema.index({ assignmentId: 1, status: 1 });
assignmentSubmissionSchema.index({ courseId: 1 });
assignmentSubmissionSchema.index({ submittedBy: 1, assignmentId: 1 });

assignmentSubmissionSchema.post('save', async function (doc) {
  try {
    if (doc.status == 'submitted') {
      const notificationData = {
        title: 'Assignment Submitted',
        body: `Your assignment for the course has been successfully submitted.`,
      };
      await NotificationService.sendToUser(doc.submittedBy, notificationData);
    } else if (doc.status == 'graded') {
      const notificationData = {
        title: 'Assignment Graded',
        body: `Your assignment has been graded. Check your feedback and score.`,
      };
      await NotificationService.sendToUser(doc.submittedBy, notificationData);
    }
  } catch (error) {
    console.error('Error sending assignment notification:', error);
  }
});

export default mongoose.model('AssignmentSubmission', assignmentSubmissionSchema);
