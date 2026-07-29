import express from 'express';
import VideoSessionController from '../controllers/VideoSessionController.js';
import passport from 'passport';
import accessTokenAutoRefresh from '../middlewares/accessTokenAutoRefresh.js';

const vedioSessionRouter = express.Router();

// Start a new video session
vedioSessionRouter.post('/start', 
      accessTokenAutoRefresh,
     passport.authenticate('jwt', { session: false }),
    VideoSessionController.startSession
);

// End a video session
vedioSessionRouter.post('/end', 
 accessTokenAutoRefresh,
     passport.authenticate('jwt', { session: false }),
    VideoSessionController.endSession
);

// Track video events
vedioSessionRouter.post('/track-event', 
   accessTokenAutoRefresh,
     passport.authenticate('jwt', { session: false }),
    VideoSessionController.trackEvent
);

// Update watch time
vedioSessionRouter.post('/update-watch-time', 
   accessTokenAutoRefresh,
     passport.authenticate('jwt', { session: false }),
    VideoSessionController.updateWatchTime
);

// Complete lesson
vedioSessionRouter.post('/courses/:courseId/lessons/:lessonId/complete', 
 accessTokenAutoRefresh,
     passport.authenticate('jwt', { session: false }),    VideoSessionController.completeLesson
);

export default vedioSessionRouter;