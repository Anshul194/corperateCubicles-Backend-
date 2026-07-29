import express from 'express';
import { 
  createCoupon, 
  getCouponById, 
  getAllCoupons, 
  updateCoupon, 
  deleteCoupon,
  applyCoupon,
  validateCoupon
} from '../controllers/CouponController.js';
import accessTokenAutoRefresh from '../middlewares/accessTokenAutoRefresh.js';
import passport from 'passport';
import { isAdmin } from '../middlewares/isAdmin.js';

const couponRouter = express.Router();

// Get all coupons (admin only) - must come before /:id route
couponRouter.get(
  '/',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  getAllCoupons
);

// Create a coupon (admin only)
couponRouter.post(
  '/',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  createCoupon
);

couponRouter.post(
  '/create',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  createCoupon
);

// Get a coupon by ID (admin only)
couponRouter.get(
  '/:id',
  getCouponById
);

// Update a coupon (admin only)
couponRouter.put(
  '/:id',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  updateCoupon
);

// Delete a coupon (admin only, soft delete)
couponRouter.delete(
  '/:id',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  deleteCoupon
);

// Apply/Validate coupon (authenticated users)
couponRouter.post(
  '/apply',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  applyCoupon
);

// Validate coupon without applying (authenticated users)
couponRouter.post(
  '/validate',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  validateCoupon
);

export default couponRouter;