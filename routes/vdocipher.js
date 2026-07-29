import express from 'express';
import VdoCipherController from '../controllers/VdoCipherController.js';
import passport from 'passport';
import accessTokenAutoRefresh from '../middlewares/accessTokenAutoRefresh.js';
import { isAdmin } from '../middlewares/isAdmin.js';
import requireDeviceApproval from '../middlewares/requireDeviceApproval.js';
const vedioCipherRouter = express.Router();

// Generate playback data
// SECURITY: device-approval gate on the video-stream credential (OTP/playbackInfo).
// This is the endpoint the mobile player actually calls; a pending/unapproved app
// device now gets 403 here instead of being able to stream directly. Web is exempt
// inside the middleware (the web player receives playback data embedded in the
// course payload, not via this route).
vedioCipherRouter.post(
    '/courses/:courseId/videos/:videoId/playback',
     accessTokenAutoRefresh,
     passport.authenticate('jwt', { session: false }),
     requireDeviceApproval,
    VdoCipherController.generatePlayback
);

// Validate token
vedioCipherRouter.post(
    '/validate-token',
 accessTokenAutoRefresh,
     passport.authenticate('jwt', { session: false }),    VdoCipherController.validateToken
);

export default vedioCipherRouter;