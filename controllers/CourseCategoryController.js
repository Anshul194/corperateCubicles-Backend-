import CourseCategoryService from '../service/CourseCategoryService.js';
import { initRedis } from '../config/redisClient.js';
import { upload } from '../middlewares/upload-middleware.js'; // Import upload middleware
import path from 'path';
import fs from 'fs/promises'; // For file system operations

const categoryService = new CourseCategoryService();

export const createCategory = async (req, res) => {
  try {
    // Check for file validation errors
    if (req.fileValidationError) {
      return res.status(400).json({
        success: false,
        message: req.fileValidationError,
        data: {},
        err: { message: req.fileValidationError },
      });
    }

    //console.log('📩 Request Body createCategory:', req.body);
    //console.log('📤 Uploaded File:', req.file);

    const categoryData = { ...req.body };
    //console.log('📥 Category Data:', categoryData);
    if (req.file) {
      categoryData.image = req.file.filename; // Store image filename
    }



    const category = await categoryService.create(categoryData);

    const redis = await initRedis();
    const categoryId = category._id.toString();
    const categoryCacheData = {
      _id: category._id,
      name: category.name,
      slug: category.slug,
      status: category.status,
      image: category.image, // Include image in cache
      isDeleted: category.isDeleted,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt
    };

    await redis.setEx(`category:${categoryId}`, 3600, JSON.stringify(categoryCacheData));
    //console.log('🗂️ Redis cache updated for category:', categoryId);

    return res.status(201).json({
      success: true,
      message: '✅ Category created successfully',
      data: { category },
      err: {},
    });
  } catch (err) {
    console.error('❌ Create Category Error:', err);
    // Delete uploaded file if creation fails
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
        //console.log(`🗑️ Deleted uploaded file due to error: ${req.file.path}`);
      } catch (unlinkErr) {
        console.warn(`⚠️ Failed to delete uploaded file: ${req.file.path}`, unlinkErr.message);
      }
    }
    if (err.message === 'Name and status are required' || err.message === 'Category slug already exists') {
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

export const getCategoryById = async (req, res) => {
  try {
    //console.log('📩 Request Params getCategoryById:', req.params);

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Category ID is required',
        data: {},
        err: { message: 'Missing category ID parameter' },
      });
    }

    // const redis = await initRedis();
    // const cachedCategory = await redis.get(`category:${id}`);
    // if (cachedCategory) {
    //   //console.log('🚀 Category data retrieved from Redis cache');
    //   const categoryData = JSON.parse(cachedCategory);
    //   return res.status(200).json({
    //     success: true,
    //     message: '✅ Category retrieved successfully',
    //     data: { category: categoryData },
    //     err: {},
    //   });
    // }

    const category = await categoryService.getById(id);
    const categoryCacheData = {
      _id: category._id,
      name: category.name,
      slug: category.slug,
      status: category.status,
      image: category.image, // Include image in cache
      isDeleted: category.isDeleted,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt
    };

    // await redis.setEx(`category:${id}`, 3600, JSON.stringify(categoryCacheData));
    //console.log('🗂️ Category data cached in Redis:', id);

    return res.status(200).json({
      success: true,
      message: '✅ Category retrieved successfully',
      data: { category },
      err: {},
    });
  } catch (err) {
    console.error('❌ Get Category By ID Error:', err);
    if (err.message === 'Category not found') {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
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

export const getAllCategories = async (req, res) => {
  try {
    const categories = await categoryService.getAll(req.query);
    return res.status(200).json({
      success: true,
      message: '✅ Categories retrieved successfully',
      data: { categories },
      err: {},
    });
  } catch (err) {
    console.error('❌ Get All Categories Error:', err);
    return res.status(500).json({
      success: false,
      message: err.message,
      data: {},
      err: err.message,
    });
  }
};

export const updateCategory = async (req, res) => {
  try {
    // Check for file validation errors
    if (req.fileValidationError) {
      return res.status(400).json({
        success: false,
        message: req.fileValidationError,
        data: {},
        err: { message: req.fileValidationError },
      });
    }

    //console.log('📩 Request Body updateCategory:', req.body);
    //console.log('📤 Uploaded File:', req.file);

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Category ID is required',
        data: {},
        err: { message: 'Missing category ID parameter' },
      });
    }

    const updateData = { ...req.body };
    if (req.file) {
      updateData.image = req.file.filename; // Store new image filename
    }

    const updatedCategory = await categoryService.updateById(id, updateData);

    const redis = await initRedis();
    const categoryId = updatedCategory._id.toString();
    const categoryCacheData = {
      _id: updatedCategory._id,
      name: updatedCategory.name,
      slug: updatedCategory.slug,
      status: updatedCategory.status,
      image: updatedCategory.image, // Include image in cache
      isDeleted: updatedCategory.isDeleted,
      createdAt: updatedCategory.createdAt,
      updatedAt: updatedCategory.updatedAt
    };

    await redis.setEx(`category:${categoryId}`, 3600, JSON.stringify(categoryCacheData));
    //console.log('🗂️ Redis cache updated for category:', categoryId);

    return res.status(200).json({
      success: true,
      message: '✅ Category updated successfully',
      data: { category: updatedCategory },
      err: {},
    });
  } catch (err) {
    // Delete uploaded file if update fails
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
        //console.log(`🗑️ Deleted uploaded file due to error: ${req.file.path}`);
      } catch (unlinkErr) {
        console.warn(`⚠️ Failed to delete uploaded file: ${req.file.path}`, unlinkErr.message);
      }
    }
    console.error('❌ Update Category Error:', err);
    if (err.message === 'Category not found' || err.message === 'No valid fields to update' || err.message === 'Category slug already exists') {
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

export const deleteCategory = async (req, res) => {
  try {
    //console.log('📩 Request Params deleteCategory:', req.params);

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Category ID is required',
        data: {},
        err: { message: 'Missing category ID parameter' },
      });
    }

    const deletedCategory = await categoryService.softDeleteById(id);

    const redis = await initRedis();
    await redis.del(`category:${id}`);
    //console.log('🗑️ Category cache cleared:', id);

    return res.status(200).json({
      success: true,
      message: '✅ Category deleted successfully',
      data: { category: deletedCategory },
      err: {},
    });
  } catch (err) {
    console.error('❌ Delete Category Error:', err);
    if (err.message === 'Category not found') {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
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