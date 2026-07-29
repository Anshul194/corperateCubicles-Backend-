import express from 'express';
import {
  createFAQ,
  getAllFAQs,
  getFAQById,
  getCourseFAQs,
  updateFAQ,
  deleteFAQ
} from '../controllers/faqController.js';
import accessTokenAutoRefresh from '../middlewares/accessTokenAutoRefresh.js';
import { isAdmin } from '../middlewares/isAdmin.js';
import passport from 'passport';

const router = express.Router();

router.post('/', accessTokenAutoRefresh,passport.authenticate('jwt', { session: false }),isAdmin,createFAQ);
router.get('/', getAllFAQs);
router.get('/:id', getFAQById);
router.get('/course/:courseId', getCourseFAQs);
// router.put('/:id',   updateFAQ);
// router.delete('/:id',  deleteFAQ);
router.put('/:id',  accessTokenAutoRefresh,passport.authenticate('jwt', { session: false }),isAdmin, updateFAQ);
router.delete('/:id', accessTokenAutoRefresh,passport.authenticate('jwt', { session: false }),isAdmin, deleteFAQ);

export default router;
