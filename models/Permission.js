import mongoose from "mongoose";

const permissionSchema = new mongoose.Schema(
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
    module: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AppModule",
    },
    action: {
      type: String,
      enum: ["create", "read", "update", "delete", "manage"],
      required: true,
    },
    resource: {
      type: String,
      required: true,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

permissionSchema.index({ module: 1, action: 1, resource: 1 });

export default mongoose.models.Permission || mongoose.model("Permission", permissionSchema);