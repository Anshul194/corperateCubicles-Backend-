import mongoose from 'mongoose';

const { Schema } = mongoose;

const lessonSchema = new Schema(
  {
    // === COURSE CONTENT METADATA ===
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    type: {
      type: String,
      enum: ['video-lesson','video', 'text', 'quiz', 'assignment', 'external_link'], //img or video
    },

    Quiz: {
      type: Schema.Types.ObjectId,
      ref: 'Quiz',
    },
    Assignment: {
      type: Schema.Types.ObjectId,
      ref: 'Assignment',
    },
    
    language: {
      type: String,
      required: true,
      default: 'English',
      trim: true,
    },
    section: {
      type: Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
    },
    source: {
      type: String,
      trim: true,
    },
    accessibility: {
      type: String,
      enum: ['free', 'paid'],
      default: 'free',
    },
    uploadType: {
      type: String,
      enum: ['direct', 'manual'],
      default: 'direct',
    },
    fileUrl: {
      type: String, //img or video URL
      trim: true,
    },
    image: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },



    // === DRIP CONTENT SETTINGS ===
 

    // === LESSON DETAILS ===
    moduleId: {
      type: Schema.Types.ObjectId,
      ref: 'Module',
      required: true,
    },
    
    // content: {
    //   type: String,
      
    // },
    content: {
  type: Schema.Types.Mixed,
  default: {}
},
    order: {
      type: Number,
      required: true,
    },
    duration: {
      type: Number, // in minutes
    },
    isRequired: {
      type: Boolean,
      default: true,
    },
    unlockConditions: {
      type: Schema.Types.Mixed,
      default: {},
    },
    resources: {
      type: Schema.Types.Mixed,
      default: {},
    },
    ismobileOnly: {
      type: Boolean,
      default: true,
    },

    // === SOFT DELETE ===
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  
  {
    timestamps: true,
  }
);

// Index to help with ordered retrieval within a module
lessonSchema.index({ moduleId: 1, order: 1 }); // for ordering within module
lessonSchema.index({ isDeleted: true }); 

export default mongoose.model('Lesson', lessonSchema);
