import Filter from '../models/Filter.js';

export default class FilterRepository {
  async create(data) {
    try {
      return await Filter.create(data);
    } catch (err) {
      throw new Error(`Failed to create filter: ${err.message}`);
    }
  }

  async findById(id) {
    try {
      return await Filter.findById(id)
        .populate('category')
        .populate('subCategory');
    } catch (err) {
      throw new Error(`Failed to find filter by ID: ${err.message}`);
    }
  }

async getAll(filter = {}, sort = {}, page = 1, limit = 10) {
  try {
    const skip = (page - 1) * limit;

    const [filters, total] = await Promise.all([
      Filter.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('category')
        .populate('subCategory'),
      Filter.countDocuments(filter)
    ]);

    return {
      filters,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  } catch (err) {
    throw new Error(`Failed to get filters: ${err.message}`);
  }
}


  async updateById(id, data) {
    try {
      const result = await Filter.findByIdAndUpdate(id, data, { new: true })
        .populate('category')
        .populate('subCategory');
      //console.log('Updated result:', result);
      return result;
    } catch (err) {
      throw new Error(`Failed to update filter: ${err.message}`);
    }
  }

  async softDeleteById(id) {
    try {
      return await Filter.findByIdAndDelete(id);
    } catch (err) {
      throw new Error(`Failed to soft delete filter: ${err.message}`);
    }
  }
}