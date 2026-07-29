import mongoose from 'mongoose';

const blogPostSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  thumbnail: {
    type: String,
    trim: true
  },
  status: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Indexes for common queries
blogPostSchema.index({ title: 1 });
blogPostSchema.index({ status: 1 });

const BlogPost = mongoose.model('BlogPost', blogPostSchema);
export default BlogPost;