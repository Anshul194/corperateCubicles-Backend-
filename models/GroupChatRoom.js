import mongoose from "mongoose";

const groupChatRoomSchema = new mongoose.Schema({
  participants: [
    { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
  ],
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("GroupChatRoom", groupChatRoomSchema);