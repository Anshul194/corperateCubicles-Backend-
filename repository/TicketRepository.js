// repository/TicketRepository.js
import SupportTicket from '../models/SupportTicket.js';
import CrudRepository from './crudRepository.js';

class TicketRepository extends CrudRepository {
  constructor() {
    super(SupportTicket);
  }

  async findById(id) {
    try {
      return await SupportTicket.findById(id)
        .populate('userId', 'fullName email role')
        .populate('messages.sender', 'fullName email role');
    } catch (error) {
      throw error;
    }
  }

  async findAll() {
    try {
      return await SupportTicket.find({ isDeleted: false })
        .populate('userId', 'fullName email')
        .sort({ createdAt: -1 });
    } catch (error) {
      throw error;
    }
  }

  async findAllWithPagination(queryConditions, sortConditions = {}, skip = 0, limit = 10) {
    try {
      const tickets = await SupportTicket.find(queryConditions)
        .populate('userId', 'fullName email')
        .sort(sortConditions)
        .skip(skip)
        .limit(limit);

      const total = await SupportTicket.countDocuments(queryConditions);
      return { tickets, total };
    } catch (error) {
      throw error;
    }
  }

  async updateById(id, updateFields) {
    try {
      return await SupportTicket.findByIdAndUpdate(
        id,
        { $set: updateFields },
        { new: true }
      )
      .populate('userId', 'fullName email')
      .populate('messages.sender', 'fullName email role');
    } catch (error) {
      throw error;
    }
  }

  async addMessage(ticketId, messageData) {
    try {
      return await SupportTicket.findByIdAndUpdate(
        ticketId,
        { $push: { messages: messageData } },
        { new: true }
      )
      .populate('userId', 'fullName email')
      .populate('messages.sender', 'fullName email role');
    } catch (error) {
      throw error;
    }
  }

  async deleteMessage(ticketId, messageId) {
    try {
      return await SupportTicket.findByIdAndUpdate(
        ticketId,
        { $pull: { messages: { _id: messageId } } },
        { new: true }
      )
      .populate('userId', 'fullName email')
      .populate('messages.sender', 'fullName email role');
    } catch (error) {
      throw error;
    }
  }

  async softDeleteById(id) {
    try {
      return await SupportTicket.findByIdAndDelete(
        id,
        { isDeleted: true },
        { new: true }
      );
    } catch (error) {
      throw error;
    }
  }

  async getTicketStats() {
    try {
      const pipeline = [
        { $match: { isDeleted: false } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ];
      return await SupportTicket.aggregate(pipeline);
    } catch (error) {
      throw error;
    }
  }

  async findByStatus(status) {
    try {
      return await SupportTicket.find({ status, isDeleted: false })
        .populate('userId', 'fullName email')
        .sort({ createdAt: -1 });
    } catch (error) {
      throw error;
    }
  }

  async findByCategory(category) {
    try {
      return await SupportTicket.find({ category, isDeleted: false })
        .populate('userId', 'fullName email')
        .sort({ createdAt: -1 });
    } catch (error) {
      throw error;
    }
  }
}

export default TicketRepository;
