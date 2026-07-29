import VideoLesson from '../models/video.js';

class VideoLessonRepository {
  async create(data) {
    try {
      const videoLesson = new VideoLesson(data);
      return await videoLesson.save();
    } catch (error) {
      console.error('Error in create:', error);
      throw error;
    }
  }

  async findById(id) {
    try {
      //console.log("Finding video lesson by ID:", id);
      return await VideoLesson.findById(id)
        .populate('lessonId', 'title description')
        .populate('uploadedBy', 'name email');
    } catch (error) {
      console.error('Error in findById:', error);
      throw error;
    }
  }

  async findAll(filters = {}, options = {}) {
    try {
      const { page = 1, limit = 10, sort = { createdAt: -1 } } = options;
      const query = { isDeleted: false, ...filters };
      const skip = (page - 1) * limit;

      const [data, total] = await Promise.all([
        VideoLesson.find(query)
          .populate('lessonId', 'title description')
          .populate('uploadedBy', 'name email')
          .sort(sort)
          .skip(skip)
          .limit(limit),
        VideoLesson.countDocuments(query)
      ]);

      return {
        data,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      console.error('Error in findAll:', error);
      throw error;
    }
  }

  async findByLessonId(lessonId) {
    try {
      return await VideoLesson.find({
        lessonId,
        isDeleted: false
      })
        .populate('uploadedBy', 'name email')
        .sort({ createdAt: -1 });
    } catch (error) {
      console.error('Error in findByLessonId:', error);
      throw error;
    }
  }

  async findByPlatform(platform) {
    try {
      return await VideoLesson.find({
        sourcePlatform: platform,
        isDeleted: false
      })
        .populate('lessonId', 'title description')
        .populate('uploadedBy', 'name email');
    } catch (error) {
      console.error('Error in findByPlatform:', error);
      throw error;
    }
  }

  async updateById(id, data) {
    try {
      return await VideoLesson.findByIdAndUpdate(
        id,
        { ...data, updatedAt: new Date() },
        { new: true, runValidators: true }
      )
        .populate('lessonId', 'title description')
        .populate('uploadedBy', 'name email');
    } catch (error) {
      console.error('Error in updateById:', error);
      throw error;
    }
  }

  async deleteById(id) {
    try {
      return await VideoLesson.findByIdAndUpdate(
        id,
        { isDeleted: true, updatedAt: new Date() },
        { new: true }
      );
    } catch (error) {
      console.error('Error in deleteById:', error);
      throw error;
    }
  }

  async hardDelete(id) {
    try {
      return await VideoLesson.findByIdAndDelete(id);
    } catch (error) {
      console.error('Error in hardDelete:', error);
      throw error;
    }
  }

  async updateStatus(id, status) {
    try {
      return await VideoLesson.findByIdAndUpdate(
        id,
        { status, updatedAt: new Date() },
        { new: true }
      );
    } catch (error) {
      console.error('Error in updateStatus:', error);
      throw error;
    }
  }

  async findByStatus(status) {
    try {
      return await VideoLesson.find({
        status,
        isDeleted: false
      })
        .populate('lessonId', 'title description')
        .populate('uploadedBy', 'name email');
    } catch (error) {
      console.error('Error in findByStatus:', error);
      throw error;
    }
  }

  async exists(id) {
    try {
      return await VideoLesson.exists({ _id: id, isDeleted: false });
    } catch (error) {
      console.error('Error in exists:', error);
      throw error;
    }
  }
}

export default new VideoLessonRepository();
