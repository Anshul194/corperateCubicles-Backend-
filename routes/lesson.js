import express from 'express';
import {
  createLesson,
  getAllLessons,
  getLessonById,
  updateLesson,
  deleteLesson,
  toggleMobileOnly
} from '../controllers/LessonController.js';

import accessTokenAutoRefresh from '../middlewares/accessTokenAutoRefresh.js';
import passport from 'passport';
import { isAdmin } from '../middlewares/isAdmin.js';
import { upload } from '../middlewares/upload-middleware.js';

const lessonRouter = express.Router();

lessonRouter.get('/', getAllLessons);
lessonRouter.get('/:lessonId', getLessonById);

lessonRouter.post(
  '/',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  // upload.single('file'),
  upload.fields([
    { name: 'fileUrl', maxCount: 1 },
    { name: 'image', maxCount: 1 },


  ]),
  createLesson
);

lessonRouter.put(
  '/:lessonId',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  upload.fields([
    { name: 'fileUrl', maxCount: 1 },
    { name: 'image', maxCount: 1 },

  ]),
  updateLesson
);

lessonRouter.delete(
  '/:lessonId',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  deleteLesson
);

lessonRouter.patch(
  '/:lessonId/mobile-only',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  toggleMobileOnly
);


export default lessonRouter;
