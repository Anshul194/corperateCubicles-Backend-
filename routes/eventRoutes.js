import express from 'express';
import {
  createEvent,
  getAllEvents,
  getEventById,
  updateEvent,
  deleteEvent,
  checkRegisterForEvent,
  registerForEvent,
  updateParticipantStatus
} from '../controllers/EventController.js';
import accessTokenAutoRefresh from '../middlewares/accessTokenAutoRefresh.js';
import passport from 'passport';
import { isAdmin } from '../middlewares/isAdmin.js';
import { upload } from '../middlewares/upload-middleware.js';

const router = express.Router();

// Public routes
router.get('/', getAllEvents);
router.get('/:id', getEventById);
router.post('/:id/check-register', checkRegisterForEvent);
router.post('/:id/register', registerForEvent);

// Protected routes
router.use(accessTokenAutoRefresh);
router.use(passport.authenticate('jwt', { session: false }));

// Event creation and management (admin only)
router.post('/',
  isAdmin,
  upload.fields([
    { name: 'thumbnail', maxCount: 1 },
    { name: 'attachments', maxCount: 5 }
  ]),
  createEvent
);

router.put('/:id',
  isAdmin,
  upload.fields([
    { name: 'thumbnail', maxCount: 1 },
    { name: 'attachments', maxCount: 5 }
  ]),
  updateEvent
);

router.delete('/:id', isAdmin, deleteEvent);

// Participant management
router.patch('/:id/participants/:userId/status', isAdmin, updateParticipantStatus);

export default router;
