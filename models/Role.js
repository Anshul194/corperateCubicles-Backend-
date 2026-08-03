import mongoose from "mongoose";

const roleSchema = new mongoose.Schema(
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
    permissions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Permission",
      },
    ],
    modules: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "AppModule",
      },
    ],
    isDefault: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

roleSchema.index({ permissions: 1 });
roleSchema.index({ modules: 1 });

export default mongoose.models.Role || mongoose.model("Role", roleSchema);