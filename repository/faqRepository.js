import FAQ from '../models/FAQ.js';

class FAQRepository {
  async create(data) {
    try {
      return await FAQ.create(data);
    } catch (error) {
      console.error('FAQRepository.create error:', error);
      throw error;
    }
  }

 async findAll(filters = {}) {
  try {
    return await FAQ.find(filters)
      .populate('courseId', 'title')
      .sort({ sortOrder: 1, createdAt: -1 }); // ✅ updated sort
  } catch (error) {
    console.error('FAQRepository.findAll error:', error);
    throw error;
  }
}

async findByCourseId(courseId) {
  try {
    return await FAQ.find({ courseId })
      .populate('courseId', 'title')
      .sort({ sortOrder: 1, createdAt: -1 }); // ✅ updated sort
  } catch (error) {
    console.error('FAQRepository.findByCourseId error:', error);
    throw error;
  }
}


  async findById(id) {
    try {
      return await FAQ.findById(id).populate('courseId', 'title');
    } catch (error) {
      console.error('FAQRepository.findById error:', error);
      throw error;
    }
  }

 

  async update(id, data) {
    try {
      return await FAQ.findByIdAndUpdate(id, data, { new: true });
    } catch (error) {
      console.error('FAQRepository.update error:', error);
      throw error;
    }
  }

  async delete(id) {
    try {
      return await FAQ.findByIdAndDelete(id);
    } catch (error) {
      console.error('FAQRepository.delete error:', error);
      throw error;
    }
  }
}

export default new FAQRepository();
