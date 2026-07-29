import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['online', 'offline', 'hybrid'],
    required: true
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  venue: {
    name: String,
    address: String,
    city: String,
    country: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  onlineLink: {
    platform: {
      type: String,
      enum: ['zoom', 'meet', 'teams', 'other']
    },
    url: String,
    meetingId: String,
    password: String
  },
  capacity: {
    type: Number,
    min: 0
  },
  registeredParticipants: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    registeredAt: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['registered', 'attended', 'cancelled', 'waitlisted'],
      default: 'registered'
    },
    ticketNo: String,
    ticketPrice: {
      type: mongoose.Types.Decimal128,
      default: 0
    },
    invoice: String,
    purchasedAt: Date,
    paymentStatus: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'completed'
    }
  }],
  price: {
    type: mongoose.Schema.Types.Decimal128,
    default: 0
  },
  currency: {
    type: String,
    default: 'INR'
  },
  category: {
    type: String,
    required: true
  },
  tags: [String],
  organizer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'cancelled', 'completed'],
    default: 'draft'
  },
  thumbnail: String,
  attachments: [{
    name: String,
    url: String,
    type: String
  }],
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Add indexes for common queries
eventSchema.index({ startDate: 1 });
eventSchema.index({ category: 1 });
eventSchema.index({ status: 1 });
eventSchema.index({ isDeleted: 1 });

const Event = mongoose.model('Event', eventSchema);
export default Event;
