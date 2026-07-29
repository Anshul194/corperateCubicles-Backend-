import express from 'express';
import {
  addTestimonialAdmin,
  listTestimonialsAdmin,
  updateTestimonialAdmin,
  deleteTestimonialAdmin,
  submitTestimonial,
  getMyTestimonials,
  getApprovedTestimonials,
  getTestimonial
} from '../controllers/testimonialController.js';
import { upload } from '../middlewares/upload-middleware.js';
import { isAdmin } from '../middlewares/isAdmin.js';
import accessTokenAutoRefresh from '../middlewares/accessTokenAutoRefresh.js';
import passport from 'passport';

const router = express.Router();

const testimonialUpload = upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'video', maxCount: 1 }
]);

// Admin routes
router.post(
  '/admin/testimonials',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  testimonialUpload,
  addTestimonialAdmin
);
router.get(
  '/admin/testimonials',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  listTestimonialsAdmin
);
router.patch(
  '/admin/testimonials/:id',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  testimonialUpload,
  updateTestimonialAdmin
);
router.delete(
  '/admin/testimonials/:id',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  deleteTestimonialAdmin
);

// User routes
router.post(
  '/testimonials',
  testimonialUpload,
  submitTestimonial
);
router.get(
  '/testimonials/me',
 
  getMyTestimonials
);
router.get('/testimonials', getApprovedTestimonials);
router.get('/testimonials/:id', getTestimonial);

export default router;