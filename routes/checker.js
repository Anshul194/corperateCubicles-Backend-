import express from 'express';
import { checkUnlockConditions, bulkCheckUnlockConditions } from '../controllers/unlockConditionChecker.js';

const Unlockrouter = express.Router();

// POST /api/drip/check-unlock-conditions
Unlockrouter.post('/check-unlock-conditions', checkUnlockConditions);

// POST /api/drip/bulk-check-unlock
Unlockrouter.post('/bulk-check-unlock', bulkCheckUnlockConditions);

export default Unlockrouter;