import DeleteAccountRequest from '../models/DeleteAccountRequest.js';
import escapeRegExp from '../utils/escapeRegExp.js';

export default class DeleteAccountRequestRepository {
  async create(data) {
    return await DeleteAccountRequest.create(data);
  }

async findAll({ page = 1, limit = 10, search = '', status = '' }) {
  try {
    const skip = (page - 1) * limit;

    const matchStage = {};

    if (status) {
      matchStage.status = status;
    }

    // escapeRegExp caps length at 200 and escapes regex metacharacters
    // so user-supplied search is matched literally (prevents ReDoS).
    const searchRegex = new RegExp(escapeRegExp(String(search)), 'i');

    const pipeline = [
      { $match: matchStage },
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      {
        $match: {
          $or: [
            { reason: { $regex: searchRegex } },
            { 'user.fullName': { $regex: searchRegex } },
            { 'user.email': { $regex: searchRegex } }
          ]
        }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: parseInt(limit) }
          ],
          totalCount: [
            { $count: 'count' }
          ]
        }
      }
    ];

    const result = await DeleteAccountRequest.aggregate(pipeline);

    const data = result[0].data;
    const total = result[0].totalCount[0]?.count || 0;

    return {
      data,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit),
      total
    };
  } catch (error) {
    console.error('Error in findAll (aggregation):', error.message);
    throw new Error('Failed to fetch delete account requests');
  }
}



  async findPendingByUser(userId) {
  try {
    return await DeleteAccountRequest.findOne({ user: userId, status: 'pending' });
  } catch (error) {
    console.error('Error in findPendingByUser:', error.message);
    throw new Error('Failed to fetch pending delete request');
  }
}

async updateStatusById(id, status) {
  try {
    return await DeleteAccountRequest.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    ).populate('user');
  } catch (error) {
    console.error('Error in updateStatusById:', error.message);
    throw new Error('Failed to update delete request status');
  }
}

}
