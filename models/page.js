import mongoose from "mongoose";

const pageSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  content: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active',
    required: true,
  }
}, { timestamps: true });

export default mongoose.model('Page', pageSchema);
