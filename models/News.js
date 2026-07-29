import mongoose from "mongoose";

const NewsSchema = new mongoose.Schema(
  {
    // Title fields (matching admin panel)
    title: { type: String, required: true, trim: true },
    articleTitle: { type: String, trim: true },
    en_articleTitle: { type: String, trim: true },
    coloredHeading: { type: String, trim: true },
    restHeading: { type: String, trim: true },
    slug: { type: String, unique: true, index: true, sparse: true },

    // Content fields
    summary: String,
    excerpt: String, // Alternative to summary
    content: { type: mongoose.Schema.Types.Mixed }, // Can be string or EditorJS JSON object

    // Source
    source: {
      id: String,
      name: { type: String },
      url: String,
    },

    // Author (can be string or object)
    author: { type: mongoose.Schema.Types.Mixed },

    url: { type: String, required: true, unique: false },
    imageUrl: String,
    coverImage: String, // Alternative to imageUrl
    videoUrl: String,
    video: String, // Alternative to videoUrl
    featuredImages: [{ type: String }],

    publishedAt: { type: Date, required: true },
    fetchedAt: { type: Date, default: Date.now },

    language: { type: String, default: "en", index: true },
    country: { type: String, index: true },

    // Categories (can be array of strings or ObjectIds)
    categories: [{ type: mongoose.Schema.Types.Mixed, index: true }],
    category: { type: mongoose.Schema.Types.Mixed }, // Single category (for compatibility)

    tags: [{ type: String }],
    highlightedTag: { type: String },

    // Scheduling
    isScheduled: { type: Boolean, default: false },
    schedulePublication: { type: Boolean, default: false },
    scheduledDateTime: { type: Date },
    scheduledDate: { type: String },
    scheduledTime: { type: String },
    publicationDate: { type: Date },

    // Trending
    trendingTopic: { type: Boolean, default: false },
    trandingTopicRef: { type: mongoose.Schema.Types.Mixed }, // Can be string, array, or null

    // News type
    newsType: {
      type: String,
      enum: ["live", "top", "normal"],
      default: "normal"
    },
    Live: { type: Boolean, default: false },
    Top: { type: Boolean, default: false },
    topNews: { type: Boolean, default: false },
    pinToTop: { type: Boolean, default: false },

    // Location
    state: { type: mongoose.Schema.Types.Mixed }, // Can be string or ObjectId
    city: { type: mongoose.Schema.Types.Mixed }, // Can be string or ObjectId
    location: { type: String },

    // Breaking news
    isBreaking: { type: Boolean, default: false },
    breakingNews: { type: Boolean, default: false },

    // Live updates
    liveNewsUpdates: [{
      content: { type: String },
      timestamp: { type: Date, default: Date.now },
      updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    }],
    liveNewsStartedAt: { type: Date },
    liveUpdates: [{ type: mongoose.Schema.Types.Mixed }], // Fallback

    // Notification
    issendNotification: { type: Boolean, default: false },

    sentiment: {
      score: { type: Number, min: -1, max: 1 },
      label: {
        type: String,
        enum: ["positive", "neutral", "negative"],
      },
    },

    entities: {
      persons: [String],
      organizations: [String],
      locations: [String],
    },

    stats: {
      views: { type: Number, default: 0 },
      likes: { type: Number, default: 0 },
      shares: { type: Number, default: 0 },
    },

    // Track which users interacted with the news
    userInteractions: {
      viewedBy: [
        {
          user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
          viewedAt: { type: Date, default: Date.now },
        },
      ],
      likedBy: [
        {
          user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
          likedAt: { type: Date, default: Date.now },
        },
      ],
      sharedBy: [
        {
          user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
          sharedAt: { type: Date, default: Date.now },
        },
      ],
    },

    isPremium: { type: Boolean, default: false },

    // Comments
    comments: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        text: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
        replies: [
          {
            user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
            text: { type: String, required: true },
            createdAt: { type: Date, default: Date.now },
          },
        ],
      },
    ],

    status: {
      type: String,
      enum: ["active", "deleted", "blocked", "published", "draft"],
      default: "active",
    },
  },
  {
    timestamps: true,
  }
);

/* Full Text Search */
NewsSchema.index({
  title: "text",
  articleTitle: "text",
  en_articleTitle: "text",
  summary: "text",
  excerpt: "text",
  content: "text",
});

/* 🚀 Performance Indexes */
NewsSchema.index({ publishedAt: -1 });
NewsSchema.index({ "source.name": 1 });
NewsSchema.index({ isBreaking: 1, breakingNews: 1, status: 1 });
NewsSchema.index({ status: 1 });
NewsSchema.index({ language: 1, country: 1 });
NewsSchema.index({ Live: 1, Top: 1 });
NewsSchema.index({ state: 1, city: 1 });
NewsSchema.index({ schedulePublication: 1, scheduledDateTime: 1 });
NewsSchema.index({ trendingTopic: 1 });
NewsSchema.index({ newsType: 1 });

/*
 * Indexes for per-user interaction lookups.
 * The repository performs has-interacted / track queries filtered by
 * { _id, 'userInteractions.<type>By.user': userId }. Without these multikey
 * indexes those filters scan the embedded arrays. These index the embedded
 * `user` fields so the lookups stay O(log n) while the arrays remain on the
 * document. (A full move of per-user interactions into a dedicated
 * NewsInteraction collection — the longer-term remedy — spans newsRepository.js
 * and newsService.js and is out of scope for this single-file change.)
 */
NewsSchema.index({ "userInteractions.viewedBy.user": 1 });
NewsSchema.index({ "userInteractions.likedBy.user": 1 });
NewsSchema.index({ "userInteractions.sharedBy.user": 1 });

const News = mongoose.model("News", NewsSchema);
export default News;
