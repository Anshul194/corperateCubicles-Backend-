import CoursePlanRepository from "../repository/CoursePlanRepository.js";

class CoursePlanService {
  constructor() {
    this.repo = new CoursePlanRepository();
  }
  async create(data) {
    return await this.repo.create(data);
  }
  async getAll(filter = {}) {
    return await this.repo.findAll(filter);
  }
  async getById(id) {
    return await this.repo.findById(id);
  }
  async updateById(id, data) {
    return await this.repo.updateById(id, data);
  }
  async deleteById(id) {
    return await this.repo.deleteById(id);
  }
}

export default CoursePlanService;