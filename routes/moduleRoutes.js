import express from 'express';
import passport from 'passport';
import upload from '../middlewares/upload.js';
import { createModule, getModuleById, getAllModules, updateModule, deleteModule, disableDripForModule } from '../controllers/ModuleController.js';
import accessTokenAutoRefresh from '../middlewares/accessTokenAutoRefresh.js';
import { isAdmin } from '../middlewares/isAdmin.js';

const router = express.Router();

// Admin only
router.post('/', accessTokenAutoRefresh, passport.authenticate('jwt', { session: false }), isAdmin, upload.single('image'), createModule);
router.put('/:id', accessTokenAutoRefresh, passport.authenticate('jwt', { session: false }), isAdmin, upload.single('image'), updateModule);
router.delete('/:id', accessTokenAutoRefresh, passport.authenticate('jwt', { session: false }), isAdmin, deleteModule);

// Public
router.get('/', getAllModules);
router.get('/:id', getModuleById);

router.post(
  '/:moduleId/disable-drip',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin, // or use a custom middleware to allow instructors as well
  disableDripForModule
);



export default router;
