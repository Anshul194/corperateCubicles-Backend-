import mongoose from 'mongoose';

const forumReplySchema = new mongoose.Schema({
  threadId: { type: mongoose.Schema.Types.ObjectId, ref: 'ForumThread', required: true },
  content: { type: String, required: true },
  repliedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  parentReplyId: { type: mongoose.Schema.Types.ObjectId, ref: 'ForumReply', default: null },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
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

forumReplySchema.index({ threadId: 1, createdAt: 1 });
// Supports nested-reply lookups find({ parentReplyId }) (forumRepository.js
// getRepliesByThread / deleteMany cascade) — previously unindexed full scans.
forumReplySchema.index({ parentReplyId: 1, createdAt: 1 });

export default mongoose.model('ForumReply', forumReplySchema);