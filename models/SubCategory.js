import mongoose from "mongoose";

const subCategorySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'CourseCategory', required: true },
  status: { 
    type: String, 
    enum: ['active', 'inactive'], 
    default: 'active', 
    required: true 
  },
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

// slug already has a unique index from the field definition (unique: true).

export default mongoose.model('SubCategory', subCategorySchema);