import mongoose from "mongoose";

const courseNoticeSchema = new mongoose.Schema({
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  publishedAt: { type: Date, default: Date.now }
}, { timestamps: true });

export default mongoose.model('CourseNotice', courseNoticeSchema);
