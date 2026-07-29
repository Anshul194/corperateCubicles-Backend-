import mongoose from 'mongoose';
import DripRule from '../models/DripRule.js';
import DripTarget from '../models/DripTarget.js';
import UserCourse from '../models/CourseEnrollment.js';
import UserProgress from '../models/LessonProgress.js';
import Lesson from '../models/Lesson.js'
import QuizAttempt from '../models/QuizSubmission.js';
import Quiz from '../models/Quiz.js';
import AssignmentSubmission from '../models/assignmentSubmission.js';
import Assignment from '../models/Assignment.js';
import Module from '../models/Module.js';
/**
 * API to check if drip conditions are satisfied for unlocking content
 * POST /api/drip/check-unlock-conditions
 */
export const checkUnlockConditions = async (req, res) => {
    // //console.log('req.body', req.body);
    try {
        const { userId, targetId, targetType } = req.body;

        if (!userId || !targetId || !targetType) {
            return res.status(400).json({
                success: false,
                message: 'userId, targetId, and targetType are required'
            });
        }

        const result = await evaluateUnlockConditions(userId, targetId, targetType);

        return res.json(result);

    } catch (error) {
        console.error('Error checking unlock conditions:', error?.message);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

/**
 * Reusable function to evaluate unlock conditions
 */
export const evaluateUnlockConditions = async (userId, targetId, targetType, providedDripTargets = null) => {
    try {
        // --- Unlock module if drip is disabled for this user ---
        if (targetType === 'module') {
            const module = await Module.findById(targetId).select('dripSettingDisabledFor');
            if (
                module &&
                Array.isArray(module.dripSettingDisabledFor) &&
                module.dripSettingDisabledFor.some(id => id.equals(userId))
            ) {
                return {
                    success: true,
                    canUnlock: true,
                    message: 'Drip is disabled for this user on this module',
                    satisfiedConditions: [],
                    failedConditions: [],
                    totalConditions: 0
                };
            }
        }

        // --- If targetType is lesson, check if its parent module has drip disabled for this user ---
        if (targetType === 'lesson') {
            const lesson = await Lesson.findById(targetId).select('moduleId');
            if (lesson && lesson.moduleId) {
                const module = await Module.findById(lesson.moduleId).select('dripSettingDisabledFor');
                if (
                    module &&
                    Array.isArray(module.dripSettingDisabledFor) &&
                    module.dripSettingDisabledFor.some(id => id.equals(userId))
                ) {
                    return {
                        success: true,
                        canUnlock: true,
                        message: 'Drip is disabled for this user on the parent module of this lesson',
                        satisfiedConditions: [],
                        failedConditions: [],
                        totalConditions: 0
                    };
                }
            }
        }

        let dripTargets = providedDripTargets;
        if (!dripTargets) {
            // Find all drip rules that target this specific lesson/module
            dripTargets = await DripTarget.find({
                targetId,
                targetType
            }).populate('dripRuleId');
        }


        // console?.log("dripTargets",dripTargets)



        if (!dripTargets || dripTargets.length === 0) {
            return {
                success: true,
                canUnlock: true,
                message: 'No drip rules found - content is unlocked',
                satisfiedConditions: [],
                failedConditions: []
            };
        }

        const conditionResults = [];

        for (const dripTarget of dripTargets) {
            // console?.log("dripTarget",dripTarget)
            const dripRule = dripTarget.dripRuleId;
            // console?.log("dripRule",dripRule)    

            const conditionResult = await evaluateDripCondition(
                dripRule,
                userId,
                targetId,
                targetType
            );

            conditionResults.push({
                dripRuleId: dripRule._id,
                dripType: dripRule.dripType,
                referenceType: dripRule.referenceType,
                referenceId: dripRule.referenceId,
                satisfied: conditionResult.satisfied,
                reason: conditionResult.reason,
                details: conditionResult.details
            });
        }
        // console?.log("conditionResults",conditionResults)

        // Determine if content can be unlocked based on condition operator
        const canUnlock = determineUnlockStatus(conditionResults, dripTargets[0].dripRuleId.conditionOperator);

        const satisfiedConditions = conditionResults.filter(c => c.satisfied);
        const failedConditions = conditionResults.filter(c => !c.satisfied);

        return {
            success: true,
            canUnlock,
            message: canUnlock ? 'Content can be unlocked' : 'Content is still locked',
            satisfiedConditions,
            failedConditions,
            totalConditions: conditionResults.length
        };

    } catch (error) {
        throw error;
    }
};

/**
 * Evaluate individual drip condition
 */
export const evaluateDripCondition = async (dripRule, userId, targetId, targetType) => {
    const { dripType, referenceType, referenceId, delayDays, unlockDate, requiredScore } = dripRule;
    // console?.log("dripRule",dripRule)
    // console?.log("dripType",dripType)
    // Validate required fields
    // console?.log("referenceType",referenceType)
    // console?.log("referenceId",referenceId)
    // console?.log("targetId",targetId    )

    try {
        switch (dripType) {
            case 'days_after_enrollment':
                return await checkDaysAfterEnrollment(userId, delayDays, targetId);

            case 'after_lesson_completed':
                return await checkLessonCompleted(userId, referenceId);

            case 'days_after_lesson_completed':
                return await checkDaysAfterLessonCompleted(userId, referenceId, delayDays);

            case 'after_module_completed':
                return await checkModuleCompleted(userId, referenceId);

            case 'days_after_module_completed':
                return await checkDaysAfterModuleCompleted(userId, referenceId, delayDays);

            case 'specific_date':
                return checkSpecificDate(unlockDate);

            case 'after_quiz_passed':
                return await checkQuizPassed(userId, referenceId, requiredScore);

            case 'after_assignment_submitted':
                return await checkAssignmentSubmitted(userId, referenceId);

            case 'after_feedback_received':
                return await checkFeedbackReceived(userId, referenceId);

            default:
                return {
                    satisfied: false,
                    reason: 'Unknown drip type',
                    details: { dripType }
                };
        }
    } catch (error) {
        return {
            satisfied: false,
            reason: 'Error evaluating condition',
            details: { error: error.message }
        };
    }
};

/**
 * Individual condition checkers
 */
const checkDaysAfterEnrollment = async (userId, delayDays, lessonId) => {
    try {
        // First, find the lesson to get the courseId
        // console?.log("consolr",lessonId)
        const lesson = await Lesson.findById(lessonId);

        if (!lesson) {
            return {
                satisfied: false,
                reason: 'Lesson not found',
                details: { lessonId }
            };
        }
        // console?.log("lesson",lesson)
        const courseId = lesson?.section?.toString() || lesson?.moduleId?.courseId?.toString();

        // Find the enrollment for the course using the courseId from the lesson
        const enrollment = await UserCourse.findOne({
            userId,
            courseId
        }).sort({ enrolledAt: 1 });

        if (!enrollment) {
            return {
                satisfied: false,
                reason: 'User not enrolled in this course',
                details: {
                    lessonId,
                    courseId,
                    message: 'No enrollment found for the course containing this lesson'
                }
            };
        }

        const daysSinceEnrollment = Math.floor(
            (new Date() - enrollment.enrolledAt) / (1000 * 60 * 60 * 24)
        );

        return {
            satisfied: daysSinceEnrollment >= delayDays,
            reason: daysSinceEnrollment >= delayDays ?
                `${daysSinceEnrollment} days passed since enrollment` :
                `Only ${daysSinceEnrollment} days passed, need ${delayDays} days`,
            details: {
                lessonId,
                courseId,
                daysSinceEnrollment,
                requiredDays: delayDays,
                enrolledAt: enrollment.enrolledAt
            }
        };

    } catch (error) {
        return {
            satisfied: false,
            reason: 'Error checking enrollment',
            details: {
                lessonId,
                error: error.message
            }
        };
    }
};

const checkLessonCompleted = async (userId, lessonId) => {
    // Find user progress for the lesson
    const progress = await UserProgress.findOne({
        userId,
        lessonId,
        completed: true
    });

    let lessonTitle = null;
    const Lesson = mongoose.model('Lesson');
    const lesson = await Lesson.findById(lessonId).populate({
        path: 'moduleId',
        populate: { path: 'courseId' }
    });
    lessonTitle = lesson ? lesson.title : null;
    return {
        satisfied: !!progress,
        reason: progress ? 'Lesson completed' : 'Lesson not completed',
        details: {
            lessonId,
            lessonTitle,
            lesson,
            completedAt: progress?.completedAt || null,
            progress: progress?.progressPercentage || 0
        }
    };
};

const checkDaysAfterLessonCompleted = async (userId, lessonId, delayDays) => {
    const progress = await UserProgress.findOne({
        userId,
        lessonId,
        completed: true
    });

    if (!progress) {
        return {
            satisfied: false,
            reason: 'Reference lesson not completed',
            details: { lessonId }
        };
    }

    const daysSinceCompletion = Math.floor(
        (new Date() - progress.completedAt) / (1000 * 60 * 60 * 24)
    );

    return {
        satisfied: daysSinceCompletion >= delayDays,
        reason: daysSinceCompletion >= delayDays ?
            `${daysSinceCompletion} days passed since lesson completion` :
            `Only ${daysSinceCompletion} days passed since completion, need ${delayDays} days`,
        details: {
            lessonId,
            daysSinceCompletion,
            requiredDays: delayDays,
            completedAt: progress.completedAt
        }
    };
};

const checkModuleCompleted = async (userId, moduleId) => {
    // Check if all lessons in module are completed
    const moduleProgress = await UserProgress.aggregate([
        {
            $lookup: {
                from: 'lessons',
                localField: 'lessonId',
                foreignField: '_id',
                as: 'lesson'
            }
        },
        {
            $match: {
                userId: new mongoose.Types.ObjectId(userId),
                'lesson.moduleId': new mongoose.Types.ObjectId(moduleId)
            }
        },
        {
            $group: {
                _id: '$lesson.moduleId',
                totalLessons: { $sum: 1 },
                completedLessons: {
                    $sum: { $cond: [{ $eq: ['$completed', true] }, 1, 0] }
                }
            }
        }
    ]);

    const isModuleCompleted = moduleProgress.length > 0 &&
        moduleProgress[0].totalLessons === moduleProgress[0].completedLessons;

    return {
        satisfied: isModuleCompleted,
        reason: isModuleCompleted ? 'Module completed' : 'Module not completed',
        details: {
            moduleId,
            totalLessons: moduleProgress[0]?.totalLessons || 0,
            completedLessons: moduleProgress[0]?.completedLessons || 0
        }
    };
};

const checkDaysAfterModuleCompleted = async (userId, moduleId, delayDays) => {
    const moduleCheck = await checkModuleCompleted(userId, moduleId);

    if (!moduleCheck.satisfied) {
        return {
            satisfied: false,
            reason: 'Reference module not completed',
            details: { moduleId }
        };
    }

    // Get the latest completion date from module lessons
    const latestCompletion = await UserProgress.aggregate([
        {
            $lookup: {
                from: 'lessons',
                localField: 'lessonId',
                foreignField: '_id',
                as: 'lesson'
            }
        },
        {
            $match: {
                userId: new mongoose.Types.ObjectId(userId),
                'lesson.moduleId': new mongoose.Types.ObjectId(moduleId),
                completed: true
            }
        },
        {
            $sort: { completedAt: -1 }
        },
        {
            $limit: 1
        }
    ]);

    if (!latestCompletion.length) {
        return {
            satisfied: false,
            reason: 'No completion date found',
            details: { moduleId }
        };
    }

    const daysSinceCompletion = Math.floor(
        (new Date() - latestCompletion[0].completedAt) / (1000 * 60 * 60 * 24)
    );

    return {
        satisfied: daysSinceCompletion >= delayDays,
        reason: daysSinceCompletion >= delayDays ?
            `${daysSinceCompletion} days passed since module completion` :
            `Only ${daysSinceCompletion} days passed since completion, need ${delayDays} days`,
        details: {
            moduleId,
            daysSinceCompletion,
            requiredDays: delayDays,
            completedAt: latestCompletion[0].completedAt
        }
    };
};

const checkSpecificDate = (unlockDate) => {
    const now = new Date();
    const unlock = new Date(unlockDate);

    return {
        satisfied: now >= unlock,
        reason: now >= unlock ?
            'Unlock date reached' :
            `Content unlocks on ${unlock.toLocaleDateString()}`,
        details: {
            unlockDate: unlock,
            currentDate: now,
            daysRemaining: Math.ceil((unlock - now) / (1000 * 60 * 60 * 24))
        }
    };
};

// const checkQuizPassed = async (userId, quizId, requiredScore = 0) => {
//     // Assuming you have a QuizAttempt model
//     const attempt = await QuizAttempt.findOne({
//         userId,
//         quiz:quizId,
//         score: { $gte: requiredScore }
//     }).sort({ attemptedAt: -1 });

//     // console?.log("attempt",attempt)

//     return {
//         satisfied: !!attempt,
//         reason: attempt ? 
//             `Quiz passed with score ${attempt.score}` : 
//             `Quiz not passed or score below ${requiredScore}`,
//         details: {
//             quizId,
//             requiredScore,
//             actualScore: attempt?.score || 0,
//             attemptedAt: attempt?.attemptedAt || null
//         }
//     };
// };
const checkQuizPassed = async (userId, lessonId, requiredScore = 0) => {
    try {
        console?.log("lessonId", userId, lessonId, requiredScore);
        const lesson = await Lesson.findById(lessonId);

        if (!lesson) {
            return {
                satisfied: false,
                reason: 'Lesson not found',
                details: { lessonId }
            };
        }
        // Get the quiz linked to this lesson

        var quizId = null;

        const quiz = await Quiz.findOne({ lesson: lessonId });

        quizId = quiz?._id;

        if (!quizId) {
            return {
                satisfied: false,
                reason: 'No quiz linked to this lesson',
                details: {
                    lessonId,
                    lessonTitle: lesson?.title || 'Unknown Lesson',
                    quizId: null,
                    quizTitle: 'No Quiz Found',
                    requiredScore,
                    actualScore: 0,
                    attemptedAt: null
                }
            };
        }

        const attempt = await QuizAttempt.findOne({
            user: userId,
            quiz: quizId
        }).sort({ submittedAt: -1 });


        return {
            satisfied: !!attempt,
            reason: attempt
                ? `Quiz passed with score ${attempt.score}`
                : `Quiz not passed or score below ${requiredScore}`,
            details: {
                quizId,
                quizTitle: lesson.Quiz?.quizTitle || 'Unknown Quiz',
                lessonId,
                lessonTitle: lesson.title || 'Unknown Lesson',
                requiredScore,
                actualScore: attempt?.score || 0,
                attemptedAt: attempt?.submittedAt || null
            }
        };
    } catch (error) {
        console.error('Error in checkQuizPassed:', error.message);
        return {
            satisfied: false,
            reason: 'Error occurred while checking quiz',
            details: {
                lessonId,
                error: error.message
            }
        };
    }
};

const checkAssignmentSubmitted = async (userId, lessonId) => {
    // lessonId is used here
    console?.log("lessonId", lessonId);

    // Check if submission exists for this lesson
    const submission = await AssignmentSubmission.findOne({
        submittedBy: userId,
        lessonId,
        status: 'submitted'
    });

    // Get the assignment that is linked to this lesson
    const assignment = await Assignment.findOne({ lessonId });

    // Get lesson info to retrieve its title
    const lesson = await Lesson.findById(lessonId);

    return {
        satisfied: !!submission,
        reason: submission ? 'Assignment submitted' : 'Assignment not submitted',
        details: {
            assignmentId: lessonId,
            assignmentTitle: assignment?.title || 'Unknown Assignment',
            lessonTitle: lesson?.title || 'Unknown Lesson',
            submittedAt: submission?.submittedAt || null,
            status: submission?.status || 'not_submitted'
        }
    };
};


const checkFeedbackReceived = async (userId, referenceId) => {
    // Assuming you have a Feedback model
    const feedback = await Feedback.findOne({
        userId,
        referenceId,
        status: 'completed'
    });

    return {
        satisfied: !!feedback,
        reason: feedback ? 'Feedback received' : 'Feedback not received',
        details: {
            referenceId,
            receivedAt: feedback?.createdAt || null
        }
    };
};

/**
 * Determine if content can be unlocked based on condition operator
 */
export const determineUnlockStatus = (conditionResults, operator = 'AND') => {
    if (conditionResults.length === 0) return true;

    if (operator === 'OR') {
        return conditionResults.some(condition => condition.satisfied);
    } else { // AND
        return conditionResults.every(condition => condition.satisfied);
    }
};

/**
 * Bulk check unlock conditions for multiple targets
 * POST /api/drip/bulk-check-unlock
 */
export const bulkCheckUnlockConditions = async (req, res) => {
    try {
        const { userId, targets } = req.body; // targets: [{ targetId, targetType }]

        if (!userId || !targets || !Array.isArray(targets)) {
            return res.status(400).json({
                success: false,
                message: 'userId and targets array are required'
            });
        }

        const results = [];

        for (const target of targets) {
            const result = await checkSingleUnlockCondition(userId, target.targetId, target.targetType);
            results.push({
                targetId: target.targetId,
                targetType: target.targetType,
                ...result
            });
        }

        return res.json({
            success: true,
            results,
            summary: {
                total: results.length,
                unlocked: results.filter(r => r.canUnlock).length,
                locked: results.filter(r => !r.canUnlock).length
            }
        });

    } catch (error) {
        console.error('Error in bulk check:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Helper function for bulk check
const checkSingleUnlockCondition = async (userId, targetId, targetType) => {
    const dripTargets = await DripTarget.find({
        targetId,
        targetType
    }).populate('dripRuleId');

    if (!dripTargets || dripTargets.length === 0) {
        return {
            canUnlock: true,
            message: 'No drip rules found',
            conditionsCount: 0
        };
    }

    const conditionResults = [];

    for (const dripTarget of dripTargets) {
        const conditionResult = await evaluateDripCondition(
            dripTarget.dripRuleId,
            userId,
            targetId,
            targetType
        );
        conditionResults.push(conditionResult);
    }

    const canUnlock = determineUnlockStatus(conditionResults, dripTargets[0].dripRuleId.conditionOperator);

    return {
        canUnlock,
        conditionsCount: conditionResults.length,
        satisfiedCount: conditionResults.filter(c => c.satisfied).length
    };
};