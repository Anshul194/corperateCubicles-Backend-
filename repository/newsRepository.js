import News from '../models/News.js';
import User from '../models/user.js';

class NewsRepository {
  async create(data) {
    try {
      const news = new News(data);
      return await news.save();
    } catch (error) {
      console.error('NewsRepository.create error:', error);
      throw error;
    }
  }

  async findAll({ query, sort, skip, limit }) {
    try {
      return await News.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean();
    } catch (error) {
      console.error('NewsRepository.findAll error:', error);
      throw error;
    }
  }

  async count(query) {
    try {
      return await News.countDocuments(query);
    } catch (error) {
      console.error('NewsRepository.count error:', error);
      throw error;
    }
  }

  async findById(id) {
    try {
      return await News.findById(id)
        .populate("comments.user", "fullName email profilePicture")
        .lean();
    } catch (error) {
      console.error('NewsRepository.findById error:', error);
      throw error;
    }
  }

  async findBySlug(slug) {
    try {
      return await News.findOne({ slug })
        .populate("comments.user", "fullName email profilePicture")
        .lean();
    } catch (error) {
      console.error('NewsRepository.findBySlug error:', error);
      throw error;
    }
  }

  async update(id, data) {
    try {
      return await News.findByIdAndUpdate(
        id,
        { $set: data },
        { new: true, runValidators: true }
      );
    } catch (error) {
      console.error('NewsRepository.update error:', error);
      throw error;
    }
  }

  async delete(id) {
    try {
      return await News.findByIdAndDelete(id);
    } catch (error) {
      console.error('NewsRepository.delete error:', error);
      throw error;
    }
  }

  async search(searchText, options = {}) {
    try {
      const { status } = options;

      // Escape special regex characters
      const escapedSearchText = searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // Create case-insensitive regex pattern
      const searchRegex = new RegExp(escapedSearchText, 'i');

      // Build search query across multiple fields
      const searchQuery = {
        $or: [
          { title: searchRegex },
          { summary: searchRegex },
          { content: searchRegex },
          { tags: searchRegex },
          { categories: searchRegex },
          { 'source.name': searchRegex },
          { 'author.name': searchRegex },
        ]
      };

      // Add status filter if provided
      if (status) {
        searchQuery.status = status;
      }

      // Try text search first (if index exists), then fallback to regex
      try {
        const textSearchQuery = { $text: { $search: searchText } };
        if (status) {
          textSearchQuery.status = status;
        }

        const textSearchResults = await News.find(
          textSearchQuery,
          { score: { $meta: 'textScore' } }
        )
          .sort({ score: { $meta: 'textScore' } })
          .lean();

        // If text search returns results, use them
        if (textSearchResults && textSearchResults.length > 0) {
          return textSearchResults;
        }
      } catch (textSearchError) {
        // Text index might not exist, fall through to regex search
        console.log('Text search not available, using regex search:', textSearchError.message);
      }

      // Fallback to regex-based search
      return await News.find(searchQuery)
        .sort({ publishedAt: -1 })
        .lean();
    } catch (error) {
      console.error('NewsRepository.search error:', error);
      throw error;
    }
  }

  async incrementStats(id, field) {
    try {
      return await News.findByIdAndUpdate(
        id,
        { $inc: { [`stats.${field}`]: 1 } },
        { new: true }
      );
    } catch (error) {
      console.error('NewsRepository.incrementStats error:', error);
      throw error;
    }
  }

  async trackUserInteraction(id, interactionType, userId) {
    try {
      const fieldMap = {
        views: 'userInteractions.viewedBy',
        likes: 'userInteractions.likedBy',
        shares: 'userInteractions.sharedBy',
      };

      const interactionField = fieldMap[interactionType];
      if (!interactionField) {
        throw new Error(`Invalid interaction type: ${interactionType}`);
      }

      // Check if user already interacted (for views, only allow unique; for likes/shares, prevent duplicates)
      const news = await News.findById(id);
      if (!news) {
        throw new Error('News not found');
      }

      const interactionArray = news.userInteractions?.[`${interactionType}By`] || [];
      const alreadyInteracted = interactionArray.some(
        (item) => item.user.toString() === userId.toString()
      );

      // For views, only add if not already present (unique views)
      // For likes and shares, only add if not already present
      const dateFieldMap = {
        views: 'viewedAt',
        likes: 'likedAt',
        shares: 'sharedAt',
      };

      if (interactionType === 'views') {
        // Atomically update timestamp if exists, else push new entry (prevents duplicates)
        const updateResult = await News.updateOne(
          { _id: id, 'userInteractions.viewedBy.user': userId },
          { $set: { 'userInteractions.viewedBy.$.viewedAt': new Date() } }
        );
        if (updateResult.modifiedCount === 0) {
          // If not present, push a new entry
          await News.updateOne(
            { _id: id, 'userInteractions.viewedBy.user': { $ne: userId } },
            { $push: { 'userInteractions.viewedBy': { user: userId, viewedAt: new Date() } } }
          );
        }
        // After update, recalculate stats.views
        const updatedNews = await News.findById(id);
        if (updatedNews) {
          updatedNews.stats.views = updatedNews.userInteractions?.viewedBy?.length || 0;
          await updatedNews.save();
        }
        return await News.findById(id);
      } else {
        // For likes/shares, only add if not already present
        if (!alreadyInteracted) {
          const update = {
            $inc: { [`stats.${interactionType}`]: 1 },
            $push: {
              [interactionField]: {
                user: userId,
                [dateFieldMap[interactionType]]: new Date(),
              },
            },
          };
          return await News.findByIdAndUpdate(id, update, { new: true });
        }
        // If already liked/shared, return current document
        return news;
      }
    } catch (error) {
      console.error('NewsRepository.trackUserInteraction error:', error);
      throw error;
    }
  }

  async removeUserInteraction(id, interactionType, userId) {
    try {
      const fieldMap = {
        likes: 'userInteractions.likedBy',
        shares: 'userInteractions.sharedBy',
      };

      const interactionField = fieldMap[interactionType];
      if (!interactionField) {
        throw new Error(`Cannot remove interaction type: ${interactionType}`);
      }

      // Remove user from interaction array and decrement count
      const update = {
        $inc: { [`stats.${interactionType}`]: -1 },
        $pull: {
          [interactionField]: { user: userId },
        },
      };

      return await News.findByIdAndUpdate(id, update, { new: true });
    } catch (error) {
      console.error('NewsRepository.removeUserInteraction error:', error);
      throw error;
    }
  }

  async getUserInteractions(id, interactionType, options = {}) {
    try {
      const { page = 1, limit = 20 } = options;
      const skip = (page - 1) * limit;

      // Map interaction types to field names
      const fieldMap = {
        views: 'viewedBy',
        likes: 'likedBy',
        shares: 'sharedBy',
      };

      const fieldName = fieldMap[interactionType];
      if (!fieldName) {
        throw new Error(`Invalid interaction type: ${interactionType}`);
      }

      // Fetch news without populate first
      const news = await News.findById(id).lean();

      if (!news) {
        throw new Error('News not found');
      }

      const dateFieldMap = {
        views: 'viewedAt',
        likes: 'likedAt',
        shares: 'sharedAt',
      };

      const interactions = news.userInteractions?.[fieldName] || [];
      const total = interactions.length;
      const dateField = dateFieldMap[interactionType];

      // Sort by date (newest first) and paginate
      const sortedInteractions = interactions.sort((a, b) => {
        const dateA = a[dateField] ? new Date(a[dateField]) : new Date(0);
        const dateB = b[dateField] ? new Date(b[dateField]) : new Date(0);
        return dateB - dateA;
      });

      const paginatedInteractions = sortedInteractions.slice(skip, skip + limit);

      // Manually populate user references
      const userIds = paginatedInteractions
        .map(interaction => interaction.user)
        .filter(Boolean);

      const users = await User.find({ _id: { $in: userIds } })
        .select('fullName email avatar')
        .lean();

      // Create a map for quick lookup
      const userMap = new Map(users.map(user => [user._id.toString(), user]));

      // Populate user data in interactions
      const populatedInteractions = paginatedInteractions.map(interaction => ({
        ...interaction,
        user: userMap.get(interaction.user?.toString()) || interaction.user,
      }));

      return {
        interactions: populatedInteractions,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      console.error('NewsRepository.getUserInteractions error:', error);
      throw error;
    }
  }

  async checkUserInteraction(id, userId) {
    try {
      const news = await News.findById(id).lean();
      if (!news) {
        throw new Error('News not found');
      }

      // Convert userId to string for comparison
      const userIdStr = userId?.toString();

      // Helper function to check if user exists in array
      const checkInArray = (array) => {
        if (!array || !Array.isArray(array)) return false;
        return array.some((item) => {
          const itemUserId = item.user?.toString();
          return itemUserId === userIdStr;
        });
      };

      return {
        hasViewed: checkInArray(news.userInteractions?.viewedBy) || false,
        hasLiked: checkInArray(news.userInteractions?.likedBy) || false,
        hasShared: checkInArray(news.userInteractions?.sharedBy) || false,
      };
    } catch (error) {
      console.error('NewsRepository.checkUserInteraction error:', error);
      throw error;
    }
  }

  async populateUserInteractions(news) {
    try {
      if (!news || !news.userInteractions) {
        return news;
      }

      // Collect all user IDs from all interaction arrays
      const allUserIds = new Set();

      ['viewedBy', 'likedBy', 'sharedBy'].forEach(field => {
        const interactions = news.userInteractions?.[field] || [];
        interactions.forEach(interaction => {
          if (interaction.user) {
            allUserIds.add(interaction.user.toString());
          }
        });
      });

      if (allUserIds.size === 0) {
        return news;
      }

      // Fetch all users at once
      const users = await User.find({ _id: { $in: Array.from(allUserIds) } })
        .select('fullName email avatar')
        .lean();

      // Create a map for quick lookup
      const userMap = new Map(users.map(user => [user._id.toString(), user]));

      // Populate user data in each interaction array
      const dateFieldMap = {
        viewedBy: 'viewedAt',
        likedBy: 'likedAt',
        sharedBy: 'sharedAt',
      };

      ['viewedBy', 'likedBy', 'sharedBy'].forEach(field => {
        if (news.userInteractions?.[field]) {
          news.userInteractions[field] = news.userInteractions[field].map(interaction => {
            const userId = interaction.user?.toString();
            const user = userMap.get(userId);
            return {
              ...interaction,
              user: user || { _id: interaction.user },
            };
          });
        }
      });

      // Also populate comments.user if comments exist
      if (news.comments && news.comments.length > 0) {
        // Collect comment user IDs that weren't already fetched
        const commentUserIds = new Set();
        news.comments.forEach(comment => {
          if (comment.user) {
            const userId = (comment.user._id || comment.user).toString();
            if (!userMap.has(userId)) {
              commentUserIds.add(userId);
            }
          }
          // Also collect user IDs from replies
          if (comment.replies && comment.replies.length > 0) {
            comment.replies.forEach(reply => {
              if (reply.user) {
                const replyUserId = (reply.user._id || reply.user).toString();
                if (!userMap.has(replyUserId)) {
                  commentUserIds.add(replyUserId);
                }
              }
            });
          }
        });

        console.log('PopulateUserInteractions: Collected commentUserIds:', Array.from(commentUserIds));

        if (commentUserIds.size > 0) {
          const additionalUsers = await User.find({ _id: { $in: Array.from(commentUserIds) } })
            .select('fullName email profilePicture') // Ensure profilePicture is selected
            .lean();

          console.log('PopulateUserInteractions: Fetched users:', additionalUsers.map(u => u._id));

          additionalUsers.forEach(user => userMap.set(user._id.toString(), user));
        }

        // Apply users to comments and populate replies
        news.comments = news.comments.map(comment => {
          const userId = (comment.user?._id || comment.user)?.toString();
          const user = userMap.get(userId);

          // Populate replies if they exist
          let populatedReplies = comment.replies || [];
          if (populatedReplies.length > 0) {
            populatedReplies = populatedReplies.map(reply => {
              const replyUserId = (reply.user?._id || reply.user)?.toString();
              const replyUser = userMap.get(replyUserId);
              return {
                ...reply,
                user: replyUser || { _id: reply.user },
              };
            });
          }

          return {
            ...comment,
            user: user || { _id: comment.user },
            replies: populatedReplies
          };
        });
      }

      return news;

      return news;
    } catch (error) {
      console.error('NewsRepository.populateUserInteractions error:', error);
      return news; // Return original news if population fails
    }
  }
}

export default new NewsRepository();

