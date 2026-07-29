
import express from 'express';
import accessTokenAutoRefresh from '../middlewares/accessTokenAutoRefresh.js';
import passport from 'passport';
import { isAdmin } from '../middlewares/isAdmin.js';
import isUserBanned from '../middlewares/isUserBanned.js';
import { createQuestion, getQuestions, submitTest, updateQuestion, deleteQuestion, getMyResults, hasSubmittedPersonalityTest, updateCourseMapping } from '../controllers/PersonalityController.js';
import optionalAuthenticate from '../middlewares/optionalAuthenticate.js';

const router = express.Router();

// Admin routes for question management
router.post(
    '/questions',
    accessTokenAutoRefresh,
    passport.authenticate('jwt', { session: false }),
    isAdmin,
    isUserBanned,
    createQuestion
);

router.put(
    '/questions/:id',
    accessTokenAutoRefresh,
    passport.authenticate('jwt', { session: false }),
    isAdmin,
    isUserBanned,
    updateQuestion
);

router.delete(
    '/questions/:id',
    accessTokenAutoRefresh,
    passport.authenticate('jwt', { session: false }),
    isAdmin,
    isUserBanned,
    deleteQuestion
);

router.put(
    '/course-mapping',
    accessTokenAutoRefresh,
    passport.authenticate('jwt', { session: false }),
    isAdmin,
    isUserBanned,
    updateCourseMapping
);

// User routes
router.post(
    '/submit',
    optionalAuthenticate,
    submitTest
);

router.get(
    '/my-results',
    accessTokenAutoRefresh,
    passport.authenticate('jwt', { session: false }),
    getMyResults
);



router.get(
    '/has-submitted',
    accessTokenAutoRefresh,
    passport.authenticate('jwt', { session: false }),
    hasSubmittedPersonalityTest
);


// Public routes
router.get('/questions', getQuestions);

export default router;
