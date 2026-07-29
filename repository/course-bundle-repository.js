// repositories/course-bundle-repository.js
import CourseBundle from '../models/CourseBundle.js';

class CourseBundleRepository {
async create(data) {
  try {
    const bundle = await CourseBundle.create(data);
    return bundle;
  } catch (error) {
    console.error("Error creating course bundle:", error);
    throw error; 
  }
}


async findAll({ page = 1, limit = 10, search = '', sortBy = 'createdAt', sortOrder = 'asc', priceFiter = {} }) {
  try {
    // Ensure page and limit are positive integers
    page = parseInt(page, 10);
    limit = parseInt(limit, 10);
    if (isNaN(page) || page < 1) page = 1;
    if (isNaN(limit) || limit < 1) limit = 10;

    const query = {};

    if (search) {
      query.title = { $regex: search, $options: 'i' }; // adjust if "title" field differs
    }

    // Apply price filter if provided
    if (priceFiter.$gt !== undefined || priceFiter.$eq !== undefined){
      query.price = priceFiter;
    }

    const skip = (page - 1) * limit;

    const bundles = await CourseBundle.find(query)
      .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
      .skip(skip)
      .limit(limit)
      .populate('courses');

    const total = await CourseBundle.countDocuments(query);

    return {
      data: bundles,
      total,
      page,
      limit,
      totalPages: limit > 0 ? Math.ceil(total / limit) : 1
    };
  } catch (error) {
    console.error('BundleRepository.findAll error:', error);
    throw error;
  }
}


  async findById(id) {
  try {
    const bundle = await CourseBundle.findById(id).populate({
  path: 'courses',
  populate: {
    path: 'modules',
    populate: {
      path: 'lessons',
      select: 'title type order duration'
    }
  }
})

    return bundle;
  } catch (error) {
    console.error('Error finding course bundle by ID:', error);
    throw error;
  }
}

async update(id, data) {
  try {
    const updatedBundle = await CourseBundle.findByIdAndUpdate(id, data, { new: true });
    return updatedBundle;
  } catch (error) {
    console.error('Error updating course bundle:', error);
    throw error;
  }
}

async delete(id) {
  try {
    const deletedBundle = await CourseBundle.findByIdAndDelete(id);
    return deletedBundle;
  } catch (error) {
    console.error('Error deleting course bundle:', error);
    throw error;
  }
}

}

export default new CourseBundleRepository();
