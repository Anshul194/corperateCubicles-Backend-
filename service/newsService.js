import NewsRepository from '../repository/newsRepository.js';
import mongoose from 'mongoose';
import News from '../models/News.js';
import axios from 'axios';
import slugify from 'slugify';

class NewsService {
  async create(newsData) {
    try {
      // Generate slug if not provided
      if (!newsData.slug && newsData.title) {
        newsData.slug = this.generateSlug(newsData.title);
      }

      // Ensure fetchedAt is set
      if (!newsData.fetchedAt) {
        newsData.fetchedAt = new Date();
      }

      return await NewsRepository.create(newsData);
    } catch (error) {
      console.error('NewsService.create error:', error);
      throw error;
    }
  }

  async getAll(options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = 'publishedAt',
        sortOrder = 'desc',
        filter = {},
        search,
        category,
        state,
        city,
        tag,
        language,
        country,
        isBreaking,
        breakingNews,
        status = 'active',
        live,
        Live,
        Top,
        topNews,
        trendingTopic,
      } = options;

      // Build query
      const query = { ...filter };

      if (status) {
        query.status = status;
      }

      if (category) {
        // Support both string and ObjectId
        const categoryValue = mongoose.Types.ObjectId.isValid(category)
          ? new mongoose.Types.ObjectId(category)
          : category;
        query.$or = [
          { categories: { $in: [categoryValue] } },
          { category: categoryValue },
        ];
      }

      if (state) {
        const stateValue = mongoose.Types.ObjectId.isValid(state)
          ? new mongoose.Types.ObjectId(state)
          : state;
        query.state = stateValue;
      }

      if (city) {
        const cityValue = mongoose.Types.ObjectId.isValid(city)
          ? new mongoose.Types.ObjectId(city)
          : city;
        query.city = cityValue;
      }

      if (tag) {
        query.tags = { $in: [tag] };
      }

      if (language) {
        query.language = language;
      }

      if (country) {
        query.country = country;
      }

      if (isBreaking !== undefined || breakingNews !== undefined) {
        const breakingValue = isBreaking === 'true' || isBreaking === true ||
          breakingNews === 'true' || breakingNews === true;
        query.$or = [
          { isBreaking: breakingValue },
          { breakingNews: breakingValue },
        ];
      }

      if (live !== undefined || Live !== undefined) {
        const liveValue = live === 'true' || live === true ||
          Live === 'true' || Live === true;
        query.Live = liveValue;
      }

      if (Top !== undefined || topNews !== undefined) {
        const topValue = Top === 'true' || Top === true ||
          topNews === 'true' || topNews === true;
        query.$or = [
          { Top: topValue },
          { topNews: topValue },
        ];
      }

      if (trendingTopic !== undefined) {
        query.trendingTopic = trendingTopic === 'true' || trendingTopic === true;
      }

      // Text search - use regex if text index not available
      if (search) {
        try {
          query.$text = { $search: search };
        } catch (e) {
          // Fallback to regex search if text index not available
          const searchRegex = new RegExp(search, 'i');
          query.$or = [
            { title: searchRegex },
            { articleTitle: searchRegex },
            { en_articleTitle: searchRegex },
            { summary: searchRegex },
            { excerpt: searchRegex },
            { content: searchRegex },
          ];
        }
      }

      // Sort
      const sort = {};
      sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

      // If text search, add text score to sort
      if (search) {
        sort.score = { $meta: 'textScore' };
      }

      const news = await NewsRepository.findAll({
        query,
        sort,
        skip: (page - 1) * limit,
        limit: parseInt(limit),
      });

      // Calculate stats from actual userInteractions arrays to ensure accuracy
      const newsWithAccurateStats = news.map(item => {
        const accurateStats = {
          views: item.userInteractions?.viewedBy?.length || item.stats?.views || 0,
          likes: item.userInteractions?.likedBy?.length || item.stats?.likes || 0,
          shares: item.userInteractions?.sharedBy?.length || item.stats?.shares || 0,
        };

        return {
          ...item,
          stats: accurateStats,
        };
      });

      const total = await NewsRepository.count(query);

      return {
        data: this.parseContent(newsWithAccurateStats),
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      console.error('NewsService.getAll error:', error);
      throw error;
    }
  }


  async getDistinctCategories() {
    return await News.distinct("categories").exec();
  }

  async getById(id) {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new Error('Invalid news ID');
      }
      const news = await NewsRepository.findById(id);
      if (!news) throw new Error('News not found');

      // Calculate stats from actual userInteractions arrays to ensure accuracy
      const accurateStats = {
        views: news.userInteractions?.viewedBy?.length || news.stats?.views || 0,
        likes: news.userInteractions?.likedBy?.length || news.stats?.likes || 0,
        shares: news.userInteractions?.sharedBy?.length || news.stats?.shares || 0,
      };

      const result = {
        ...news,
        stats: accurateStats,
      };
      return this.parseContent(result);
    } catch (error) {
      console.error('NewsService.getById error:', error);
      throw error;
    }
  }

  async getBySlug(slug) {
    try {
      const news = await NewsRepository.findBySlug(slug);
      if (!news) throw new Error('News not found');

      // Calculate stats from actual userInteractions arrays to ensure accuracy
      const accurateStats = {
        views: news.userInteractions?.viewedBy?.length || news.stats?.views || 0,
        likes: news.userInteractions?.likedBy?.length || news.stats?.likes || 0,
        shares: news.userInteractions?.sharedBy?.length || news.stats?.shares || 0,
      };

      const result = {
        ...news,
        stats: accurateStats,
      };
      return this.parseContent(result);
    } catch (error) {
      console.error('NewsService.getBySlug error:', error);
      throw error;
    }
  }

  async update(id, updateData) {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new Error('Invalid news ID');
      }

      // Generate slug if title is being updated
      if (updateData.title && !updateData.slug) {
        updateData.slug = this.generateSlug(updateData.title);
      }

      const news = await NewsRepository.update(id, updateData);
      if (!news) throw new Error('News not found');
      return news;
    } catch (error) {
      console.error('NewsService.update error:', error);
      throw error;
    }
  }

  async delete(id) {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new Error('Invalid news ID');
      }
      const news = await NewsRepository.delete(id);
      if (!news) throw new Error('News not found');
      return news;
    } catch (error) {
      console.error('NewsService.delete error:', error);
      throw error;
    }
  }

  async search(searchText, options = {}) {
    try {
      const { limit = 20, status } = options;
      const results = await NewsRepository.search(searchText, { status });
      return results.slice(0, limit);
    } catch (error) {
      console.error('NewsService.search error:', error);
      throw error;
    }
  }


  async incrementLikes(id) {
    try {
      return await NewsRepository.incrementStats(id, 'likes');
    } catch (error) {
      console.error('NewsService.incrementLikes error:', error);
      throw error;
    }
  }

  async incrementShares(id) {
    try {
      return await NewsRepository.incrementStats(id, 'shares');
    } catch (error) {
      console.error('NewsService.incrementShares error:', error);
      throw error;
    }
  }

  async trackUserInteraction(id, interactionType, userId) {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new Error('Invalid news ID');
      }
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new Error('Invalid user ID');
      }
      if (!['views', 'likes', 'shares'].includes(interactionType)) {
        throw new Error('Invalid interaction type. Must be views, likes, or shares');
      }
      return await NewsRepository.trackUserInteraction(id, interactionType, userId);
    } catch (error) {
      console.error('NewsService.trackUserInteraction error:', error);
      throw error;
    }
  }

  async removeUserInteraction(id, interactionType, userId) {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new Error('Invalid news ID');
      }
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new Error('Invalid user ID');
      }
      if (!['likes', 'shares'].includes(interactionType)) {
        throw new Error('Invalid interaction type. Can only remove likes or shares');
      }
      return await NewsRepository.removeUserInteraction(id, interactionType, userId);
    } catch (error) {
      console.error('NewsService.removeUserInteraction error:', error);
      throw error;
    }
  }

  async getUserInteractions(id, interactionType, options = {}) {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new Error('Invalid news ID');
      }
      if (!['views', 'likes', 'shares'].includes(interactionType)) {
        throw new Error('Invalid interaction type. Must be views, likes, or shares');
      }
      return await NewsRepository.getUserInteractions(id, interactionType, options);
    } catch (error) {
      console.error('NewsService.getUserInteractions error:', error);
      throw error;
    }
  }

  async checkUserInteraction(id, userId) {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new Error('Invalid news ID');
      }
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new Error('Invalid user ID');
      }
      return await NewsRepository.checkUserInteraction(id, userId);
    } catch (error) {
      console.error('NewsService.checkUserInteraction error:', error);
      throw error;
    }
  }

  async populateUserInteractions(news) {
    try {
      return await NewsRepository.populateUserInteractions(news);
    } catch (error) {
      console.error('NewsService.populateUserInteractions error:', error);
      return news; // Return original news if population fails
    }
  }

  async addComment(id, userId, comment) {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new Error('Invalid news ID');
      }

      // Use Mongoose model directly to get document instance
      const news = await News.findById(id);
      if (!news) throw new Error('News not found');

      const newComment = {
        user: userId,
        text: comment,
        createdAt: new Date(),
      };

      news.comments.push(newComment);
      await news.save();

      // Populate user details for the new comment
      const result = await News.findById(id).populate("comments.user", "fullName email profilePicture").lean();
      return this.parseContent(result);
    } catch (error) {
      console.error('NewsService.addComment error:', error);
      throw error;
    }
  }

  async addReply(newsId, commentId, userId, text) {
    try {
      if (!mongoose.Types.ObjectId.isValid(newsId)) {
        throw new Error('Invalid news ID');
      }
      if (!mongoose.Types.ObjectId.isValid(commentId)) {
        throw new Error('Invalid comment ID');
      }

      const news = await News.findById(newsId);
      if (!news) throw new Error('News not found');

      const comment = news.comments.id(commentId);
      if (!comment) throw new Error('Comment not found');

      const newReply = {
        user: userId,
        text,
        createdAt: new Date(),
      };

      comment.replies.push(newReply);
      await news.save();

      // Populate user details including replies
      const result = await NewsRepository.findById(newsId);
      return await NewsRepository.populateUserInteractions(result);
    } catch (error) {
      console.error('NewsService.addReply error:', error);
      throw error;
    }
  }

  async deleteComment(newsId, commentId, userId, userRole) {
    try {
      if (!mongoose.Types.ObjectId.isValid(newsId)) {
        throw new Error('Invalid news ID');
      }
      if (!mongoose.Types.ObjectId.isValid(commentId)) {
        throw new Error('Invalid comment ID');
      }

      const news = await News.findById(newsId);
      if (!news) throw new Error('News not found');

      const comment = news.comments.id(commentId);
      if (!comment) throw new Error('Comment not found');

      // Check permissions: User must be author OR admin
      const isAuthor = comment.user.toString() === userId.toString();
      const isAdmin = userRole === 'admin';

      if (!isAuthor && !isAdmin) {
        throw new Error('Unauthorized to delete this comment');
      }

      // Use pull to remove the subdocument
      news.comments.pull(commentId);
      await news.save();

      // Return updated news with populated fields
      const result = await NewsRepository.findById(newsId);
      return await NewsRepository.populateUserInteractions(result);
    } catch (error) {
      console.error('NewsService.deleteComment error:', error);
      throw error;
    }
  }

  async getComments(newsId) {
    try {
      if (!mongoose.Types.ObjectId.isValid(newsId)) {
        throw new Error('Invalid news ID');
      }

      const news = await NewsRepository.findById(newsId);
      if (!news) throw new Error('News not found');

      const populatedNews = await NewsRepository.populateUserInteractions(news);

      // Sort comments by date (newest first)
      const comments = populatedNews.comments || [];
      comments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      return comments;
    } catch (error) {
      console.error('NewsService.getComments error:', error);
      throw error;
    }
  }

  // Helper to parse content JSON string if needed
  parseContent(newsItem) {
    if (!newsItem) return newsItem;

    // Handle array of news
    if (Array.isArray(newsItem)) {
      return newsItem.map(item => this.parseContent(item));
    }

    // Handle single news object
    if (newsItem.content && typeof newsItem.content === 'string') {
      try {
        // Check if it looks like a JSON object or array
        if (newsItem.content.trim().startsWith('{') || newsItem.content.trim().startsWith('[')) {
          const parsed = JSON.parse(newsItem.content);
          // If double stringified, parse again (just in case)
          if (typeof parsed === 'string') {
            try {
              newsItem.content = JSON.parse(parsed);
            } catch (e) {
              newsItem.content = parsed;
            }
          } else {
            newsItem.content = parsed;
          }
        }
      } catch (e) {
        // Keep original if parse fails
        console.warn('Failed to parse news content JSON:', e);
      }
    }
    return newsItem;
  }

  generateSlug(title) {
    return slugify(title, { lower: true, strict: true }) + '-' + Date.now().toString(36);
  }

  async fetchFromWordPress(url, maxPosts = 500) {
    try {
      // Normalize URL to get the base endpoint for posts
      let baseUrl = url;

      // Remove query parameters if present
      if (baseUrl.includes('?')) {
        baseUrl = baseUrl.split('?')[0];
      }

      // Ensure we have the correct path to /wp-json/wp/v2/posts
      if (!baseUrl.includes('/wp-json/wp/v2/posts')) {
        // If it contains /wp-json but not the full path
        if (baseUrl.includes('/wp-json')) {
          baseUrl = baseUrl.replace(/\/$/, '');
          if (!baseUrl.endsWith('/wp/v2/posts')) {
            baseUrl += '/wp/v2/posts';
          }
        } else {
          // Assume it's the site root
          baseUrl = baseUrl.replace(/\/$/, '') + '/wp-json/wp/v2/posts';
        }
      }

      const savedNews = [];
      let newCount = 0;
      let updatedCount = 0;

      let page = 1;
      const perPage = 100; // WordPress max is usually 100
      let fetchedCount = 0;
      let keepFetching = true;

      // Calculate cutoff time if fetching only recent posts (e.g. last 10 minutes)
      let afterDate = null;
      if (maxPosts === 'recent') {
        const now = new Date();
        afterDate = new Date(now.getTime() - 10 * 60 * 1000); // 10 minutes ago
        maxPosts = Infinity; // Remove limits, bounded by time
        console.log(`Fetching recent news after: ${afterDate.toISOString()}`);

        // Append 'after' to URL if possible to optimize fetch
        // Note: WordPress API expects ISO 8601 date string
        baseUrl += `${baseUrl.includes('?') ? '&' : '?'}after=${afterDate.toISOString()}`;
      }

      console.log(`Starting fetch from ${baseUrl} with target limit ${maxPosts}`);

      while (keepFetching && fetchedCount < maxPosts) {
        // Construct URL for this page with _embed and pagination, avoid double '?'
        let pageUrl = baseUrl;
        pageUrl += pageUrl.includes('?') ? `&_embed&per_page=${perPage}&page=${page}` : `?_embed&per_page=${perPage}&page=${page}`;
        console.log(`Fetching page ${page}: ${pageUrl}`);

        try {
          // SECURITY/RELIABILITY: bound the outbound request — a timeout prevents a
          // slow/hung upstream from hanging the handler, and maxRedirects:0 blocks
          // redirect-based SSRF (the initial host is validated by the caller, but a
          // 3xx could otherwise bounce the request to an internal address).
          const response = await axios.get(pageUrl, {
            timeout: 10000,
            maxRedirects: 0,
            maxContentLength: 10 * 1024 * 1024,
            maxBodyLength: 10 * 1024 * 1024,
          });
          const posts = response.data;

          if (!Array.isArray(posts) || posts.length === 0) {
            console.log('No more posts found.');
            keepFetching = false;
            break;
          }

          for (const post of posts) {
            if (fetchedCount >= maxPosts) {
              keepFetching = false;
              break;
            }

            // Check date if we are in 'recent' mode
            // Although we added 'after' param to query, manual check is good safety
            if (afterDate) {
              const postDate = new Date(post.date);
              if (postDate < afterDate) {
                keepFetching = false;
                break;
              }
            }

            // Check if news already exists by source ID
            const existingNews = await News.findOne({ 'source.id': post.id.toString() });

            // Extract basic fields
            const title = post.title.rendered || 'Untitled';
            const content = post.content.rendered || '';
            const excerpt = post.excerpt.rendered || '';
            const slug = post.slug || slugify(title, { lower: true, strict: true });
            const publishedAt = new Date(post.date);
            const url = post.link;

            // Extract featured image
            let imageUrl = '';
            if (post._embedded && post._embedded['wp:featuredmedia'] && post._embedded['wp:featuredmedia'][0]) {
              imageUrl = post._embedded['wp:featuredmedia'][0].source_url;
            } else if (post.jetpack_featured_media_url) {
              imageUrl = post.jetpack_featured_media_url;
            }

            // Extract categories (names)
            let categories = [];
            if (post._embedded && post._embedded['wp:term']) {
              const terms = post._embedded['wp:term'].flat();
              categories = terms
                .filter(term => term.taxonomy === 'category')
                .map(term => term.name);
            }

            // Map to News model
            const newsData = {
              title: title.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec)).replace(/&amp;/g, '&'),
              slug: existingNews ? existingNews.slug : slug, // Keep existing slug if updating
              summary: excerpt.replace(/<\/?[^>]+(>|$)/g, "").substring(0, 500), // Strip HTML tags
              content: content, // Store full HTML content
              source: {
                id: post.id.toString(),
                name: 'WordPress',
                url: url
              },
              url: url,
              imageUrl: imageUrl,
              coverImage: imageUrl,
              publishedAt: publishedAt,
              formattedDate: publishedAt,
              fetchedAt: new Date(),
              categories: categories,
              status: 'active',
              newsType: 'normal'
            };

            if (existingNews) {
              // Update existing news
              Object.assign(existingNews, newsData);
              await existingNews.save();
              savedNews.push(existingNews);
              updatedCount++;
            } else {
              // Create new news
              // Ensure unique slug
              const uniqueSlug = await this.ensureUniqueSlug(slug);
              newsData.slug = uniqueSlug;

              const newNews = await News.create(newsData);
              savedNews.push(newNews);
              newCount++;
            }

            fetchedCount++;
          }

          console.log(`Page ${page} processed. Total fetched: ${fetchedCount}`);

          // If we got fewer posts than perPage, we've reached the end
          if (posts.length < perPage) {
            keepFetching = false;
          } else {
            page++;
          }

        } catch (error) {
          console.error(`Error fetching page ${page}: ${error.message}`);
          // If 400 Bad Request, usually means page number is too high (end of pagination)
          if (error.response && error.response.status === 400) {
            console.log('Reached end of pagination (400 Bad Request).');
          }
          keepFetching = false;
        }
      }

      return {
        count: savedNews.length,
        new: newCount,
        updated: updatedCount,
        data: savedNews
      };

    } catch (error) {
      console.error('NewsService.fetchFromWordPress error:', error);
      throw error;
    }
  }

  async ensureUniqueSlug(slug) {
    let uniqueSlug = slug;
    let counter = 1;
    while (await News.findOne({ slug: uniqueSlug })) {
      uniqueSlug = `${slug}-${counter}`;
      counter++;
    }
    return uniqueSlug;
  }
}

export default new NewsService();

