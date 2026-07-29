import mongoose from 'mongoose';

const statSchema = new mongoose.Schema({
  label: { type: String, required: true },
  value: { type: String, required: true },
  change: { type: String }
}, { _id: false });

const valueSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  icon: { type: String }
}, { _id: false });

const aboutContentSchema = new mongoose.Schema({
  // Hero section
  heroBadge: { type: String, default: 'About Corporate Cubicles' },
  heroTitle: { type: String, default: 'Empowering Tomorrow\'s AI & Data Science Leaders' },
  heroSubtitle: { type: String },
  heroDescription: { type: String },

  // Stats bar
  stats: [statSchema],

  // Story section
  storyTitle: { type: String, default: 'Our Story' },
  storyParagraphs: [{ type: String }],

  // Mission
  missionTitle: { type: String, default: 'Our Mission' },
  missionDescription: { type: String },

  // Vision
  visionTitle: { type: String, default: 'Our Vision' },
  visionDescription: { type: String },

  // Values / pillars
  values: [valueSchema],

  // Comparison table
  comparisons: [{
    feature: { type: String },
    academic: { type: String },
    corporate: { type: String }
  }],

  // CTA section
  ctaTitle: { type: String },
  ctaDescription: { type: String },
  ctaButtonText: { type: String },
  ctaButtonLink: { type: String },

  isActive: { type: Boolean, default: true }
}, { timestamps: true });

export default mongoose.model('AboutContent', aboutContentSchema);
