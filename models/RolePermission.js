import mongoose from "mongoose";

const rolePermissionSchema = new mongoose.Schema(
  {
    role: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
      required: true,
    },
    permission: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Permission",
      required: true,
    },
    grantedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

rolePermissionSchema.index({ role: 1, permission: 1 }, { unique: true });

export default mongoose.models.RolePermission || mongoose.model("RolePermission", rolePermissionSchema);