import SubCategoryRepository from '../repository/SubCategoryRepository.js';
import CourseCategory from '../models/CourseCategory.js';
import slugify from 'slugify';
import AppError from '../utils/app-error.js';
import { StatusCodes } from 'http-status-codes';

class SubCategoryService {
  constructor() {
    this.repository = new SubCategoryRepository();
  }

  // Helper function to generate unique slug with number suffix
  async generateUniqueSlug(name, excludeId = null) {
    try {
      const baseSlug = slugify(name, { lower: true, strict: true });
      let slug = baseSlug;
      let counter = 1;

      while (true) {
        const existingSubCategory = await this.repository.findBy({ slug });
        if (!existingSubCategory || (excludeId && existingSubCategory._id.toString() === excludeId)) {
          return slug;
        }
        slug = `${baseSlug}-${counter}`;
        counter++;
      }
    } catch (error) {
      throw new Error('Error generating unique slug');
    }
  }

  async create(subCategoryData) {
    try {
      const { name, status, categoryId } = subCategoryData;
      if (!name || !status || !categoryId) {
        throw new Error('Name, status, and categoryId are required');
      }

      const category = await CourseCategory.findOne({ _id: categoryId, isDeleted: false });
      if (!category) {
        throw new Error('Invalid or non-existent category');
      }

      const slug = await this.generateUniqueSlug(name);
      const subCategory = await this.repository.create({ name, slug, status, categoryId });
      return subCategory;
    } catch (error) {
      throw error;
    }
  }

  async getById(id) {
    try {
      const subCategory = await this.repository.findById(id);
      if (!subCategory) {
        throw new Error('SubCategory not found');
      }
      return subCategory;
    } catch (error) {
      throw error;
    }
  }

  async getAll(query) {
    try {
      const { page = 1, limit = 10, filters = "{}", searchFields = "{}", sort = "{}" } = query;
      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.max(1, parseInt(limit));
      const skip = Math.max(0, (pageNum - 1) * limitNum);

      // Parse JSON strings from query parameters to objects
      const parsedFilters = JSON.parse(filters);
      const parsedSearchFields = JSON.parse(searchFields);
      const parsedSort = JSON.parse(sort);

      // Build aggregation pipeline
      const pipeline = [];

      // Stage 1: Match - Filter conditions
      const matchConditions = { isDeleted: false };

      // Add filters
      for (const [key, value] of Object.entries(parsedFilters)) {
        matchConditions[key] = value;
      }

      // Add search conditions
      const searchConditions = [];
      for (const [field, term] of Object.entries(parsedSearchFields)) {
        searchConditions.push({ [field]: { $regex: term, $options: "i" } });
      }
      if (searchConditions.length > 0) {
        matchConditions.$or = searchConditions;
      }

      pipeline.push({ $match: matchConditions });

      // Stage 2: Lookup - Populate categoryId
      pipeline.push({
        $lookup: {
          from: 'coursecategories', // Replace with your actual coursecategories collection name
          localField: 'categoryId',
          foreignField: '_id',
          as: 'categoryId',
        },
      });

      // Stage 3: Unwind - Flatten the categoryId array
      pipeline.push({
        $unwind: {
          path: '$categoryId',
          preserveNullAndEmptyArrays: true,
        },
      });

      // Stage 4: Match - Ensure category is not deleted
      pipeline.push({
        $match: {
          'categoryId.isDeleted': { $ne: true },
        },
      });

      // Stage 5: Sort
      if (Object.keys(parsedSort).length > 0) {
        const sortConditions = {};
        for (const [field, direction] of Object.entries(parsedSort)) {
          sortConditions[field] = direction === 'asc' ? 1 : -1;
        }
        pipeline.push({ $sort: sortConditions });
      }

      // Stage 6: Facet - Get paginated data and total count
      const facetPipeline = [
        ...pipeline,
        {
          $facet: {
            data: [{ $skip: skip }, { $limit: limitNum }],
            count: [{ $count: 'total' }],
          },
        },
      ];

      // Execute aggregation
      const [result] = await this.repository.aggregate(facetPipeline);

      const subCategories = result.data;
      const total = result.count[0]?.total || 0;

      return {
        result: subCategories,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      };
    } catch (error) {
      console.error('Error fetching subcategories:', error.message);
      throw new AppError('Cannot fetch data of all subcategories', StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }

  async updateById(id, updateData) {
    try {
      const { name, status, categoryId } = updateData;
      const updateFields = {};
      if (name) {
        updateFields.name = name;
        updateFields.slug = await this.generateUniqueSlug(name, id);
      }
      if (status) {
        updateFields.status = status;
      }
      if (categoryId) {
        const category = await CourseCategory.findOne({ _id: categoryId, isDeleted: false });
        if (!category) {
          throw new Error('Invalid or non-existent category');
        }
        updateFields.categoryId = categoryId;
      }
      if (Object.keys(updateFields).length === 0) {
        throw new Error('No valid fields to update');
      }

      const updatedSubCategory = await this.repository.updateById(id, updateFields);
      if (!updatedSubCategory) {
        throw new Error('SubCategory not found');
      }
      return updatedSubCategory;
    } catch (error) {
      throw error;
    }
  }

  async softDeleteById(id) {
    try {
      const deletedSubCategory = await this.repository.softDeleteById(id);
      if (!deletedSubCategory) {
        throw new Error('SubCategory not found');
      }
      return deletedSubCategory;
    } catch (error) {
      throw error;
    }
  }
}

export default SubCategoryService;