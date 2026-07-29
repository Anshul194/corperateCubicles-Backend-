import express from 'express';
import * as ProjectAnalyticsController from '../controllers/ProjectAnalyticsController.js';
import accessTokenAutoRefresh from '../middlewares/accessTokenAutoRefresh.js';
import passport from 'passport';
import { isAdmin } from '../middlewares/isAdmin.js';

const projectrouter = express.Router();

projectrouter.get('/summary', accessTokenAutoRefresh, passport.authenticate('jwt', { session: false }), isAdmin, ProjectAnalyticsController.getProjectSummary);
projectrouter.get('/top', accessTokenAutoRefresh, passport.authenticate('jwt', { session: false }), isAdmin, ProjectAnalyticsController.getTopEntities);
projectrouter.get('/trends', accessTokenAutoRefresh, passport.authenticate('jwt', { session: false }), isAdmin, ProjectAnalyticsController.getTrends);

projectrouter.get('/course/:courseId', accessTokenAutoRefresh, passport.authenticate('jwt', { session: false }), isAdmin, ProjectAnalyticsController.getCourseStats);
projectrouter.get('/user/:userId', accessTokenAutoRefresh, passport.authenticate('jwt', { session: false }), isAdmin, ProjectAnalyticsController.getUserStats);
projectrouter.get('/bundle/:bundleId', accessTokenAutoRefresh, passport.authenticate('jwt', { session: false }), isAdmin, ProjectAnalyticsController.getBundleStats);

projectrouter.get('/revenue-breakdown', accessTokenAutoRefresh, passport.authenticate('jwt', { session: false }), isAdmin, ProjectAnalyticsController.getRevenueBreakdown);
projectrouter.get('/activity-logs', accessTokenAutoRefresh, passport.authenticate('jwt', { session: false }), isAdmin, ProjectAnalyticsController.getActivityLogs);
projectrouter.get(
  '/full',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  ProjectAnalyticsController.getFullProjectAnalytics
);

export default projectrouter;
