import mongoose from 'mongoose';

const jobPostingSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  thumbnail: {
    type: String,
    trim: true
  },

  isAdminApproved:{
    type: Boolean,
    default: false
  },

  status: {
    type: Boolean,
    default: true
  },
  budget: {
    min: { type: Number, required: true },
    max: { type: Number, required: true },
    currency: { type: String, default: 'INR' }
  },
  category: {
    type: String,
    required: true,
  },
  skillsRequired: [{
    type: String,
    trim: true
  }],
  experienceLevel: {
    type: String,
    enum: ['beginner', 'intermediate', 'expert'],
    required: true
  },
  estimatedDuration: {
    value: { type: Number },
    unit: { type: String, enum: ['hours', 'days', 'weeks', 'months']}
  },
  mode: {
    type: String,
    enum: ['full-time', 'part-time', 'contract', 'freelance', 'internship'],
    required: true
  },
  location: {
    type: {
      type: String,
      enum: ['remote', 'onsite', 'hybrid'],
      default: 'remote'
    },
    address: {
      street: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      country: { type: String, trim: true },
      zipCode: { type: String, trim: true }
    }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  proposals: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    coverLetter: String,
    cv: String, // URL to CV or resume
    proposedAmount: Number,
    status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
    submittedAt: { type: Date, default: Date.now }
  }]
}, {
  timestamps: true
});

// Indexes for efficient queries
jobPostingSchema.index({ title: 1 });
jobPostingSchema.index({ status: 1 });
jobPostingSchema.index({ category: 1 });
jobPostingSchema.index({ 'budget.min': 1, 'budget.max': 1 });
jobPostingSchema.index({ experienceLevel: 1 });
jobPostingSchema.index({ createdAt: -1 });

const JobPosting = mongoose.model('JobPosting', jobPostingSchema);
export default JobPosting;
