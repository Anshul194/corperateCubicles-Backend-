import express from 'express';
import {
  createAssignment,
  getAllAssignments,
  getAssignmentById,
  updateAssignment,
  deleteAssignment
} from '../controllers/assignmentController.js';

import { upload } from '../middlewares/upload-middleware.js';
import accessTokenAutoRefresh from '../middlewares/accessTokenAutoRefresh.js';
import passport from 'passport';
import { isAdmin } from '../middlewares/isAdmin.js';
const assignmentRouter = express.Router();

assignmentRouter.post(
  '/',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  upload.fields([
    { name: 'attachmentFile', maxCount: 1 },
    { name: 'documentFile', maxCount: 1 }
  ]),
  createAssignment
);

assignmentRouter.get('/', getAllAssignments);
assignmentRouter.get('/:id', getAssignmentById);
assignmentRouter.put(
  '/:id',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  upload.fields([
    { name: 'attachmentFile', maxCount: 1 },
    { name: 'documentFile', maxCount: 1 }
  ]),
  updateAssignment
);
assignmentRouter.delete(
  '/:id',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  deleteAssignment
);

export default assignmentRouter;