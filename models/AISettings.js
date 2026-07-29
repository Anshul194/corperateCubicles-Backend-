import mongoose from 'mongoose';

const aiSettingsSchema = new mongoose.Schema({
    temperature: {
        type: Number,
        default: 7,
        min: 0,
        max: 10
    },
    systemPrompt: {
        type: String,
        default: ''
    },
    about: {
        type: String,
        default: ''
    },
    avoidWords: {
        type: String,
        default: ''
    },
    responseLength: {
        type: String,
        enum: ['short', 'medium', 'long'],
        default: 'medium'
    },
    tone: {
        type: String,
        enum: ['professional', 'friendly', 'casual', 'humorous', 'authoritative', 'neutral'],
        default: 'neutral'
    },
    gender: {
        type: String,
        enum: ['male', 'female', 'neutral'],
        default: 'neutral'
    },
    languages: {
        type: [String],
        default: []
    },
    useEmojis: {
        type: Boolean,
        default: true
    },
    useBulletPoints: {
        type: Boolean,
        default: true
    },
    dos: {
        type: [String],
        default: []
    },
    donts: {
        type: [String],
        default: []
    }
}, {
    timestamps: true
});

const AISettings = mongoose.models.AISettings || mongoose.model('AISettings', aiSettingsSchema);

export default AISettings;
