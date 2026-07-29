import mongoose from 'mongoose';
import ModuleRepository from '../repository/ModuleRepository.js';
import Course from '../models/Course.js';
export default class ModuleService {
  constructor() {
    this.repository = new ModuleRepository();
  }

  async create(data) {
    if (!data.courseId || !data.title || data.order === undefined) {
      throw new Error('courseId, title, and order are required');
    }

    //console.log('Creating module with data:', data);

    const courseCategoryExists = await Course.findById(data.courseId);
    if (!courseCategoryExists) {
      throw new Error('Invalid courseId: CourseCategory not found');
    }

    try {
      return await this.repository.create(data);
    } catch (err) {
      // if (err.code === 11000 && err.keyPattern?.title) {
      //   throw new Error('A module with this title already exists.');
      // }
      
      throw err;
    }
  }

  async getById(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error('Invalid module ID');
    }

    const module = await this.repository.findById(id);
    if (!module) throw new Error('Module not found');
    return module;
  }

 async getAll(query) {
  const { page = 1, limit = 10, filters = '{}', sort = '{}', search = '' } = query;

  const parsedFilters = JSON.parse(filters);
  const parsedSort = JSON.parse(sort);

  // Add text search logic (on title for example)
  if (search) {
    parsedFilters.title = { $regex: search, $options: 'i' }; // case-insensitive search
  }

  return await this.repository.getAll(parsedFilters, parsedSort, parseInt(page), parseInt(limit));
}


  async updateById(id, data) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error('Invalid module ID');
    }

    const module = await this.repository.updateById(id, data);
    if (!module) throw new Error('Module not found');
    return module;
  }

  async softDeleteById(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error('Invalid module ID');
    }

    const module = await this.repository.softDeleteById(id);
    if (!module) throw new Error('Module not found');
    return module;
  }
}
