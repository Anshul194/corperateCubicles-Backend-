import mongoose from "mongoose";

// Updated Schema - removed TTL index and added proper expiration handling
const userRefreshTokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true // Only one index definition here
  },
  token: {
    type: String,
    required: true,
    unique: true
  },
  blacklisted: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    required: false,
    index: false // No index, allow null
  },
  platform: {
    type: String,
    enum: ["web", "app", "android", "ios"],
    default: "web"
  },
  deviceId: {
    type: String,
    default: null
  }
}, {
  timestamps: true // Adds createdAt and updatedAt automatically
});

// Model
const UserRefreshToken = mongoose.model("UserRefreshToken", userRefreshTokenSchema);

export default UserRefreshToken;