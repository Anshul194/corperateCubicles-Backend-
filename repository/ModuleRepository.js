import Module from '../models/Module.js';

export default class ModuleRepository {
  async create(data) {
    try {
      const module = await Module.create(data);
      // Push the created module's _id to the related Course's modules array
      await import('../models/Course.js').then(async ({ default: Course }) => {
        if (module.courseId) {
          await Course.findByIdAndUpdate(
        module.courseId,
        { $push: { modules: module._id } }
          );
        }
      });
      return module;

    } catch (err) {
      throw new Error(`Failed to create module: ${err.message}`);
    }
  }

  async findById(id) {
    try {
      return await Module.findById(id)
        .populate({
          path: 'courseId',
          populate: {
            path: 'modules',
            populate: { path: 'lessons' }
          }
        })
        .populate({ path: 'lessons' });
    } catch (err) {
      throw new Error(`Failed to find module by ID: ${err.message}`);
    }
  }

 async getAll(filter = {}, sort = {}, page = 1, limit = 10) {
  try {
    const skip = (page - 1) * limit;

    const [modules, total] = await Promise.all([
      Module.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('courseId'),
      Module.countDocuments(filter)
    ]);

    return {
      modules,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  } catch (err) {
    throw new Error(`Failed to get modules: ${err.message}`);
  }
}


  async updateById(id, data) {
    try {
      const result = await Module.findByIdAndUpdate(id, data, { new: true });
      //console.log('Updated result:', result);
      return result;
    } catch (err) {
      throw new Error(`Failed to update module: ${err.message}`);
    }
  }

  async softDeleteById(id) {
    try {
      return await Module.findByIdAndDelete(id, { isPublished: false }, { new: true });
    } catch (err) {
      throw new Error(`Failed to soft delete module: ${err.message}`);
    }
  }
}
