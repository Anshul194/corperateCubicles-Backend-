import mongoose from "mongoose";

const waitlistSchema = new mongoose.Schema({
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  addedAt: { type: Date, default: Date.now }
}, { timestamps: true });

export default mongoose.model('Waitlist', waitlistSchema);
