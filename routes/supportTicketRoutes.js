// routes/ticketRoutes.js
import express from 'express';
import { 
  createTicket, 
  getTicketById, 
  getAllTickets, 
  updateTicket, 
  deleteTicket,
  addMessage,
  deleteMessage,
  getMyTickets,
  updateTicketStatus,
  getMyResolvedTickets
} from '../controllers/TicketController.js';
import accessTokenAutoRefresh from '../middlewares/accessTokenAutoRefresh.js';
import passport from 'passport';
import { isAdmin } from '../middlewares/isAdmin.js';
import { upload } from '../middlewares/upload-middleware.js';

const ticketRouter = express.Router();

// Create a support ticket (authenticated users)
ticketRouter.post(
  '/',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
//   upload.fields([{ name: 'attachments', maxCount: 5 }]),
upload.any(),

  createTicket
);

ticketRouter.get(
  '/my-resolved-tickets',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  getMyResolvedTickets
);

// Get all tickets (admin only)
ticketRouter.get(
  '/',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  getAllTickets
);

// Get my tickets (authenticated users)
ticketRouter.get(
  '/my-tickets',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  getMyTickets
);

// Get a ticket by ID (owner or admin)
ticketRouter.get(
  '/:id',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  getTicketById
);

// Update a ticket (owner or admin)
ticketRouter.put(
  '/:id',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  updateTicket
);

// Update ticket status (admin only)
ticketRouter.patch(
  '/:id/status',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  updateTicketStatus
);

// Add message to ticket (owner or admin)
ticketRouter.post(
  '/:id/messages',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  upload.any(),
  addMessage
);

// Delete a single message from a support ticket (owner or admin)
ticketRouter.delete(
  '/:id/messages/:messageId',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  deleteMessage
);

// Delete a ticket (soft delete - admin only)
ticketRouter.delete(
  '/:id',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  deleteTicket
);



export default ticketRouter;