import express from 'express';
import { signup, updateProfile, login, getUserById, blockUser, changeUserPassword, forgotPassword, resetPassword, getMyProfile, deleteDocument, getUserDashboard, deleteUser, getOverviewDashboard, deleteEducation, createUserByAdmin, logoutAllSessions, updateFcmToken, sendTestNotification, banOrShadowBanUser, unbanUser,  listDeviceApprovalRequests,
  manageDeviceRequest, checkDeviceApprovalStatus,
  searchUsers, sendOtpviaemail, verifyOtpviaemail, googleLogin, updateUserRole, logout, refreshToken} from '../controllers/userController.js';
import accessTokenAutoRefresh from '../middlewares/accessTokenAutoRefresh.js';
import { sendOtp, verifyOtp } from '../controllers/otpController.js';
import passport from 'passport';
import {upload} from '../middlewares/upload-middleware.js';
import { isAdmin } from '../middlewares/isAdmin.js';
import { validateResetPassword } from '../middlewares/validation.js';
import isUserBanned from '../middlewares/isUserBanned.js';
import dotenv from "dotenv"

dotenv.config();

const userRouter = express.Router();


userRouter.post('/signup', signup);
userRouter.post('/forgot-password', forgotPassword);
//update-fcm-token
// SECURITY: requires authentication — the controller binds the FCM token to
// req.user._id and ignores any client-supplied userId (previously an anonymous
// caller could bind their device token to any victim's userId and receive
// that user's push notifications).
userRouter.post('/fcm/update',
  accessTokenAutoRefresh,
  passport.authenticate("jwt", { session: false }),
  updateFcmToken
);
//send-test-notification
userRouter.get('/send-test-notification', sendTestNotification);
  
userRouter.post('/reset-password', validateResetPassword, resetPassword);
// userRouter.post('/change-password', changeUserPassword);
userRouter.post('/change-password', accessTokenAutoRefresh,
  passport.authenticate("jwt", { session: false }),
  isUserBanned,
  changeUserPassword
);
userRouter.post(
  '/create-user',
  accessTokenAutoRefresh,
  passport.authenticate("jwt", { session: false }),
  isAdmin,
  createUserByAdmin
);



// profile update route
userRouter.get('/me',accessTokenAutoRefresh,passport.authenticate('jwt', { session: false }), isUserBanned, getMyProfile);
// userRouter.put('/profile',upload.single("profilePicture"), accessTokenAutoRefresh, passport.authenticate("jwt", { session: false }),updateProfile);
userRouter.put(
  '/profile',
  upload.fields([
    { name: 'profilePicture', maxCount: 1 },
    { name: 'documentation', maxCount: 5 } // or more, adjust as needed
  ]),
  accessTokenAutoRefresh,
  passport.authenticate("jwt", { session: false }),
  isUserBanned,
  updateProfile
);
userRouter.delete('/documentation/:documentId', 
  accessTokenAutoRefresh,
  passport.authenticate("jwt", { session: false }),
  isUserBanned,
  deleteDocument
);

userRouter.delete('/education/:educationId', 
  accessTokenAutoRefresh,
  passport.authenticate("jwt", { session: false }),
  isUserBanned,
  deleteEducation
);

userRouter.get("/search", accessTokenAutoRefresh, passport.authenticate("jwt", { session: false }), searchUsers);

userRouter.post('/login', login);
userRouter.get('/user', accessTokenAutoRefresh, passport.authenticate("jwt", { session: false }), isUserBanned, getUserById);
userRouter.put('/block-unblock', accessTokenAutoRefresh, passport.authenticate("jwt", { session: false }), isAdmin, blockUser);
userRouter.post('/send-otp', sendOtp);
userRouter.post('/verify-otp', verifyOtp);
userRouter.delete('/:id', accessTokenAutoRefresh, passport.authenticate('jwt', { session: false }), isUserBanned, deleteUser);
userRouter.get('/overview', accessTokenAutoRefresh, passport.authenticate('jwt', { session: false }), isAdmin, isUserBanned, getOverviewDashboard);

// Logout the current session. Intentionally NOT behind passport — a user must be
// able to log out (and clear cookies) even with an expired/blacklisted token.
userRouter.post('/logout', logout);

// Refresh a session explicitly: exchange the refresh token (cookie or
// X-Refresh-Token header) for a fresh access token. Used by the SPA on a 401.
userRouter.post('/refresh-token', refreshToken);

userRouter.post('/logout-all-sessions',
  accessTokenAutoRefresh,
  passport.authenticate("jwt", { session: false }),
  isUserBanned,
  logoutAllSessions
);
userRouter.put(
  '/ban-shadow-ban',
  accessTokenAutoRefresh,
  passport.authenticate("jwt", { session: false }),
  isAdmin,
  banOrShadowBanUser
);
userRouter.put(
  '/unban-user',
  accessTokenAutoRefresh,
  passport.authenticate("jwt", { session: false }),
  isAdmin,
  unbanUser
);
userRouter.put(
  '/:userId/role',
  accessTokenAutoRefresh,
  passport.authenticate("jwt", { session: false }),
  isAdmin,
  updateUserRole
);

userRouter.get(
  '/device-approvals',
  accessTokenAutoRefresh,
  passport.authenticate("jwt", { session: false }),
  isAdmin,
  listDeviceApprovalRequests
);

userRouter.post(
  '/device-approvals/manage',
  accessTokenAutoRefresh,
  passport.authenticate("jwt", { session: false }),
  isAdmin,
  manageDeviceRequest
);

userRouter.get(
  '/device-approval/status',
  accessTokenAutoRefresh,
  passport.authenticate("jwt", { session: false }),
  isUserBanned,
  checkDeviceApprovalStatus
);


userRouter.post('/sendotp', sendOtpviaemail);
userRouter.post('/google-login', googleLogin);
userRouter.post('/verifyotp', verifyOtpviaemail);


userRouter.get("/check-force-update", 
  (req, res) => {
    //console.log("Checking force update...", process.env.APP_VERSION);
    //console.log("Force update status:", process.env.FORCE_UPDATE);
    //console.log("Force android update status:", process.env.ANDROID_FORCE_UPDATE);
    //console.log("Android Verzion :", process.env.ANDROID_APP_VERSION);
    res.json({
      APP_VERSION: process.env.APP_VERSION,
      FORCE_UPDATE: true,
        ANDROID_APP_VERSION: process.env.ANDROID_APP_VERSION,
      ANDROID_FORCE_UPDATE: true,
      IOS_APP_VERSION: process.env.IOS_APP_VERSION,
      IOS_FORCE_UPDATE: true
    });
  },
);


export default userRouter;