import mongoose from 'mongoose';

const personalitySubmissionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    answers: [{
        questionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'PersonalityQuestion'
        },
        value: {
            type: Number,
            required: true,
            min: 1,
            max: 7
        }
    }],
    resultType: {
        type: String,
        required: true,
        enum: [
            'INTJ', 'INTP', 'ENTJ', 'ENTP',
            'INFJ', 'INFP', 'ENFJ', 'ENFP',
            'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ',
            'ISTP', 'ISFP', 'ESTP', 'ESFP'
        ]
    },
    scores: {
        IE: { type: Number, required: true },
        SN: { type: Number, required: true },
        TF: { type: Number, required: true },
        JP: { type: Number, required: true }
    }
}, { timestamps: true });

const PersonalitySubmission = mongoose.model('PersonalitySubmission', personalitySubmissionSchema);

export default PersonalitySubmission;
