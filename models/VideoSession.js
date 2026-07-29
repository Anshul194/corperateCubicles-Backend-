import mongoose from 'mongoose';

const VideoSessionSchema = new mongoose.Schema({
    sessionId: { type: String, unique: true, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },    courseId: { type: String, required: true,  ref: 'Course'},
    videoId: { type: mongoose.Schema.Types.ObjectId, required: true,ref: 'VideoLesson' },
    lessonId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Lesson' },
    startTime: { type: Date, default: Date.now },
    endTime: { type: Date },
    totalWatchTime: { type: Number, default: 0 },
    maxWatchedTime: { type: Number, default: 0 },
    completionPercentage: { type: Number, default: 0 },
    deviceInfo: {
        userAgent: String,
        platform: String,
        language: String,
        screenResolution: String,
        timezone: String
    },
    ipAddress: String,
    referrer: String,
    isActive: { type: Boolean, default: true },
    completed: { type: Boolean, default: false },
    interactions: [{
        eventType: String,
        timestamp: Date,
        currentTime: Number,
        duration: Number,
        watchProgress: Number,
        additionalData: mongoose.Schema.Types.Mixed
    }],
    qualityChanges: [{
        from: String,
        to: String,
        timestamp: Date,
        currentTime: Number
    }],
    bufferEvents: [{
        type: String,
        timestamp: Date,
        currentTime: Number
    }],
    playbackSpeed: { type: Number, default: 1 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Indexes to back the analytics dashboard and session lookups.
// Without these, getDashboardData() does an unindexed scan over startTime/courseId.
VideoSessionSchema.index({ courseId: 1, startTime: -1 }); // dashboard: courseId filter + startTime sort/range
VideoSessionSchema.index({ userId: 1, videoId: 1, isActive: 1 }); // findActiveSessions
VideoSessionSchema.index({ startTime: 1 }); // findByDateRange

const VideoSession = mongoose.model('VideoSession', VideoSessionSchema);

export default VideoSession;