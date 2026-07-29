import express from 'express';
import { getSettings, getAllSettings, getAllSettingsAdmin } from '../controllers/settingController.js';
import accessTokenAutoRefresh from '../middlewares/accessTokenAutoRefresh.js';
import passport from 'passport';
import { isAdmin } from '../middlewares/isAdmin.js';

const router = express.Router();

// SECURITY: the public routes below are intentionally unauthenticated — the
// student frontend and mobile app read public settings (gstRate, RAZORPAY_KEY_ID)
// at checkout. The controller restricts them to the PUBLIC_SETTING_KEYS allowlist;
// secrets (e.g. RAZORPAY_KEY_SECRET) are only available via the admin route below.

// POST /settings - Get settings by keys (public keys only)
router.post('/', getSettings);

// GET /settings - Get all public settings
router.get('/', getAllSettings);

// GET /settings/all - Full, unfiltered settings (Admin only)
router.get(
  '/all',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  getAllSettingsAdmin
);

export default router;
