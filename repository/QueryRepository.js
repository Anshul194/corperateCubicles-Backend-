import Query from '../models/Query.js';

export default class QueryRepository {
  async create(data) {
    try {
      return await Query.create(data);
    } catch (error) {
      console.error('QueryRepository.create error:', error);
      throw error;
    }
  }

  async findAll({ page = 1, limit = 10, search = '', status, category }) {
    try {
      const skip = (page - 1) * limit;

      const query = { isDeleted: false };

      // Search by name, email, phone, message
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } },
          { message: { $regex: search, $options: 'i' } }
        ];
      }

      if (status) query.status = status;
      if (category) query.category = category;

      const data = await Query.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const total = await Query.countDocuments(query);

      return {
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      console.error('QueryRepository.findAll error:', error);
      throw error;
    }
  }

  async findById(id) {
    try {
      return await Query.findById(id);
    } catch (error) {
      console.error('QueryRepository.findById error:', error);
      throw error;
    }
  }

  async update(id, data) {
    try {
      return await Query.findByIdAndUpdate(id, data, { new: true });
    } catch (error) {
      console.error('QueryRepository.update error:', error);
      throw error;
    }
  }
}
