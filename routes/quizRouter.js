import express from 'express';
import {
  createQuiz,
  getAllQuizzes,
  getQuizById,
  updateQuiz,
  deleteQuiz,
  submitQuiz,
  mySubmittedQuizzes,
  submittedQuiz,
  getAllSubmissions
} from '../controllers/QuizController.js';
import accessTokenAutoRefresh from '../middlewares/accessTokenAutoRefresh.js';
import passport from 'passport';
import { isAdmin } from '../middlewares/isAdmin.js';
import { upload } from '../middlewares/upload-middleware.js';

const quizRouter = express.Router();

quizRouter.get('/', getAllQuizzes);
quizRouter.get('/:quizId', getQuizById);
quizRouter.get('/my/submitted-quizzes', 
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  mySubmittedQuizzes
);
quizRouter.get('/submitted-quiz/:submissionId',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  submittedQuiz
);

quizRouter.get('/all/submissions',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  getAllSubmissions
);

quizRouter.post(
  '/',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  createQuiz
);

quizRouter.post(
  '/:quizId/submit',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  submitQuiz
);

quizRouter.put(
  '/:quizId',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  upload.any(),
  updateQuiz
);

quizRouter.delete(
  '/:quizId',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  deleteQuiz
);

export default quizRouter;