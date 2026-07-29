import mongoose from 'mongoose';

const aiMessageSchema = new mongoose.Schema({
    chatRoomId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AIChatRoom',
        required: true,
        index: true
    },
    role: {
        type: String,
        enum: ['user', 'assistant', 'system'],
        required: true
    },
    content: {
        type: String,
        required: true
    },
    tokens: {
        prompt: Number,
        completion: Number,
        total: Number
    },
    model: {
        type: String,
        default: 'gpt-4o'
    },
    toolCalls: {
        type: Array,
        default: []
    },
    metadata: {
        type: Map,
        of: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, { timestamps: true });

aiMessageSchema.index({ chatRoomId: 1, createdAt: 1 });

const AIMessage = mongoose.model('AIMessage', aiMessageSchema);

export default AIMessage;
