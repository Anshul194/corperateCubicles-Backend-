import mongoose from 'mongoose';

const dripRuleSchema = new mongoose.Schema({
    dripType: {
        type: String,
        enum: [
            'days_after_enrollment',
            'days_after_lesson_completed',
            'days_after_module_completed',
            'after_lesson_completed',
            'after_module_completed',
            'specific_date',
            'after_quiz_passed',
            'after_assignment_submitted',
            'after_feedback_received',
            'custom_condition'
        ],
        required: true
    },

    referenceType: {
        type: String,
        enum: ['lesson', 'module', 'date', 'enrollment'],
    },

    referenceId: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: 'referenceType', // Dynamic ref to either Lesson or Module
        required: function () {
            return this.referenceType !== 'enrollment' && this.referenceType !== 'date';
        }
    },

    delayDays: {
        type: Number,
        default: 0
    },

    unlockDate: {
        type: Date
    },

    requiredScore: {
        type: Number
    },

    conditionOperator: {
        type: String,
        enum: ['AND', 'OR'],
        default: 'AND'
    }

}, { timestamps: true });

export default mongoose.models.DripRule || mongoose.model('DripRule', dripRuleSchema);
