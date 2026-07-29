import express from 'express';
import {
  saveLeaderboardSettings,
  getLeaderboardSettings,
  updateLeaderboardEntry,
  getGlobalLeaderboardAPI,
  getUserLeaderboardAPI,
  getUserHistoryAPI
} from '../controllers/leaderboardController.js';
import accessTokenAutoRefresh from '../middlewares/accessTokenAutoRefresh.js';
import passport from 'passport';
import { isAdmin } from '../middlewares/isAdmin.js';

const router = express.Router();

// All leaderboard routes require a valid authenticated user
router.use(accessTokenAutoRefresh);
router.use(passport.authenticate('jwt', { session: false }));

// Admin APIs (manage platform-wide gamification scoring config)
router.post('/admin/leaderboard/settings', isAdmin, saveLeaderboardSettings);
router.get('/admin/leaderboard/settings', isAdmin, getLeaderboardSettings);

// XP-mutating endpoint — privileged/server-side action, restrict to admin/instructor
router.post('/leaderboard/update', isAdmin, updateLeaderboardEntry);

// User APIs
router.get('/leaderboard/global', getGlobalLeaderboardAPI);
router.get('/leaderboard/user/:userId', getUserLeaderboardAPI);
router.get('/leaderboard/history/:userId', getUserHistoryAPI);

export default router;
