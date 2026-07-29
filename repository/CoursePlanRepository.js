import CoursePlan from "../models/CoursePlan.js";

class CoursePlanRepository {
  async create(data) {
    // Only allow salePrice, not discount
    const planData = {
      ...data,
      salePrice: data.salePrice !== undefined ? Number(data.salePrice) : 0,
      duration: data.duration !== undefined ? Number(data.duration) : 0,
      durationType: data.durationType || 'lifetime',
      status: data.status || 'active'
      // discount: undefined // ignore any discount field
    };
    return await CoursePlan.create(planData);
  }
  async findAll(filter = {}) {
    return await CoursePlan.find(filter);
  }
  async findById(id) {
    return await CoursePlan.findById(id);
  }
  async updateById(id, data) {
    return await CoursePlan.findByIdAndUpdate(id, data, { new: true });
  }
  async deleteById(id) {
    return await CoursePlan.findByIdAndDelete(id);
  }
}

export default CoursePlanRepository;