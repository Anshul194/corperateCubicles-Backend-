import mongoose from 'mongoose';
const { Schema } = mongoose;

const videoLessonSchema = new Schema(
  {
    lessonId: {
      type: Schema.Types.ObjectId,
      ref: 'Lesson',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    sourcePlatform: {
      type: String,
      enum: ['videocypher', 'manual', 'youtube', 'vimeo', 'external_link'],
      required: true,
    },
    // Platform-specific video identifier
    videoId: {
      type: String,
      required: function() {
        return [  'vimeo'].includes(this.sourcePlatform);
      }
    },
    // Main video URL (watch URL for YouTube, embed URL for others)
    secureUrl: {
      type: String,
    },
    // Embed URL (for iframe embedding)
    embedUrl: {
      type: String
     
    },
    // Original URL provided by user (for YouTube links)
    originalUrl: {
      type: String,

    },
    thumbnail: {
      type: String,
    },
    // Video metadata
    duration: {
      type: Number, // in seconds
    },
    fileSize: {
      type: Number, // in bytes (for uploaded files)
    },
    // Enhanced quality field
    quality: {
      type: String,
      enum: ['auto', '240p', '360p', '480p', '720p', '1080p', '1440p', '2160p'],
      default: 'auto'
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
   
    },
    // Enhanced status field for VdoCipher
    status: {
      type: String,
      enum: ['processing', 'ready', 'failed', 'pending'],
      default: 'ready',
    },
    // Error information if upload/processing fails
    errorMessage: {
      type: String,
    },
    // Processing information
    processingStartedAt: {
      type: Date,
    },
    processingCompletedAt: {
      type: Date,
    },
    // Access control
    isPublic: {
      type: Boolean,
      default: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    // Additional platform-specific data
    platformData: {
      type: Schema.Types.Mixed, // Store platform-specific metadata
    },
    // VdoCipher specific fields
    uploadMethod: {
      type: String,
      enum: ['file', 'existing_video_id'],
      default: 'file'
    },
    
    vdocipherVideoId: {
      type: String,
      sparse: true // Allow multiple null values
    },
    
    linkedAt: {
      type: Date
    },
    
    // Additional metadata
    size: {
      type: Number // File size in bytes
    },
    
    uploadTime: {
      type: Date
    },
    
    tags: [{
      type: String
    }],
  },
  { 
    timestamps: true,
    // Add indexes for better query performance
    indexes: [
      { lessonId: 1, isDeleted: 1 },
      { sourcePlatform: 1, status: 1 },
      { uploadedBy: 1, createdAt: -1 }
    ]
  }
);

// Virtual for getting formatted duration
videoLessonSchema.virtual('formattedDuration').get(function() {
  if (!this.duration) return null;
  
  const hours = Math.floor(this.duration / 3600);
  const minutes = Math.floor((this.duration % 3600) / 60);
  const seconds = this.duration % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
});

// Virtual for getting file size in readable format
videoLessonSchema.virtual('readableFileSize').get(function() {
  if (!this.fileSize) return null;
  
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = this.fileSize;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
});

// Pre-save middleware to set processing times
videoLessonSchema.pre('save', function(next) {
  if (this.isModified('status')) {
    if (this.status === 'processing' && !this.processingStartedAt) {
      this.processingStartedAt = new Date();
    } else if (this.status === 'ready' && !this.processingCompletedAt) {
      this.processingCompletedAt = new Date();
    }
  }
  next();
});

// Static method to find active videos for a lesson
videoLessonSchema.statics.findByLessonId = function(lessonId, includeDeleted = false) {
  const query = { lessonId };
  if (!includeDeleted) {
    query.isDeleted = false;
  }
  return this.find(query).sort({ createdAt: -1 });
};

// Instance method to mark as deleted (soft delete)
videoLessonSchema.methods.softDelete = function() {
  this.isDeleted = true;
  return this.save();
};

// Instance method to get embed HTML
videoLessonSchema.methods.getEmbedHtml = function(options = {}) {
  if (!this.embedUrl) return null;
  
  const { width = 560, height = 315, autoplay = false } = options;
  let embedUrl = this.embedUrl;
  
  if (this.sourcePlatform === 'youtube' && autoplay) {
    embedUrl += '?autoplay=1';
  }
  
  return `<iframe width="${width}" height="${height}" src="${embedUrl}" frameborder="0" allowfullscreen></iframe>`;
};

export default mongoose.model('VideoLesson', videoLessonSchema);