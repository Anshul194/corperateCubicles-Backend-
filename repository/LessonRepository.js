import Lesson from '../models/Lesson.js';

export default class LessonRepository {
  async create(data) {
    try {
      //console.log('==========================================LessonRepository.create called with data:', data);
      const lesson = await Lesson.create(data);
      //console.log('//////////////////////////LessonRepository.create success:', lesson);
      return lesson;
    } catch (error) {
      console.error('LessonRepository.create error:', error);
      throw error;
    }
  }

async findAll({ page = 1, limit = 10, search = '', sortBy = 'order', sortOrder = 'asc', filters = {} }) {
  try {
    //console.log('LessonRepository.findAll called with:', { page, limit, search, sortBy, sortOrder, filters });

    const query = { isDeleted: false, ...filters };

    if (search) {
      query.title = { $regex: search, $options: 'i' };
    }

    const skip = (page - 1) * limit;

    const lessons = await Lesson.find(query)
      .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
      .skip(skip)
      .limit(limit)
      .populate({
        path: 'section',
        select: '-__v -isDeleted',
        populate: [
          { path: 'categoryId', select: 'name' },
          { path: 'subCategoryId', select: 'name' },
          { path: 'instructorId', select: 'name email' }
        ]
      })
      .populate({
        path: 'moduleId',
        select: '-__v -isDeleted',
        populate: {
          path: 'courseId',
          select: 'title'
        }
      });

    const total = await Lesson.countDocuments(query);

    return {
      data: lessons,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  } catch (error) {
    console.error('LessonRepository.findAll error:', error);
    throw error;
  }
}




async findById(id) {
  try {
    //console.log('LessonRepository.findById called with id:', id);

    const lesson = await Lesson.findById(id)
      .populate({
        path: 'section', // Course
        select: '-__v -isDeleted',
        populate: [
          { path: 'categoryId', select: 'name' },
          { path: 'subCategoryId', select: 'name' },
          { path: 'instructorId', select: 'name email' }
        ]
      })
      .populate({
        path: 'moduleId', // Module
        select: '-__v -isDeleted',
        populate: {
          path: 'courseId',
          select: 'title'
        }
      });

    //console.log('Populated lesson.section:', lesson?.section);
    //console.log('Populated lesson.moduleId:', lesson?.moduleId);

    return lesson;
  } catch (error) {
    console.error('LessonRepository.findById error:', error);
    throw error;
  }
}


  async update(id, data) {
    try {
      //console.log('LessonRepository.update called with id:', id, 'and data:', data);
      const updatedLesson = await Lesson.findByIdAndUpdate(id, data, { new: true })
        .populate('section', 'name')
        .populate('moduleId', 'name');
      //console.log('LessonRepository.update success:', updatedLesson);
      return updatedLesson;
    } catch (error) {
      console.error('LessonRepository.update error:', error);
      throw error;
    }
  }

  async delete(id) {
    try {
      //console.log('LessonRepository.delete called with id:', id);
      const deletedLesson = await Lesson.findByIdAndDelete(id, { isDeleted: true }, { new: true });
      //console.log('LessonRepository.delete success:', deletedLesson);
      return deletedLesson;
    } catch (error) {
      console.error('LessonRepository.delete error:', error);
      throw error;
    }
  }
}
