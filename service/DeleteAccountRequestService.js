import DeleteAccountRequestRepository from '../repository/DeleteAccountRequestRepository.js';
import User from '../models/user.js';

export default class DeleteAccountRequestService {
  constructor() {
    this.repo = new DeleteAccountRequestRepository();
  }

  async createRequest(userId, reason) {
    const existing = await this.repo.findPendingByUser(userId);
    if (existing) {
      throw new Error('You already have a pending delete request.');
    }
    return await this.repo.create({ user: userId, reason });
  }

  async getAllRequests(params) {
  try {
    return await this.repo.findAll(params);
  } catch (error) {
    console.error('Error in getAllRequests:', error.message);
    throw new Error('Failed to fetch delete account requests');
  }
}

async updateStatus(id, status) {
  try {
    const result = await this.repo.updateStatusById(id, status);
    
    // If request is approved, update user status to inactive
    if (status == 'approved' && result?.user?._id) {
      await User.findByIdAndUpdate(result.user._id, {
        status: 'inactive',
        isActive: false
      });
    }
    
    return result;
  } catch (error) {
    console.error('Error in updateStatus:', error.message);
    throw new Error('Failed to update delete account request status');
  }
}


}
