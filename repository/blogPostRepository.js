import BlogPost from '../models/BlogPost.js';

class BlogPostRepository {
  async create(data) {
    try {
      const blogPost = new BlogPost(data);
      return await blogPost.save();
    } catch (error) {
      console.error('BlogPostRepository.create error:', error);
      throw error;
    }
  }

  async findAll({ query, sort, skip, limit }) {
    try {
      return await BlogPost.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('createdBy', 'fullName email')
        .lean();
    } catch (error) {
      console.error('BlogPostRepository.findAll error:', error);
      throw error;
    }
  }

  async count(query) {
    try {
      return await BlogPost.countDocuments(query);
    } catch (error) {
      console.error('BlogPostRepository.count error:', error);
      throw error;
    }
  }

  async findById(id) {
    try {
      return await BlogPost.findById(id)
        .populate('createdBy', 'fullName email')
        .lean();
    } catch (error) {
      console.error('BlogPostRepository.findById error:', error);
      throw error;
    }
  }

  async update(id, data) {
    try {
      return await BlogPost.findByIdAndUpdate(
        id,
        { $set: data },
        { new: true, runValidators: true }
      ).populate('createdBy', 'fullName email');
    } catch (error) {
      console.error('BlogPostRepository.update error:', error);
      throw error;
    }
  }

  async delete(id) {
    try {
      return await BlogPost.findByIdAndDelete(id);
    } catch (error) {
      console.error('BlogPostRepository.delete error:', error);
      throw error;
    }
  }
}

export default new BlogPostRepository();