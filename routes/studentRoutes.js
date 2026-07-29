// routes/studentRoutes.js
import express from 'express';
import passport from 'passport';
import accessTokenAutoRefresh from '../middlewares/accessTokenAutoRefresh.js';
import { isAdmin } from '../middlewares/isAdmin.js';
import { getAllStudents, getStudentById, getStudentAnalytics } from '../controllers/studentController.js';

const studentRouter = express.Router();

// Allow access only if the requester is an admin/instructor OR is the owner of
// the requested student record. Prevents IDOR on student profile/analytics.
const ADMIN_ROLES = ['admin', 'instructor'];
const authorizeStudentAccess = (req, res, next) => {
  const user = req.user;
  const userRoles = user
    ? (Array.isArray(user.roles) ? user.roles : [user.role || user.roles])
    : [];
  const isAdminUser = userRoles.some((r) => ADMIN_ROLES.includes(r));
  const isOwner = user && String(user._id) === String(req.params.id);

  if (isAdminUser || isOwner) {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: 'Access denied: you are not authorized to view this student',
    data: {},
    err: { message: 'Forbidden' },
  });
};

studentRouter.get(
  '/',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  getAllStudents
);

studentRouter.get(
  '/:id',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  authorizeStudentAccess,
  getStudentById
);

studentRouter.get(
  '/:id/analytics',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  authorizeStudentAccess,
  getStudentAnalytics
);

export default studentRouter;
