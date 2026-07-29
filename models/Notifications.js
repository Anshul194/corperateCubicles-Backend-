import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    data: {
      type: Object, // Example: { title, body, order_id, etc. }
      required: true,
    },
    status: {
      type: Number,
      default: 1, // 1 = unread, 0 = read
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    device_id: { type: String, default: null }, // optional
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

// Supports the notification list query shape:
// $match { $or: [{ user_id }, { user_id: null }] } + $sort { created_at: -1 }
// (service/notificationService.js) — both $or branches are user_id equalities,
// so this index serves them via index union and avoids a blocking sort.
notificationSchema.index({ user_id: 1, created_at: -1 });

export default mongoose.model("Notification", notificationSchema);
