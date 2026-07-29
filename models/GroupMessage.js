import mongoose from "mongoose";

const fileSubSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    name: { type: String, default: null },
    type: {
      type: String,
      enum: ["image", "document", "voice", "other"],
      default: "other",
    },
    size: { type: Number, default: null },
  },
  { _id: false }
);

const groupMessageSchema = new mongoose.Schema(
  {
    groupChatRoomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GroupChatRoom",
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    message: { type: String, default: null },
    isPinned: { type: Boolean, default: false },
    pinnedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    pinnedAt: { type: Date, default: null },
    // Backwards-compatible single-file fields
    fileUrl: { type: String, default: null },
    fileName: { type: String, default: null },
    fileType: {
      type: String,
      enum: ["image", "document", "voice", "other"],
      default: null,
    },
    fileSize: { type: Number, default: null },
    // Support multiple attachments
    files: {
      type: [fileSubSchema],
      default: [],
    },
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", default: [] }],
    // Reply to a specific message (for threaded conversations)
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GroupMessage",
      default: null,
    },
    // Mentions - array of user IDs mentioned in the message
    mentions: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        userName: String,
        userEmail: String,
      },
    ],
  },
  {
    timestamps: true, // adds createdAt and updatedAt
  }
);

// index to support recent messages queries
groupMessageSchema.index({ groupChatRoomId: 1, createdAt: -1 });

export default mongoose.model("GroupMessage", groupMessageSchema);