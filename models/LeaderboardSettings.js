import mongoose from 'mongoose';

const LevelRankSchema = new mongoose.Schema({
  minXP: { type: Number, required: true },
  maxXP: { type: Number, required: true },
  levelName: { type: String, required: true }
}, { _id: false });

const LeaderboardSettingsSchema = new mongoose.Schema({
  actionXP: { type: Map, of: Number, required: true }, // action → XP value
  levelRanks: [LevelRankSchema],
  updatedAt: { type: Date, default: Date.now }
});

export default mongoose.model('LeaderboardSettings', LeaderboardSettingsSchema);
