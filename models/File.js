import mongoose from 'mongoose';

const fileSchema = new mongoose.Schema({

    lessonId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lesson',
    required: true,
    },
    courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true,
    },

  language: {
    type: String,
    required: true,
    enum: ['English', 'Hindi', 'French'],
  },
  fileType: {
    type: String,
    required: true,
    enum: ['PDF', 'DOCX', 'VIDEO', 'IMAGE'],
  },
  filePath: {
    type: String,
    required: true,
  },
  downloadable: {
    type: Boolean,
    default: true,
  },
  active: {
    type: Boolean,
    default: true,
  },
  isPublic: {
    type: Boolean,
    default: false,
  }
}, { timestamps: true });

const File = mongoose.model('File', fileSchema);
export default File;
