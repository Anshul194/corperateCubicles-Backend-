import File from '../models/File.js';

class FileRepository {
  async create(data) {
    try {
      return await File.create(data);
    } catch (error) {
      console.error('FileRepository.create error:', error);
      throw error;
    }
  }

  async findAll({ page = 1, limit = 10, search = '', sortBy = 'createdAt', sortOrder = 'asc', filters = {} }) {
    try {
      const query = { ...filters };

      if (search) {
        query.title = { $regex: search, $options: 'i' }; // optional if you want search by title
      }

      const skip = (page - 1) * limit;

      const files = await File.find(query)
        .populate('courseId', 'title slug')       // populate with selected fields from Course
        .populate('lessonId', 'title slug')       // populate with selected fields from Lesson
        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limit);

      const total = await File.countDocuments(query);

      return {
        data: files,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      console.error('FileRepository.findAll error:', error);
      throw error;
    }
  }

  async findById(id) {
    try {
      return await File.findById(id)
        .populate('courseId', 'title slug')
        .populate('lessonId', 'title slug');
    } catch (error) {
      console.error('FileRepository.findById error:', error);
      throw error;
    }
  }

  async update(id, data) {
    try {
      //console.log('Updating file with id:', id, 'and data:', data);
      return await File.findByIdAndUpdate(id, data, { new: true })
        .populate('courseId', 'title slug')
        .populate('lessonId', 'title slug');
    } catch (error) {
      console.error('FileRepository.update error:', error);
      throw error;
    }
  }

  async delete(id) {
    try {
      return await File.findByIdAndDelete(id);
    } catch (error) {
      console.error('FileRepository.delete error:', error);
      throw error;
    }
  }
}

export default new FileRepository();
