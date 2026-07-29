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

const courseChatMessageSchema = new mongoose.Schema(
  {
    courseChatRoomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CourseChatRoom",
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isPinned: { type: Boolean, default: false },
    pinnedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    pinnedAt: { type: Date, default: null },
    message: {
      type: String,
      required: function () {
        // message required only if no files array and no single fileUrl
        return (
          !(Array.isArray(this.files) && this.files.length > 0) && !this.fileUrl
        );
      },
    },
    // Backwards-compatible single file fields (optional)
    fileUrl: {
      type: String,
      default: null,
    },
    fileName: {
      type: String,
      default: null,
    },
    fileType: {
      type: String,
      enum: ["image", "document", "voice", "other"],
      default: null,
    },
    fileSize: {
      type: Number,
      default: null,
    },
    // New files array to support multiple attachments
    files: {
      type: [fileSubSchema],
      default: [],
    },
    readBy: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        readAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    isDeleted: {
      type: Boolean,
      default: false,
    },
    // Reply to a specific message (for threaded conversations)
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CourseChatMessage",
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
    timestamps: true,
  }
);

courseChatMessageSchema.index({ courseChatRoomId: 1, createdAt: -1 });
courseChatMessageSchema.index({ sender: 1 });
courseChatMessageSchema.index({
  courseChatRoomId: 1,
  isPinned: -1,
  pinnedAt: -1,
});

const CourseChatMessage = mongoose.model(
  "CourseChatMessage",
  courseChatMessageSchema
);
export default CourseChatMessage;
