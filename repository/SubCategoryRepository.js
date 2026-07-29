import SubCategory from '../models/SubCategory.js';
import CrudRepository from './crudRepository.js';

class SubCategoryRepository extends CrudRepository {
  constructor() {
    super(SubCategory);
  }

  async findBy(data) {
    try {
      const response = await SubCategory.findOne({ ...data, isDeleted: false }).populate('categoryId');
      return response;
    } catch (error) {
      throw error;
    }
  }

  async findAll() {
    try {
      const response = await SubCategory.find({ isDeleted: false }).populate('categoryId');
      return response;
    } catch (error) {
      throw error;
    }
  }

  async findById(id) {
    try {
      const response = await SubCategory.findOne({ _id: id, isDeleted: false }).populate('categoryId');
      return response;
    } catch (error) {
      throw error;
    }
  }

  async updateById(id, updateData) {
    try {
      const updatedSubCategory = await SubCategory.findOneAndUpdate(
        { _id: id, isDeleted: false },
        updateData,
        { new: true }
      ).populate('categoryId');
      return updatedSubCategory;
    } catch (error) {
      throw error;
    }
  }

  async softDeleteById(id) {
    try {
      const deletedSubCategory = await SubCategory.findOneAndUpdate(
        { _id: id, isDeleted: false },
        { isDeleted: true },
        { new: true }
      ).populate('categoryId');
      return deletedSubCategory;
    } catch (error) {
      throw error;
    }
  }

  // Add aggregate method
  async aggregate(pipeline) {
    try {
      return await SubCategory.aggregate(pipeline);
    } catch (error) {
      throw error;
    }
  }
}

export default SubCategoryRepository;