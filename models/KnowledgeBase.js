import mongoose from 'mongoose';

const knowledgeBaseSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['text', 'url', 'pdf', 'docx', 'xlsx'],
        required: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    content: {
        type: String,
        default: ''
    },
    source: {
        type: String, // URL or Filename
        trim: true
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    isActive: {
        type: Boolean,
        default: true
    },
    status: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed'],
        default: 'pending'
    },
    error: {
        type: String,
        default: null
    }
}, {
    timestamps: true
});

const KnowledgeBase = mongoose.models.KnowledgeBase || mongoose.model('KnowledgeBase', knowledgeBaseSchema);

export default KnowledgeBase;
