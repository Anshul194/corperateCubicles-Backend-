import QueryRepository from '../repository/QueryRepository.js';

export default class QueryService {
  constructor() {
    this.queryRepository = new QueryRepository();
  }

  async createQuery(data) {
    try {
      return await this.queryRepository.create(data);
    } catch (error) {
      console.error('QueryService.createQuery error:', error);
      throw error;
    }
  }

  async getAllQueries(options) {
    try {
      return await this.queryRepository.findAll(options);
    } catch (error) {
      console.error('QueryService.getAllQueries error:', error);
      throw error;
    }
  }

  async getQueryById(id) {
    try {
      return await this.queryRepository.findById(id);
    } catch (error) {
      console.error('QueryService.getQueryById error:', error);
      throw error;
    }
  }

  async updateQuery(id, data) {
    try {
      return await this.queryRepository.update(id, data);
    } catch (error) {
      console.error('QueryService.updateQuery error:', error);
      throw error;
    }
  }
}
