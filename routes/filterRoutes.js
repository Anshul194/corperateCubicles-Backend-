import express from 'express';
import passport from 'passport';
import {
  createFilter,
  getFilterById,
  getAllFilters,
  updateFilter,
  deleteFilter,
  getFilterOptionsByCategory,
  getSubCategoriesByCategory,
  getFilteredContent
} from '../controllers/FilterController.js';
import accessTokenAutoRefresh from '../middlewares/accessTokenAutoRefresh.js';
import { isAdmin } from '../middlewares/isAdmin.js';

const router = express.Router();

// ✅ Admin-only routes (need valid token + admin role)
router.post(
  '/',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  createFilter
);

router.post('/content/category/:categoryId', getFilteredContent);
router.post('/content/category/:categoryId/subcategory/:subCategoryId', getFilteredContent);


router.put(
  '/:id',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  updateFilter
);

router.delete(
  '/:id',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  deleteFilter
);

// ✅ Public routes (no token needed)
router.get('/', getAllFilters);
router.get('/:id', getFilterById);

router.get('/options/category/:categoryId', getFilterOptionsByCategory);
router.get('/subcategories/by-category/:categoryId', getSubCategoriesByCategory);




export default router;
