import express from 'express';
import AnalyticsController from '../controllers/AnalyticsController.js';
import accessTokenAutoRefresh from '../middlewares/accessTokenAutoRefresh.js';
import { isAdmin } from '../middlewares/isAdmin.js';
import passport from 'passport';
const analyticRouter = express.Router();

// Search content (courses and bundles) - Public endpoint
analyticRouter.get('/search', 
    AnalyticsController.searchContent
);

// Get search suggestions - Public endpoint
analyticRouter.get('/search/suggestions', 
    AnalyticsController.getSearchSuggestions
);

// Get dashboard data
analyticRouter.get('/dashboard',
   accessTokenAutoRefresh,
     passport.authenticate('jwt', { session: false }),
     isAdmin,
    AnalyticsController.getDashboard
);

// Get video metrics
analyticRouter.get('/videos/:videoId/metrics', 
   accessTokenAutoRefresh,
     passport.authenticate('jwt', { session: false }),
     isAdmin, 
    AnalyticsController.getVideoMetrics
);

analyticRouter.get('/videos/sessions',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  AnalyticsController.getAllVideoSessions
);


// Get user analytics
analyticRouter.get('/users/:userId/analytics', 
   accessTokenAutoRefresh,
     passport.authenticate('jwt', { session: false }),
     isAdmin,
    AnalyticsController.getUserAnalytics
);

export default analyticRouter;