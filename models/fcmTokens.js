import mongoose from "mongoose";

const fcmTokenSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }, // null for guest
    deviceId: { type: String, required: true }, // unique identifier for device
    token: { type: String, required: true },
    platform: { type: String, enum: ["android", "ios", "web"], default: "android" },
    updatedAt: { type: Date, default: Date.now }
});

export default mongoose.model("FcmToken", fcmTokenSchema);
