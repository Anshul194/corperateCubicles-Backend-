import express from 'express';
import * as SalesAnalyticsController from '../controllers/SalesAnalyticsController.js';
import accessTokenAutoRefresh from '../middlewares/accessTokenAutoRefresh.js';
import passport from 'passport';
import { isAdmin } from '../middlewares/isAdmin.js';

const Salesrouter = express.Router();

// All endpoints require admin by default
Salesrouter.get('/courses', accessTokenAutoRefresh, passport.authenticate('jwt', { session: false }), isAdmin, SalesAnalyticsController.getCourseSales);
Salesrouter.get('/users', accessTokenAutoRefresh, passport.authenticate('jwt', { session: false }), isAdmin, SalesAnalyticsController.getUserSales);
Salesrouter.get('/summary', accessTokenAutoRefresh, passport.authenticate('jwt', { session: false }), isAdmin, SalesAnalyticsController.getSalesSummary);
Salesrouter.get('/bundles', accessTokenAutoRefresh, passport.authenticate('jwt', { session: false }), isAdmin, SalesAnalyticsController.getBundleSales);

export default Salesrouter;
