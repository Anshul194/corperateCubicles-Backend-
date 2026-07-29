import express from 'express';
import { createCategory, getCategoryById, getAllCategories, updateCategory, deleteCategory } from '../controllers/CourseCategoryController.js';
import accessTokenAutoRefresh from '../middlewares/accessTokenAutoRefresh.js';
import passport from 'passport';
import { isAdmin } from '../middlewares/isAdmin.js';
import { upload } from '../middlewares/upload-middleware.js'; // Import upload middleware

const categoryRouter = express.Router();

// Create a category (admin only, with image upload)
categoryRouter.post(
  '/',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  upload.single('image'), // Handle single image upload
  createCategory
);

// Get all categories (public)
categoryRouter.get('/', getAllCategories);

// Get a category by ID (public)
categoryRouter.get('/:id', getCategoryById);

// Update a category (admin only, with image upload)
categoryRouter.put(
  '/:id',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  upload.single('image'), // Handle single image upload
  updateCategory
);

// Delete a category (admin only, soft delete)
categoryRouter.delete(
  '/:id',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  deleteCategory
);

export default categoryRouter;