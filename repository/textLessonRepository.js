import TextLesson from '../models/TextLesson.js';

class TextLessonRepository {
    static async create(data) {
        try {
            const lesson = new TextLesson(data);
            return await lesson.save();
        } catch (error) {
            throw new Error('Repository: Failed to create text lesson: ' + error.message);
        }
    }

static async findAll({
  page = 1,
  limit = 10,
  search = '',
  sortBy = 'createdAt',
  sortOrder = 'asc',
  filters = {}
} = {}) {
  try {
    const query = { ...filters };

    if (search) {
      query.title = { $regex: search, $options: 'i' };
    }

    const skip = (page - 1) * limit;

    const lessons = await TextLesson.find(query)
      .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
      .skip(skip)
      .limit(limit)
      .populate('course', 'title') // optional if used
      .populate('lesson', 'title'); // optional if used

    const total = await TextLesson.countDocuments(query);

    return {
      data: lessons,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  } catch (error) {
    throw new Error('Repository: Failed to fetch text lessons: ' + error.message);
  }
}


  static async findById(id) {
    try {
        return await TextLesson.findById(id)
            .populate('course', 'title') 
            .populate('lesson', 'title'); 
    } catch (error) {
        throw new Error('Repository: Failed to fetch text lesson: ' + error.message);
    }
}


    static async updateById(id, data) {
        try {
            return await TextLesson.findByIdAndUpdate(id, data, { new: true });
        } catch (error) {
            throw new Error('Repository: Failed to update text lesson: ' + error.message);
        }
    }

    static async deleteById(id) {
        try {
            return await TextLesson.findByIdAndDelete(id);
        } catch (error) {
            throw new Error('Repository: Failed to delete text lesson: ' + error.message);
        }
    }
}

export default TextLessonRepository;