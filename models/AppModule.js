import mongoose from "mongoose";

const appModuleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    routePrefix: {
      type: String,
      trim: true,
    },
    icon: {
      type: String,
      trim: true,
    },
    parentModule: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AppModule",
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

appModuleSchema.index({ parentModule: 1, sortOrder: 1 });

export default mongoose.models.AppModule || mongoose.model("AppModule", appModuleSchema);