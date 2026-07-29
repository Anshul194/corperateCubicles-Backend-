import express from 'express';
import { requestDeleteAccount, getDeleteRequests,updateDeleteRequestStatus } from '../controllers/DeleteAccountRequestController.js';
import passport from 'passport';
import accessTokenAutoRefresh from '../middlewares/accessTokenAutoRefresh.js';
import { isAdmin } from '../middlewares/isAdmin.js';

const deleteAccountRequestRouter = express.Router();

deleteAccountRequestRouter.post(
  '/',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  requestDeleteAccount
);

deleteAccountRequestRouter.get(
  '/all',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  getDeleteRequests
);

deleteAccountRequestRouter.put(
  '/:id',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  updateDeleteRequestStatus
);


export default deleteAccountRequestRouter;
