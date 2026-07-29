import mongoose from 'mongoose';
import CoursePricingPlanRepository from '../repository/CoursePricingPlanRepository.js';
import Course from '../models/Course.js';

class CoursePricingPlanService {
  constructor() {
    this.repository = new CoursePricingPlanRepository();
  }

  async create(pricingPlanData) {
    try {
      if (!pricingPlanData) {
        throw new Error('Pricing plan data is undefined');
      }

      const { course, type, features } = pricingPlanData;
      if (!course || !type) {
        throw new Error('Course and type are required');
      }

      const courseExists = await Course.findOne({ _id: course, isDeleted: false });
      if (!courseExists) {
        throw new Error('Invalid or non-existent course');
      }

      if (features && !Array.isArray(features)) {
        throw new Error('Features must be an array');
      }

      if (features && features.length > 10) {
        throw new Error('Maximum 10 features allowed');
      }

      const existingPlan = await this.repository.findBy({ course, type });
      if (existingPlan) {
        throw new Error('A pricing plan with this course and type already exists');
      }

      const pricingPlan = await this.repository.create(pricingPlanData);
      return pricingPlan;
    } catch (error) {
      throw error;
    }
  }

  async getById(id) {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new Error('Invalid pricing plan ID');
      }

      const pricingPlan = await this.repository.findById(id);
      if (!pricingPlan) {
        throw new Error('Pricing plan not found');
      }
      return pricingPlan;
    } catch (error) {
      throw error;
    }
  }

  async getByCourseId(courseId) {
    try {
      if (!mongoose.Types.ObjectId.isValid(courseId)) {
        throw new Error('Invalid course ID');
      }

      const pricingPlans = await this.repository.findByCourseId(courseId);
      if (!pricingPlans || pricingPlans.length === 0) {
        throw new Error('No pricing plans found for this course');
      }
      return pricingPlans;
    } catch (error) {
      throw error;
    }
  }

  async getAll(options = {}) {
    try {
      const pricingPlansWithPagination = await this.repository.findAll(options);
      return pricingPlansWithPagination;
    } catch (error) {
      throw error;
    }
  }

  async updateById(id, updateData) {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new Error('Invalid pricing plan ID');
      }

      const { course, type, features } = updateData;

      if (course) {
        const courseExists = await Course.findOne({ _id: course, isDeleted: false });
        if (!courseExists) {
          throw new Error('Invalid or non-existent course');
        }
      }

      if (type && course) {
        const existingPlan = await this.repository.findBy({ course, type });
        if (existingPlan && existingPlan._id.toString() !== id) {
          throw new Error('A pricing plan with this course and type already exists');
        }
      }

      if (features && !Array.isArray(features)) {
        throw new Error('Features must be an array');
      }

      if (features && features.length > 10) {
        throw new Error('Maximum 10 features allowed');
      }

      if (Object.keys(updateData).length === 0) {
        throw new Error('No valid fields to update');
      }

      const updatedPlan = await this.repository.updateById(id, updateData);
      if (!updatedPlan) {
        throw new Error('Pricing plan not found');
      }
      return updatedPlan;
    } catch (error) {
      throw error;
    }
  }

  async softDeleteById(id) {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new Error('Invalid pricing plan ID');
      }

      const deletedPlan = await this.repository.softDeleteById(id);
      if (!deletedPlan) {
        throw new Error('Pricing plan not found');
      }
      return deletedPlan;
    } catch (error) {
      throw error;
    }
  }
}

export default CoursePricingPlanService;