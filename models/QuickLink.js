import mongoose from "mongoose";

const QuickLinkSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  url: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  icon: {
    type: String,
    trim: true,
  },
  type: {
    type: String,
    enum: ["internal", "external"],
    default: "external",
  },
  target: {
    type: String,
    enum: ["_self", "_blank"],
    default: "_blank",
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  priority: {
    type: Number,
    default: 0,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
}, { timestamps: true });

QuickLinkSchema.index({ isActive: 1, priority: -1 });

const QuickLink = mongoose.model("QuickLink", QuickLinkSchema);
export default QuickLink;
