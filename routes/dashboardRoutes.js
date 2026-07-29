import express from 'express';
import passport from 'passport';
import accessTokenAutoRefresh from '../middlewares/accessTokenAutoRefresh.js';
import DashboardController from '../controllers/dashboardController.js';

const router = express.Router();

// GET /api/v1/dashboard/ - user dashboard overview
router.get(
  '/',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  DashboardController.getDashboard
);

export default router;
