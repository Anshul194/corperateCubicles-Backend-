import express from 'express';
import SecurityController from '../controllers/SecurityController.js';
import passport from 'passport';
import accessTokenAutoRefresh from '../middlewares/accessTokenAutoRefresh.js';
import { isAdmin } from '../middlewares/isAdmin.js';

const securityRouter = express.Router();

// Record security incident
securityRouter.post(
    '/incidents',
    accessTokenAutoRefresh,
     passport.authenticate('jwt', { session: false }),
    SecurityController.recordIncident
);

// Get security incidents (Admin only — exposes user PII, IPs, and user agents.
// Consumed by the admin panel's Security page, which authenticates.)
securityRouter.get(
    '/incidents',
    accessTokenAutoRefresh,
    passport.authenticate('jwt', { session: false }),
    isAdmin,
    SecurityController.getIncidents
);

export default securityRouter;