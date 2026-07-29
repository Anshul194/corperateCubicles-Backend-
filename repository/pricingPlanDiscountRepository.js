import PricingPlanDiscount from '../models/PricingPlanDiscount.js';

export default class PricingPlanDiscountRepository {
  async create(data) {
    try {
      //console.log('PricingPlanDiscountRepository.create called with data:', data);
      // Validate discount based on discountType
      if (data.discountType === 'percentage' && data.discount > 100) {
        throw new Error('Percentage discount cannot exceed 100');
      }
      if (data.discountType === 'amount' && data.discount < 0) {
        throw new Error('Amount discount cannot be negative');
      }
      const discount = await PricingPlanDiscount.create(data);
      //console.log('PricingPlanDiscountRepository.create success:', discount);
      return discount;
    } catch (error) {
      console.error('PricingPlanDiscountRepository.create error:', error);
      throw error;
    }
  }

  async findAll({ page = 1, limit = 10, search = '', sortBy = 'createdAt', sortOrder = 'asc', filters = {} }) {
    try {
      //console.log('PricingPlanDiscountRepository.findAll called with:', { page, limit, search, sortBy, sortOrder, filters });

      const query = { isDeleted: false, ...filters };
      if (search) {
        query.title = { $regex: search, $options: 'i' };
      }

      const skip = (page - 1) * limit;

      const discounts = await PricingPlanDiscount.find(query)
        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limit)
        .populate({
          path: 'course',
          select: 'title'
        });

      const total = await PricingPlanDiscount.countDocuments(query);

      return {
        data: discounts,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      console.error('PricingPlanDiscountRepository.findAll error:', error);
      throw error;
    }
  }

  async findById(id) {
    try {
      //console.log('PricingPlanDiscountRepository.findById called with id:', id);
      const discount = await PricingPlanDiscount.findById(id)
        .populate({
          path: 'course',
          select: 'title'
        });
      //console.log('PricingPlanDiscountRepository.findById success:', discount);
      return discount;
    } catch (error) {
      console.error('PricingPlanDiscountRepository.findById error:', error);
      throw error;
    }
  }

  async update(id, data) {
    try {
      //console.log('PricingPlanDiscountRepository.update called with id:', id, 'and data:', data);
      // Validate discount based on discountType
      if (data.discountType === 'percentage' && data.discount > 100) {
        throw new Error('Percentage discount cannot exceed 100');
      }
      if (data.discountType === 'amount' && data.discount < 0) {
        throw new Error('Amount discount cannot be negative');
      }
      const updatedDiscount = await PricingPlanDiscount.findByIdAndUpdate(id, data, { new: true })
        .populate('course', 'title');
      //console.log('PricingPlanDiscountRepository.update success:', updatedDiscount);
      return updatedDiscount;
    } catch (error) {
      console.error('PricingPlanDiscountRepository.update error:', error);
      throw error;
    }
  }

  async delete(id) {
    try {
      //console.log('PricingPlanDiscountRepository.delete called with id:', id);
      const deletedDiscount = await PricingPlanDiscount.findByIdAndUpdate(
        id,
        { isDeleted: true },
        { new: true }
      );
      //console.log('PricingPlanDiscountRepository.delete success:', deletedDiscount);
      return deletedDiscount;
    } catch (error) {
      console.error('PricingPlanDiscountRepository.delete error:', error);
      throw error;
    }
  }
}