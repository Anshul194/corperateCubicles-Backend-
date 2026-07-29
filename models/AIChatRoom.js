import mongoose from 'mongoose';

const aiChatRoomSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    title: {
        type: String,
        default: 'New Chat'
    },
    lastMessageAt: {
        type: Date,
        default: Date.now
    },
    contextSummary: {
        type: String,
        default: ""
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

aiChatRoomSchema.index({ user: 1, lastMessageAt: -1 });

const AIChatRoom = mongoose.model('AIChatRoom', aiChatRoomSchema);

export default AIChatRoom;
