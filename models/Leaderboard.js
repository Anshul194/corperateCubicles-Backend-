import mongoose from 'mongoose';

const LeaderboardSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  xp: { type: Number, default: 0 },
  level: { type: String },
  lastUpdated: { type: Date, default: Date.now }
});

// Supports the leaderboard queries: find().sort({ xp: -1 }).limit(50) and
// rank via countDocuments({ xp: { $gt: entry.xp } }) (leaderboardService.js) —
// previously a full-collection sort/scan per request.
LeaderboardSchema.index({ xp: -1 });

export default mongoose.model('Leaderboard', LeaderboardSchema);
