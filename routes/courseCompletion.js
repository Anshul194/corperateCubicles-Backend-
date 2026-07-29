import express from 'express';
import passport from 'passport';
import courseCompletionController from '../controllers/CourseCompletionController.js';
import accessTokenAutoRefresh from '../middlewares/accessTokenAutoRefresh.js';
import { isAdmin } from '../middlewares/isAdmin.js';

const Completionrouter = express.Router();

// Main API - Check and update all course completions
// Operational/cron-style sweep: restrict to authenticated admins/instructors only
Completionrouter.get(
  '/check-all',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  courseCompletionController.checkAllCourseCompletions
);

// New route to update last video played (requires valid token)
Completionrouter.post(
  '/update-last-video',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  courseCompletionController.updateLastVideoPlayed // Use method from instance
);

export default Completionrouter;