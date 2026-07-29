import mongoose from 'mongoose';

const personalityQuestionSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true,
    trim: true
  },
  dimension: {
    type: String,
    enum: ['IE', 'EI', 'SN', 'NS', 'TF', 'FT', 'JP', 'PJ'],
    required: true,
    description: 'The personality dimension this question measures (Introversion/Extroversion, Sensing/Intuition, Thinking/Feeling, Judging/Perceiving)'
  },
  agreeType: {
    type: String,
    required: true,
    description: 'The personality type letter score increases for if user agrees (e.g. E, N, T, J)'
  },
  disagreeType: {
    type: String,
    required: true,
    description: 'The personality type letter score increases for if user disagrees (e.g. I, S, F, P)'
  },
  weight: {
    type: Number,
    default: 1,
    description: 'Weight of the question'
  }
}, { timestamps: true });

const PersonalityQuestion = mongoose.model('PersonalityQuestion', personalityQuestionSchema);

export default PersonalityQuestion;
