import NewsService from "../service/newsService.js";
import { initRedis } from "../config/redisClient.js";
import mongoose from "mongoose";
import dns from "dns";
import net from "net";

// Determine whether a resolved IP address falls inside a private, loopback,
// link-local or otherwise non-routable range that should never be reached via
// a user-supplied URL (SSRF protection).
const isPrivateIp = (ip) => {
  const type = net.isIP(ip);
  if (type === 4) {
    const parts = ip.split(".").map((p) => parseInt(p, 10));
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
    const [a, b] = parts;
    if (a === 127) return true; // 127.0.0.0/8 loopback
    if (a === 10) return true; // 10.0.0.0/8 private
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 private
    if (a === 192 && b === 168) return true; // 192.168.0.0/16 private
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local + metadata
    if (a === 0) return true; // 0.0.0.0/8
    return false;
  }
  if (type === 6) {
    const lower = ip.toLowerCase();
    if (lower === "::1" || lower === "::") return true; // loopback / unspecified
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // fc00::/7 unique-local
    if (lower.startsWith("fe80")) return true; // link-local
    // IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1)
    const mapped = lower.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIp(mapped[1]);
    return false;
  }
  // Unknown / unparseable -> treat as unsafe
  return true;
};

// Validate a user-supplied WordPress URL to prevent Server-Side Request
// Forgery. Enforces an http(s) scheme, blocks obvious metadata/loopback
// hostnames, and resolves the hostname rejecting private/loopback/link-local
// IP ranges. Returns the validated URL string or throws an Error.
const validateWordPressUrl = async (rawUrl) => {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch (e) {
    throw new Error("Invalid WordPress API URL");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http(s) WordPress API URLs are allowed");
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");

  // Block obvious internal / metadata hostnames outright.
  const blockedHosts = ["localhost", "metadata.google.internal"];
  if (
    blockedHosts.includes(hostname) ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".local")
  ) {
    throw new Error("WordPress API URL host is not allowed");
  }

  // If host is already a literal IP, check it directly.
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new Error("WordPress API URL host is not allowed");
    }
    return parsed.toString();
  }

  // Resolve DNS and reject if any resolved address is private/loopback/etc.
  let addresses;
  try {
    addresses = await dns.promises.lookup(hostname, { all: true });
  } catch (e) {
    throw new Error("Unable to resolve WordPress API URL host");
  }

  if (!addresses || addresses.length === 0) {
    throw new Error("Unable to resolve WordPress API URL host");
  }

  for (const { address } of addresses) {
    if (isPrivateIp(address)) {
      throw new Error("WordPress API URL host is not allowed");
    }
  }

  return parsed.toString();
};

// Helper function to generate image URL from file path
const generateImageUrl = (filePath, req) => {
  const normalizedPath = filePath.replace(/\\/g, "/");
  const uploadsIndex = normalizedPath.indexOf("uploads/");

  if (uploadsIndex !== -1) {
    const relativePath = normalizedPath.substring(uploadsIndex);
    const pathParts = relativePath.split("/");
    const filename = pathParts.pop();
    const directory = pathParts.join("/");
    const encodedFilename = encodeURIComponent(filename);
    const encodedPath = `${directory}/${encodedFilename}`;

    const protocol = req.protocol || "http";
    const host = req.get("host") || "localhost:5000";
    return `${protocol}://${host}/${encodedPath}`;
  }
  return `/${normalizedPath}`;
};



export const getAllCategories = async (req, res) => {
  try {
    const categories = await NewsService.getDistinctCategories();

    return res.status(200).json({
      success: true,
      message: "Categories retrieved successfully",
      data: categories,
      count: categories.length,
    });
  } catch (error) {
    console.error("Get All Categories Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to retrieve categories",
    });
  }
};


const cleanImageUrl = (url) => {
  if (!url) return null;

  // If it's already relative (starts with /uploads), return as is
  if (url.startsWith("/uploads/")) {
    return url;
  }

  // If it's a full URL (http/https), strip the domain part
  if (url.startsWith("http://") || url.startsWith("https://")) {
    try {
      const parsed = new URL(url);
      let path = parsed.pathname;

      // Optional: query params ya hash remove kar do agar nahi chahiye
      // path = path.split('?')[0];

      // Ensure it starts with /uploads
      if (path.startsWith("/uploads/")) {
        return path;
      }

      // Fallback: agar uploads nahi mila to bhi relative return kar do
      return path.startsWith("/") ? path : `/${path}`;
    } catch (e) {
      // Invalid URL, return as is or null
      return url;
    }
  }

  // Any other case (relative but without leading /uploads?), normalize
  const normalized = url.replace(/\\/g, "/");
  if (normalized.startsWith("uploads/")) {
    return `/${normalized}`;
  }

  return url.startsWith("/") ? url : `/${url}`;
};

export const createNews = async (req, res) => {
  try {
    // Handle main image upload
    let imageUrl = req.body.imageUrl; // Allow imageUrl from body if no file uploaded

    if (req.file && req.file.fieldname === "image") {
      // Main image from single upload (fallback)
      imageUrl = generateImageUrl(req.file.path, req);
    } else if (req.files && req.files.image && req.files.image[0]) {
      // Main image from fields upload (multer.fields())
      imageUrl = generateImageUrl(req.files.image[0].path, req);
    }

    // Handle content - Editor.js block format with images
    let contentData = req.body.content || "";
    const contentImageUrls = [];

    // Parse content if it's a JSON string (Editor.js format)
    let contentBlocks = null;
    if (typeof contentData === "string") {
      // Remove extra quotes if wrapped
      if (contentData.startsWith('"') && contentData.endsWith('"')) {
        try {
          contentData = JSON.parse(contentData);
        } catch (e) {
          contentData = contentData.replace(/^"|"$/g, "");
        }
      }

      // Try to parse as JSON (Editor.js format)
      if (
        contentData.trim().startsWith("{") ||
        contentData.trim().startsWith("[")
      ) {
        try {
          contentBlocks = JSON.parse(contentData);
        } catch (e) {
          // If parsing fails, treat as plain text
          contentBlocks = null;
        }
      }
    } else if (typeof contentData === "object") {
      // Already an object
      contentBlocks = contentData;
    }

    // Check for content files (images) uploaded with field name 'content'
    let contentFiles = [];
    if (req.files && req.files.content) {
      contentFiles = Array.isArray(req.files.content)
        ? req.files.content
        : [req.files.content];
    } else if (Array.isArray(req.files)) {
      contentFiles = req.files.filter((f) => f.fieldname === "content");
    }

    // Process content image files and create image blocks
    if (contentFiles.length > 0) {
      contentFiles.forEach((file) => {
        const imageUrl = generateImageUrl(file.path, req);
        contentImageUrls.push(imageUrl);

        // Create image block in Editor.js format
        const imageBlock = {
          type: "image",
          data: {
            url: imageUrl,
            caption: file.originalname || "",
            withBorder: false,
            withBackground: false,
            stretched: false,
          },
        };

        // Add image block to content structure
        if (
          contentBlocks &&
          contentBlocks.blocks &&
          Array.isArray(contentBlocks.blocks)
        ) {
          // If content is already in Editor.js format, add image block
          contentBlocks.blocks.push(imageBlock);
        } else if (contentBlocks && Array.isArray(contentBlocks)) {
          // If content is array of blocks
          contentBlocks.push(imageBlock);
        } else {
          // Create new Editor.js structure
          if (!contentBlocks) {
            contentBlocks = {
              time: Date.now(),
              blocks: [],
            };
          }
          if (!contentBlocks.blocks) {
            contentBlocks.blocks = [];
          }
          contentBlocks.blocks.push(imageBlock);
        }
      });
    }

    // If contentBlocks is null but we have text content, create paragraph blocks
    if (
      !contentBlocks &&
      contentData &&
      typeof contentData === "string" &&
      contentData.trim()
    ) {
      const textContent = contentData.replace(/^"|"$/g, "").trim();
      if (textContent) {
        contentBlocks = {
          time: Date.now(),
          blocks: [
            {
              type: "paragraph",
              data: {
                text: textContent,
              },
            },
          ],
        };
      }
    }

    // If no content at all, create empty structure
    if (!contentBlocks) {
      contentBlocks = {
        time: Date.now(),
        blocks: [],
      };
    }

    // Ensure time is set
    if (!contentBlocks.time) {
      contentBlocks.time = Date.now();
    }

    // Convert content blocks to JSON string for storage
    const content =
      typeof contentBlocks === "string"
        ? contentBlocks
        : JSON.stringify(contentBlocks);

    // Parse JSON fields if they are strings (from form-data)
    let source = req.body.source;
    let author = req.body.author;
    let sentiment = req.body.sentiment;
    let entities = req.body.entities;
    let categories = req.body.categories;
    let tags = req.body.tags;

    // Parse JSON strings to objects if needed
    if (typeof source === "string" && source.trim().startsWith("{")) {
      try {
        source = JSON.parse(source);
      } catch (e) {
        // If parsing fails, keep as is
      }
    }
    if (typeof author === "string" && author.trim().startsWith("{")) {
      try {
        author = JSON.parse(author);
      } catch (e) {
        // If parsing fails, keep as is
      }
    }
    if (typeof sentiment === "string" && sentiment.trim().startsWith("{")) {
      try {
        sentiment = JSON.parse(sentiment);
      } catch (e) {
        // If parsing fails, keep as is
      }
    }
    if (typeof entities === "string" && entities.trim().startsWith("{")) {
      try {
        entities = JSON.parse(entities);
      } catch (e) {
        // If parsing fails, keep as is
      }
    }
    if (typeof categories === "string") {
      try {
        categories = JSON.parse(categories);
      } catch (e) {
        // If parsing fails, treat as comma-separated string
        categories = categories
          .split(",")
          .map((c) => c.trim())
          .filter((c) => c);
      }
    }
    if (typeof tags === "string") {
      try {
        tags = JSON.parse(tags);
      } catch (e) {
        // If parsing fails, treat as comma-separated string
        tags = tags
          .split(",")
          .map((t) => t.trim())
          .filter((t) => t);
      }
    }

    // Helper function to clean string values from form-data
    const cleanString = (value) => {
      if (typeof value !== "string") return value;
      // Remove surrounding quotes if present
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        try {
          return JSON.parse(value);
        } catch (e) {
          return value.replace(/^["']|["']$/g, "");
        }
      }
      return value;
    };

    // Handle video upload
    let videoUrl = req.body.videoUrl;
    if (req.files && req.files.video && req.files.video[0]) {
      videoUrl = generateImageUrl(req.files.video[0].path, req);
    }

    // Handle coloredHeading and restHeading
    const coloredHeading = cleanString(req.body.coloredHeading || "");
    const restHeading = cleanString(req.body.restHeading || "");
    const fullTitle = cleanString(req.body.title) ||
      (coloredHeading.trim() + " " + restHeading.trim()).trim();

    // Handle articleTitle and en_articleTitle
    const articleTitle = cleanString(req.body.articleTitle || fullTitle);
    const en_articleTitle = cleanString(req.body.en_articleTitle || articleTitle);

    // Handle excerpt (alternative to summary)
    const excerpt = cleanString(req.body.excerpt || req.body.summary || "");

    // Handle author (can be string or object)
    let authorData = author;
    if (typeof req.body.author === "string" && !req.body.author.trim().startsWith("{")) {
      authorData = { name: req.body.author };
    }

    // Handle scheduledDateTime
    let scheduledDateTime = null;
    if (req.body.scheduledDateTime) {
      scheduledDateTime = new Date(req.body.scheduledDateTime);
    } else if (req.body.scheduledDate && req.body.scheduledTime) {
      scheduledDateTime = new Date(`${req.body.scheduledDate}T${req.body.scheduledTime}`);
    }

    // Handle publicationDate
    let publicationDate = null;
    if (req.body.publicationDate) {
      publicationDate = new Date(req.body.publicationDate);
    }

    // Handle trendingTopicRef (can be string, array, or null)
    let trandingTopicRef = req.body.trandingTopicRef;
    if (typeof trandingTopicRef === "string") {
      try {
        trandingTopicRef = JSON.parse(trandingTopicRef);
      } catch (e) {
        // Keep as string if not JSON
      }
    }

    // Handle state and city (can be strings or ObjectIds)
    let state = req.body.state;
    let city = req.body.city;
    if (typeof state === "string" && mongoose.Types.ObjectId.isValid(state)) {
      state = new mongoose.Types.ObjectId(state);
    }
    if (typeof city === "string" && mongoose.Types.ObjectId.isValid(city)) {
      city = new mongoose.Types.ObjectId(city);
    }

    const newsData = {
      title: fullTitle,
      articleTitle: articleTitle,
      en_articleTitle: en_articleTitle,
      coloredHeading: coloredHeading,
      restHeading: restHeading,
      slug: cleanString(req.body.slug),
      summary: cleanString(req.body.summary || excerpt),
      excerpt: excerpt,
      content: content, // Already processed
      source: source,
      author: authorData,
      url: cleanString(req.body.url) || fullTitle,
      imageUrl: imageUrl || cleanString(req.body.imageUrl),
      coverImage: imageUrl || cleanString(req.body.coverImage) || cleanString(req.body.imageUrl),
      videoUrl: videoUrl || cleanString(req.body.videoUrl),
      video: videoUrl || cleanString(req.body.video) || cleanString(req.body.videoUrl),
      publishedAt: req.body.publishedAt
        ? new Date(req.body.publishedAt)
        : publicationDate || new Date(),
      fetchedAt: req.body.fetchedAt ? new Date(req.body.fetchedAt) : new Date(),
      language: req.body.language || "en",
      country: cleanString(req.body.country),
      categories: categories || [],
      category: categories && categories.length > 0 ? categories[0] : null,
      tags: tags || [],
      highlightedTag: cleanString(req.body.highlightedTag),
      // Scheduling
      isScheduled: req.body.isScheduled === true || req.body.isScheduled === "true" || req.body.isScheduled === "1",
      schedulePublication: req.body.schedulePublication === true || req.body.schedulePublication === "true" || req.body.schedulePublication === "1" || (scheduledDateTime !== null),
      scheduledDateTime: scheduledDateTime,
      scheduledDate: req.body.scheduledDate,
      scheduledTime: req.body.scheduledTime,
      publicationDate: publicationDate,
      // Trending
      trendingTopic: req.body.trendingTopic === true || req.body.trendingTopic === "true" || req.body.trendingTopic === "1",
      trandingTopicRef: trandingTopicRef,
      // News type
      newsType: req.body.newsType || "normal",
      Live: req.body.Live === true || req.body.Live === "true" || req.body.Live === "1",
      Top: req.body.Top === true || req.body.Top === "true" || req.body.Top === "1",
      topNews: req.body.topNews === true || req.body.topNews === "true" || req.body.topNews === "1",
      pinToTop: req.body.pinToTop === true || req.body.pinToTop === "true" || req.body.pinToTop === "1",
      // Location
      state: state,
      city: city,
      location: cleanString(req.body.location),
      // Breaking news
      isBreaking: req.body.isBreaking === true || req.body.isBreaking === "true" || req.body.isBreaking === "1",
      breakingNews: req.body.breakingNews === true || req.body.breakingNews === "true" || req.body.breakingNews === "1",
      // Notification
      issendNotification: req.body.issendNotification === true || req.body.issendNotification === "true" || req.body.issendNotification === "1",
      sentiment: sentiment,
      entities: entities,
      stats: req.body.stats,
      isPremium:
        req.body.isPremium === true ||
        req.body.isPremium === "true" ||
        req.body.isPremium === "1",
      status: req.body.status || "active",
    };

    const news = await NewsService.create(newsData);

    // Clear cache
    const redis = await initRedis();
    await redis.del("news:*");

    // Convert to plain object if needed
    let newsResponse = news;
    if (news && news.toObject) {
      newsResponse = news.toObject();
    } else if (news && typeof news.toJSON === "function") {
      newsResponse = news.toJSON();
    }

    // Parse content if it's stored as JSON string
    let parsedContent = newsResponse.content || content;
    if (typeof parsedContent === "string") {
      try {
        parsedContent = JSON.parse(parsedContent);
      } catch (e) {
        // If parsing fails, keep as string
      }
    }

    // Reorder response to put contentImages right after content
    const orderedResponse = {};

    // Copy all properties before 'content'
    Object.keys(newsResponse).forEach((key) => {
      if (key !== "content" && key !== "contentImages") {
        orderedResponse[key] = newsResponse[key];
      }
    });

    // Add content (as parsed object if it's Editor.js format)
    orderedResponse.content = parsedContent;

    // Add contentImages right after content
    orderedResponse.contentImages = contentImageUrls || [];

    // Copy remaining properties after contentImages
    Object.keys(newsResponse).forEach((key) => {
      if (
        key !== "content" &&
        key !== "contentImages" &&
        !orderedResponse.hasOwnProperty(key)
      ) {
        orderedResponse[key] = newsResponse[key];
      }
    });

    return res.status(201).json({
      success: true,
      message: "News created successfully",
      data: orderedResponse,
    });
  } catch (error) {
    console.error("Create News Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create news",
    });
  }
};

// Add comment to news
export const addComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { comment } = req.body;
    const userId = req.user._id;

    if (!comment) {
      return res.status(400).json({
        success: false,
        message: "Comment text is required",
      });
    }

    const populatedNews = await NewsService.addComment(id, userId, comment);

    res.status(200).json({
      success: true,
      message: "Comment added successfully",
      data: populatedNews,
    });
  } catch (error) {
    console.error("Add comment error:", error);
    res.status(error.message === "News not found" ? 404 : 500).json({
      success: false,
      message: "Failed to add comment",
      error: error.message,
    });
  }
};

// Add reply to comment
export const addReply = async (req, res) => {
  try {
    const { id, commentId } = req.params;
    const { text } = req.body;
    const userId = req.user._id;

    if (!text) {
      return res.status(400).json({
        success: false,
        message: "Reply text is required",
      });
    }

    const populatedNews = await NewsService.addReply(id, commentId, userId, text);

    res.status(200).json({
      success: true,
      message: "Reply added successfully",
      data: populatedNews,
    });
  } catch (error) {
    console.error("Add reply error:", error);
    res.status(error.message === "News not found" || error.message === "Comment not found" ? 404 : 500).json({
      success: false,
      message: "Failed to add reply",
      error: error.message,
    });
  }
};

// Delete comment
export const deleteComment = async (req, res) => {
  try {
    const { id, commentId } = req.params;
    const userId = req.user._id;
    const userRole = req.user.role; // Assuming role is populated in req.user

    const populatedNews = await NewsService.deleteComment(id, commentId, userId, userRole);

    res.status(200).json({
      success: true,
      message: "Comment deleted successfully",
      data: populatedNews,
    });
  } catch (error) {
    console.error("Delete comment error:", error);
    res.status(error.message === "Unauthorized to delete this comment" ? 403 : error.message === "News not found" || error.message === "Comment not found" ? 404 : 500).json({
      success: false,
      message: "Failed to delete comment",
      error: error.message,
    });
  }
};

// Get comments for a news article
export const getComments = async (req, res) => {
  try {
    const { id } = req.params;
    const comments = await NewsService.getComments(id);

    res.status(200).json({
      success: true,
      data: comments,
    });
  } catch (error) {
    console.error("Get comments error:", error);
    res.status(error.message === "News not found" ? 404 : 500).json({
      success: false,
      message: "Failed to fetch comments",
      error: error.message,
    });
  }
};

export const getAllNews = async (req, res) => {
  try {
    const {
      page,
      limit,
      sortBy,
      sortOrder,
      search,
      q, // Alternative search param
      category,
      state,
      city,
      tag,
      language,
      country,
      isBreaking,
      breakingNews,
      status,
      live,
      Live,
      Top,
      topNews,
      trendingTopic,
    } = req.query;

    // SECURITY: clamp limit to prevent unauthenticated full-collection dumps
    // (DoS). Largest legitimate client request is 20 (mobile app news_bloc);
    // web apps use 10-12. Negative/NaN values fall back to the default.
    const parsedLimit = parseInt(limit);
    const limitNum = Math.min(parsedLimit > 0 ? parsedLimit : 10, 100);

    const options = {
      page: parseInt(page) || 1,
      limit: limitNum,
      sortBy: sortBy || "updatedAt",
      sortOrder: sortOrder || "desc",
      filter: {},
      search: search || q,
      category,
      state,
      city,
      tag,
      language,
      country,
      isBreaking: isBreaking || breakingNews,
      live: live || Live,
      Top: Top || topNews,
      trendingTopic,
      status: status || "active",
    };

    // Cache disabled - always fetch fresh data from database
    // const redis = await initRedis();
    // const cacheKey = `news:all:${JSON.stringify(options)}`;
    // const cached = await redis.get(cacheKey);

    // if (cached) {
    //   const cachedData = JSON.parse(cached);

    //   // Clean image URLs in cached data too (important for consistency)
    //   const cleanedData = {
    //     ...cachedData,
    //     data: cachedData.data.map(news => ({
    //       ...news,
    //       image: cleanImageUrl(news.image),
    //       // agar thumbnail, featuredImage ya multiple images ho to yahan add karo
    //       // thumbnail: cleanImageUrl(news.thumbnail),
    //     })),
    //   };

    //   return res.status(200).json({
    //     success: true,
    //     message: "News fetched from cache",
    //     data: cleanedData,
    //     fromCache: true,
    //   });
    // }

    let result = await NewsService.getAll(options);

    // Clean image URLs before sending response
    result = {
      ...result,
      data: result.data.map(news => ({
        ...news,
        image: cleanImageUrl(news.image),
        // thumbnail: cleanImageUrl(news.thumbnail), // agar hai to
        // images: news.images?.map(img => cleanImageUrl(img)), // array ho to
      })),
    };

    // Cache disabled - no longer caching results
    // await redis.setEx(cacheKey, 300, JSON.stringify(result)); // 5 minutes

    return res.status(200).json({
      success: true,
      message: "News retrieved successfully",
      data: result,
    });
  } catch (error) {
    console.error("Get All News Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to retrieve news",
    });
  }
};

// Helper function to ensure only relative path is returned


export const getNewsById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?._id;

    // Cache disabled - always fetch fresh data from database
    // const redis = await initRedis();
    // const cacheKey = `news:${id}`;
    // const cached = await redis.get(cacheKey);

    let news;
    // if (cached) {
    //   news = JSON.parse(cached);
    // } else {
    news = await NewsService.getById(id);
    // await redis.setEx(cacheKey, 300, JSON.stringify(news)); // Cache for 5 minutes
    // }

    // Track view and add user interaction status if user is authenticated
    if (userId) {
      try {
        // Track the view
        await NewsService.trackUserInteraction(id, "views", userId);

        // Get updated news with tracked view
        news = await NewsService.getById(id);

        // Get updated interaction status
        const interaction = await NewsService.checkUserInteraction(id, userId);
        news.userInteraction = interaction;

        // Cache disabled - no need to clear cache
        // await redis.del(cacheKey);
      } catch (err) {
        console.error("Error tracking view or checking user interaction:", err);

        try {
          const interaction = await NewsService.checkUserInteraction(
            id,
            userId
          );
          news.userInteraction = interaction;
        } catch (checkErr) {
          console.error("Error checking user interaction:", checkErr);
        }
      }
    } else {
      // Do not increment views for guests; only unique user views are tracked
    }

    // Populate user data in interactions
    news = await NewsService.populateUserInteractions(news);

    return res.status(200).json({
      success: true,
      message: "News retrieved successfully",
      data: news,
      fromCache: false,
    });
  } catch (error) {
    console.error("Get News By ID Error:", error);
    return res.status(error.message === "News not found" ? 404 : 500).json({
      success: false,
      message: error.message || "Failed to retrieve news",
    });
  }
};

export const getNewsBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const userId = req.user?._id;

    // Cache disabled - always fetch fresh data from database
    // const redis = await initRedis();
    // const cacheKey = `news:slug:${slug}`;
    // const cached = await redis.get(cacheKey);

    let news;
    // if (cached) {
    //   news = JSON.parse(cached);
    // } else {
    news = await NewsService.getBySlug(slug);
    // await redis.setEx(cacheKey, 300, JSON.stringify(news)); // Cache for 5 minutes
    // }

    // Increment views and track user if authenticated
    if (userId) {
      await NewsService.trackUserInteraction(news._id, "views", userId);
      // Get updated news with tracked view
      news = await NewsService.getBySlug(slug);
    } else {
      // Do not increment views for guests; only unique user views are tracked
    }

    // Add user interaction status if user is authenticated
    if (userId) {
      try {
        const interaction = await NewsService.checkUserInteraction(
          news._id,
          userId
        );
        news.userInteraction = interaction;
      } catch (err) {
        console.error("Error checking user interaction:", err);
      }
    }

    // Populate user data in interactions
    news = await NewsService.populateUserInteractions(news);

    // Cache disabled - no need to clear cache
    // await redis.del(cacheKey);

    return res.status(200).json({
      success: true,
      message: "News retrieved successfully",
      data: news,
    });
  } catch (error) {
    console.error("Get News By Slug Error:", error);
    return res.status(error.message === "News not found" ? 404 : 500).json({
      success: false,
      message: error.message || "Failed to retrieve news",
    });
  }
};

export const updateNews = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    // Handle image upload if file is present
    if (req.file && req.file.fieldname === "image") {
      // Main image from single upload
      updateData.imageUrl = generateImageUrl(req.file.path, req);
      updateData.coverImage = updateData.imageUrl;
    } else if (req.files && req.files.image && req.files.image[0]) {
      // Main image from fields upload (multer.fields())
      updateData.imageUrl = generateImageUrl(req.files.image[0].path, req);
      updateData.coverImage = updateData.imageUrl;
    } else if (req.body.imageUrl) {
      // Use imageUrl from body if no file uploaded
      updateData.imageUrl = req.body.imageUrl;
      updateData.coverImage = req.body.coverImage || req.body.imageUrl;
    } else if (req.body.coverImage) {
      updateData.imageUrl = req.body.coverImage;
      updateData.coverImage = req.body.coverImage;
    }

    // Handle video upload
    if (req.files && req.files.video && req.files.video[0]) {
      updateData.videoUrl = generateImageUrl(req.files.video[0].path, req);
      updateData.video = updateData.videoUrl;
    } else if (req.body.videoUrl) {
      updateData.video = req.body.video || req.body.videoUrl;
    }

    // Handle content - EditorJS block format
    if (req.body.content) {
      let contentData = req.body.content;
      if (typeof contentData === "string") {
        if (contentData.trim().startsWith("{") || contentData.trim().startsWith("[")) {
          try {
            updateData.content = JSON.parse(contentData);
          } catch (e) {
            updateData.content = contentData;
          }
        } else {
          updateData.content = contentData;
        }
      } else {
        updateData.content = contentData;
      }
    }

    // Parse JSON fields if they are strings (from form-data)
    if (typeof updateData.source === "string" && updateData.source.trim().startsWith("{")) {
      try {
        updateData.source = JSON.parse(updateData.source);
      } catch (e) {
        // If parsing fails, keep as is
      }
    }
    if (typeof updateData.author === "string" && updateData.author.trim().startsWith("{")) {
      try {
        updateData.author = JSON.parse(updateData.author);
      } catch (e) {
        // If parsing fails, keep as is
      }
    }
    if (typeof updateData.sentiment === "string" && updateData.sentiment.trim().startsWith("{")) {
      try {
        updateData.sentiment = JSON.parse(updateData.sentiment);
      } catch (e) {
        // If parsing fails, keep as is
      }
    }
    if (typeof updateData.entities === "string" && updateData.entities.trim().startsWith("{")) {
      try {
        updateData.entities = JSON.parse(updateData.entities);
      } catch (e) {
        // If parsing fails, keep as is
      }
    }
    if (typeof updateData.categories === "string") {
      try {
        updateData.categories = JSON.parse(updateData.categories);
      } catch (e) {
        // If parsing fails, treat as comma-separated string
        updateData.categories = updateData.categories
          .split(",")
          .map((c) => c.trim())
          .filter((c) => c);
      }
    }
    if (typeof updateData.tags === "string") {
      try {
        updateData.tags = JSON.parse(updateData.tags);
      } catch (e) {
        // If parsing fails, treat as comma-separated string
        updateData.tags = updateData.tags
          .split(",")
          .map((t) => t.trim())
          .filter((t) => t);
      }
    }

    // Helper function to clean string values from form-data
    const cleanString = (value) => {
      if (typeof value !== "string") return value;
      // Remove surrounding quotes if present
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        try {
          return JSON.parse(value);
        } catch (e) {
          return value.replace(/^["']|["']$/g, "");
        }
      }
      return value;
    };

    // Handle coloredHeading and restHeading
    if (req.body.coloredHeading !== undefined) {
      updateData.coloredHeading = cleanString(req.body.coloredHeading);
    }
    if (req.body.restHeading !== undefined) {
      updateData.restHeading = cleanString(req.body.restHeading);
    }
    if (req.body.coloredHeading || req.body.restHeading) {
      const coloredHeading = cleanString(req.body.coloredHeading || "");
      const restHeading = cleanString(req.body.restHeading || "");
      updateData.title = cleanString(req.body.title) ||
        (coloredHeading.trim() + " " + restHeading.trim()).trim();
    }

    // Handle articleTitle and en_articleTitle
    if (req.body.articleTitle !== undefined) {
      updateData.articleTitle = cleanString(req.body.articleTitle);
    }
    if (req.body.en_articleTitle !== undefined) {
      updateData.en_articleTitle = cleanString(req.body.en_articleTitle);
    }

    // Handle excerpt
    if (req.body.excerpt !== undefined) {
      updateData.excerpt = cleanString(req.body.excerpt);
    }

    // Clean string values
    if (updateData.title) updateData.title = cleanString(updateData.title);
    if (updateData.summary) updateData.summary = cleanString(updateData.summary);
    if (updateData.url) updateData.url = cleanString(updateData.url);
    if (updateData.videoUrl) updateData.videoUrl = cleanString(updateData.videoUrl);
    if (updateData.country) updateData.country = cleanString(updateData.country);
    if (updateData.highlightedTag) updateData.highlightedTag = cleanString(updateData.highlightedTag);

    // Handle author (can be string or object)
    if (req.body.author !== undefined) {
      if (typeof req.body.author === "string" && !req.body.author.trim().startsWith("{")) {
        updateData.author = { name: req.body.author };
      }
    }

    // Handle state and city (can be strings or ObjectIds)
    if (req.body.state !== undefined) {
      const state = req.body.state;
      updateData.state = mongoose.Types.ObjectId.isValid(state)
        ? new mongoose.Types.ObjectId(state)
        : state;
    }
    if (req.body.city !== undefined) {
      const city = req.body.city;
      updateData.city = mongoose.Types.ObjectId.isValid(city)
        ? new mongoose.Types.ObjectId(city)
        : city;
    }

    // Handle scheduledDateTime
    if (req.body.scheduledDateTime) {
      updateData.scheduledDateTime = new Date(req.body.scheduledDateTime);
      updateData.schedulePublication = true;
    }

    // Handle trendingTopicRef
    if (req.body.trandingTopicRef !== undefined) {
      let trandingTopicRef = req.body.trandingTopicRef;
      if (typeof trandingTopicRef === "string") {
        try {
          trandingTopicRef = JSON.parse(trandingTopicRef);
        } catch (e) {
          // Keep as string if not JSON
        }
      }
      updateData.trandingTopicRef = trandingTopicRef;
    }

    // Convert boolean strings to booleans
    if (updateData.isBreaking !== undefined || req.body.breakingNews !== undefined) {
      updateData.isBreaking =
        updateData.isBreaking === true ||
        updateData.isBreaking === "true" ||
        updateData.isBreaking === "1" ||
        req.body.breakingNews === true ||
        req.body.breakingNews === "true" ||
        req.body.breakingNews === "1";
      updateData.breakingNews = updateData.isBreaking;
    }
    if (updateData.isScheduled !== undefined) {
      updateData.isScheduled =
        updateData.isScheduled === true ||
        updateData.isScheduled === "true" ||
        updateData.isScheduled === "1";
    }
    if (updateData.schedulePublication !== undefined) {
      updateData.schedulePublication =
        updateData.schedulePublication === true ||
        updateData.schedulePublication === "true" ||
        updateData.schedulePublication === "1";
    }
    if (req.body.trendingTopic !== undefined) {
      updateData.trendingTopic =
        req.body.trendingTopic === true ||
        req.body.trendingTopic === "true" ||
        req.body.trendingTopic === "1";
    }
    if (req.body.Live !== undefined) {
      updateData.Live =
        req.body.Live === true ||
        req.body.Live === "true" ||
        req.body.Live === "1";
    }
    if (req.body.Top !== undefined || req.body.topNews !== undefined) {
      const topValue =
        req.body.Top === true ||
        req.body.Top === "true" ||
        req.body.Top === "1" ||
        req.body.topNews === true ||
        req.body.topNews === "true" ||
        req.body.topNews === "1";
      updateData.Top = topValue;
      updateData.topNews = topValue;
    }
    if (req.body.pinToTop !== undefined) {
      updateData.pinToTop =
        req.body.pinToTop === true ||
        req.body.pinToTop === "true" ||
        req.body.pinToTop === "1";
    }
    if (req.body.issendNotification !== undefined) {
      updateData.issendNotification =
        req.body.issendNotification === true ||
        req.body.issendNotification === "true" ||
        req.body.issendNotification === "1";
    }
    if (req.body.newsType) {
      updateData.newsType = req.body.newsType;
    }
    if (updateData.isPremium !== undefined) {
      updateData.isPremium =
        updateData.isPremium === true ||
        updateData.isPremium === "true" ||
        updateData.isPremium === "1";
    }

    // Convert date strings to Date objects
    if (updateData.publishedAt) {
      updateData.publishedAt = new Date(updateData.publishedAt);
    }
    if (updateData.fetchedAt) {
      updateData.fetchedAt = new Date(updateData.fetchedAt);
    }
    if (req.body.publicationDate) {
      updateData.publicationDate = new Date(req.body.publicationDate);
    }

    const news = await NewsService.update(id, updateData);

    // Clear cache
    const redis = await initRedis();
    await redis.del(`news:${id}`);
    await redis.del(`news:slug:${news.slug}`);
    await redis.del("news:*");

    // Convert to plain object if needed
    let newsResponse = news;
    if (news && news.toObject) {
      newsResponse = news.toObject();
    } else if (news && typeof news.toJSON === "function") {
      newsResponse = news.toJSON();
    }

    return res.status(200).json({
      success: true,
      message: "News updated successfully",
      data: newsResponse,
    });
  } catch (error) {
    console.error("Update News Error:", error);
    return res.status(error.message === "News not found" ? 404 : 500).json({
      success: false,
      message: error.message || "Failed to update news",
    });
  }
};

export const deleteNews = async (req, res) => {
  try {
    const { id } = req.params;

    const news = await NewsService.delete(id);

    // Clear cache
    const redis = await initRedis();
    await redis.del(`news:${id}`);
    if (news.slug) {
      await redis.del(`news:slug:${news.slug}`);
    }
    await redis.del("news:*");

    return res.status(200).json({
      success: true,
      message: "News deleted successfully",
      data: news,
    });
  } catch (error) {
    console.error("Delete News Error:", error);
    return res.status(error.message === "News not found" ? 404 : 500).json({
      success: false,
      message: error.message || "Failed to delete news",
    });
  }
};

export const searchNews = async (req, res) => {
  try {
    const { q, limit, status } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        message: "Search query is required",
      });
    }

    // Handle both string and array inputs
    // If q is an array (multiple query params with same name), join them with spaces
    let searchQuery = q;
    if (Array.isArray(q)) {
      searchQuery = q.join(" ");
    } else if (typeof q !== "string") {
      searchQuery = String(q);
    }

    // Trim and validate
    searchQuery = searchQuery.trim();
    if (!searchQuery) {
      return res.status(400).json({
        success: false,
        message: "Search query cannot be empty",
      });
    }

    const results = await NewsService.search(searchQuery, {
      limit: parseInt(limit) || 20,
      status: status || undefined, // Only pass status if provided
    });

    return res.status(200).json({
      success: true,
      message: "News search completed",
      data: results,
    });
  } catch (error) {
    console.error("Search News Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to search news",
    });
  }
};

export const incrementNewsStats = async (req, res) => {
  try {
    const { id } = req.params;
    const { type, userId: bodyUserId } = req.body; // 'views', 'likes', or 'shares', and optional userId from body
    const userId = req.user?._id || bodyUserId; // Get user ID from authenticated request or request body

    if (!["views", "likes", "shares"].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid stat type. Must be views, likes, or shares",
      });
    }

    // Track user interaction if user ID is provided (from auth or body)
    let news;
    if (userId) {
      news = await NewsService.trackUserInteraction(id, type, userId);
    } else {
      // Do not increment views for guests; only unique user views are tracked
      if (type === "likes") {
        news = await NewsService.incrementLikes(id);
      } else if (type === "shares") {
        news = await NewsService.incrementShares(id);
      }
    }

    // Convert to plain object if it's a Mongoose document
    if (news && news.toObject) {
      news = news.toObject();
    } else if (news && typeof news.toJSON === "function") {
      news = news.toJSON();
    }

    // Populate user data in interactions
    if (news) {
      news = await NewsService.populateUserInteractions(news);
    }

    // Clear cache for this news item
    const redis = await initRedis();
    await redis.del(`news:${id}`);
    if (news?.slug) {
      await redis.del(`news:slug:${news.slug}`);
    }

    return res.status(200).json({
      success: true,
      message: `News ${type} incremented successfully`,
      data: news,
    });
  } catch (error) {
    console.error("Increment News Stats Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to increment news stats",
    });
  }
};

export const likeNews = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required to like news",
      });
    }

    // Track like interaction
    let news = await NewsService.trackUserInteraction(id, "likes", userId);

    // Convert to plain object if it's a Mongoose document
    if (news && news.toObject) {
      news = news.toObject();
    } else if (news && typeof news.toJSON === "function") {
      news = news.toJSON();
    }

    // Populate user data in interactions
    if (news) {
      news = await NewsService.populateUserInteractions(news);
    }

    // Clear cache
    const redis = await initRedis();
    await redis.del(`news:${id}`);
    if (news?.slug) {
      await redis.del(`news:slug:${news.slug}`);
    }

    return res.status(200).json({
      success: true,
      message: "News liked successfully",
      data: news,
      isLiked: true,
    });
  } catch (error) {
    console.error("Like News Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to like news",
    });
  }
};

export const unlikeNews = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required to unlike news",
      });
    }

    // Remove like interaction
    let news = await NewsService.removeUserInteraction(id, "likes", userId);

    // Convert to plain object if it's a Mongoose document
    if (news && news.toObject) {
      news = news.toObject();
    } else if (news && typeof news.toJSON === "function") {
      news = news.toJSON();
    }

    // Populate user data in interactions
    if (news) {
      news = await NewsService.populateUserInteractions(news);
    }

    // Clear cache
    const redis = await initRedis();
    await redis.del(`news:${id}`);
    if (news?.slug) {
      await redis.del(`news:slug:${news.slug}`);
    }

    return res.status(200).json({
      success: true,
      message: "News unliked successfully",
      data: news,
      isLiked: false,
    });
  } catch (error) {
    console.error("Unlike News Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to unlike news",
    });
  }
};

export const toggleLike = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required to like news",
      });
    }

    // Check if user already liked
    const interaction = await NewsService.checkUserInteraction(id, userId);

    let news;
    if (interaction.hasLiked) {
      // Unlike - remove interaction
      news = await NewsService.removeUserInteraction(id, "likes", userId);
    } else {
      // Like - add interaction
      news = await NewsService.trackUserInteraction(id, "likes", userId);
    }

    // Populate user data in interactions
    news = await NewsService.populateUserInteractions(news);

    // Clear cache
    const redis = await initRedis();
    await redis.del(`news:${id}`);
    if (news?.slug) {
      await redis.del(`news:slug:${news.slug}`);
    }

    return res.status(200).json({
      success: true,
      message: interaction.hasLiked
        ? "News unliked successfully"
        : "News liked successfully",
      data: news,
      isLiked: !interaction.hasLiked,
    });
  } catch (error) {
    console.error("Toggle Like Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to toggle like",
    });
  }
};

export const viewNews = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required to track view",
      });
    }

    // Track view interaction
    let news = await NewsService.trackUserInteraction(id, "views", userId);

    // Populate user data in interactions
    news = await NewsService.populateUserInteractions(news);

    // Clear cache
    const redis = await initRedis();
    await redis.del(`news:${id}`);
    if (news?.slug) {
      await redis.del(`news:slug:${news.slug}`);
    }

    return res.status(200).json({
      success: true,
      message: "News view tracked successfully",
      data: news,
      hasViewed: true,
    });
  } catch (error) {
    console.error("View News Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to track view",
    });
  }
};

export const shareNews = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required to share news",
      });
    }

    // Track share interaction
    let news = await NewsService.trackUserInteraction(id, "shares", userId);

    // Populate user data in interactions
    news = await NewsService.populateUserInteractions(news);

    // Clear cache
    const redis = await initRedis();
    await redis.del(`news:${id}`);
    if (news?.slug) {
      await redis.del(`news:slug:${news.slug}`);
    }

    return res.status(200).json({
      success: true,
      message: "News shared successfully",
      data: news,
      hasShared: true,
    });
  } catch (error) {
    console.error("Share News Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to share news",
    });
  }
};

// New endpoints with userId in URL
export const likeNewsByUserId = async (req, res) => {
  try {
    const { id, userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    // Track like interaction
    let news = await NewsService.trackUserInteraction(id, "likes", userId);

    // Convert to plain object if it's a Mongoose document
    if (news && news.toObject) {
      news = news.toObject();
    } else if (news && typeof news.toJSON === "function") {
      news = news.toJSON();
    }

    // Populate user data in interactions
    if (news) {
      news = await NewsService.populateUserInteractions(news);
    }

    // Clear cache
    const redis = await initRedis();
    await redis.del(`news:${id}`);
    if (news?.slug) {
      await redis.del(`news:slug:${news.slug}`);
    }

    return res.status(200).json({
      success: true,
      message: "News liked successfully",
      data: news,
      isLiked: true,
    });
  } catch (error) {
    console.error("Like News By User ID Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to like news",
    });
  }
};

export const viewNewsByUserId = async (req, res) => {
  try {
    const { id, userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    // Track view interaction
    let news = await NewsService.trackUserInteraction(id, "views", userId);

    // Convert to plain object if it's a Mongoose document
    if (news && news.toObject) {
      news = news.toObject();
    } else if (news && typeof news.toJSON === "function") {
      news = news.toJSON();
    }

    // Populate user data in interactions
    if (news) {
      news = await NewsService.populateUserInteractions(news);
    }

    // Clear cache
    const redis = await initRedis();
    await redis.del(`news:${id}`);
    if (news?.slug) {
      await redis.del(`news:slug:${news.slug}`);
    }

    return res.status(200).json({
      success: true,
      message: "News view tracked successfully",
      data: news,
      hasViewed: true,
    });
  } catch (error) {
    console.error("View News By User ID Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to track view",
    });
  }
};

export const shareNewsByUserId = async (req, res) => {
  try {
    const { id, userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    // Track share interaction
    let news = await NewsService.trackUserInteraction(id, "shares", userId);

    // Convert to plain object if it's a Mongoose document
    if (news && news.toObject) {
      news = news.toObject();
    } else if (news && typeof news.toJSON === "function") {
      news = news.toJSON();
    }

    // Populate user data in interactions
    if (news) {
      news = await NewsService.populateUserInteractions(news);
    }

    // Clear cache
    const redis = await initRedis();
    await redis.del(`news:${id}`);
    if (news?.slug) {
      await redis.del(`news:slug:${news.slug}`);
    }

    return res.status(200).json({
      success: true,
      message: "News shared successfully",
      data: news,
      hasShared: true,
    });
  } catch (error) {
    console.error("Share News By User ID Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to share news",
    });
  }
};

export const getUsersWhoViewed = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const result = await NewsService.getUserInteractions(id, "views", {
      page: parseInt(page),
      limit: parseInt(limit),
    });

    return res.status(200).json({
      success: true,
      message: "Users who viewed this news retrieved successfully",
      data: result,
    });
  } catch (error) {
    console.error("Get Users Who Viewed Error:", error);
    return res.status(error.message === "News not found" ? 404 : 500).json({
      success: false,
      message: error.message || "Failed to retrieve users who viewed",
    });
  }
};

export const getUsersWhoLiked = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const result = await NewsService.getUserInteractions(id, "likes", {
      page: parseInt(page),
      limit: parseInt(limit),
    });

    return res.status(200).json({
      success: true,
      message: "Users who liked this news retrieved successfully",
      data: result,
    });
  } catch (error) {
    console.error("Get Users Who Liked Error:", error);
    return res.status(error.message === "News not found" ? 404 : 500).json({
      success: false,
      message: error.message || "Failed to retrieve users who liked",
    });
  }
};

export const getUsersWhoShared = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const result = await NewsService.getUserInteractions(id, "shares", {
      page: parseInt(page),
      limit: parseInt(limit),
    });

    return res.status(200).json({
      success: true,
      message: "Users who shared this news retrieved successfully",
      data: result,
    });
  } catch (error) {
    console.error("Get Users Who Shared Error:", error);
    return res.status(error.message === "News not found" ? 404 : 500).json({
      success: false,
      message: error.message || "Failed to retrieve users who shared",
    });
  }
};

export const checkUserInteractionStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const interaction = await NewsService.checkUserInteraction(id, userId);

    return res.status(200).json({
      success: true,
      message: "User interaction status retrieved successfully",
      data: interaction,
    });
  } catch (error) {
    console.error("Check User Interaction Status Error:", error);
    return res.status(error.message === "News not found" ? 404 : 500).json({
      success: false,
      message: error.message || "Failed to check user interaction status",
    });
  }
};

export const uploadContentImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No image file provided",
      });
    }

    // Extract relative path from uploads directory
    const filePath = req.file.path.replace(/\\/g, "/"); // Replace backslashes with forward slashes for Windows

    // Find the 'uploads' directory in the path and extract everything after it
    const uploadsIndex = filePath.indexOf("uploads/");
    if (uploadsIndex !== -1) {
      const relativePath = filePath.substring(uploadsIndex);

      // Split path into directory and filename to encode filename separately
      const pathParts = relativePath.split("/");
      const filename = pathParts.pop(); // Get the filename
      const directory = pathParts.join("/"); // Get the directory path

      // URL encode the filename to handle spaces and special characters
      const encodedFilename = encodeURIComponent(filename);
      const encodedPath = `${directory}/${encodedFilename}`;

      // Get base URL from request or use default
      const protocol = req.protocol || "http";
      const host = req.get("host") || "localhost:5000";
      const imageUrl = `${protocol}://${host}/${encodedPath}`;

      return res.status(200).json({
        success: true,
        message: "Content image uploaded successfully",
        data: {
          url: imageUrl,
          filename: filename,
        },
      });
    } else {
      return res.status(500).json({
        success: false,
        message: "Failed to process uploaded file",
      });
    }
  } catch (error) {
    console.error("Upload Content Image Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to upload content image",
    });
  }
};

// Upload content video endpoint
export const uploadContentVideo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No video file provided",
      });
    }

    // Extract relative path from uploads directory
    const filePath = req.file.path.replace(/\\/g, "/"); // Replace backslashes with forward slashes for Windows

    // Find the 'uploads' directory in the path and extract everything after it
    const uploadsIndex = filePath.indexOf("uploads/");
    if (uploadsIndex !== -1) {
      const relativePath = filePath.substring(uploadsIndex);

      // Split path into directory and filename to encode filename separately
      const pathParts = relativePath.split("/");
      const filename = pathParts.pop(); // Get the filename
      const directory = pathParts.join("/"); // Get the directory path

      // URL encode the filename to handle spaces and special characters
      const encodedFilename = encodeURIComponent(filename);
      const encodedPath = `${directory}/${encodedFilename}`;

      // Get base URL from request or use default
      const protocol = req.protocol || "http";
      const host = req.get("host") || "localhost:5000";
      const videoUrl = `${protocol}://${host}/${encodedPath}`;

      return res.status(200).json({
        success: true,
        message: "Content video uploaded successfully",
        data: {
          url: videoUrl,
          path: `/${encodedPath}`,
          filename: filename,
        },
      });
    } else {
      return res.status(500).json({
        success: false,
        message: "Failed to process uploaded file",
      });
    }
  } catch (error) {
    console.error("Upload Content Video Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to upload content video",
    });
  }
};

// EditorJS image upload endpoint - returns format expected by EditorJS
export const uploadEditorImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: 0,
        message: "No image file provided",
      });
    }

    // Extract relative path from uploads directory
    const filePath = req.file.path.replace(/\\/g, "/");

    // Find the 'uploads' directory in the path and extract everything after it
    const uploadsIndex = filePath.indexOf("uploads/");
    if (uploadsIndex !== -1) {
      const relativePath = filePath.substring(uploadsIndex);

      // Split path into directory and filename to encode filename separately
      const pathParts = relativePath.split("/");
      const filename = pathParts.pop();
      const directory = pathParts.join("/");

      // URL encode the filename to handle spaces and special characters
      const encodedFilename = encodeURIComponent(filename);
      const encodedPath = `${directory}/${encodedFilename}`;

      // Get base URL from request or use default
      const protocol = req.protocol || "http";
      const host = req.get("host") || "localhost:5000";
      const imageUrl = `${protocol}://${host}/${encodedPath}`;

      // Return EditorJS expected format
      return res.status(200).json({
        success: 1,
        file: {
          url: imageUrl,
          name: filename || req.file.originalname,
        },
      });
    } else {
      return res.status(500).json({
        success: 0,
        message: "Failed to process uploaded file",
      });
    }
  } catch (error) {
    console.error("Upload Editor Image Error:", error);
    return res.status(500).json({
      success: 0,
      message: error.message || "Failed to upload image",
    });
  }
};

export const fetchWordPressNews = async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        message: "WordPress API URL is required",
      });
    }

    // SSRF protection: validate scheme, block internal hosts, and resolve the
    // hostname rejecting private/loopback/link-local/metadata IP ranges before
    // the URL is passed to the fetch sink.
    let safeUrl;
    try {
      safeUrl = await validateWordPressUrl(url);
    } catch (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError.message || "Invalid WordPress API URL",
      });
    }

    const result = await NewsService.fetchFromWordPress(safeUrl, 500);

    // Clear cache
    const redis = await initRedis();
    await redis.del("news:*");

    return res.status(200).json({
      success: true,
      message: "News fetched and processed from WordPress",
      data: result,
    });
  } catch (error) {
    console.error("Fetch WordPress News Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch WordPress news",
    });
  }
};

