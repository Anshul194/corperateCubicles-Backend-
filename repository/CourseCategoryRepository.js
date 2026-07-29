import CourseCategory from '../models/CourseCategory.js';
import CrudRepository from './crudRepository.js';

class CourseCategoryRepository extends CrudRepository {
  constructor() {
    super(CourseCategory);
  }

  async findBy(data) {
    try {
      const response = await CourseCategory.findOne({ ...data, isDeleted: false });
      return response;
    } catch (error) {
      throw error;
    }
  }

  async findAll() {
    try {
      const response = await CourseCategory.find({ isDeleted: false });
      return response;
    } catch (error) {
      throw error;
    }
  }

  async countSubCategories(categoryId) {
    try {
      const count = await CourseCategory.countDocuments({ parentCategory: categoryId, isDeleted: false });
      return count;
    } catch (error) {
      throw error;
    }
  }

  async aggregate(pipeline) {
    return await this.model.aggregate(pipeline);
  }

  async findById(id) {
    try {
      const response = await CourseCategory.findOne({ _id: id, isDeleted: false });
      return response;
    } catch (error) {
      throw error;
    }
  }

  async updateById(id, updateData) {
    try {
      const updatedCategory = await CourseCategory.findOneAndUpdate(
        { _id: id, isDeleted: false },
        updateData,
        { new: true }
      );
      return updatedCategory;
    } catch (error) {
      throw error;
    }
  }

  async softDeleteById(id) {
    try {
      const deletedCategory = await CourseCategory.findOneAndUpdate(
        { _id: id, isDeleted: false },
        { isDeleted: true },
        { new: true }
      );
      return deletedCategory;
    } catch (error) {
      throw error;
    }
  }
}

export default CourseCategoryRepository;