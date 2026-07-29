import mongoose from 'mongoose';

const siteContentSchema = new mongoose.Schema({
  section: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    enum: [
      'hero',
      'howItWorks',
      'brandFeatures',
      'enterprise',
      'footer',
      'instructors',
      'growth',
      'logoMarquee',
      'easyMoney',
      'benefits',
      'solution',
      'framework',
      'comparison',
      'guarantee',
      'bonus',
      'masterclassBanner',
      'stackingBanners',
      'curatedCatalog',
      'finalCta',
      'testimonialsScroll',
      'certificatePricing',
      'eventHero'
    ]
  },
  data: { type: mongoose.Schema.Types.Mixed, default: {} },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

siteContentSchema.index({ section: 1, isActive: 1 });

export default mongoose.model('SiteContent', siteContentSchema);
