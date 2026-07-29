import express from 'express';
import {
  getAboutContent,
  updateAboutContent,
  getTeamMembers,
  getAllTeamMembers,
  createTeamMember,
  updateTeamMember,
  deleteTeamMember,
} from '../controllers/aboutController.js';
import accessTokenAutoRefresh from '../middlewares/accessTokenAutoRefresh.js';
import passport from 'passport';
import { isAdmin } from '../middlewares/isAdmin.js';

const aboutRouter = express.Router();

// Public routes
aboutRouter.get('/about', getAboutContent);
aboutRouter.get('/team', getTeamMembers);

// Admin routes
aboutRouter.put(
  '/admin/about',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  updateAboutContent
);

aboutRouter.get(
  '/admin/team',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  getAllTeamMembers
);

aboutRouter.post(
  '/admin/team',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  createTeamMember
);

aboutRouter.put(
  '/admin/team/:id',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  updateTeamMember
);

aboutRouter.delete(
  '/admin/team/:id',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  deleteTeamMember
);

export default aboutRouter;
