import mongoose from "mongoose";

const loginLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: false, // Allow null for failed logins
  },
  deviceId: {
    type: String,
    required: true,
  },
  deviceInfo: {
    platform: { type: String, enum: ["android", "ios", "web"], default: "android" },
    userAgent: { type: String },
    ipAddress: { type: String },
    deviceName: { type: String },
    browserName: { type: String },
    browserVersion: { type: String },
  },
  loginTime: {
    type: Date,
    default: Date.now,
  },
  loginStatus: {
    type: String,
    enum: ["success", "failed", "device_pending", "device_rejected"],
    default: "success",
  },
  sessionId: {
    type: String,
    required: false, // Allow null
  },
  logoutTime: {
    type: Date,
  },
  sessionDuration: {
    type: Number,
  },
  location: {
    country: { type: String },
    city: { type: String },
    region: { type: String },
  },
});

// Index for efficient querying
loginLogSchema.index({ userId: 1, loginTime: -1 });
loginLogSchema.index({ deviceId: 1 });
loginLogSchema.index({ loginTime: -1 });

export default mongoose.model("LoginLog", loginLogSchema);