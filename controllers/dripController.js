import DripRule from '../models/DripRule.js';
import DripTarget from '../models/DripTarget.js';
import { initRedis } from '../config/redisClient.js';
import mongoose from 'mongoose';

// Create Drip Rule + Target (supports bulk targetId)
export const createDripRule = async (req, res) => {
    try {
        let {
            dripType,
            referenceType,
            referenceId,
            delayDays,
            unlockDate,
            requiredScore,
            conditionOperator,
            targetType,
            targetId
        } = req.body;

        // --- Sanitize referenceId and targetId ---
        // If array, filter out empty/invalid values; if string and empty, set to undefined
        if (Array.isArray(referenceId)) {
            referenceId = referenceId.filter(id => id && typeof id === 'string' ? id.trim() !== '' : !!id);
        } else if (typeof referenceId === 'string' && referenceId.trim() === '') {
            referenceId = undefined;
        }
        if (Array.isArray(targetId)) {
            targetId = targetId.filter(id => id && typeof id === 'string' ? id.trim() !== '' : !!id);
        } else if (typeof targetId === 'string' && targetId.trim() === '') {
            targetId = undefined;
        }

        // Normalize to arrays for bulk logic
        const referenceIds = Array.isArray(referenceId) ? referenceId : [referenceId];
        const targetIds = Array.isArray(targetId) ? targetId : [targetId];

        // --- Ensure only one drip rule per target: delete existing before creating new ---
        for (const tid of targetIds) {
            if (tid) {
                // Find and delete existing DripTarget(s) for this targetId/targetType
                const existingTargets = await DripTarget.find({ targetId: tid, targetType });
                for (const target of existingTargets) {
                    // Delete the associated DripRule
                    if (target.dripRuleId) {
                        await DripRule.findByIdAndDelete(target.dripRuleId);
                    }
                    await DripTarget.findByIdAndDelete(target._id);
                }
            }
        }

        // If both are arrays of same length, pairwise create rules
        let dripRules = [];
        let dripTargets = [];

        if (Array.isArray(referenceId) && Array.isArray(targetId) && referenceIds.length === targetIds.length) {
            for (let i = 0; i < referenceIds.length; i++) {
                const rule = await DripRule.create({
                    dripType,
                    referenceType,
                    referenceId: referenceIds[i],
                    delayDays,
                    unlockDate,
                    requiredScore,
                    conditionOperator
                });
                dripRules.push(rule);
                const target = await DripTarget.create({
                    dripRuleId: rule._id,
                    targetType,
                    targetId: targetIds[i]
                });
                dripTargets.push(target);
            }
        } else if (Array.isArray(targetId)) {
            // One referenceId, many targets
            const rule = await DripRule.create({
                dripType,
                referenceType,
                referenceId: referenceIds[0],
                delayDays,
                unlockDate,
                requiredScore,
                conditionOperator
            });
            dripRules.push(rule);
            dripTargets = await DripTarget.insertMany(
                targetIds.map(id => ({
                    dripRuleId: rule._id,
                    targetType,
                    targetId: id
                }))
            );
        } else if (Array.isArray(referenceId)) {
            // Many referenceIds, one targetId
            for (let i = 0; i < referenceIds.length; i++) {
                const rule = await DripRule.create({
                    dripType,
                    referenceType,
                    referenceId: referenceIds[i],
                    delayDays,
                    unlockDate,
                    requiredScore,
                    conditionOperator
                });
                dripRules.push(rule);
                const target = await DripTarget.create({
                    dripRuleId: rule._id,
                    targetType,
                    targetId: targetIds[0]
                });
                dripTargets.push(target);
            }
        } else {
            // Single rule/target
            const rule = await DripRule.create({
                dripType,
                referenceType,
                referenceId,
                delayDays,
                unlockDate,
                requiredScore,
                conditionOperator
            });
            dripRules.push(rule);
            const target = await DripTarget.create({
                dripRuleId: rule._id,
                targetType,
                targetId
            });
            dripTargets.push(target);
        }

        // Invalidate Redis cache
        const redis = await initRedis();
        await redis.del('dripRules:all');

        // --- Return only the newly created dripTargets (with populated dripRule) ---
        const populatedTargets = await DripTarget.find({
            _id: { $in: dripTargets.map(t => t._id) }
        }).populate('dripRuleId');

        res.status(201).json({
            success: true,
            message: 'Drip rule(s) created successfully',
            dripRules,
            dripTargets: populatedTargets
        });
    } catch (error) {
        console.error('Create drip rule error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Get all drip rules with cache
export const getAllDripRules = async (req, res) => {
    try {
        const redis = await initRedis();
        const cacheKey = 'dripRules:all';
        const cached = await redis.get(cacheKey);

        if (cached) {
            return res.status(200).json({
                success: true,
                message: 'Drip rules fetched from cache',
                data: JSON.parse(cached),
                fromCache: true
            });
        }

        const rules = await DripRule.find()
            .populate({
                path: 'referenceId',
                select: 'title name'
            });

        const targets = await DripTarget.find()
            .populate('dripRuleId')
            .populate('targetId');

        const data = { rules, targets };

        await redis.setEx(cacheKey, 300, JSON.stringify(data)); // cache for 5 minutes

        res.json({
            success: true,
            message: 'Drip rules fetched successfully',
            data
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch drip rules' });
    }
};

//getDripTargetsByReferenceId
export const getDripTargetsByReferenceId = async (req, res) => {
    const { referenceId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(referenceId)) {
        return res.status(400).json({ message: 'Invalid reference ID' });
    }

    try {
        // Find the latest DripTarget for this referenceId (targetId)
        const target = await DripTarget.findOne({
            targetId: referenceId
        })
        .sort({ createdAt: -1 }) // get the latest
        .populate('dripRuleId');

        if (!target) {
            return res.status(404).json({ message: 'No drip target found for this reference ID' });
        }

        res.status(200).json({ data: target });
    } catch (err) {
        console.error('Error fetching drip targets by referenceId:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

//getDripForTarget
export const getDripForTarget = async (req, res) => {
    const { targetType, targetId } = req.params;

    if (!['lesson', 'module'].includes(targetType)) {
        return res.status(400).json({ message: 'Invalid target type.' });
    }

    if (!mongoose.Types.ObjectId.isValid(targetId)) {
        return res.status(400).json({ message: 'Invalid target ID.' });
    }

    try {
        const dripTargets = await DripTarget.find({
            targetType,
            targetId
        }).populate('dripRuleId');

        if (!dripTargets.length) {
            return res.status(404).json({ message: 'No drip rule found for this target.' });
        }

        const result = dripTargets.map(target => ({
            dripTargetId: target._id,
            targetType: target.targetType,
            targetId: target.targetId,
            dripRule: target.dripRuleId
        }));

        return res.status(200).json({ data: result });
    } catch (err) {
        console.error('Error fetching drip:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Delete a drip rule + its targets + invalidate cache
// export const deleteDripRule = async (req, res) => {
//     try {
//         const { id } = req.params;

//         await DripTarget.deleteMany({ dripRuleId: id });
//         await DripRule.findByIdAndDelete(id);

//         // Invalidate Redis cache
//         const redis = await initRedis();
//         await redis.del('dripRules:all');

//         res.json({ success: true, message: 'Drip rule and associated targets deleted' });
//     } catch (error) {
//         res.status(500).json({ error: 'Failed to delete drip rule' });
//     }
// };

// Fields a client may set on a DripRule (mirrors models/DripRule.js schema).
// SECURITY: never $set req.body directly — whitelist to prevent mass assignment.
const DRIP_RULE_UPDATABLE_FIELDS = [
    'dripType',
    'referenceType',
    'referenceId',
    'delayDays',
    'unlockDate',
    'requiredScore',
    'conditionOperator',
];

export const updateDripRuleByReferenceId = async (req, res) => {
    const { targetID } = req.params;

    if (!mongoose.Types.ObjectId.isValid(targetID)) {
        return res.status(400).json({ success: false, message: 'Invalid targetID' });
    }

    // Whitelist assignable fields (mass-assignment protection)
    const updateFields = {};
    for (const field of DRIP_RULE_UPDATABLE_FIELDS) {
        if (req.body && Object.prototype.hasOwnProperty.call(req.body, field)) {
            updateFields[field] = req.body[field];
        }
    }

    // Sanitize referenceId: remove if empty string, null, or undefined
    if (
        'referenceId' in updateFields &&
        (
            updateFields.referenceId === '' ||
            updateFields.referenceId === null ||
            typeof updateFields.referenceId === 'undefined'
        )
    ) {
        delete updateFields.referenceId;
    }

    try {
        const target = await DripTarget.findOne({
            targetId: targetID
        }).populate('dripRuleId');

        if (!target || !target.dripRuleId) {
            return res.status(404).json({ success: false, message: 'No drip target found for the given targetId' });
        }

        const dripRule = await DripRule.findOneAndUpdate(
            { _id: target.dripRuleId },
            { $set: updateFields },
            { new: true }
        );

        if (!dripRule) {
            return res.status(404).json({ success: false, message: 'Drip rule not found for the given targetId' });
        }

        // Invalidate Redis cache
        const redis = await initRedis();
        await redis.del('dripRules:all');

        res.status(200).json({
            success: true,
            message: 'Drip rule updated successfully',
            dripRule
        });
    } catch (error) {
        console.error('Error updating drip rule:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

export const deleteDripRule = async (req, res) => {
    try {
        const { id } = req.params;

        // Delete all DripTargets associated with this DripRule
        await DripTarget.deleteMany({ dripRuleId: id });

        // Delete the DripRule itself
        await DripRule.findByIdAndDelete(id);

        // Invalidate Redis cache
        const redis = await initRedis();
        await redis.del('dripRules:all');

        res.json({ success: true, message: 'Drip rule and associated targets deleted' });
    } catch (error) {
        console.error('Delete drip rule error:', error);
        res.status(500).json({ error: 'Failed to delete drip rule' });
    }
};


