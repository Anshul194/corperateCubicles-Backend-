import JobPosting from '../models/JobPosting.js';

class JobPostRepository {
  async create(jobPostData) {
    try {
      const jobPost = new JobPosting(jobPostData);
      return await jobPost.save();
    } catch (error) {
      console.error('JobPostRepository.create error:', error);
      throw error;
    }
  }

  async findAll({ query = {}, sort = {}, skip = 0, limit = 10 }) {
    try {
      return await JobPosting.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('createdBy', 'fullName email')
        .populate('proposals.userId', 'fullName email profilePicture')
        .select('title description thumbnail status budget category skillsRequired experienceLevel estimatedDuration mode location createdBy proposals createdAt isAdminApproved')
        .lean();
    } catch (error) {
      console.error('JobPostRepository.findAll error:', error);
      throw error;
    }
  }

  async findById(id) {
    try {
      return await JobPosting.findById(id)
        .populate('createdBy', 'fullName email')
        .populate('proposals.userId', 'fullName email profilePicture');
    } catch (error) {
      console.error('JobPostRepository.findById error:', error);
      throw error;
    }
  }

  async update(id, updateData) {
    try {
      return await JobPosting.findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true }
      ).populate('createdBy', 'fullName email');
    } catch (error) {
      console.error('JobPostRepository.update error:', error);
      throw error;
    }
  }

  async delete(id) {
    try {
      return await JobPosting.findByIdAndDelete(id);
    } catch (error) {
      console.error('JobPostRepository.delete error:', error);
      throw error;
    }
  }

  async addProposal(jobId, proposal) {
    try {
      return await JobPosting.findByIdAndUpdate(
        jobId,
        { $push: { proposals: proposal } },
        { new: true }
      ).populate('proposals.userId', 'fullName email profilePicture');
    } catch (error) {
      console.error('JobPostRepository.addProposal error:', error);
      throw error;
    }
  }

  async count(query = {}) {
    try {
      return await JobPosting.countDocuments(query);
    } catch (error) {
      console.error('JobPostRepository.count error:', error);
      throw error;
    }
  }
}

export default new JobPostRepository();
