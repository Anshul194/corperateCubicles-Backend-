import express from 'express';
import passport from 'passport';
import accessTokenAutoRefresh from '../middlewares/accessTokenAutoRefresh.js';
import { isAdmin } from '../middlewares/isAdmin.js';
import {
    createDripRule,
    getAllDripRules,
    deleteDripRule,
    getDripForTarget,
    getDripTargetsByReferenceId,
    updateDripRuleByReferenceId,
} from '../controllers/dripController.js';

const router = express.Router();

// Supports bulk drip rule creation: pass array of targetId for multiple lessons/modules
// Admin/instructor only (admin panel uses cookie auth, so the full JWT stack works)
router.post(
    '/drip-rule',
    accessTokenAutoRefresh,
    passport.authenticate('jwt', { session: false }),
    isAdmin,
    createDripRule
);
router.get('/drip-rules', getAllDripRules);
///api/drip/module/665c914ec2d86c3f48567fbc
//drip-targets/by-reference/:referenceId
router.get('/drip-rules/by-reference/:referenceId', accessTokenAutoRefresh, getDripTargetsByReferenceId);
// Update DripRule by targetId — admin/instructor only
router.put(
    '/drip-rules/by-target/:targetID',
    accessTokenAutoRefresh,
    passport.authenticate('jwt', { session: false }),
    isAdmin,
    updateDripRuleByReferenceId
);
router.delete(
    '/drip-rule/:id',
    accessTokenAutoRefresh,
    passport.authenticate('jwt', { session: false }),
    isAdmin,
    deleteDripRule
);


// Get drip rules for a specific target type and ID



router.get('/drip-rules/:targetType/:targetId', accessTokenAutoRefresh, getDripForTarget);

export default router;