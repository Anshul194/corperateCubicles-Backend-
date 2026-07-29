import Page from '../models/page.js';

class PageRepository {
  async create(data) {
    try {
      return await Page.create(data);
    } catch (error) {
      console.error('❌ Error in PageRepository.create:', error);
      throw new Error('Failed to create page');
    }
  }

  async findAll(filter = {}, sort = { createdAt: -1 }) {
    try {
      return await Page.find(filter).sort(sort);
    } catch (error) {
      console.error('❌ Error in PageRepository.findAll:', error);
      throw new Error('Failed to fetch pages');
    }
  }

  async findById(id) {
    try {
      return await Page.findById(id);
    } catch (error) {
      console.error('❌ Error in PageRepository.findById:', error);
      throw new Error('Failed to fetch page by ID');
    }
  }

  async update(id, data) {
    try {
      return await Page.findByIdAndUpdate(id, data, { new: true });
    } catch (error) {
      console.error('❌ Error in PageRepository.update:', error);
      throw new Error('Failed to update page');
    }
  }

  async delete(id) {
    try {
      return await Page.findByIdAndDelete(id);
    } catch (error) {
      console.error('❌ Error in PageRepository.delete:', error);
      throw new Error('Failed to delete page');
    }
  }
}

export default new PageRepository();
