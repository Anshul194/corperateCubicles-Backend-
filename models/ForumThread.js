import mongoose from 'mongoose';

const forumThreadSchema = new mongoose.Schema({
  
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: false },
  title: { type: String, required: true },
  content: { type: String, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isPinned: { type: Boolean, default: false },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  // tags: [String],
  tags: [{ type: String, lowercase: true, trim: true }], 
  isApproved: { type: Boolean, default: false },
  Is_openSource: { type: Boolean, default: false },
  attachments: [
  {
    type: {
      type: String
    },
    originalName: String,
    fileType: String
  }
],

  createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

forumThreadSchema.index({ courseId: 1, isApproved: 1, createdAt: -1 });
forumThreadSchema.index({ title: 'text', content: 'text' });

export default mongoose.model('ForumThread', forumThreadSchema);
