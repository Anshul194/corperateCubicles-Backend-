import express from 'express';
import {
  getSiteContent,
  getAllSiteContent,
  createSiteContent,
  updateSiteContent,
  deleteSiteContent
} from '../controllers/siteContentController.js';
import accessTokenAutoRefresh from '../middlewares/accessTokenAutoRefresh.js';
import passport from 'passport';
import { isAdmin } from '../middlewares/isAdmin.js';

const router = express.Router();

router.get('/', getAllSiteContent);
router.get('/:section', getSiteContent);
router.post(
  '/',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  createSiteContent
);
router.put(
  '/:section',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  updateSiteContent
);
router.delete(
  '/:section',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  deleteSiteContent
);

export default router;
