import pageRepo from '../repository/pageRepository.js';

class PageService {
  async createPage(data) {
    try {
      return await pageRepo.create(data);
    } catch (error) {
      console.error("❌ Error in createPage:", error);
      throw new Error("Failed to create page");
    }
  }

  async getAllPages() {
    try {
      return await pageRepo.findAll();
    } catch (error) {
      console.error("❌ Error in getAllPages:", error);
      throw new Error("Failed to fetch all pages");
    }
  }

  async getPageById(id) {
    try {
      return await pageRepo.findById(id);
    } catch (error) {
      console.error("❌ Error in getPageById:", error);
      throw new Error("Failed to fetch page by ID");
    }
  }

  async updatePage(id, data) {
    try {
      return await pageRepo.update(id, data);
    } catch (error) {
      console.error("❌ Error in updatePage:", error);
      throw new Error("Failed to update page");
    }
  }

  async deletePage(id) {
    try {
      return await pageRepo.delete(id);
    } catch (error) {
      console.error("❌ Error in deletePage:", error);
      throw new Error("Failed to delete page");
    }
  }
}

export default new PageService();
