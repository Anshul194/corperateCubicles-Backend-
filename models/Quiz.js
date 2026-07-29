import mongoose from "mongoose";

const optionSchema = new mongoose.Schema({
  label: { 
    type: String, 
    required: true, 
    enum: ['A', 'B', 'C', 'D'] 
  },
  text: { 
    type: String, 
    required: true 
  }
}, { _id: false });

const questionSchema = new mongoose.Schema({
  question: { type: String, required: true },
  options: [optionSchema],
  correctAnswer: { 
    type: String, 
    required: true, 
    enum: ['A', 'B', 'C', 'D'] 
  },
  marks: { type: Number, required: true, default: 1 }
}, { _id: false });

const sectionSchema = new mongoose.Schema({
  sectionTitle: { type: String, required: true },
  sectionDescription: { type: String },
  questions: [questionSchema]
}, { _id: false });

const quizSchema = new mongoose.Schema({
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  lesson: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson', required: true },
  quizTitle: { type: String, required: true },
  quizDescription: { type: String, required: true },
  totalMarks: { type: Number, required: true },
  timeLimit: { type: Number, required: true },
  level: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    required: true
  },
  isTestSeries: { type: Boolean, default: false },
  sections: [sectionSchema],
  passMark: { type: Number, required: true }
}, { timestamps: true });

const Quiz = mongoose.models.Quiz || mongoose.model('Quiz', quizSchema);
export default Quiz;