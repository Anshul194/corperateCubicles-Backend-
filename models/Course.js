import mongoose from "mongoose";
import CourseChatRoom from './CourseChatRoom.js'; // Added import

const { Schema } = mongoose;

const courseSchema = new mongoose.Schema({
  // Basic Info
  title: { type: String, required: true, trim: true },
  subtitle: { type: String, trim: true },
  slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
  description: { type: String, trim: true },
  shortDescription: { type: String, trim: true },
  seoMetaDescription: { type: String, trim: true },
  seoContent: { type: String, trim: true },
  enrolledStudents: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  // CHANGE: Removed default value of 20000, set to 0
  enrolledStudentsCount: { type: Number, default: 0 },

  // Media
  thumbnail: { type: String, trim: true },
  coverImage: { type: String, trim: true },
  demoVideo: { type: String, trim: true },
  verticalCarouselImage: { type: String, trim: true },
  featuredImageBanner: { type: String, trim: true },

  // Classification
  categoryId: { type: Schema.Types.ObjectId, ref: 'CourseCategory' },
  subCategoryId: { type: Schema.Types.ObjectId, ref: 'SubCategory' },
  level: [{ type: String, enum: ['beginner', 'intermediate', 'advanced'], default: ['beginner'] }],
  modules: [{ type: Schema.Types.ObjectId, ref: 'Module' }],

  // Pricing - Handle empty strings for decimal fields
  price: {
    type: mongoose.Types.Decimal128,
    default: 0,
    set: function (value) {
      // Convert empty strings to 0
      if (value === '' || value === null || value === undefined) {
        return 0;
      }
      return value;
    }
  },
  salePrice: {
    type: mongoose.Types.Decimal128,
    default: 0,
    set: function (value) {
      // Convert empty strings to 0
      if (value === '' || value === null || value === undefined) {
        return 0;
      }
      return value;
    }
  },
  currency: { type: String, default: 'USD' },
  discountPrice: {
    type: mongoose.Types.Decimal128,
    set: function (value) {
      // Convert empty strings to null for optional field
      if (value === '' || value === null || value === undefined) {
        return null;
      }
      return value;
    }
  },
  discountExpiry: { type: Date },

  // Course Details
  duration: { type: Number }, // in minutes
  totalLessons: { type: Number, default: 0 },
  instructorId: { type: Schema.Types.ObjectId, ref: 'User' },
  coInstructors: [{ type: Schema.Types.ObjectId, ref: 'User' }],

  // Enrollment & Access
  isPublished: { type: Boolean, default: true },
  enrollmentType: { type: String, enum: ['open', 'invite_only', 'paid', 'subscription'], default: 'open' },
  maxStudents: { type: Number },
  currentEnrollments: { type: Number, default: 0 },
  salesCount: { type: Number, default: 0 },
  revenue: { type: Number, default: 0 },

  // Learning Features
  tags: [{ type: String, trim: true }],
  prerequisites: { type: String, trim: true, default: 'None' },
  learningOutcomes: [{ type: String, trim: true }],
  completionCriteria: {
    type: { type: String, enum: ['all_lessons', 'percentage', 'specific_lessons'], default: 'all_lessons' },
    value: { type: Number, default: 100 }, // percentage or specific count
    requiredLessons: [{ type: Schema.Types.ObjectId, ref: 'Lesson' }]
  },

  // Certificate & Downloads
  certificateTemplate: { type: String, trim: true },
  isDownloadable: { type: Boolean, default: false },

  // Certificate Customization
  certificateImage: { type: String, trim: true },
  certificateTitle: { type: String, trim: true, default: "Certificate of Completion" },
  certificateSubtitle: { type: String, trim: true, default: "Awarded for Excellence" },
  certificateRecipientName: { type: String, trim: true, default: "Student Name" },
  certificateIssuerName: { type: String, trim: true },
  certificateIssuerTitle: { type: String, trim: true },
  certificateOrganization: { type: String, trim: true, default: "Lapaas LMS" },
  certificateDescription: { type: String, trim: true },
  downloadableFiles: [{
    name: { type: String, trim: true },
    url: { type: String, trim: true },
    size: { type: String, trim: true }
  }],

  // Community & Support
  courseForum: { type: Boolean, default: false },
  enableQA: { type: Boolean, default: true },
  enableReviews: { type: Boolean, default: true },

  // Access Control
  isPrivate: { type: Boolean, default: false },
  enableWaitlist: { type: Boolean, default: false },

  // Localization
  languages: [{ type: String, enum: ['English', 'Español', 'Português', 'हिन्दी', 'العربية', 'Français', 'Deutsch'], default: ['English'] }],

  // Additional Fields
  topic: [{ type: String, trim: true }],
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
  requirements: [{ type: String, trim: true }],
  targetAudience: [{ type: String, trim: true }],

  // Positioning for manual ordering of courses
  coursePosition: { type: Number, default: 0 },

  // Personality Test Integration
  suitablePersonalityTypes: [{ type: String, trim: true }], // e.g., ["ENTJ", "INTJ"]


  // Analytics
  averageRating: { type: Number, default: 0, min: 0, max: 5 },
  totalReviews: { type: Number, default: 0 },
  totalViews: { type: Number, default: 0 },

  // Scheduling (for live courses/webinars)
  isLive: { type: Boolean, default: false },
  startDate: { type: Date },
  endDate: { type: Date },
  timeZone: { type: String, trim: true },
  meetingInfo: {
    platform: { type: String, enum: ['zoom', 'teams', 'meet', 'custom'] },
    meetingId: { type: String, trim: true },
    password: { type: String, trim: true },
    link: { type: String, trim: true }
  },
  popular: {
    type: Boolean,
    default: false
  },

  // Featured flag for highlighting courses in UI
  isFeatured: { type: Boolean, default: false },

  // Drip setting: users for whom drip is disabled
  dripSettingDisabledFor: [{ type: Schema.Types.ObjectId, ref: 'User', default: [] }],

  // Support & Misc
  support: { type: String, trim: true },
  faq: [{
    question: { type: String, trim: true },
    answer: { type: String, trim: true },
    category: { type: String, enum: ['course', 'purchase', 'technical'], default: 'course' }
  }],

  // Dynamic Content Sections for Landing Page
  contentSections: [{
    sectionType: {
      type: String,
      enum: ['hero', 'what_is', 'comparison', 'features', 'problems_solutions', 'outcomes', 'mentor', 'custom'],
      required: true
    },
    sectionTitle: { type: String, trim: true }, // e.g., "What is The Art of Content Creation?"
    sectionSubtitle: { type: String, trim: true }, // e.g., "Learn the Exact Systems Behind Viral Content"
    sectionDescription: { type: String, trim: true }, // Main description text
    order: { type: Number, default: 0 }, // For ordering sections

    // For bullet points or list items
    listItems: [{
      text: { type: String, trim: true },
      icon: { type: String, trim: true } // optional icon name or emoji
    }],

    // For two-column layouts (features, outcomes, etc.)
    columns: [{
      columnTitle: { type: String, trim: true },
      items: [{
        text: { type: String, trim: true },
        icon: { type: String, trim: true }
      }]
    }],

    // For comparison sections (Traditional vs Our Approach)
    comparisonData: {
      leftColumn: {
        title: { type: String, trim: true }, // e.g., "Traditional Content Classes"
        items: [{ type: String, trim: true }]
      },
      rightColumn: {
        title: { type: String, trim: true }, // e.g., "Our Actual Content Course"
        items: [{ type: String, trim: true }]
      }
    },

    // For mentor/instructor spotlight section
    mentorData: {
      name: { type: String, trim: true },
      title: { type: String, trim: true },
      bio: { type: String, trim: true },
      image: { type: String, trim: true },
      achievements: [{ type: String, trim: true }]
    },

    // For custom HTML/rich content
    customContent: { type: String, trim: true },

    // Background styling options
    backgroundColor: { type: String, trim: true },
    textColor: { type: String, trim: true },

    // Show/hide section
    isVisible: { type: Boolean, default: true }
  }],

  // Course Page Branding
  brandColors: {
    primary: { type: String, trim: true, default: '#000000' },
    secondary: { type: String, trim: true, default: '#ffffff' },
    accent: { type: String, trim: true, default: '#ff0000' }
  },

  // Featured logos/brands (as seen in the image)
  featuredIn: [{
    name: { type: String, trim: true }, // e.g., "Forbes", "TechCrunch"
    logo: { type: String, trim: true }, // logo URL
    url: { type: String, trim: true } // link to article/feature
  }],

  // Course highlights/key features (for quick display)
  highlights: [{ type: String, trim: true }],

  // Reviews/Testimonials Section
  reviews: [{
    name: { type: String, trim: true },
    designation: { type: String, trim: true },
    image: { type: String, trim: true },
    rating: { type: Number, min: 1, max: 5 },
    reviewText: { type: String, trim: true },
    sequence: { type: Number, default: 0 }
  }],

  // Mentor Information
  mentorName: { type: String, trim: true },
  mentorTitle: { type: String, trim: true },
  mentorDescription: { type: String, trim: true },
  mentorImage: { type: String, trim: true },
  mentorAchievements: [{ type: String, trim: true }],
  mentorSocialLinks: {
    linkedin: { type: String, trim: true },
    twitter: { type: String, trim: true },
    youtube: { type: String, trim: true },
    website: { type: String, trim: true }
  },

  // Enhanced Landing Page Sections
  landingPageSections: [{
    id: { type: String, trim: true },
    type: { type: String, trim: true },
    order: { type: Number, default: 0 },
    sortOrder: { type: Number, default: 0 },
    data: { type: mongoose.Schema.Types.Mixed }
  }],
  overviewSection: {
    show: { type: Boolean, default: false },
    title: { type: String, trim: true },
    subtitle: { type: String, trim: true },
    description: { type: mongoose.Schema.Types.Mixed },
    images: [{ type: String, trim: true }]
  },
  comparisonSection: {
    show: { type: Boolean, default: false },
    title: { type: String, trim: true },
    leftTitle: { type: String, trim: true, default: "Traditional Program" },
    rightTitle: { type: String, trim: true, default: "Our Program" },
    content: { type: mongoose.Schema.Types.Mixed },
    leftPoints: [{ type: String, trim: true }],
    rightPoints: [{ type: String, trim: true }]
  },
  benefitsSection: {
    show: { type: Boolean, default: false },
    title: { type: String, trim: true },
    content: { type: mongoose.Schema.Types.Mixed },
    points: [{ type: String, trim: true }]
  },
  frameworkSection: {
    show: { type: Boolean, default: false },
    title: { type: String, trim: true },
    subtitle: { type: String, trim: true },
    description: { type: mongoose.Schema.Types.Mixed },
    media: { type: String, trim: true }
  },
  solutionSection: {
    show: { type: Boolean, default: false },
    title: { type: String, trim: true },
    content: { type: mongoose.Schema.Types.Mixed },
    points: [{ type: String, trim: true }]
  },

  // Soft Delete
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null }
}, { timestamps: true });

// Pre-save middleware to handle decimal field validation
courseSchema.pre('save', function (next) {
  // Handle price fields - convert empty strings to proper values
  if (this.price === '' || this.price === null || this.price === undefined) {
    this.price = 0;
  }
  if (this.salePrice === '' || this.salePrice === null || this.salePrice === undefined) {
    this.salePrice = 0;
  }
  if (this.discountPrice === '' || this.discountPrice === null || this.discountPrice === undefined) {
    this.discountPrice = null;
  }

  next();
});

// Pre-validate middleware to clean data before validation
courseSchema.pre('validate', function (next) {
  // Clean decimal fields
  if (this.price === '') this.price = 0;
  if (this.salePrice === '') this.salePrice = 0;
  if (this.discountPrice === '') this.discountPrice = undefined;

  next();
});

courseSchema.virtual('enrollstudent_course_details', {
  ref: 'Enrollment',
  localField: '_id',
  foreignField: 'courseId',
  justOne: false,
  match: { isActive: true },
});

// ➕ Enable virtuals in output
courseSchema.set('toObject', { virtuals: true });
courseSchema.set('toJSON', { virtuals: true });

// Indexes (slug already has a unique index from the field definition)
courseSchema.index({ categoryId: 1 });
courseSchema.index({ subCategoryId: 1 });
courseSchema.index({ instructorId: 1 });
courseSchema.index({ topic: 1 });
courseSchema.index({ isPublished: 1, isDeleted: 1 });
courseSchema.index({ startDate: 1, endDate: 1 });
courseSchema.index({ averageRating: -1 });
// Index to support manual ordering when coursePosition is used
courseSchema.index({ coursePosition: 1 });
// Index to quickly query featured courses
courseSchema.index({ isFeatured: -1 });

courseSchema.post('save', async function (doc) {
  if (doc.isNew) { // Only for new courses
    try {
      const fixedUsers = ['68b69334dffbe2b24ed4f059', '68d54d727eca4a280a63569c'];
      const room = new CourseChatRoom({
        courseId: doc._id,
        participants: fixedUsers,
        createdBy: doc.instructorId // Assuming instructor creates the course
      });
      await room.save();
      console.log(`CourseChatRoom created for course ${doc._id} with fixed users.`);
    } catch (error) {
      console.error('Error creating CourseChatRoom for course:', error);
    }
  }
});

const Course = mongoose.models.Course || mongoose.model('Course', courseSchema);

export default Course;