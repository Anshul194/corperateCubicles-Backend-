import ForumRepository from '../repository/forumRepository.js';

export default class ForumService {
  constructor() {
    this.forumRepository = new ForumRepository();
  }

  // Thread Services
  async createThread(data) {
    try {
      //console.log('ForumService: Creating thread with data:', data);
      const thread = await this.forumRepository.createThread(data);
      //console.log('ForumService: Thread created successfully:', thread);
      return thread;
    } catch (error) {
      console.error('ForumService: Error in createThread:', error);
      throw error;
    }
  }

  async getAllThreads(options) {
    try {
      return await this.forumRepository.findAllThreads(options);
    } catch (error) {
      console.error('ForumService: Error in getAllThreads:', error);
      throw error;
    }
  }

  async getThreadById(id) {
    try {
      return await this.forumRepository.findThreadById(id);
    } catch (error) {
      console.error('ForumService: Error in getThreadById:', error);
      throw error;
    }
  }

  

  async updateThread(id, data, userId, isAdmin = false) {
    try {
      //console.log('ForumService: Updating thread with ID:', id, 'and data:', data);
      
      // Check ownership
      const thread = await this.forumRepository.findThreadById(id);
      if (!thread) {
        throw new Error('Thread not found');
      }
      
      // Allow update if user is admin OR thread owner
      let threadCreatorId = thread.createdBy;
      if (typeof threadCreatorId === 'object' && threadCreatorId._id) {
        threadCreatorId = threadCreatorId._id;
      }
      if (!isAdmin && threadCreatorId.toString() !== userId.toString()) {
        throw new Error('Unauthorized to update this thread');
      }

      return await this.forumRepository.updateThread(id, data);
    } catch (error) {
      console.error('ForumService: Error in updateThread:', error);
      throw error;
    }
  }

  async updateThreadOpenSource(id, isOpenSource) {
  try {
    const updated = await this.forumRepository.updateThreadOpenSource(id, isOpenSource);
    return updated;
  } catch (error) {
    console.error("ForumService.updateThreadOpenSource error:", error);
    throw error;
  }
}


  async deleteThread(id, userId, isAdmin) {
    try {
      const thread = await this.forumRepository.findThreadById(id);
      if (!thread) {
        throw new Error('Thread not found');
      }

      console.log('ForumService: Deleting thread with ID:', id, 'by user:', userId, 'isAdmin:', isAdmin);
      console.log('ForumService: Thread createdBy:', thread);
      

      // Support both ObjectId and populated object for createdBy
      let threadCreatorId = thread.createdBy;
      if (typeof threadCreatorId === 'object' && threadCreatorId._id) {
        threadCreatorId = threadCreatorId._id;
      }
      if (!isAdmin && threadCreatorId.toString() !== userId.toString()) {
        throw new Error('Unauthorized to delete this thread');
      }

      return await this.forumRepository.deleteThread(id);
    } catch (error) {
      console.error('ForumService: Error in deleteThread:', error);
      throw error;
    }
  }

  async pinThread(id, isPinned) {
    try {
      return await this.forumRepository.updateThread(id, { isPinned });
    } catch (error) {
      console.error('ForumService: Error in pinThread:', error);
      throw error;
    }
  }

  async likeThread(id, userId) {
    try {
      return await this.forumRepository.toggleLikeThread(id, userId);
    } catch (error) {
      console.error('ForumService: Error in likeThread:', error);
      throw error;
    }
  }

  async searchThreads(options) {
    try {
      return await this.forumRepository.searchThreads(options);
    } catch (error) {
      console.error('ForumService: Error in searchThreads:', error);
      throw error;
    }
  }

  // Reply Services
  async createReply(data) {
    try {
      //console.log('ForumService: Creating reply with data:', data);
      const reply = await this.forumRepository.createReply(data);
      //console.log('ForumService: Reply created successfully:', reply);
      return reply;
    } catch (error) {
      console.error('ForumService: Error in createReply:', error);
      throw error;
    }
  }

  async getReplies(options) {
    try {
      return await this.forumRepository.findReplies(options);
    } catch (error) {
      console.error('ForumService: Error in getReplies:', error);
      throw error;
    }
  }

  async updateReply(id, data, userId) {
    try {
      const reply = await this.forumRepository.findReplyById(id);
      if (!reply) {
        throw new Error('Reply not found');
      }
      
      if (reply.repliedBy.toString() !== userId.toString()) {
        throw new Error('Unauthorized to update this reply');
      }

      return await this.forumRepository.updateReply(id, data);
    } catch (error) {
      console.error('ForumService: Error in updateReply:', error);
      throw error;
    }
  }

  async deleteReply(id, userId, isAdmin) {
    try {
      const reply = await this.forumRepository.findReplyById(id);
      if (!reply) {
        throw new Error('Reply not found');
      }
      
      if (!isAdmin && reply.repliedBy.toString() !== userId.toString()) {
        throw new Error('Unauthorized to delete this reply');
      }

      return await this.forumRepository.deleteReply(id);
    } catch (error) {
      console.error('ForumService: Error in deleteReply:', error);
      throw error;
    }
  }

  async likeReply(id, userId) {
    try {
      return await this.forumRepository.toggleLikeReply(id, userId);
    } catch (error) {
      console.error('ForumService: Error in likeReply:', error);
      throw error;
    }
  }

  async getAllThreadsWithReplies(query) {
    try {
      return await this.forumRepository.findAllThreadsWithReplies(query);
    } catch (error) {
      console.error('ForumService: Error in getAllThreadsWithReplies:', error);
      throw error;
    }
  }
async getAllTags(courseId = null) {
  try {
    return await this.forumRepository.findAllTags(courseId);
  } catch (error) {
    console.error('ForumService: Error in getAllTags:', error);
    throw error;
  }
}

async getThreadByIdAdmin(id) {
    try {
      return await this.forumRepository.findThreadByIdAdmin(id);
    } catch (error) {
      console.error("ForumService.getThreadByIdAdmin error:", error);
      throw error;
    }
  }



 async filterThreadsByTags(options) {
    try {
      return await this.forumRepository.findThreadsByTags(options);
    } catch (error) {
      console.error('ForumService: Error in filterThreadsByTags:', error);
      throw error;
    }
  }
}


