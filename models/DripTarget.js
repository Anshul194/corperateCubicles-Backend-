import mongoose from 'mongoose';

const dripTargetSchema = new mongoose.Schema({
    dripRuleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DripRule',
        required: true
    },

    targetType: {
        type: String,
        enum: ['lesson', 'module', 'course'], // added 'course' for extensibility
        required: true
    },

    targetId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        refPath: 'targetType'
    }

}, { timestamps: true });

// Serves ProgressController.js DripTarget.find({ targetId: { $in: targetIds } })
dripTargetSchema.index({ targetId: 1 });
// Serves unlockConditionChecker.js DripTarget.find({ targetType, targetId });
// the targetId prefix also covers the targetId-only $in query above.
dripTargetSchema.index({ targetId: 1, targetType: 1 });

export default mongoose.models.DripTarget || mongoose.model('DripTarget', dripTargetSchema);
