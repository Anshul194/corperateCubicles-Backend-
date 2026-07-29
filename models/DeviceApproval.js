import mongoose from "mongoose";

const deviceApprovalSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  deviceId: {
    type: String,
    required: true,
  },
  deviceInfo: {
    platform: { type: String, enum: ["android", "ios", "web"], default: "android" },
    userAgent: { type: String },
    ipAddress: { type: String },
    deviceName: { type: String }, // Optional
  },
  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
  },
  requestedAt: {
    type: Date,
    default: Date.now,
  },
  approvedAt: {
    type: Date,
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  rejectionReason: {
    type: String,
  },
  isActive: {
    type: Boolean,
    default: false, // Only active for approved devices
  },
  isFirstDevice: {
    type: Boolean,
    default: false,
  },
});

// Index to speed up lookups for user-device combinations
deviceApprovalSchema.index({ userId: 1, deviceId: 1, requestedAt: -1 });

export default mongoose.model("DeviceApproval", deviceApprovalSchema);