import express from 'express';
import {
  createBanner,
  getBanners,
  getBanner,
  updateBanner,
  deleteBanner
} from '../controllers/bannerController.js';
import { upload } from '../middlewares/upload-middleware.js';
import accessTokenAutoRefresh from '../middlewares/accessTokenAutoRefresh.js';
import passport from 'passport';
import { isAdmin } from '../middlewares/isAdmin.js';

const router = express.Router();

// SECURITY: GETs stay public (the student frontend/mobile render banners);
// mutations are admin-only.
router.post(
  '/',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  upload.fields([{ name: 'image' }, { name: 'mobileImage' }]),
  createBanner
);
router.get('/', getBanners);
router.get('/:id', getBanner);
router.put(
  '/:id',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  upload.fields([{ name: 'image' }, { name: 'mobileImage' }]),
  updateBanner
);
router.delete(
  '/:id',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  deleteBanner
);

export default router;
