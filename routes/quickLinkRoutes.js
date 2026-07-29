import express from 'express';
import {
  createQuickLink,
  getQuickLinks,
  getQuickLink,
  updateQuickLink,
  deleteQuickLink,
} from '../controllers/quickLinkController.js';
import accessTokenAutoRefresh from '../middlewares/accessTokenAutoRefresh.js';
import passport from 'passport';
import { isAdmin } from '../middlewares/isAdmin.js';

const router = express.Router();

router.get('/', getQuickLinks);
router.get('/:id', getQuickLink);
router.post(
  '/',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  createQuickLink
);
router.put(
  '/:id',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  updateQuickLink
);
router.delete(
  '/:id',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  deleteQuickLink
);

export default router;
