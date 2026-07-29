import mongoose from "mongoose";

const lessonProgressSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true,
    index: true,
  },
  lessonId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lesson',
    required: true,
    index: true,
  },
  sessionId: {
    type: String,
    // required: true,
    // index: true,
    trim: true
  },

  // Progress tracking
  progressPercentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  watchTime: {
    type: Number,
    default: 0,
    min: 0
  },
  currentPosition: {
    type: Number,
    default: 0,
    min: 0
  },
  lastPosition: {
    type: Number,
    default: 0,
    min: 0
  },

  // Completion tracking
  completed: {
    type: Boolean,
    default: false,
    index: true
  },
  completedAt: {
    type: Date,
    default: null
  },
  completionPercentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },

  // VdoCipher specific tracking
  coveredSegments: [{
    start: { type: Number, required: true },
    end: { type: Number, required: true }
  }],
  totalCovered: {
    type: Number,
    default: 0
  },

  // Video metadata
  videoDuration: {
    type: Number,
    default: 0
  },
  videoType: {
    type: String,
    enum: ['vdocipher', 'youtube', 'direct'],
    required: true,
    lowercase: true,
    trim: true
  },

  // Timestamps
  startedAt: {
    type: Date,
    default: Date.now
  },
  lastUpdatedAt: {
    type: Date,
    default: Date.now
  },

  // Additional metadata
  metadata: {
    userAgent: { type: String, trim: true },
    screenResolution: { type: String, trim: true },
    timezone: { type: String, trim: true },
    platform: { type: String, trim: true }
  }
}, {
  timestamps: true
});

// Indexes
lessonProgressSchema.index({ userId: 1, courseId: 1, lessonId: 1 });
lessonProgressSchema.index({ sessionId: 1 });
lessonProgressSchema.index({ userId: 1, completed: 1 });
lessonProgressSchema.index({ courseId: 1, completed: 1 });
lessonProgressSchema.index({ lastUpdatedAt: 1 });

// Unique constraint: 1 user → 1 progress per lesson
lessonProgressSchema.index({ userId: 1, lessonId: 1 });

// Middleware
lessonProgressSchema.pre('save', function (next) {
  this.lastUpdatedAt = new Date();

  if (this.videoType === 'vdocipher' && Array.isArray(this.coveredSegments)) {
    this.totalCovered = this.coveredSegments.reduce((sum, seg) => sum + (seg.end - seg.start), 0);
    if (this.videoDuration > 0) {
      this.progressPercentage = Math.min(100, (this.totalCovered / this.videoDuration) * 100);
    }
  }

  if (this.progressPercentage >= 90 && !this.completed) {
    this.completed = true;
    this.completedAt = new Date();
    this.completionPercentage = this.progressPercentage;
  }

  next();
});

// Instance Methods
lessonProgressSchema.methods.updateProgress = function (data) {
  if (data.watchTime !== undefined) this.watchTime = Math.max(this.watchTime, data.watchTime);
  if (data.currentPosition !== undefined) this.currentPosition = data.currentPosition;
  if (data.lastPosition !== undefined) this.lastPosition = data.lastPosition;
  if (data.progressPercentage !== undefined) this.progressPercentage = data.progressPercentage;
  if (data.coveredSegments !== undefined) this.coveredSegments = data.coveredSegments;
  return this.save();
};

lessonProgressSchema.methods.markCompleted = function (data = {}) {
  this.completed = true;
  this.completedAt = new Date();
  this.completionPercentage = data.completionPercentage || this.progressPercentage || 100;
  if (data.watchTime) {
    this.watchTime = Math.max(this.watchTime, data.watchTime);
  }
  return this.save();
};

// Static Methods
lessonProgressSchema.statics.findByUserAndLesson = function (userId, lessonId) {
  return this.findOne({ userId, lessonId });
};

lessonProgressSchema.statics.getCourseProgress = function (userId, courseId) {
  return this.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId), courseId: new mongoose.Types.ObjectId(courseId) } },
    {
      $group: {
        _id: '$courseId',
        totalLessons: { $sum: 1 },
        completedLessons: { $sum: { $cond: [{ $eq: ['$completed', true] }, 1, 0] } },
        totalWatchTime: { $sum: '$watchTime' },
        averageProgress: { $avg: '$progressPercentage' }
      }
    },
    {
      $addFields: {
        courseCompletionPercentage: {
          $multiply: [{ $divide: ['$completedLessons', '$totalLessons'] }, 100]
        }
      }
    }
  ]);
};

export default mongoose.model('LessonProgress', lessonProgressSchema);
