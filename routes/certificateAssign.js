import express from 'express';
import multer from 'multer';
import { 
  assignCertificate, 
  getCertificate, 
  getAllCertificates, 
  updateCertificate, 
  deleteCertificate,
  downloadCertificate
} from '../controllers/certificateAssignController.js';
import accessTokenAutoRefresh from '../middlewares/accessTokenAutoRefresh.js';
import passport from 'passport';
import { isAdmin } from '../middlewares/isAdmin.js';

const certificateAssignRouter = express.Router();

// Configure multer for form-data parsing (no file uploads)
const upload = multer(); // No storage or limits needed since no files are uploaded

// Assign a certificate (admin only)
certificateAssignRouter.post(
  '/',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  upload.none(), // Parse form-data fields, expect no files
  assignCertificate
);

// Get a certificate by ID (admin only)
certificateAssignRouter.get(
  '/:id',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  getCertificate
);

// Get all certificates (admin only)
certificateAssignRouter.get(
  '/',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  getAllCertificates
);

// Update a certificate (admin only)
certificateAssignRouter.put(
  '/:id',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  upload.none(), // Parse form-data fields for PUT
  updateCertificate
);

// Delete a certificate (admin only)
certificateAssignRouter.delete(
  '/:id',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  deleteCertificate
);

// Download a certificate
certificateAssignRouter.get(
  '/:id/download',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  downloadCertificate
);

export default certificateAssignRouter;