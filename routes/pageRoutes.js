import express from 'express';
import {
  createPage,
  getAllPages,
  getPageById,
  updatePage,
  deletePage
} from '../controllers/pageController.js';
import accessTokenAutoRefresh from '../middlewares/accessTokenAutoRefresh.js';
import passport from 'passport';
import { isAdmin } from '../middlewares/isAdmin.js';

const pageRouter = express.Router();

// SECURITY: GETs stay public (CMS pages are rendered to anonymous visitors);
// mutations are admin-only.
pageRouter.post(
  '/',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  createPage
);
pageRouter.get('/', getAllPages);
pageRouter.get('/:id', getPageById);
pageRouter.put(
  '/:id',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  updatePage
);
pageRouter.delete(
  '/:id',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  deletePage
);

export default pageRouter;
