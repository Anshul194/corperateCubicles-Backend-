import JobPostRepository from '../repository/jobPostRepository.js';

class JobPostService {
  async create(jobPostData) {
    try {
      return await JobPostRepository.create(jobPostData);
    } catch (error) {
      console.error('JobPostService.create error:', error);
      throw error;
    }
  }

  async getAll(filter = {}, options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        sort = { createdAt: -1 }
      } = options;

      const skip = (page - 1) * limit;
      
      const [jobPosts, total] = await Promise.all([
        JobPostRepository.findAll({ 
          query: filter, 
          sort, 
          skip, 
          limit 
        }),
        JobPostRepository.count(filter)
      ]);

      return {
        data: jobPosts.map(post => ({
          ...post,
          thumbnail: post.thumbnail || null, // Ensure thumbnail is always present
          isAdminApproved: typeof post.isAdminApproved !== 'undefined' ? post.isAdminApproved : false // Always include isAdminApproved
        })),
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      console.error('JobPostService.getAll error:', error);
      throw error;
    }
  }

  async getById(id) {
    try {
      const jobPost = await JobPostRepository.findById(id);
      if (!jobPost) throw new Error('Job post not found');
      return jobPost;
    } catch (error) {
      console.error('JobPostService.getById error:', error);
      throw error;
    }
  }

  async update(id, updateData) {
    try {
      const jobPost = await JobPostRepository.update(id, updateData);
      if (!jobPost) throw new Error('Job post not found');
      return jobPost;
    } catch (error) {
      console.error('JobPostService.update error:', error);
      throw error;
    }
  }

  async delete(id) {
    try {
      const jobPost = await JobPostRepository.delete(id);
      if (!jobPost) throw new Error('Job post not found');
      return jobPost;
    } catch (error) {
      console.error('JobPostService.delete error:', error);
      throw error;
    }
  }

  async submitProposal(jobId, proposalData) {
    try {
      // Validate if user has already submitted a proposal
      const existingJob = await JobPostRepository.findById(jobId);
      if (!existingJob) throw new Error('Job post not found');

      const existingProposal = existingJob.proposals.find(
        p => p.userId?.toString() === proposalData?.userId?.toString()
      );
      if (existingProposal) {
        throw new Error('You have already submitted a proposal for this job');
      }

      // Add proposal
      const updatedJob = await JobPostRepository.addProposal(jobId, proposalData);
      if (!updatedJob) throw new Error('Failed to submit proposal');
      // Ensure createdBy is populated for notification/email
      return updatedJob;
    } catch (error) {
      console.error('JobPostService.submitProposal error:', error);
      throw error;
    }
  }
}

export default new JobPostService();
