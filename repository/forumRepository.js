import ForumThread from '../models/ForumThread.js';
import ForumReply from '../models/ForumReply.js';
import User from '../models/user.js';
import { initRedis } from '../config/redisClient.js';

export default class ForumRepository {
  // Thread Repository Methods
  async createThread(data) {
    try {
      //console.log('ForumRepository.createThread called with data:', data);

      // Normalize tags before saving
      if (data.tags) {
        data.tags = data.tags.map(tag => tag.toLowerCase().trim());
      }

      const thread = await ForumThread.create(data);
      const populatedThread = await ForumThread.findById(thread._id)
        .populate('createdBy', '_id fullName email')
        .populate('courseId', 'title');

      // Clear Redis cache
      if (populatedThread) {
        const redis = await initRedis();
        await redis.del(`forum:threads:${populatedThread.courseId}*`);
        await redis.del(`forum:threads:*`);

        // Clear tag cache
        const tagCacheKey = populatedThread.courseId
          ? `forum:tags:${populatedThread.courseId}`
          : 'forum:tags:all';
        await redis.del(tagCacheKey);
      }

      //console.log('ForumRepository.createThread success:', populatedThread);
      return populatedThread;
    } catch (error) {
      console.error('ForumRepository.createThread error:', error);
      throw error;
    }
  }

  async updateThread(id, data) {
    try {
      //console.log('ForumRepository.updateThread called with id:', id, 'and data:', data);

      // Normalize tags before updating - handle both string and array formats
      if (data.tags) {
        if (typeof data.tags === 'string') {
          // If tags is a string, split by comma and clean up
          data.tags = data.tags.split(',').map(tag => tag.toLowerCase().trim()).filter(tag => tag.length > 0);
        } else if (Array.isArray(data.tags)) {
          // If tags is already an array, just normalize
          data.tags = data.tags.map(tag => tag.toLowerCase().trim()).filter(tag => tag.length > 0);
        }
      }

      const updatedThread = await ForumThread.findByIdAndUpdate(id, data, { new: true })
        .populate('createdBy', '_id fullName email')
        .populate('courseId', 'title');

      // Clear Redis cache
      if (updatedThread) {
        const redis = await initRedis();
        await redis.del(`forum:thread:${id}`);
        await redis.del(`forum:thread:admin:${id}`);
        await redis.del(`forum:threads:${updatedThread.courseId}*`);
        await redis.del(`forum:threads:*`);

        // Clear tag cache
        const tagCacheKey = updatedThread.courseId
          ? `forum:tags:${updatedThread.courseId}`
          : 'forum:tags:all';
        await redis.del(tagCacheKey);
      }

      //console.log('ForumRepository.updateThread success:', updatedThread);
      return updatedThread;
    } catch (error) {
      console.error('ForumRepository.updateThread error:', error);
      throw error;
    }
  }


  async findAllThreads({ courseId, page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc', tag }) {
    try {
      //console.log('ForumRepository.findAllThreads called with:', { courseId, page, limit, sortBy, sortOrder, tag });

      const query = { courseId };
      if (tag) {
        query.tags = { $in: [tag] };
      }

      // Exclude threads by shadowbanned users
      const shadowbannedUsers = await User.find({ isShadowBanned: true }).select('_id');
      if (shadowbannedUsers.length) {
        query.createdBy = { $nin: shadowbannedUsers.map(u => u._id) };
      }

      const skip = (page - 1) * limit;

      // Sort pinned threads first, then by the specified sort
      const sortObj = { isPinned: -1 };
      sortObj[sortBy] = sortOrder === 'asc' ? 1 : -1;

      query.isApproved = true;

      //console.log('ForumRepository.findAllThreads query:', query);

      const threads = await ForumThread.find(query)
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .populate('createdBy', '_id fullName profilePicture')
        .populate('courseId', 'title')
        .lean();

      // Add reply count to each thread using a single aggregate (avoids N+1 countDocuments)
      const threadIds = threads.map(t => t._id);
      const replyCounts = await ForumReply.aggregate([
        { $match: { threadId: { $in: threadIds } } },
        { $group: { _id: '$threadId', n: { $sum: 1 } } }
      ]);
      const replyCountMap = new Map(replyCounts.map(rc => [rc._id.toString(), rc.n]));
      const threadsWithCount = threads.map((thread) => ({
        ...thread,
        replyCount: replyCountMap.get(thread._id.toString()) || 0,
        likeCount: thread.likes.length
      }));

      const total = await ForumThread.countDocuments(query);

      return {
        data: threadsWithCount,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      console.error('ForumRepository.findAllThreads error:', error);
      throw error;
    }
  }

  async updateThreadOpenSource(id, isOpenSource) {
    try {
      const updated = await ForumThread.findByIdAndUpdate(
        id,
        { Is_openSource: isOpenSource },
        { new: true }
      )
        .populate('createdBy', '_id fullName email')
        .populate('courseId', 'title');

      // Clear Redis cache
      if (updated) {
        const redis = await initRedis();
        await redis.del(`forum:thread:${id}`);
        await redis.del(`forum:thread:admin:${id}`);
        await redis.del(`forum:threads:${updated.courseId}*`);
        await redis.del(`forum:threads:*`);
      }

      return updated;
    } catch (error) {
      console.error("ForumRepository.updateThreadOpenSource error:", error);
      throw error;
    }
  }


  async findThreadById(id) {
    try {
      //console.log('ForumRepository.findThreadById called with id:', id);
      const thread = await ForumThread.findById(id)
        .populate('createdBy', '_id fullName email')
        .populate('courseId', 'title')
        .lean();

      // Exclude if createdBy is shadowbanned
      if (thread && thread.createdBy?.isShadowBanned) {
        return null;
      }

      if (thread) {
        const replyCount = await ForumReply.countDocuments({ threadId: id });
        thread.replyCount = replyCount;
        thread.likeCount = thread.likes.length;
      }

      //console.log('ForumRepository.findThreadById success:', thread);
      return thread;
    } catch (error) {
      console.error('ForumRepository.findThreadById error:', error);
      throw error;
    }
  }


  async deleteThread(id) {
    try {
      //console.log('ForumRepository.deleteThread called with id:', id);

      // Get thread info before deletion for cache clearing
      const threadToDelete = await ForumThread.findById(id);

      // Delete all replies first
      await ForumReply.deleteMany({ threadId: id });

      const deletedThread = await ForumThread.findByIdAndDelete(id);

      // Clear Redis cache
      if (threadToDelete) {
        const redis = await initRedis();
        await redis.del(`forum:thread:${id}`);
        await redis.del(`forum:thread:admin:${id}`);
        await redis.del(`forum:threads:${threadToDelete.courseId}*`);
        await redis.del(`forum:threads:*`);
        await redis.del(`forum:replies:${id}*`);

        // Clear tag cache
        const tagCacheKey = threadToDelete.courseId
          ? `forum:tags:${threadToDelete.courseId}`
          : 'forum:tags:all';
        await redis.del(tagCacheKey);
      }

      //console.log('ForumRepository.deleteThread success:', deletedThread);
      return deletedThread;
    } catch (error) {
      console.error('ForumRepository.deleteThread error:', error);
      throw error;
    }
  }

  async toggleLikeThread(id, userId) {
    try {
      // Prevent shadowbanned users from liking/unliking
      const user = await User.findById(userId);


      const thread = await ForumThread.findById(id);
      if (!thread) {
        throw new Error('Thread not found');
      }

      const isLiked = thread.likes.includes(userId);
      let updatedThread;

      if (isLiked) {
        updatedThread = await ForumThread.findByIdAndUpdate(
          id,
          { $pull: { likes: userId } },
          { new: true }
        ).populate('createdBy', '_id fullName email');
      } else {
        updatedThread = await ForumThread.findByIdAndUpdate(
          id,
          { $push: { likes: userId } },
          { new: true }
        ).populate('createdBy', '_id fullName email');
      }

      // Clear Redis cache
      if (updatedThread) {
        const redis = await initRedis();
        await redis.del(`forum:thread:${id}`);
        await redis.del(`forum:thread:admin:${id}`);
        await redis.del(`forum:threads:${updatedThread.courseId}*`);
        await redis.del(`forum:threads:*`);
      }

      return {
        thread: updatedThread,
        message: isLiked ? 'Thread unliked' : 'Thread liked'
      };
    } catch (error) {
      throw error;
    }
  }

  async searchThreads({ courseId, query, tag, page = 1, limit = 10 }) {
    try {
      const searchQuery = { courseId };

      // Exclude threads by shadowbanned users
      const shadowbannedUsers = await User.find({ isShadowBanned: true }).select('_id');
      if (shadowbannedUsers.length) {
        searchQuery.createdBy = { $nin: shadowbannedUsers.map(u => u._id) };
      }

      if (query) {
        searchQuery.$text = { $search: query };
      }

      if (tag) {
        searchQuery.tags = { $in: [tag] };
      }

      const skip = (page - 1) * limit;

      const threads = await ForumThread.find(searchQuery)
        .sort({ isPinned: -1, score: { $meta: 'textScore' } })
        .skip(skip)
        .limit(limit)
        .populate('createdBy', '_id fullName profilePicture')
        .populate('courseId', 'title')
        .lean();

      const threadIds = threads.map(t => t._id);
      const replyCounts = await ForumReply.aggregate([
        { $match: { threadId: { $in: threadIds } } },
        { $group: { _id: '$threadId', n: { $sum: 1 } } }
      ]);
      const replyCountMap = new Map(replyCounts.map(rc => [rc._id.toString(), rc.n]));
      const threadsWithCount = threads.map((thread) => ({
        ...thread,
        replyCount: replyCountMap.get(thread._id.toString()) || 0,
        likeCount: thread.likes.length
      }));

      const total = await ForumThread.countDocuments(searchQuery);

      return {
        data: threadsWithCount,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      throw error;
    }
  }

  // Reply Repository Methods
  async createReply(data) {
    try {
      //console.log('ForumRepository.createReply called with data:', data);
      const reply = await ForumReply.create(data);
      const populatedReply = await ForumReply.findById(reply._id)
        .populate('repliedBy')
        .populate('parentReplyId', 'content repliedBy');

      //console.log('ForumRepository.createReply success:', populatedReply);
      return populatedReply;
    } catch (error) {
      console.error('ForumRepository.createReply error:', error?.message);
      throw error;
    }
  }

  async findReplies({ threadId, page = 1, limit = 20, sortOrder = 'asc', userId }) {
    try {
      //console.log('ForumRepository.findReplies called with:', { threadId, page, limit, sortOrder, userId });

      const skip = (page - 1) * limit;

      const replies = await ForumReply.find({ threadId, parentReplyId: null })
        .sort({ createdAt: sortOrder === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limit)
        .populate('repliedBy', '_id fullName profilePicture')
        .lean();

      // Exclude replies by shadowbanned users, but include the current user's replies
      const shadowbannedUsers = await User.find({ isShadowBanned: true }).select('_id');
      const shadowIds = shadowbannedUsers.map(u => u._id.toString());
      const filteredReplies = replies.filter(r => !shadowIds.includes(r.repliedBy?._id?.toString()) || r.repliedBy?._id?.toString() === userId);

      // Get nested replies for each reply
      const repliesWithNested = await Promise.all(
        filteredReplies.map(async (reply) => {
          const nestedReplies = await ForumReply.find({ parentReplyId: reply._id })
            .sort({ createdAt: 1 })
            .populate('repliedBy') // Changed to populate all user fields for repliedBy in nested replies
            .lean();
          // Exclude nested replies by shadowbanned users, but include the current user's replies
          const filteredNested = nestedReplies.filter(nested => !shadowIds.includes(nested.repliedBy?._id?.toString()) || nested.repliedBy?._id?.toString() === userId);

          return {
            ...reply,
            nestedReplies: filteredNested.map(nested => ({
              ...nested,
              likeCount: nested.likes.length
            })),
            likeCount: reply.likes.length
          };
        })
      );

      const total = await ForumReply.countDocuments({ threadId, parentReplyId: null });

      return {
        data: repliesWithNested,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      console.error('ForumRepository.findReplies error:', error);
      throw error;
    }
  }

  async findReplyById(id) {
    try {
      const reply = await ForumReply.findById(id)
        .populate('repliedBy', '_id fullName email');
      return reply;
    } catch (error) {
      throw error;
    }
  }

  async updateReply(id, data) {
    try {
      const updatedReply = await ForumReply.findByIdAndUpdate(id, data, { new: true })
        .populate('repliedBy', '_id fullName email');
      return updatedReply;
    } catch (error) {
      throw error;
    }
  }

  async deleteReply(id) {
    try {
      // Delete nested replies first
      await ForumReply.deleteMany({ parentReplyId: id });

      const deletedReply = await ForumReply.findByIdAndDelete(id);
      return deletedReply;
    } catch (error) {
      throw error;
    }
  }
  async findThreadByIdAdmin(id) {
    try {
      const thread = await ForumThread.findById(id)
        .populate("createdBy", "fullName isShadowBanned profilePicture") // add fields as needed
        .populate("courseId", "title")
        .lean();

      if (!thread) return null;

      // Count replies
      const replyCount = await ForumReply.countDocuments({ threadId: id });
      thread.replyCount = replyCount;

      // Like count
      thread.likeCount = thread.likes ? thread.likes.length : 0;

      return thread;
    } catch (error) {
      console.error("ForumRepository.findThreadByIdAdmin error:", error);
      throw error;
    }
  }

  async toggleLikeReply(id, userId) {
    try {
      // Prevent shadowbanned users from liking/unliking
      const user = await User.findById(userId);


      const reply = await ForumReply.findById(id);
      if (!reply) {
        throw new Error('Reply not found');
      }

      const isLiked = reply.likes.includes(userId);
      let updatedReply;

      if (isLiked) {
        updatedReply = await ForumReply.findByIdAndUpdate(
          id,
          { $pull: { likes: userId } },
          { new: true }
        ).populate('repliedBy', '_id fullName email');
      } else {
        updatedReply = await ForumReply.findByIdAndUpdate(
          id,
          { $push: { likes: userId } },
          { new: true }
        ).populate('repliedBy', '_id fullName email');
      }

      return {
        reply: updatedReply,
        message: isLiked ? 'Reply unliked' : 'Reply liked'
      };
    } catch (error) {
      throw error;
    }
  }

  //   async findAllTags(courseId = null) {
  //   try {
  //     //console.log('ForumRepository.findAllTags called with courseId:', courseId);

  //     const matchQuery = courseId ? { courseId } : {};

  //     const tags = await ForumThread.aggregate([
  //       { $match: matchQuery },
  //       { $unwind: '$tags' },
  //       { 
  //         $group: { 
  //           _id: '$tags',
  //           count: { $sum: 1 },
  //           lastUsed: { $max: '$createdAt' }
  //         } 
  //       },
  //       { 
  //         $project: {
  //           _id: 0,
  //           tag: '$_id',
  //           count: 1,
  //           lastUsed: 1
  //         }
  //       },
  //       { $sort: { count: -1, lastUsed: -1 } }
  //     ]);

  //     //console.log('ForumRepository.findAllTags success, found tags:', tags.length);
  //     return tags;
  //   } catch (error) {
  //     console.error('ForumRepository.findAllTags error:', error);
  //     throw error;
  //   }
  // }
  async findAllTags(courseId = null) {
    try {
      //console.log('ForumRepository.findAllTags called with courseId:', courseId);

      const matchQuery = courseId ? { courseId: mongoose.Types.ObjectId(courseId) } : {};

      const tags = await ForumThread.aggregate([
        { $match: matchQuery },
        { $unwind: '$tags' },

        // Group by tag
        {
          $group: {
            _id: '$tags',
            count: { $sum: 1 },
            lastUsedThreadId: { $first: '$_id' },   // Keep the last thread using this tag
            lastUsed: { $max: '$createdAt' }
          }
        },

        // Lookup the last thread to get user + course
        {
          $lookup: {
            from: 'forumthreads',
            localField: 'lastUsedThreadId',
            foreignField: '_id',
            as: 'lastThread'
          }
        },
        { $unwind: { path: '$lastThread', preserveNullAndEmptyArrays: true } },

        // Lookup user who created last thread
        {
          $lookup: {
            from: 'users',
            localField: 'lastThread.createdBy',
            foreignField: '_id',
            as: 'lastUsedBy'
          }
        },
        { $unwind: { path: '$lastUsedBy', preserveNullAndEmptyArrays: true } },

        // Lookup course of last thread
        {
          $lookup: {
            from: 'courses',
            localField: 'lastThread.courseId',
            foreignField: '_id',
            as: 'course'
          }
        },
        { $unwind: { path: '$course', preserveNullAndEmptyArrays: true } },

        // Lookup users who liked the last thread
        {
          $lookup: {
            from: 'users',
            localField: 'lastThread.likes',
            foreignField: '_id',
            as: 'likes'
          }
        },

        // Project final result
        {
          $project: {
            _id: 0,
            tag: '$_id',
            count: 1,
            lastUsed: 1,
            lastUsedBy: { _id: '$lastUsedBy._id', fullName: '$lastUsedBy.fullName', email: '$lastUsedBy.email' },
            course: { _id: '$course._id', title: '$course.title', slug: '$course.slug' },
            likes: { _id: 1, fullName: 1, email: 1 }  // include only relevant fields
          }
        },

        { $sort: { count: -1, lastUsed: -1 } }
      ]);

      //console.log('ForumRepository.findAllTags success, found tags:', tags.length);
      return tags;

    } catch (error) {
      console.error('ForumRepository.findAllTags error:', error);
      throw error;
    }
  }

  async findThreadsByTags({ tags, courseId, page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' }) {
    try {
      const skip = (page - 1) * limit;

      // Build query
      const query = {
        courseId,
        tags: { $in: tags.map(tag => new RegExp(`^${tag}$`, 'i')) } // case-insensitive
      };

      // Exclude threads by shadowbanned users
      const shadowbannedUsers = await User.find({ isShadowBanned: true }).select('_id');
      if (shadowbannedUsers.length) {
        query.createdBy = { $nin: shadowbannedUsers.map(u => u._id) };
      }

      const sortObj = { isPinned: -1 };
      sortObj[sortBy] = sortOrder === 'asc' ? 1 : -1;

      const threads = await ForumThread.find(query)
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .populate('createdBy', '_id fullName email')
        .populate('courseId', 'title')
        .lean();

      // Add reply & like counts using a single aggregate (avoids N+1 countDocuments)
      const threadIds = threads.map(t => t._id);
      const replyCounts = await ForumReply.aggregate([
        { $match: { threadId: { $in: threadIds } } },
        { $group: { _id: '$threadId', n: { $sum: 1 } } }
      ]);
      const replyCountMap = new Map(replyCounts.map(rc => [rc._id.toString(), rc.n]));
      const threadsWithCounts = threads.map((thread) => ({
        ...thread,
        replyCount: replyCountMap.get(thread._id.toString()) || 0,
        likeCount: thread.likes.length
      }));

      const total = await ForumThread.countDocuments(query);

      return {
        data: threadsWithCounts,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      console.error('ForumRepository.findThreadsByTags error:', error);
      throw error;
    }
  }




  async findAllThreadsWithReplies(query) {
    try {
      const { page = 1, limit = 10, filters = "{}", search = "", sort = "{}", isApproved } = query;
      let pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      if (isNaN(pageNum) || pageNum < 1) pageNum = 1;
      const skip = (pageNum - 1) * limitNum;

      // Safe JSON parse helper
      const safeParseJSON = (str, defaultValue) => {
        try {
          return JSON.parse(str);
        } catch (e) {
          console.warn(`Invalid JSON received: ${str} — using default`, e.message);
          return defaultValue;
        }
      };

      const parsedFilters = safeParseJSON(filters, {});
      const parsedSort = safeParseJSON(sort, {});

      // Build query conditions
      const matchConditions = {};

      // Add filters
      for (const [key, value] of Object.entries(parsedFilters)) {
        matchConditions[key] = value;
      }

      // Add search conditions for title and content
      if (search) {
        matchConditions.$or = [
          { title: { $regex: search, $options: "i" } },
          { content: { $regex: search, $options: "i" } }
        ];
      }

      // Add isApproved filter if provided
      if (typeof isApproved !== 'undefined') {
        matchConditions.isApproved = isApproved;
      }

      // Count total threads for pagination metadata
      const total = await ForumThread.countDocuments(matchConditions);

      // Fetch more threads than requested to account for shadowbanned users being filtered later
      // This ensures we return the requested number of threads after filtering
      // Fetch 3x the limit to ensure we have enough (some threads may be shadowbanned)
      const fetchLimit = Math.max(limitNum * 3, 30); // At least 30, or 3x the limit
      const threads = await ForumThread.find(matchConditions)
        .sort({ isPinned: -1, createdAt: -1, ...parsedSort })
        .skip(skip)
        .limit(fetchLimit)
        .populate('createdBy') // Changed to populate all user fields for createdBy
        .populate('courseId', 'title')
        .lean();

      // Don't filter shadowbanned users here - let the controller handle it
      // This allows logged-in users to see their own shadowbanned posts
      const threadsWithCounts = threads;

      // PERF: fetch ALL replies for the page's threads in ONE query and build
      // the nested tree in JS, instead of one query per thread plus one query
      // per top-level reply (quadratic N+1). threadId is required on every
      // ForumReply, so children are covered by the $in too.
      const threadIds = threadsWithCounts.map(thread => thread._id);
      const allReplies = threadIds.length === 0
        ? []
        : await ForumReply.find({ threadId: { $in: threadIds } })
          .sort({ createdAt: 1 }) // preserves the old per-bucket createdAt:1 ordering
          .populate('repliedBy') // Changed to populate all user fields for repliedBy
          .lean();

      // Bucket replies: top-level by threadId, children by parentReplyId.
      const topLevelByThread = new Map();
      const childrenByParent = new Map();
      for (const reply of allReplies) {
        if (reply.parentReplyId) {
          const parentKey = reply.parentReplyId.toString();
          if (!childrenByParent.has(parentKey)) childrenByParent.set(parentKey, []);
          childrenByParent.get(parentKey).push(reply);
        } else {
          const threadKey = reply.threadId.toString();
          if (!topLevelByThread.has(threadKey)) topLevelByThread.set(threadKey, []);
          topLevelByThread.get(threadKey).push(reply);
        }
      }

      // Shadowban filtering still happens in the controller, as before.
      const threadsWithReplies = threadsWithCounts.map((thread) => {
        const topLevelReplies = topLevelByThread.get(thread._id.toString()) || [];

        const nestedReplies = topLevelReplies.map((reply) => {
          const children = childrenByParent.get(reply._id.toString()) || [];

          return {
            ...reply,
            nestedReplies: children.map(c => ({
              ...c,
              likeCount: c.likes?.length || 0,
            })),
            likeCount: reply.likes?.length || 0,
          };
        });

        return {
          ...thread,
          replies: nestedReplies,
          likeCount: thread.likes?.length || 0,
        };
      });

      return {
        threads: threadsWithReplies,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      };
    } catch (err) {
      console.error('Repository Error:', err);
      throw err;
    }
  }


}