import express from 'express';
import {

createTextLesson,
getAllTextLessons,
getTextLessonById,
updateTextLesson,
deleteTextLesson
} from '../controllers/textLessonController.js';
import { upload } from '../middlewares/upload-middleware.js';
import accessTokenAutoRefresh from '../middlewares/accessTokenAutoRefresh.js';
import passport from 'passport';
import { isAdmin } from '../middlewares/isAdmin.js';

const Textrouter = express.Router();

// SECURITY: GETs stay public; mutations are admin-only.

// Create a new text lesson (Admin only)
Textrouter.post(
  '/',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  upload.any(),
  createTextLesson
);

// Get all text lessons
Textrouter.get('/', getAllTextLessons);

// Get a single text lesson by ID
Textrouter.get('/:id', getTextLessonById);

// Update a text lesson (Admin only)
Textrouter.put(
  '/:id',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  upload.any(),
  updateTextLesson
);

// Delete a text lesson (Admin only)
Textrouter.delete(
  '/:id',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  deleteTextLesson
);

export default Textrouter;
