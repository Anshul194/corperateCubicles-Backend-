import QuickLink from '../models/QuickLink.js';
import CrudRepository from './crudRepository.js';

class QuickLinkRepository extends CrudRepository {
  constructor() {
    super(QuickLink);
  }

  async findActive() {
    try {
      const links = await QuickLink.find({ isActive: true })
        .sort({ priority: -1, createdAt: -1 });
      return links;
    } catch (error) {
      throw error;
    }
  }

  async findByType(type) {
    try {
      const links = await QuickLink.find({ type, isActive: true })
        .sort({ priority: -1, createdAt: -1 });
      return links;
    } catch (error) {
      throw error;
    }
  }

  async aggregate(pipeline) {
    return await this.model.aggregate(pipeline);
  }

  async updateById(id, updateData) {
    try {
      const updatedLink = await QuickLink.findOneAndUpdate(
        { _id: id },
        updateData,
        { new: true }
      );
      return updatedLink;
    } catch (error) {
      throw error;
    }
  }
}

export default QuickLinkRepository;
