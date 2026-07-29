import mongoose from 'mongoose';
import FilterRepository from '../repository/FilterRepository.js';
import CourseCategory from '../models/CourseCategory.js';
import SubCategory from '../models/SubCategory.js';
import CourseBundle from '../models/CourseBundle.js';
import Filter from '../models/Filter.js'; // ⬅️ Make sure you import this

export default class FilterService {
  constructor() {
    this.repository = new FilterRepository();
  }

  async create(data) {
    if (!data.language || !data.category || !data.subCategory || !data.title) {
      throw new Error('language, category, subCategory, and title are required');
    }

    const categoryExists = await CourseCategory.findById(data.category);
    if (!categoryExists) {
      throw new Error('Invalid category: CourseCategory not found');
    }

    const subCategoryExists = await SubCategory.findById(data.subCategory);
    if (!subCategoryExists) {
      throw new Error('Invalid subCategory: SubCategory not found');
    }

    try {
      return await this.repository.create(data);
    } catch (err) {
      if (err.code === 11000 && err.keyPattern?.title) {
        throw new Error('A filter with this title already exists.');
      }
      throw err;
    }
  }

  async getById(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error('Invalid filter ID');
    }

    const filter = await this.repository.findById(id);
    if (!filter) throw new Error('Filter not found');
    return filter;
  }

  async getAll(query) {
    const {
      page = 1,
      limit = 10,
      filters = '{}',
      sort = '{}',
      search = '',
      categoryId,
      subCategoryId
    } = query;

    const parsedFilters = JSON.parse(filters);
    const parsedSort = JSON.parse(sort);

    if (search) {
      parsedFilters.title = { $regex: search, $options: 'i' };
    }

    if (categoryId) {
      parsedFilters.category = categoryId;
    }

    if (subCategoryId) {
      parsedFilters.subCategory = subCategoryId;
    }

    return await this.repository.getAll(parsedFilters, parsedSort, parseInt(page), parseInt(limit));
  }

  async updateById(id, data) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error('Invalid filter ID');
    }

    if (data.category) {
      const categoryExists = await CourseCategory.findById(data.category);
      if (!categoryExists) {
        throw new Error('Invalid category: CourseCategory not found');
      }
    }

    if (data.subCategory) {
      const subCategoryExists = await SubCategory.findById(data.subCategory);
      if (!subCategoryExists) {
        throw new Error('Invalid subCategory: SubCategory not found');
      }
    }

    const filter = await this.repository.updateById(id, data);
    if (!filter) throw new Error('Filter not found');
    return filter;
  }

  async softDeleteById(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error('Invalid filter ID');
    }

    const filter = await this.repository.softDeleteById(id);
    if (!filter) throw new Error('Filter not found');
    return filter;
  }



async getAllWithAggregation({ categoryId, subCategoryId }) {
  const matchStage = {};
  
  // Category ID condition
  if (categoryId) {
    matchStage.category = new mongoose.Types.ObjectId(categoryId);
    //console.log('Category ID:', categoryId);
  }
  
  // SubCategory ID condition
  if (subCategoryId) {
    matchStage.subCategory = new mongoose.Types.ObjectId(subCategoryId);
    //console.log('SubCategory ID:', subCategoryId);
  }
  
  // Only add existence checks when specifically needed
  // Don't add unnecessary $exists conditions
  
  //console.log('Match Stage:', matchStage);
  
  const pipeline = [
    { $match: matchStage },
    {
      $project: {
        _id: 0,
        title: 1,
        options: '$filterOptions'
      }
    }
  ];
  
  // Get filters for courses
  const courseFilters = await Filter.aggregate(pipeline);

  // Get filters for course bundles by checking their courses
  const bundleFilters = await this.getBundleFilterOptions({ categoryId, subCategoryId });

  // Combine band remove duplicates
  const allFilters = [...courseFilters, ...bundleFilters];
  const uniqueFilters = this.removeDuplicateFilters(allFilters);


  return uniqueFilters;
}

async getBundleFilterOptions({ categoryId, subCategoryId }) {
  try{
    // Build aggregation pipeline to find bundles with coursesmatching the filters
    const bundlePipeline = [
      {
        $lookup: {
          from: 'courses', // Collection name for courses
          localField: 'courses',
          foreignField: '_id',
          as: 'courseDetails'
        }
      },
      {
        $match: {
          'coueseDetails': { $ne: []} // Ensure bundles has courses
        }
      }
    ];

    // Add category filter if provided
    if (categoryId) {
      bundlePipeline.push({
        $match: {
          'coueseDetails.categoryId': new mongoose.Types.ObjectId(categoryId)
        }
      });
    }

    // Add subCategory filter if provided
    if (subCategoryId) {
      bundlePipeline.push({
        $match: {
          'coueseDetails.subCategoryId': new mongoose.Types.ObjectId(subCategoryId)
        }
      });
    }

    // Get all bundles that match the criteria
    const matchingBundles = await CourseBundle.aggregate(bundlePipeline);

    // Extract course IDs from the matching bundles
    const courseIds = [];
    matchingBundles.forEach(bundle => {
      bundle.courseDetails.forEach(course => {
        if (categoryId && course.categoryId && course.categoryId.toString() === categoryId) {
          courseIds.push(course._id);
        } else if (subCategoryId && course.subCategoryId && course.subCategoryId.toString() === subCategoryId) {
          courseIds.push(course._id);
        } else if (!categoryId && !subCategoryId) {
          courseIds.push(course._id);
        }
      });
    });

    // Now get filters that apply to these courses
    const filterMatchStage = {};

    if (categoryId) {
      filterMatchStage.category = new mongoose.Types.ObjectId(categoryId);
    }

    if (subCategoryId) {
      filterMatchStage.subCategory = new mongoose.Types.ObjectId(subCategoryId);
    }

    const filterPipeline = [
      { $match: filterMatchStage },
      {
        $project: {
          _id: 0,
          title: 1,
          options: '$filterOptions'
        }
      }
    ];

    return await Filter.aggregate(filterPipeline);
  }
  catch (error) {
    console.error('Error in getBundleFilterOptions:', error);
    return [];
  }
}

removeDuplicateFilters(filters) {
  const seen = new Set();
  return filters.filter(filter => {
    const key = `${filter.title}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

// Add method to apply filters to both courses and bundles
async getFilteredContent({ categoryId, subCategoryId, appliedFilters = {} }) {
  try {
    // Get filtered courses
    const courseMatchStage = {};
    if (categoryId) {
      courseMatchStage.categoryId = new mongoose.Types.ObjectId(categoryId);
    }
    if (subCategoryId) {
      courseMatchStage.subCategoryId = new mongoose.Types.ObjectId(subCategoryId);
    }

    //Apply additional filters to courses
    Object.keys(appliedFilters).forEach(filterKey => {
      if (appliedFilters[filterKey] && appliedFilters[filterKey].length > 0){
        // Apply filter logic based on your filter structure
        // This depends on how filters are stored in your course model
        courseMatchStage[filterKey] = { $in: appliedFilters[filterKey] };
      }
    });

    const courses = await mongoose.model('Course').find(courseMatchStage);

    // Get filtered bundles
    const bundlePipeline = [
      {
        $lookup: {
          from: 'courses', // Collection name for courses
          localField: 'courses',
          foreignField: '_id',
          as: 'courseDetails'
        }
      },
      {
        $match: {
          'courseDetails': { $ne: [] }
        }
      }
    ];

    // Filter bundles based on their courses
    if (categoryId || subCategoryId || Object.keys(appliedFilters).length > 0) {
      const bundleMatchConditions = {};

      if (categoryId) {
        bundleMatchConditions['courseDetails.categoryId'] = new mongoose.Types.ObjectId(categoryId);
      }
      if (subCategoryId) {
        bundleMatchConditions['courseDetails.subCategoryId'] = new mongoose.Types.ObjectId(subCategoryId);
      }

      // Apply additional filters to bundles
      Object.keys(appliedFilters).forEach(filterKey => {
        if (appliedFilters[filterKey] && appliedFilters[filterKey].length > 0){
          bundleMatchConditions[`courseDetails.${filterKey}`] = { $in: appliedFilters[filterKey] };
        }
      });

      if (Object.keys(bundleMatchConditions).length > 0) {
        bundlePipeline.push({ $match: bundleMatchConditions });
      }
    }

    const bundles = await CourseBundle.aggregate(bundlePipeline);

    return {
      courses,
      bundles: bundles.map(bundle => ({
        ...bundle,
        type: 'bundle'
      }))
    };
  }
  catch(error){
    console.error('Error in getFilteredContent:', error);
    throw error;
  }
}

async getSubCategoriesByCategoryId(categoryId) {
  try {
    //console.log('Fetching subcategories for categoryId:', categoryId);

    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      console.warn('Invalid categoryId:', categoryId);
      throw new Error('Invalid categoryId');
    }

    // Use the correct field name as per schema:
    const subCategories = await SubCategory.find({ categoryId: categoryId });
    //console.log('Subcategories found:', subCategories);

    return subCategories;
  } catch (error) {
    console.error('Error in getSubCategoriesByCategoryId:', error.message);
    throw error;
  }
}





}
