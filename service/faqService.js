import faqRepo from '../repository/faqRepository.js';

class FAQService {
  async createFAQ(data) {
    try {
      return await faqRepo.create(data);
    } catch (error) {
      console.error('FAQService.createFAQ error:', error);
      throw error;
    }
  }

  async getAllFAQs(filters) {
    try {
      return await faqRepo.findAll(filters);
    } catch (error) {
      console.error('FAQService.getAllFAQs error:', error);
      throw error;
    }
  }

  async getFAQById(id) {
    try {
      return await faqRepo.findById(id);
    } catch (error) {
      console.error('FAQService.getFAQById error:', error);
      throw error;
    }
  }

  async getFAQsByCourseId(courseId) {
    try {
      return await faqRepo.findByCourseId(courseId);
    } catch (error) {
      console.error('FAQService.getFAQsByCourseId error:', error);
      throw error;
    }
  }

  async updateFAQ(id, data) {
    try {
      return await faqRepo.update(id, data);
    } catch (error) {
      console.error('FAQService.updateFAQ error:', error);
      throw error;
    }
  }

  async deleteFAQ(id) {
    try {
      return await faqRepo.delete(id);
    } catch (error) {
      console.error('FAQService.deleteFAQ error:', error);
      throw error;
    }
  }
}

export default new FAQService();
