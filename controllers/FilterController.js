import FilterService from '../service/FilterService.js';
import { initRedis } from '../config/redisClient.js';


const filterService = new FilterService();

export const createFilter = async (req, res) => {
  try {
    const filter = await filterService.create(req.body);
    const redis = await initRedis();
    await redis.setEx(`filter:${filter._id}`, 3600, JSON.stringify(filter));
    return res.status(201).json({ success: true, message: 'Filter created', data: { filter } });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

export const getFilterById = async (req, res) => {
  try {
    const { id } = req.params;
    const redis = await initRedis();
    const cached = await redis.get(`filter:${id}`);
    if (cached) {
      return res.status(200).json({ success: true, message: 'Filter from cache', data: { filter: JSON.parse(cached) } });
    }
    const filter = await filterService.getById(id);
    await redis.setEx(`filter:${id}`, 3600, JSON.stringify(filter));
    return res.status(200).json({ success: true, message: 'Filter retrieved', data: { filter } });
  } catch (err) {
    return res.status(404).json({ success: false, message: err.message });
  }
};

export const getAllFilters = async (req, res) => {
  try {
    const result = await filterService.getAll(req.query);
    return res.status(200).json({
      success: true,
      message: 'Filters fetched',
      data: result
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const updateFilter = async (req, res) => {
  //console.log('Updating filter with data:', req.body);
  
  try {
    const { id } = req.params;
    const updated = await filterService.updateById(id, req.body);
    const redis = await initRedis();
    await redis.setEx(`filter:${id}`, 3600, JSON.stringify(updated));
    return res.status(200).json({ success: true, message: 'Filter updated', data: { filter: updated } });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

export const deleteFilter = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await filterService.softDeleteById(id);
    const redis = await initRedis();
    await redis.del(`filter:${id}`);
    return res.status(200).json({ success: true, message: 'Filter deleted (soft)', data: { filter: deleted } });
  } catch (err) {
    return res.status(404).json({ success: false, message: err.message });
  }
};

// Get all filter options by categoryId
export const getFilterOptionsByCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { subCategoryId } = req.query;

    if (!categoryId) {
      return res.status(400).json({ success: false, message: 'categoryId is required' });
    }

    const data = await filterService.getAllWithAggregation({ categoryId, subCategoryId });

    return res.status(200).json({
      success: true,
      message: 'Filters fetched successfully',
      data,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getSubCategoriesByCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    //console.log('Request to get subcategories for categoryId:', categoryId);

    if (!categoryId) {
      console.warn('categoryId is missing in request params');
      return res.status(400).json({ success: false, message: 'categoryId is required' });
    }

    const subCategories = await filterService.getSubCategoriesByCategoryId(categoryId);
    //console.log('Fetched subCategories:', subCategories);

    return res.status(200).json({
      success: true,
      message: 'Subcategories fetched successfully',
      data: subCategories,
    });
  } catch (err) {
    console.error('Error in getSubCategoriesByCategory:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};


export const getFilteredContent = async (req, res) => {
  try {
    const { categoryId, subCategoryId } = req.params;
    const appliedFilters = req.body.filters || {};

    if (!categoryId) {
      return res.status(400).json({ success: false, message: 'categoryId is required' });
    }

    const data = await filterService.getFilteredContent({ 
      categoryId, 
      subCategoryId, 
      appliedFilters 
    });

    return res.status(200).json({
      success: true,
      message: 'Filtered content fetched successfully',
      data: {
        courses: data.courses,
        bundles: data.bundles,
        totalCourses: data.courses.length,
        totalBundles: data.bundles.length
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};




