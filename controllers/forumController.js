// Get all threads created by the authenticated user
export const getMyThreads = async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 10, sortBy = "createdAt", sortOrder = "desc" } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const threads = await ForumThread.find({ createdBy: userId })
      .sort({ [sortBy]: sortOrder === "asc" ? 1 : -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('createdBy', '_id fullName email')
      .populate('courseId', 'title');
    const total = await ForumThread.countDocuments({ createdBy: userId });
    res.status(200).json({
      success: true,
      threads,
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / limit)
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
import ForumService from "../service/forumService.js";
import { initRedis } from "../config/redisClient.js";
import ForumThread from "../models/ForumThread.js";
import ForumReply from "../models/ForumReply.js";
import User from "../models/user.js"; // Add this import
import notificationService from "../service/notificationService.js";
import notification from "../utils/notificationService.js"
import fcmTokenss from "../models/fcmTokens.js";
import Notification from "../models/Notifications.js";

const forumService = new ForumService();

// Thread Controllers
export const createThread = async (req, res) => {
  try {
    const threadData = {
      ...req.body,
      createdBy: req.user._id,
      attachments:
        req.files?.map((file) => ({
          type: file.path || file.filename,
          originalName: file.originalname,
          fileType: file.mimetype,
        })) || [],
    };
    //console.log("Creating thread with data:", threadData);

    const thread = await forumService.createThread(threadData);



    const redis = await initRedis();
    await redis.del(`forum:threads:${threadData.courseId}*`);

    res
      .status(201)
      .json({ success: true, message: "Thread created", data: thread });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getAllThreads = async (req, res) => {
  try {
    const { courseId } = req.params;
    const {
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
      tag,
    } = req.query;

    const options = {
      courseId,
      page: parseInt(page),
      limit: parseInt(limit),
      sortBy,
      sortOrder,
      tag,
      isApproved: true, // Only show approved threads
    };

    const cacheKey = `forum:threads:${courseId}:${JSON.stringify(options)}`;
    const redis = await initRedis();
    const cached = await redis.get(cacheKey);

    if (cached) {
      return res.status(200).json({
        success: true,
        message: "Threads from cache",
        ...JSON.parse(cached),
        fromCache: true,
      });
    }

    const threads = await forumService.getAllThreads(options);

    // Filter out threads by shadowbanned users
    const shadowbannedUsers = await User.find({ isShadowBanned: true }).select('_id');
    const shadowIds = shadowbannedUsers.map(u => u._id.toString());
    const filteredThreads = (threads.data || threads).filter(t => !shadowIds.includes(t.createdBy?._id?.toString()));

    // Filter likes array for each thread
    for (const thread of filteredThreads) {
      if (thread.likes && Array.isArray(thread.likes)) {
        thread.likes = thread.likes.filter(likeUser =>
          !shadowIds.includes(likeUser?._id?.toString())
        );
        thread.likeCount = thread.likes.length;
      }
    }

    const total = filteredThreads.length;
    await redis.setEx(cacheKey, 300, JSON.stringify({ ...threads, data: filteredThreads }));

    res.status(200).json({
      success: true,
      message: "Threads fetched",
      threads: filteredThreads,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getThreadById = async (req, res) => {
  try {
    const { id } = req.params;

    const redis = await initRedis();
    const cached = await redis.get(`forum:thread:${id}`);

    if (cached) {
      return res.status(200).json({
        success: true,
        data: JSON.parse(cached),
        fromCache: true,
      });
    }

    const thread = await forumService.getThreadById(id);
    // If thread is null (shadowbanned), return not found
    if (!thread) {
      return res
        .status(404)
        .json({ success: false, message: "Thread not found or unavailable" });
    }

    // Filter likes array
    const shadowbannedUsers = await User.find({ isShadowBanned: true }).select('_id');
    const shadowIds = shadowbannedUsers.map(u => u._id.toString());
    if (thread.likes && Array.isArray(thread.likes)) {
      thread.likes = thread.likes.filter(likeUser =>
        !shadowIds.includes(likeUser?._id?.toString())
      );
      thread.likeCount = thread.likes.length;
    }

    await redis.setEx(`forum:thread:${id}`, 300, JSON.stringify(thread));
    res.status(200).json({ success: true, data: thread });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updateThread = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const isAdmin = req.user.role === 'admin';

    const threadData = {
      ...req.body,
    };

    // Only update attachments if new files are uploaded
    if (req.files && req.files.length > 0) {
      threadData.attachments = req.files.map((file) => ({
        type: file.path || file.filename,
        originalName: file.originalname,
        fileType: file.mimetype,
      }));
    }

    const updated = await forumService.updateThread(id, threadData, userId, isAdmin);

    // Clear comprehensive Redis cache
    const redis = await initRedis();
    await redis.del(`forum:thread:${id}`);
    await redis.del(`forum:thread:admin:${id}`);
    await redis.del(`forum:threads:${updated.courseId}*`);
    await redis.del(`forum:threads:*`);
    await redis.del(`forum:replies:${id}*`);
    
    // Clear tag-related cache
    const cacheKey = updated.courseId
      ? `forum:tags:${updated.courseId}`
      : 'forum:tags:all';
    await redis.del(cacheKey);

    res
      .status(200)
      .json({ success: true, message: "Thread updated", data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteThread = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const isAdmin = req.user.role === "admin";

    const deleted = await forumService.deleteThread(id, userId, isAdmin);

    const redis = await initRedis();
    await redis.del(`forum:threads:*`);
    await redis.del(`forum:thread:${id}`);

    res
      .status(200)
      .json({ success: true, message: "Thread deleted", data: deleted });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const pinThread = async (req, res) => {
  try {
    //console.log("📦 Headers:", req.headers);
    //console.log("📦 Content-Type:", req.get("content-type"));
    //console.log("📦 Body:", req.body);

    const { id } = req.params;
    const { isPinned } = req.body;

    const updated = await forumService.pinThread(id, isPinned);

    const redis = await initRedis();
    await redis.del(`forum:threads:*`);
    await redis.del(`forum:thread:${id}`);

    res.status(200).json({
      success: true,
      message: "Thread pin status updated",
      data: updated,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const likeThread = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const result = await forumService.likeThread(id, userId);
    
    // Notify thread creator about the like
    const thread = await ForumThread.findById(id).populate("createdBy", "fullName email");
    // //console.log("📦 Thread:", thread);
    if (thread) {
      const fcmTokens = await fcmTokenss.findOne({ userId: thread.createdBy._id });
      // console?.log("fc", fcmTokens)
      if (fcmTokens) {
        //console.log("📦 FCM Tokens:", fcmTokens.token);
        const likeNotification = {
          title: "Your Thread Was Liked",
          description: `Your thread titled "${thread.title}" received a new like.`,
          type: "forum_like",
          data_id: thread._id,
        };
        const notificationResult = await notification.sendPushNotification(fcmTokens.token, likeNotification);
        // Save notification

        //console.log("Notification Result:", notificationResult);
        if (notificationResult.success) {

          const notification = new Notification({
            data: likeNotification,
            status: 0,
            user_id: thread.createdBy._id,
          });
          await notification.save();

          // Optionally, you can log the saved notification
          //console.log("📦 Notification saved:", notification);
        }
      }
    }

    const redis = await initRedis();
    await redis.del(`forum:thread:${id}`);

    res
      .status(200)
      .json({ success: true, message: result.message, data: result.thread });
  } catch (err) {
    // If shadowbanned user tries to like/unlike
    if (err.message && err.message.includes('Shadowbanned users')) {
      return res.status(403).json({ success: false, message: err.message });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

export const searchThreads = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { q, tag, page = 1, limit = 10 } = req.query;

    if (!q && !tag) {
      return res
        .status(400)
        .json({ success: false, message: "Search query or tag required" });
    }

    const options = {
      courseId,
      query: q,
      tag,
      page: parseInt(page),
      limit: parseInt(limit),
    };

    const results = await forumService.searchThreads(options);
    res
      .status(200)
      .json({ success: true, message: "Search completed", ...results });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Reply Controllers
export const createReply = async (req, res) => {
  try {
    const { id: threadId } = req.params;
    const replyData = {
      ...req.body,
      threadId,
      repliedBy: req.user._id,
      attachments:
        req.files?.map((file) => ({
          type: file.path || file.filename,
          originalName: file.originalname,
          fileType: file.mimetype,
        })) || [],
    };

    const reply = await forumService.createReply(replyData);

    // Notify thread creator about the new reply
    const thread = await ForumThread.findById(threadId).populate("createdBy", "fullName email ");
    //console.log("📦 Thread:", thread);
    if (thread) {
      const fcmTokens = await fcmTokenss.findOne({ userId: thread.createdBy._id });
      console?.log("fc", fcmTokens)
      if (fcmTokens) {
        //console.log("📦 FCM Tokens:", fcmTokens.token);
        const replyNotification = {
          title: "New Reply to Your Thread",
          description: `Your thread titled "${thread.title}" has received a new reply.`,
          type: "forum_reply",
          data_id: thread._id,
        };
        const notificationResult = await notification.sendPushNotification(fcmTokens.token, replyNotification);
        // Save notification
        if (notificationResult.success) {
          const notification = new Notification({
            data: replyNotification,
            status: 0,
            user_id: thread.createdBy._id,
          });
          await notification.save();

          // Optionally, you can log the saved notification
          //console.log("📦 Notification saved:", notification);
        }
      }
    }

    const redis = await initRedis();
    await redis.del(`forum:replies:${threadId}*`);

    res
      .status(201)
      .json({ success: true, message: "Reply created", data: reply });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getReplies = async (req, res) => {
  try {
    const { id: threadId } = req.params;
    const { page = 1, limit = 20, sortOrder = "asc" } = req.query;

    const options = {
      threadId,
      page: parseInt(page),
      limit: parseInt(limit),
      sortOrder,
    };
    const replies = await forumService.getReplies(options);

    const shadowbannedUsers = await User.find({ isShadowBanned: true }).select('_id');
    const shadowIds = shadowbannedUsers.map(u => u._id.toString());
    const loggedInUserId = req.user?._id.toString();

    console?.log("Shadowbanned User IDs:", shadowIds);
    console?.log("Logged-in User ID:", loggedInUserId);

    const filteredReplies = replies.data.filter(reply => {
      const replyUserId = reply.repliedBy?._id?.toString();
      const isReplyByShadowUser = shadowIds.includes(replyUserId);
      const isReplyByLoggedInUser = replyUserId === loggedInUserId;

      console?.log("Reply ID:", reply._id);
      console?.log("Reply By User ID:", replyUserId);
      console?.log("Is Reply By Shadow User:", isReplyByShadowUser);
      console?.log("Is Reply By Logged-In User:", isReplyByLoggedInUser);

      return !isReplyByShadowUser || isReplyByLoggedInUser;
    });

    // Filter likes and nestedReplies
    filteredReplies.forEach(reply => {
      if (reply.likes && Array.isArray(reply.likes)) {
        reply.likes = reply.likes.filter(likeUser =>
          !shadowIds.includes(likeUser?._id?.toString())
        );
        reply.likeCount = reply.likes.length;
      }
      if (reply.nestedReplies) {
        reply.nestedReplies = reply.nestedReplies.filter(nr => {
          const nestedReplyUserId = nr.repliedBy?._id?.toString();
          const isNestedReplyByShadowUser = shadowIds.includes(nestedReplyUserId);
          const isNestedReplyByLoggedInUser = nestedReplyUserId === loggedInUserId;

          console?.log("Nested Reply ID:", nr._id);
          console?.log("Nested Reply By User ID:", nestedReplyUserId);
          console?.log("Is Nested Reply By Shadow User:", isNestedReplyByShadowUser);
          console?.log("Is Nested Reply By Logged-In User:", isNestedReplyByLoggedInUser);

          return !isNestedReplyByShadowUser || isNestedReplyByLoggedInUser;
        });
        reply.nestedReplies.forEach(nr => {
          if (nr.likes && Array.isArray(nr.likes)) {
            nr.likes = nr.likes.filter(likeUser =>
              !shadowIds.includes(likeUser?._id?.toString())
            );
            nr.likeCount = nr.likes.length;
          }
        });
      }
    });

    res.status(200).json({
      success: true,
      message: "Replies fetched",
      data: filteredReplies,
      page,
      limit,
      total: replies.total,
      totalPages: replies.totalPages,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updateReply = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const replyData = {
      ...req.body,
    };

    // Only update attachments if new files are uploaded
    if (req.files && req.files.length > 0) {
      replyData.attachments = req.files.map((file) => ({
        type: file.path || file.filename,
        originalName: file.originalname,
        fileType: file.mimetype,
      }));
    }

    const updated = await forumService.updateReply(id, replyData, userId);

    const redis = await initRedis();
    await redis.del(`forum:replies:*`);

    res
      .status(200)
      .json({ success: true, message: "Reply updated", data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteReply = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const isAdmin = req.user.role === "admin";

    const deleted = await forumService.deleteReply(id, userId, isAdmin);

    const redis = await initRedis();
    await redis.del(`forum:replies:*`);

    res
      .status(200)
      .json({ success: true, message: "Reply deleted", data: deleted });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const likeReply = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const result = await forumService.likeReply(id, userId);

    const redis = await initRedis();
    await redis.del(`forum:replies:*`);

    res
      .status(200)
      .json({ success: true, message: result.message, data: result.reply });
  } catch (err) {
    // If shadowbanned user tries to like/unlike
    if (err.message && err.message.includes('Shadowbanned users')) {
      return res.status(403).json({ success: false, message: err.message });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getAllThreadsWithReplies = async (req, res) => {
  try {
    let { isApproved } = req.query;
    if (typeof isApproved === 'undefined') {
      isApproved = true;
    } else if (isApproved === 'all') {
      isApproved = undefined;
    } else if (isApproved === 'true') {
      isApproved = true;
    } else if (isApproved === 'false') {
      isApproved = false;
    }

    // SECURITY: clamp limit before it reaches the repository, which multiplies
    // it by 3 and fans out per-thread/per-reply populate queries (DoS vector).
    // Largest legitimate client request is 50 (admin panel page-size dropdown
    // on this endpoint); web/mobile apps use 10. Negative/NaN fall back to 10.
    const parsedLimit = parseInt(req.query.limit);
    req.query.limit = Math.min(parsedLimit > 0 ? parsedLimit : 10, 50);

    const threadsResult = await forumService.getAllThreadsWithReplies({
      ...req.query,
      isApproved
    });

    //console.log("getAllThreadsWithReplies - User Role:", req?.user);

    if (!req?.user) {
      const openSourceThreads = threadsResult.threads.filter(
        t => t.Is_openSource === true
      );
      
      // Slice to requested limit
      const requestedLimit = parseInt(req.query.limit) || 10;
      const limitedThreads = openSourceThreads.slice(0, requestedLimit);

      return res.status(200).json({
        success: true,
        message: "Public open-source forum threads with replies fetched",
        data: { ...threadsResult, threads: limitedThreads },
      });
    }
    

    // If the user is an admin, return all threads (but still limit to requested amount)
    if (req?.user?.role === "admin") {
      const requestedLimit = parseInt(req.query.limit) || 10;
      const limitedThreads = threadsResult.threads.slice(0, requestedLimit);
      
      return res.status(200).json({
        success: true,
        message: "All forum threads with replies fetched",
        data: { ...threadsResult, threads: limitedThreads },
      });
    }

    const shadowbannedUsers = await User.find({ isShadowBanned: true }).select('_id');
    const shadowIds = shadowbannedUsers.map(u => u._id.toString());
    const loggedInUserId = req.user?._id.toString();

    //console.log("Shadowbanned User IDs:", shadowIds);
    //console.log("Logged-in User ID:", loggedInUserId);

    const filteredThreads = threadsResult.threads.filter(t => {
      const isShadowBanned = shadowIds.includes(t.createdBy?._id?.toString());
      const isOwnPost = t.createdBy?._id?.toString() === loggedInUserId;

      return !isShadowBanned || isOwnPost;
    });

    // Slice to requested limit after filtering to ensure correct pagination
    const requestedLimit = parseInt(req.query.limit) || 10;
    const limitedThreads = filteredThreads.slice(0, requestedLimit);

    //console.log("Filtered Threads Count:", filteredThreads.length, "Limited to:", limitedThreads.length);

    // Filter likes, replies, and nestedReplies
    filteredThreads.forEach(thread => {
      if (thread.likes && Array.isArray(thread.likes)) {
        thread.likes = thread.likes.filter(likeUser =>
          !shadowIds.includes(likeUser?._id?.toString())
        );
        thread.likeCount = thread.likes.length;
      }
      
      if (thread.replies) {
        //console.log(`Processing replies for thread ID: ${thread._id}`);
        
        // FIXED: Filter replies - hide shadowbanned users' replies EXCEPT if it's the logged-in user's own reply
        thread.replies = thread.replies.filter(r => {
          const replyUserId = r.repliedBy?._id?.toString();
          const isReplyByShadowUser = shadowIds.includes(replyUserId);
          const isOwnReply = replyUserId === loggedInUserId;

          //console.log(`Reply ID: ${r._id}, Reply User: ${replyUserId}, IsShadowBanned: ${isReplyByShadowUser}, IsOwnReply: ${isOwnReply}`);

          // Show the reply if:
          // 1. It's NOT by a shadowbanned user, OR
          // 2. It's by a shadowbanned user but it's the logged-in user's own reply
          const shouldShow = !isReplyByShadowUser || isOwnReply;
          
          if (!shouldShow) {
            //console.log(`Excluding reply ID: ${r._id} by shadow-banned user.`);
          }

          return shouldShow;
        });

        //console.log(`Filtered Replies Count for thread ID ${thread._id}: ${thread.replies.length}`);

        // Process each remaining reply
        thread.replies.forEach(reply => {
          // Filter likes in replies
          if (reply.likes && Array.isArray(reply.likes)) {
            reply.likes = reply.likes.filter(likeUser =>
              !shadowIds.includes(likeUser?._id?.toString())
            );
            reply.likeCount = reply.likes.length;
          }
          
          // Filter nested replies
          if (reply.nestedReplies) {
            //console.log(`Processing nested replies for reply ID: ${reply._id}`);
            
            reply.nestedReplies = reply.nestedReplies.filter(nr => {
              const nestedReplyUserId = nr.repliedBy?._id?.toString();
              const isNestedReplyByShadowUser = shadowIds.includes(nestedReplyUserId);
              const isOwnNestedReply = nestedReplyUserId === loggedInUserId;

              //console.log(`Nested Reply ID: ${nr._id}, User: ${nestedReplyUserId}, IsShadowBanned: ${isNestedReplyByShadowUser}, IsOwnReply: ${isOwnNestedReply}`);

              // Show the nested reply if:
              // 1. It's NOT by a shadowbanned user, OR
              // 2. It's by a shadowbanned user but it's the logged-in user's own nested reply
              const shouldShow = !isNestedReplyByShadowUser || isOwnNestedReply;

              if (!shouldShow) {
                //console.log(`Excluding nested reply ID: ${nr._id} by shadow-banned user.`);
              }

              return shouldShow;
            });

            //console.log(`Filtered Nested Replies Count for reply ID ${reply._id}: ${reply.nestedReplies.length}`);

            // Filter likes in nested replies
            reply.nestedReplies.forEach(nr => {
              if (nr.likes && Array.isArray(nr.likes)) {
                nr.likes = nr.likes.filter(likeUser =>
                  !shadowIds.includes(likeUser?._id?.toString())
                );
                nr.likeCount = nr.likes.length;
              }
            });
          }
        });
      }
    });

    res.status(200).json({
      success: true,
      message: "All forum threads with replies fetched",
      data: { ...threadsResult, threads: limitedThreads },
    });
  } catch (error) {
    console.error("getAllThreadsWithReplies error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const getAllTags = async (req, res) => {
  try {
    const { courseId } = req.query;

    const cacheKey = courseId
      ? `forum:tags:${courseId}`
      : 'forum:tags:all';

    const redis = await initRedis();
    const cached = await redis.get(cacheKey);

    // if (cached) {
    //   return res.status(200).json({
    //     success: true,
    //     message: "Tags fetched from cache",
    //     data: JSON.parse(cached),
    //     fromCache: true,
    //   });
    // }

    const tags = await forumService.getAllTags(courseId);

    await redis.setEx(cacheKey, 600, JSON.stringify(tags)); // Cache for 10 minutes

    res.status(200).json({
      success: true,
      message: "Tags fetched successfully",
      data: tags,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};
export const filterThreadsByTags = async (req, res) => {
  try {
    let { tags, courseId, page = 1, limit = 10, sortBy = "createdAt", sortOrder = "desc" } = req.query;

    // Validate tags
    if (!tags || tags.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Tags parameter is required"
      });
    }

    // Ensure numbers
    page = parseInt(page) || 1;
    limit = parseInt(limit) || 10;
    const skip = (page - 1) * limit;

    // Prepare formatted tags for case-insensitive match
    const formattedTags = tags
      .split(",")
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);

    // Tags are stored as array and lowercase (e.g. ["#feedback", "#seo"])
    // Match tags case-insensitively, handling "#" prefix
    const tagConditions = formattedTags.map(tag => {
      // Ensure tag has "#" prefix and convert to lowercase (since DB stores lowercase)
      const tagWithHash = tag.startsWith("#") ? tag : `#${tag}`;
      const tagLowercase = tagWithHash.toLowerCase();
      // Escape special regex characters
      const escapedTag = tagLowercase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Match tag in array (MongoDB $regex on array matches any element)
      // Use exact match with case-insensitive option for safety
      return { tags: { $regex: `^${escapedTag}$`, $options: "i" } };
    });

    const query = { $or: tagConditions };
    if (courseId) query.course = courseId;


    


    query.isApproved = true; // Only approved threads
    query.Is_openSource = true; // Only open-source threads

    // Exclude threads by shadowbanned users in the query
    const shadowbannedUsers = await User.find({ isShadowBanned: true }).select('_id');
    if (shadowbannedUsers.length > 0) {
      query.createdBy = { $nin: shadowbannedUsers.map(u => u._id) };
    }

    // Get total count before pagination
    const total = await ForumThread.countDocuments(query);

    // Fetch threads
    const threads = await ForumThread.find(query)
      .sort({ [sortBy]: sortOrder.toLowerCase() === "asc" ? 1 : -1 })
      .skip(skip)
      .limit(limit)
      .populate("createdBy", "fullName email isShadowBanned")   // include isShadowBanned
      .populate("likes", "fullName email isShadowBanned")
      .populate("courseId", "title slug")
      .lean();

     
      
    

    // Filter likes array for each thread and add reply count and replies
    const shadowIds = shadowbannedUsers.map(u => u._id.toString());
    
    // Add reply count and fetch replies for each thread
    const threadsWithReplies = await Promise.all(
      threads.map(async (thread) => {
        // Filter likes
        if (thread.likes && Array.isArray(thread.likes)) {
          thread.likes = thread.likes.filter(likeUser =>
            !shadowIds.includes(likeUser?._id?.toString())
          );
          thread.likeCount = thread.likes.length;
        }

        // Get reply count
        const replyCount = await ForumReply.countDocuments({ 
          threadId: thread._id,
          parentReplyId: null // Only count top-level replies
        });
        thread.replyCount = replyCount;

        // Fetch replies (top-level only, similar to getAllThreadsWithReplies pattern)
        const replies = await ForumReply.find({ 
          threadId: thread._id, 
          parentReplyId: null 
        })
          .sort({ createdAt: 1 })
          .populate('repliedBy', 'fullName email isShadowBanned')
          .populate('likes', 'fullName email isShadowBanned')
          .lean();

        // Filter out replies by shadowbanned users
        const filteredReplies = replies.filter(reply => 
          !reply.repliedBy?.isShadowBanned && 
          !shadowIds.includes(reply.repliedBy?._id?.toString())
        );

        // Filter likes in replies
        filteredReplies.forEach(reply => {
          if (reply.likes && Array.isArray(reply.likes)) {
            reply.likes = reply.likes.filter(likeUser =>
              !shadowIds.includes(likeUser?._id?.toString())
            );
            reply.likeCount = reply.likes.length;
          } else {
            reply.likeCount = 0;
          }
        });

        thread.replies = filteredReplies;

        return thread;
      })
    );

    return res.status(200).json({
      success: true,
      message: "Threads filtered by tags successfully",
      data: threadsWithReplies,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });
  } catch (err) {
    console.error("filterThreadsByTags error:", err);
    return res.status(500).json({
      success: false,
      message: "Server Error"
    });
  }
};

export const approveThread = async (req, res) => {
  try {
    const { id } = req.params;
    const { isApproved } = req.body;

    if (typeof isApproved !== "boolean") {
      return res.status(400).json({ success: false, message: "isApproved must be boolean" });
    }

    const updated = await ForumThread.findByIdAndUpdate(
      id,
      { isApproved },
      { new: true }
    ).populate("createdBy", "fullName email isShadowBanned")
      .populate("courseId", "title slug")
      .lean();

    if (!updated) {
      return res.status(404).json({ success: false, message: "Thread not found" });
    }

    // Send notification to the thread creator
    const creatorNotification = {
      title: isApproved
        ? "Thread Approved"
        : "Thread Rejected",
      description: isApproved
        ? `Your thread titled "${updated.title}" has been approved and is now visible to the community.`
        : `Your thread titled "${updated.title}" has been rejected. Please review the guidelines and consider updating it before resubmitting.`,
      type: "forum_thread_status",
    };

    //console.log("👤 Notifying thread creator:", updated.createdBy);

    const fcmToken = await fcmTokenss.findOne({ userId: updated.createdBy._id });
    //console.log("📲 Found FCM token for user:", fcmToken);

    if (fcmToken) {
      const notiresponse = await notification.sendPushNotification(fcmToken.token, creatorNotification);
      //console.log("📲 Push notification response:", notiresponse);

      if (notiresponse.success) {
        // Fix: Pass creatorNotification object instead of undefined data
        const notificationDoc = new Notification({
          data: creatorNotification,
          status: 0,
          user_id: updated.createdBy._id,
        });
        await notificationDoc.save();
      }
    }
    
    // If approved, send notification to all users
    // if (isApproved) {
    //   const allUsersNotification = {
    //     title: "New Forum Thread Posted",
    //     description: `Check it out! A new thread titled "${updated.title}" has been posted in the forum.`,
    //     type: "forum_thread",
    //   };
    //   const notiresponse = await notificationService.sendToAllStudents(allUsersNotification);
    //   if (notiresponse.success) {
    //     const notificationDoc = new Notification({
    //       data: allUsersNotification,
    //       status: 0,
    //       user_id: updated.createdBy._id,
    //     });
    //     await notificationDoc.save();
    //   }
    // }

    res.status(200).json({
      success: true,
      message: `Thread approval updated to ${isApproved}`,
      data: updated,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updateThreadOpenSource = async (req, res) => {
  try {
    const { id } = req.params;
    const { Is_openSource } = req.body;

    if (typeof Is_openSource !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "Is_openSource must be a boolean",
      });
    }

    const updatedThread = await forumService.updateThreadOpenSource(id, Is_openSource);

    if (!updatedThread) {
      return res.status(404).json({ success: false, message: "Thread not found" });
    }

    // clear redis cache for threads of that course
    const redis = await initRedis();
    await redis.del(`forum:threads:${updatedThread.courseId}*`);

    res.status(200).json({
      success: true,
      message: "Thread open-source field updated successfully",
      data: updatedThread,
    });
  } catch (err) {
    console.error("updateThreadOpenSource error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getThreadByIdAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    const redis = await initRedis();

    // Check Redis cache first
    const cached = await redis.get(`forum:thread:admin:${id}`);
    if (cached) {
      return res.status(200).json({
        success: true,
        data: JSON.parse(cached),
        fromCache: true,
      });
    }

    // Fetch from DB
    const thread = await forumService.getThreadByIdAdmin(id);

    if (!thread) {
      return res
        .status(404)
        .json({ success: false, message: "Thread not found" });
    }

    // Cache for 5 minutes
    await redis.setEx(
      `forum:thread:admin:${id}`,
      300,
      JSON.stringify(thread)
    );

    return res.status(200).json({ success: true, data: thread });
  } catch (err) {
    console.error("getThreadByIdAdmin error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};