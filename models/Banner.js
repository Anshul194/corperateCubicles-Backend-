import mongoose from 'mongoose';

const BannerSchema = new mongoose.Schema({
  title: { 
    type: String, 
    required: true,
    trim: true
  },
  description: { 
    type: String, 
    trim: true
  },
  image: { 
    type: String, 
    required: true 
  },
  mobileImage: { 
    type: String // Optional mobile-specific image
  },
  type: {
    type: String,
    enum: ['course', 'event', 'job','all_courses', 'all_events', 'all_jobs'],
    required: true
  },
  referenceId: { 
    type: mongoose.Schema.Types.ObjectId, 
    refPath: 'type', 
    required: function() { return this.type !== 'all'; } 
  },
  isActive: { 
    type: Boolean, 
    default: true 
  },
  priority: { 
    type: Number, 
    default: 0
  },

  startDate: { 
    type: Date, 
    default: Date.now 
  },
  endDate: { 
    type: Date 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

BannerSchema.index({ isActive: 1, priority: -1 });

const Banner = mongoose.model('Banner', BannerSchema);
export default Banner;
