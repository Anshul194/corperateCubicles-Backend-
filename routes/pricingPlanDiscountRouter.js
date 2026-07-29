import express from 'express';
import {
  createPricingPlanDiscount,
  getAllPricingPlanDiscounts,
  getPricingPlanDiscountById,
  updatePricingPlanDiscount,
  deletePricingPlanDiscount,
  getDiscountsByCourseId
} from '../controllers/pricingPlanDiscountController.js';
import accessTokenAutoRefresh from '../middlewares/accessTokenAutoRefresh.js';
import passport from 'passport';
import { isAdmin } from '../middlewares/isAdmin.js';

const pricingPlanDiscountRouter = express.Router();

pricingPlanDiscountRouter.get('/', getAllPricingPlanDiscounts);
pricingPlanDiscountRouter.get('/:discountId', getPricingPlanDiscountById);

pricingPlanDiscountRouter.post(
  '/',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  createPricingPlanDiscount
);

pricingPlanDiscountRouter.put(
  '/:discountId',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  updatePricingPlanDiscount
);

pricingPlanDiscountRouter.delete(
  '/:discountId',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  deletePricingPlanDiscount
);

pricingPlanDiscountRouter.get(
  '/course/:courseId',
  getDiscountsByCourseId
);

export default pricingPlanDiscountRouter;