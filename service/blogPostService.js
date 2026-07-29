import BlogPostRepository from '../repository/blogPostRepository.js';

class BlogPostService {
  async create(blogPostData) {
    try {
      return await BlogPostRepository.create(blogPostData);
    } catch (error) {
      console.error('BlogPostService.create error:', error);
      throw error;
    }
  }

  async getAll(options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        filter = {}
      } = options;

      const sort = {};
      sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

      const blogPosts = await BlogPostRepository.findAll({
        query: filter,
        sort,
        skip: (page - 1) * limit,
        limit
      });

      const total = await BlogPostRepository.count(filter);

      return {
        data: blogPosts,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      console.error('BlogPostService.getAll error:', error);
      throw error;
    }
  }

  async getById(id) {
    try {
      const blogPost = await BlogPostRepository.findById(id);
      if (!blogPost) throw new Error('Blog post not found');
      return blogPost;
    } catch (error) {
      console.error('BlogPostService.getById error:', error);
      throw error;
    }
  }

  async update(id, updateData) {
    try {
      const blogPost = await BlogPostRepository.update(id, updateData);
      if (!blogPost) throw new Error('Blog post not found');
      return blogPost;
    } catch (error) {
      console.error('BlogPostService.update error:', error);
      throw error;
    }
  }

  async delete(id) {
    try {
      const blogPost = await BlogPostRepository.delete(id);
      if (!blogPost) throw new Error('Blog post not found');
      return blogPost;
    } catch (error) {
      console.error('BlogPostService.delete error:', error);
      throw error;
    }
  }
}

export default new BlogPostService();