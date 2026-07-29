import mongoose from 'mongoose';

const filterSchema = new mongoose.Schema(
  {
    language: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CourseCategory',
      required: true,
    },
    subCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SubCategory',
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    filterOptions: {
      type: [String], // array of strings
      required: true,
      default: [],
    },
  },
  { timestamps: true }
);

export default mongoose.model('Filter', filterSchema);
