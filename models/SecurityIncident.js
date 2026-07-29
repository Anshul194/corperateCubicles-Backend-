import mongoose from 'mongoose';

const SecurityIncidentSchema = new mongoose.Schema({
    sessionId: String,
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
    videoId: { type: mongoose.Schema.Types.ObjectId, ref: 'VideoLesson' },
    incidentType: String,
    severity: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium' },
    details: mongoose.Schema.Types.Mixed,
    timestamp: { type: Date, default: Date.now },
    userAgent: String,
    ipAddress: String,
    resolved: { type: Boolean, default: false },
    resolvedAt: Date,
    notes: String
});

const SecurityIncident = mongoose.model('SecurityIncident', SecurityIncidentSchema);

export default SecurityIncident;