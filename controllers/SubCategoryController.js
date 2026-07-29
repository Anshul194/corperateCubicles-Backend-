import SubCategoryService from '../service/SubCategoryService.js';
import { initRedis } from '../config/redisClient.js';

const subCategoryService = new SubCategoryService();

export const createSubCategory = async (req, res) => {
  try {
    //console.log('📩 Request Body createSubCategory:', req.body);

    const subCategory = await subCategoryService.create(req.body);

    const redis = await initRedis();
    const subCategoryId = subCategory._id.toString();
    const subCategoryCacheData = {
      _id: subCategory._id,
      name: subCategory.name,
      slug: subCategory.slug,
      categoryId: subCategory.categoryId,
      status: subCategory.status,
      isDeleted: subCategory.isDeleted,
      createdAt: subCategory.createdAt,
      updatedAt: subCategory.updatedAt,
    };

    await redis.setEx(`subcategory:${subCategoryId}`, 3600, JSON.stringify(subCategoryCacheData));
    //console.log('🗂️ Redis cache updated for subcategory:', subCategoryId);

    return res.status(201).json({
      success: true,
      message: '✅ SubCategory created successfully',
      data: { subCategory },
      err: {},
    });
  } catch (err) {
    console.error('❌ Create SubCategory Error:', err);
    if (
      err.message === 'Name, status, and categoryId are required' ||
      err.message === 'SubCategory slug already exists' ||
      err.message === 'Invalid or non-existent category'
    ) {
      return res.status(400).json({
        success: false,
        message: err.message,
        data: {},
        err: { message: err.message },
      });
    }
    return res.status(500).json({
      success: false,
      message: err.message,
      data: {},
      err: err.message,
    });
  }
};

export const getSubCategoryById = async (req, res) => {
  try {
    //console.log('📩 Request Params getSubCategoryById:', req.params);

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'SubCategory ID is required',
        data: {},
        err: { message: 'Missing subcategory ID parameter' },
      });
    }

    const redis = await initRedis();
    const cachedSubCategory = await redis.get(`subcategory:${id}`);
    if (cachedSubCategory) {
      //console.log('🚀 SubCategory data retrieved from Redis cache');
      const subCategoryData = JSON.parse(cachedSubCategory);
      return res.status(200).json({
        success: true,
        message: '✅ SubCategory retrieved successfully',
        data: { subCategory: subCategoryData },
        err: {},
      });
    }

    const subCategory = await subCategoryService.getById(id);
    const subCategoryCacheData = {
      _id: subCategory._id,
      name: subCategory.name,
      slug: subCategory.slug,
      categoryId: subCategory.categoryId,
      status: subCategory.status,
      isDeleted: subCategory.isDeleted,
      createdAt: subCategory.createdAt,
      updatedAt: subCategory.updatedAt,
    };

    await redis.setEx(`subcategory:${id}`, 3600, JSON.stringify(subCategoryCacheData));
    //console.log('🗂️ SubCategory data cached in Redis:', id);

    return res.status(200).json({
      success: true,
      message: '✅ SubCategory retrieved successfully',
      data: { subCategory },
      err: {},
    });
  } catch (err) {
    console.error('❌ Get SubCategory By ID Error:', err);
    if (err.message === 'SubCategory not found') {
      return res.status(404).json({
        success: false,
        message: 'SubCategory not found',
        data: {},
        err: { message: err.message },
      });
    }
    return res.status(500).json({
      success: false,
      message: err.message,
      data: {},
      err: err.message,
    });
  }
};

export const getAllSubCategories = async (req, res) => {
  try {
    const { result: subCategories, total, page, limit, totalPages } = await subCategoryService.getAll(req.query);
    return res.status(200).json({
      success: true,
      message: '✅ SubCategories retrieved successfully',
      data: { subCategories, total, page, limit, totalPages },
      err: {},
    });
  } catch (err) {
    console.error('❌ Get All SubCategories Error:', err);
    return res.status(500).json({
      success: false,
      message: err.message,
      data: {},
      err: err.message,
    });
  }
};

export const updateSubCategory = async (req, res) => {
  try {
    //console.log('📩 Request Body updateSubCategory:', req.body);

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'SubCategory ID is required',
        data: {},
        err: { message: 'Missing subcategory ID parameter' },
      });
    }

    const updatedSubCategory = await subCategoryService.updateById(id, req.body);

    const redis = await initRedis();
    const subCategoryId = updatedSubCategory._id.toString();
    const subCategoryCacheData = {
      _id: updatedSubCategory._id,
      name: updatedSubCategory.name,
      slug: updatedSubCategory.slug,
      categoryId: updatedSubCategory.categoryId,
      status: updatedSubCategory.status,
      isDeleted: updatedSubCategory.isDeleted,
      createdAt: updatedSubCategory.createdAt,
      updatedAt: updatedSubCategory.updatedAt,
    };

    await redis.setEx(`subcategory:${subCategoryId}`, 3600, JSON.stringify(subCategoryCacheData));
    //console.log('🗂️ Redis cache updated for subcategory:', subCategoryId);

    return res.status(200).json({
      success: true,
      message: '✅ SubCategory updated successfully',
      data: { subCategory: updatedSubCategory },
      err: {},
    });
  } catch (err) {
    console.error('❌ Update SubCategory Error:', err);
    if (
      err.message === 'SubCategory not found' ||
      err.message === 'No valid fields to update' ||
      err.message === 'SubCategory slug already exists' ||
      err.message === 'Invalid or non-existent category'
    ) {
      return res.status(400).json({
        success: false,
        message: err.message,
        data: {},
        err: { message: err.message },
      });
    }
    return res.status(500).json({
      success: false,
      message: err.message,
      data: {},
      err: err.message,
    });
  }
};

export const deleteSubCategory = async (req, res) => {
  try {
    //console.log('📩 Request Params deleteSubCategory:', req.params);

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'SubCategory ID is required',
        data: {},
        err: { message: 'Missing subcategory ID parameter' },
      });
    }

    const deletedSubCategory = await subCategoryService.softDeleteById(id);

    const redis = await initRedis();
    await redis.del(`subcategory:${id}`);
    //console.log('🗑️ SubCategory cache cleared:', id);

    return res.status(200).json({
      success: true,
      message: '✅ SubCategory deleted successfully',
      data: { subCategory: deletedSubCategory },
      err: {},
    });
  } catch (err) {
    console.error('❌ Delete SubCategory Error:', err);
    if (err.message === 'SubCategory not found') {
      return res.status(404).json({
        success: false,
        message: 'SubCategory not found',
        data: {},
        err: { message: err.message },
      });
    }
    return res.status(500).json({
      success: false,
      message: err.message,
      data: {},
      err: err.message,
    });
  }
};