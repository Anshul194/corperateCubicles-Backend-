import BlogPostService from '../service/blogPostService.js';
import { initRedis } from '../config/redisClient.js';

// Use the imported instance directly (no 'new')
const blogPostService = BlogPostService;

export const createBlogPost = async (req, res) => {
  try {
    const blogPostData = {
      title: req.body.title,
      description: req.body.description,
      status: req.body.status === 'true' || req.body.status === true ? true : req.body.status === 'false' ? false : undefined,
      createdBy: req.user._id,
      thumbnail: req.file ? req.file.path.replace(/\\/g, '/') : null
    };

    const blogPost = await blogPostService.create(blogPostData);

    const redis = await initRedis();
    await redis.del('blogposts:all*');

    return res.status(201).json({
      success: true,
      message: 'Blog post created successfully',
      data: blogPost
    });
  } catch (error) {
    // console.error('BlogPost creation error:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getAllBlogPosts = async (req, res) => {
  try {
    const { page, limit, sortBy, sortOrder, search, status } = req.query;

    const filter = {};
    if (status) filter.status = status === 'true';
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const options = {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10,
      sortBy: sortBy || 'createdAt',
      sortOrder: sortOrder || 'desc',
      filter
    };

    const redis = await initRedis();
    const cacheKey = `blogposts:all:${JSON.stringify(options)}`;
    const cached = await redis.get(cacheKey);

    if (cached) {
      return res.status(200).json({
        success: true,
        message: 'Blog posts fetched from cache',
        data: JSON.parse(cached),
        fromCache: true
      });
    }

    const blogPosts = await blogPostService.getAll(options);
    await redis.setEx(cacheKey, 300, JSON.stringify(blogPosts));

    return res.status(200).json({
      success: true,
      message: 'Blog posts retrieved successfully',
      data: blogPosts
    });
  } catch (error) {
    // console.error('getAllBlogPosts error:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getBlogPostById = async (req, res) => {
  try {
    const { id } = req.params;
    const redis = await initRedis();
    const cacheKey = `blogpost:${id}`;
    const cached = await redis.get(cacheKey);

    if (cached) {
      return res.status(200).json({
        success: true,
        message: 'Blog post fetched from cache',
        data: JSON.parse(cached),
        fromCache: true
      });
    }

    const blogPost = await blogPostService.getById(id);
    await redis.setEx(cacheKey, 300, JSON.stringify(blogPost));

    return res.status(200).json({
      success: true,
      message: 'Blog post retrieved successfully',
      data: blogPost
    });
  } catch (error) {
    // console.error('getBlogPostById error:', error);
    return res.status(error.message === 'Blog post not found' ? 404 : 500).json({
      success: false,
      message: error.message
    });
  }
};

export const updateBlogPost = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = {
      title: req.body.title,
      description: req.body.description,
      status: req.body.status === 'true' || req.body.status === true ? true : req.body.status === 'false' ? false : undefined,
      thumbnail: req.file ? req.file.path.replace(/\\/g, '/') : req.body.thumbnail
    };

    const blogPost = await blogPostService.update(id, updateData);

    const redis = await initRedis();
    await redis.del('blogposts:all*');
    await redis.del(`blogpost:${id}`);

    return res.status(200).json({
      success: true,
      message: 'Blog post updated successfully',
      data: blogPost
    });
  } catch (error) {
    // console.error('updateBlogPost error:', error);
    return res.status(error.message === 'Blog post not found' ? 404 : 500).json({
      success: false,
      message: error.message
    });
  }
};

export const deleteBlogPost = async (req, res) => {
  try {
    const { id } = req.params;
    await blogPostService.delete(id);

    const redis = await initRedis();
    await redis.del('blogposts:all*');
    await redis.del(`blogpost:${id}`);

    return res.status(200).json({
      success: true,
      message: 'Blog post deleted successfully'
    });
  } catch (error) {
    // console.error('deleteBlogPost error:', error);
    return res.status(error.message === 'Blog post not found' ? 404 : 500).json({
      success: false,
      message: error.message
    });
  }
};