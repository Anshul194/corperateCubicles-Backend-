import mongoose from "mongoose";

const coursePlanSchema = new mongoose.Schema({
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
  name: { type: String, required: true, trim: true },
  price: { type: Number, required: true },
  salePrice: { type: Number, default: 0 },
  description: { type: String, trim: true },
  durationType: { type: String, enum: ["Month", "Year", "Day"], required: true },
  duration: { type: Number, required: true },
  status: { type: String, enum: ["active", "inactive"], default: "active" }
}, { timestamps: true });

export default mongoose.model("CoursePlan", coursePlanSchema);