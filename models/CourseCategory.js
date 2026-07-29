import mongoose from "mongoose";

const courseCategorySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
  status: { 
    type: String, 
    enum: ['active', 'inactive'], 
    default: 'active', 
    required: true 
  },
  image: { type: String, trim: true }, // Added image field to store filename
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

// slug already has a unique index from the field definition (unique: true).

export default mongoose.model('CourseCategory', courseCategorySchema);