import express from 'express';
import passport from 'passport';
import {
  createPricingPlan,
  getPricingPlanById,
  getAllPricingPlans,
  updatePricingPlan,
  deletePricingPlan,
  getPricingPlansByCourseId
} from '../controllers/CoursePricingPlanController.js';
import accessTokenAutoRefresh from '../middlewares/accessTokenAutoRefresh.js';
import { isAdmin } from '../middlewares/isAdmin.js';

const router = express.Router();

// Admin-only routes (require valid token + admin role)
router.post(
  '/',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  createPricingPlan
);

router.put(
  '/:id',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  updatePricingPlan
);

router.delete(
  '/:id',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  deletePricingPlan
);

// Public routes (no token needed)
router.get('/', getAllPricingPlans);
router.get('/:id', getPricingPlanById);
router.get('/course/:courseId', getPricingPlansByCourseId);

export default router;