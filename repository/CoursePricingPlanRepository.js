import mongoose from 'mongoose';
import CoursePricingPlan from '../models/coursePricingPlan.js';
import CrudRepository from './crudRepository.js';

class CoursePricingPlanRepository extends CrudRepository {
  constructor() {
    super(CoursePricingPlan);
  }

  async findBy(data) {
    try {
      const response = await CoursePricingPlan.findOne({ ...data, isActive: true })
        .populate('course');
      return response;
    } catch (error) {
      throw new Error(`Failed to find pricing plan: ${error.message}`);
    }
  }

  async findByCourseId(courseId) {
    try {
      if (!mongoose.Types.ObjectId.isValid(courseId)) {
        throw new Error('Invalid course ID');
      }
      const response = await CoursePricingPlan.find({ course: courseId, isActive: true })
        .populate('course');
      return response;
    } catch (error) {
      throw new Error(`Failed to find pricing plans by course ID: ${error.message}`);
    }
  }

  async findAll({ page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc', filter = {}, search = '' } = {}) {
    try {
      const skip = (page - 1) * limit;

      let searchQuery = {};
      if (search) {
        searchQuery = {
          $or: [
            { type: { $regex: search, $options: 'i' } },
            { currency: { $regex: search, $options: 'i' } },
            { features: { $regex: search, $options: 'i' } },
          ],
        };
      }

      const query = {
        isActive: true,
        ...filter,
        ...searchQuery,
      };

      const sortOptions = {};
      sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

      const data = await CoursePricingPlan.find(query)
        .populate('course')
        .skip(skip)
        .limit(limit)
        .sort(sortOptions);

      const total = await CoursePricingPlan.countDocuments(query);

      return {
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      throw new Error(`Failed to get pricing plans: ${error.message}`);
    }
  }

  async findById(id) {
    try {
      const response = await CoursePricingPlan.findOne({ _id: id, isActive: true })
        .populate('course');
      return response;
    } catch (error) {
      throw new Error(`Failed to find pricing plan by ID: ${error.message}`);
    }
  }

  async updateById(id, updateData) {
    try {
      const updatedPlan = await CoursePricingPlan.findOneAndUpdate(
        { _id: id, isActive: true },
        updateData,
        { new: true }
      )
        .populate('course');
      return updatedPlan;
    } catch (error) {
      throw new Error(`Failed to update pricing plan: ${error.message}`);
    }
  }

  async softDeleteById(id) {
    try {
      const deletedPlan = await CoursePricingPlan.findOneAndUpdate(
        { _id: id, isActive: true },
        { isActive: false, updatedAt: new Date() },
        { new: true }
      )
        .populate('course');
      return deletedPlan;
    } catch (error) {
      throw new Error(`Failed to soft delete pricing plan: ${error.message}`);
    }
  }
}

export default CoursePricingPlanRepository;