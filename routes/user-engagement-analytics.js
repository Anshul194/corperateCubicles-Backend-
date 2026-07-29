import express from 'express';
import * as UserEngagementAnalyticsController from '../controllers/UserEngagementAnalyticsController.js';
import accessTokenAutoRefresh from '../middlewares/accessTokenAutoRefresh.js';
import passport from 'passport';
import { isAdmin } from '../middlewares/isAdmin.js';

const UserEngagementrouter = express.Router();

UserEngagementrouter.get('/summary', accessTokenAutoRefresh, passport.authenticate('jwt', { session: false }), isAdmin, UserEngagementAnalyticsController.getUserEngagementSummary);
UserEngagementrouter.get('/timeline', accessTokenAutoRefresh, passport.authenticate('jwt', { session: false }), isAdmin, UserEngagementAnalyticsController.getUserActivityTimeline);
UserEngagementrouter.get('/course/:courseId', accessTokenAutoRefresh, passport.authenticate('jwt', { session: false }), isAdmin, UserEngagementAnalyticsController.getCourseEngagementStats);
UserEngagementrouter.get('/user/:userId', accessTokenAutoRefresh, passport.authenticate('jwt', { session: false }), isAdmin, UserEngagementAnalyticsController.getUserEngagementDetails);
UserEngagementrouter.get('/user/:userId/course/:courseId', accessTokenAutoRefresh, passport.authenticate('jwt', { session: false }), isAdmin, UserEngagementAnalyticsController.getUserCourseAnalytics);

export default UserEngagementrouter;
