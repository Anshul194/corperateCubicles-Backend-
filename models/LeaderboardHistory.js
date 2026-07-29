import mongoose from 'mongoose';

const LeaderboardHistorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  referenceType: { type: String, required: true }, // course, quiz, forum, comment, system, etc.
  referenceId: { type: mongoose.Schema.Types.ObjectId },
  action: { type: String, required: true },
  remark: { type: String },
  xpChange: { type: Number, required: true },
  totalXP: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('LeaderboardHistory', LeaderboardHistorySchema);
