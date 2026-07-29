// routes/adminStudentActivityRoutes.js
// Admin-only student activity feeds consumed by the admin panel's
// StudentDetail page (GET /admin/students/:id/forum-posts|forum-replies|job-posts).
import express from 'express';
import passport from 'passport';
import accessTokenAutoRefresh from '../middlewares/accessTokenAutoRefresh.js';
import { isAdmin } from '../middlewares/isAdmin.js';
import {
  getStudentForumPosts,
  getStudentForumReplies,
  getStudentJobPosts,
} from '../controllers/studentController.js';

const adminStudentActivityRouter = express.Router();

const adminOnly = [
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
];

// Forum threads authored by the student
adminStudentActivityRouter.get('/:id/forum-posts', ...adminOnly, getStudentForumPosts);

// Forum replies authored by the student
adminStudentActivityRouter.get('/:id/forum-replies', ...adminOnly, getStudentForumReplies);

// Job postings created by the student
adminStudentActivityRouter.get('/:id/job-posts', ...adminOnly, getStudentJobPosts);

export default adminStudentActivityRouter;
