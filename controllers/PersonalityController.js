// Check if user has already submitted the personality test
export const hasSubmittedPersonalityTest = async (req, res) => {
    try {
        if (!req.user || !req.user._id) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized"
            });
        }
        const existingSubmission = await PersonalitySubmission.findOne({ userId: req.user._id });
        if (existingSubmission) {
            return res.status(200).json({
                success: true,
                hasSubmitted: true
            });
        } else {
            return res.status(200).json({
                success: true,
                hasSubmitted: false
            });
        }
    } catch (err) {
        console.error("Check Submission Error:", err);
        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};
import PersonalityQuestion from '../models/PersonalityQuestion.js';
import Course from '../models/Course.js';
import PersonalitySubmission from '../models/PersonalitySubmission.js';
import { personalityTypes } from '../constants/personalityData.js';

const normalizeDimension = (dim) => {
    if (!dim) return 'IE';
    const d = dim.toUpperCase();
    const map = {
        'EI': 'IE',
        'NS': 'SN',
        'FT': 'TF',
        'PJ': 'JP'
    };
    return map[d] || d;
};

// Helper function to strip HTML tags from text
const stripHtml = (html) => {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, '').trim();
};

// Helper function to convert string answer to numeric value (1-7 scale)
const convertAnswerToNumeric = (answer) => {
    if (!answer) return 4; // default to neutral
    const normalized = answer.toString().trim().toLowerCase();
    const mapping = {
        'strongly_disagree': 1,
        'disagree': 2,
        'slightly_disagree': 3,
        'neutral': 4,
        'slightly_agree': 5,
        'agree': 6,
        'strongly_agree': 7
    };
    return mapping[normalized] || 4; // default to neutral if unknown
};

export const createQuestion = async (req, res) => {
    try {
        const { questions } = req.body;
        // Support bulk creation if an array is passed, or single creation
        const dataToInsert = (Array.isArray(questions) ? questions : [req.body]).map(q => ({
            ...q,
            dimension: normalizeDimension(q.dimension)
        }));

        const newQuestions = await PersonalityQuestion.insertMany(dataToInsert);

        return res.status(201).json({
            success: true,
            message: "Questions created successfully",
            data: newQuestions
        });
    } catch (err) {
        console.error("Create Question Error:", err);
        return res.status(500).json({
            success: false,
            message: err.message,
            err: err.message
        });
    }
};

export const getQuestions = async (req, res) => {
    try {
        const questions = await PersonalityQuestion.find({}).sort({ createdAt: 1 });
        return res.status(200).json({
            success: true,
            data: questions
        });
    } catch (err) {
        console.error(" Get Questions Error:", err);
        return res.status(500).json({
            success: false,
            message: err.message,
            err: err.message
        });
    }
};

export const submitTest = async (req, res) => {
    try {
        const { answers } = req.body;
        // Expecting answers to be an array of objects: { questionId: "...", answer: "Agree" | "Disagree" }

        if (!answers || !Array.isArray(answers) || answers.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Answers are required",
            });
        }

        // Fetch all questions to validate and calculate
        const questions = await PersonalityQuestion.find({});
        const questionMap = new Map(questions.map(q => [q._id.toString(), q]));

        // Initialize counts
        let counts = {
            I: 0, E: 0,
            S: 0, N: 0,
            T: 0, F: 0,
            J: 0, P: 0
        };

        let processedAnswers = 0;

        answers.forEach(ans => {
            if (!ans.questionId) return;

            const question = questionMap.get(ans.questionId);
            if (question) {
                processedAnswers++;
                const answerRaw = ans.answer?.toString().trim();
                const answer = answerRaw?.toLowerCase();
                const weight = question.weight || 1;

                // Normalize dimension keys to uppercase to match 'counts' object keys
                const agreeKey = question.agreeType?.toString().trim().toUpperCase();
                const disagreeKey = question.disagreeType?.toString().trim().toUpperCase();

                // Convert numeric answer (1-7) to agree/disagree scale
                // Check numeric value BEFORE lowercasing (to preserve numeric strings)
                let numericValue = null;
                if (answerRaw && !isNaN(answerRaw) && !isNaN(parseFloat(answerRaw))) {
                    numericValue = parseInt(answerRaw);
                }

                // Debug logging for first few answers
                if (processedAnswers <= 3) {
                    console.log('Processing answer:', {
                        questionId: ans.questionId,
                        answerRaw,
                        numericValue,
                        agreeKey,
                        disagreeKey,
                        dimension: question.dimension,
                        hasAgreeKey: !!agreeKey,
                        hasDisagreeKey: !!disagreeKey
                    });
                }

                // Validate that we have the required keys
                if (!agreeKey || !disagreeKey) {
                    console.warn(`Question ${ans.questionId} missing agreeType or disagreeType:`, {
                        agreeType: question.agreeType,
                        disagreeType: question.disagreeType
                    });
                    return; // Skip this question
                }

                // Handle numeric answers (1-7 scale)
                if (numericValue !== null && numericValue >= 1 && numericValue <= 7) {
                    if (numericValue >= 6 && agreeKey) {
                        // 6-7: Agree/Strongly Agree
                        const multiplier = numericValue === 7 ? 2 : 1;
                        const oldCount = counts[agreeKey] || 0;
                        counts[agreeKey] = oldCount + (weight * multiplier);
                        if (processedAnswers <= 3) {
                            console.log(`  -> Incremented ${agreeKey}: ${oldCount} + ${weight * multiplier} = ${counts[agreeKey]}`);
                        }
                    } else if (numericValue <= 2 && disagreeKey) {
                        // 1-2: Disagree/Strongly Disagree
                        const multiplier = numericValue === 1 ? 2 : 1;
                        const oldCount = counts[disagreeKey] || 0;
                        counts[disagreeKey] = oldCount + (weight * multiplier);
                        if (processedAnswers <= 3) {
                            console.log(`  -> Incremented ${disagreeKey}: ${oldCount} + ${weight * multiplier} = ${counts[disagreeKey]}`);
                        }
                    } else if (numericValue === 3 && disagreeKey) {
                        // 3: Slightly Disagree
                        const oldCount = counts[disagreeKey] || 0;
                        counts[disagreeKey] = oldCount + (weight * 0.5);
                        if (processedAnswers <= 3) {
                            console.log(`  -> Incremented ${disagreeKey}: ${oldCount} + ${weight * 0.5} = ${counts[disagreeKey]}`);
                        }
                    } else if (numericValue === 5 && agreeKey) {
                        // 5: Slightly Agree
                        const oldCount = counts[agreeKey] || 0;
                        counts[agreeKey] = oldCount + (weight * 0.5);
                        if (processedAnswers <= 3) {
                            console.log(`  -> Incremented ${agreeKey}: ${oldCount} + ${weight * 0.5} = ${counts[agreeKey]}`);
                        }
                    } else {
                        // 4: Neutral - does nothing
                        if (processedAnswers <= 3) {
                            console.log(`  -> Neutral answer (${numericValue}), no change`);
                        }
                    }
                } else {
                    // Handle string-based answers (backward compatibility)
                    if (answer === 'strongly_agree' && agreeKey) {
                        counts[agreeKey] = (counts[agreeKey] || 0) + (weight * 2);
                    } else if (answer === 'agree' && agreeKey) {
                        counts[agreeKey] = (counts[agreeKey] || 0) + weight;
                    } else if (answer === 'strongly_disagree' && disagreeKey) {
                        counts[disagreeKey] = (counts[disagreeKey] || 0) + (weight * 2);
                    } else if (answer === 'disagree' && disagreeKey) {
                        counts[disagreeKey] = (counts[disagreeKey] || 0) + weight;
                    } else {
                        console.warn(`Unrecognized answer format: ${answerRaw} (numeric: ${numericValue})`);
                    }
                    // neutral does nothing
                }
            } else {
                console.warn(`Question ID not found: ${ans.questionId}`);
            }
        });

        if (processedAnswers === 0) {
            return res.status(400).json({
                success: false,
                message: "No valid answers processed. Please check your question IDs.",
                data: {
                    personalityType: null,
                    stats: null,
                    suitableCourses: []
                }
            });
        }

        // Debug: Log counts before calculating ratios
        console.log('Personality test counts:', counts);
        console.log('Processed answers:', processedAnswers);

        // Calculate Ratios as percentages (0-100) instead of decimals (0-1)
        const calcRatio = (val1, val2) => {
            const total = val1 + val2;
            if (total === 0) return 0;
            return Math.round((val1 / total) * 100); // Return as percentage (0-100)
        };

        const stats = {
            introversionRatio: calcRatio(counts.I, counts.E),
            extroversionRatio: calcRatio(counts.E, counts.I),
            sensingRatio: calcRatio(counts.S, counts.N),
            intuitionRatio: calcRatio(counts.N, counts.S),
            thinkingRatio: calcRatio(counts.T, counts.F),
            feelingRatio: calcRatio(counts.F, counts.T),
            judgingRatio: calcRatio(counts.J, counts.P),
            perceivingRatio: calcRatio(counts.P, counts.J)
        };

        // Determine Type
        let personalityType = "";
        personalityType += stats.introversionRatio > stats.extroversionRatio ? "I" : "E";
        personalityType += stats.sensingRatio > stats.intuitionRatio ? "S" : "N";
        personalityType += stats.thinkingRatio > stats.feelingRatio ? "T" : "F";
        personalityType += stats.judgingRatio > stats.perceivingRatio ? "J" : "P";

        // Get personality type data (overview, strengths, weaknesses)
        const typeData = personalityTypes[personalityType] || {};

        // Find suitable courses
        const suitableCourses = await Course.find({
            suitablePersonalityTypes: personalityType,
            isPublished: true,
            isDeleted: false
        }).limit(6)
            .select('title slug thumbnail description suitablePersonalityTypes difficulty categoryId')
            .populate('categoryId', 'name');

        // Strip HTML from course descriptions
        const cleanedCourses = suitableCourses.map(course => ({
            ...course.toObject(),
            description: stripHtml(course.description)
        }));

        // Save result if user is authenticated and hasn't submitted before
        if (req.user && req.user._id) {
            try {
                const existingSubmission = await PersonalitySubmission.findOne({ userId: req.user._id });
                if (existingSubmission) {
                    return res.status(400).json({
                        success: false,
                        message: "You have already submitted the personality test.",
                        data: null
                    });
                }
                const submission = await PersonalitySubmission.create({
                    userId: req.user._id,
                    answers: answers.map(ans => ({
                        questionId: ans.questionId,
                        value: convertAnswerToNumeric(ans.answer)
                    })),
                    resultType: personalityType,
                    scores: {
                        IE: stats.introversionRatio,
                        SN: stats.sensingRatio,
                        TF: stats.thinkingRatio,
                        JP: stats.judgingRatio
                    }
                });
                console.log(" Personality submission saved successfully:", submission._id);
            } catch (saveError) {
                console.error(" Error saving personality submission:", saveError);
                console.error(" Error details:", {
                    message: saveError.message,
                    stack: saveError.stack,
                    userId: req.user._id,
                    resultType: personalityType
                });
                // We don't want to fail the whole request just because saving failed
            }
        } else {
            console.warn(" User not authenticated, skipping save");
        }

        return res.status(200).json({
            success: true,
            message: " Test calculated successfully",
            data: {
                personalityType,
                stats,
                overview: typeData.overview || "",
                strengths: {
                    strengths: typeData.strengths || [],
                    weaknesses: typeData.weaknesses || []
                },
                career: typeData.sections?.suitableCareerPaths || {
                    environment: "",
                    careers: []
                },
                suitableCourses: cleanedCourses
            }
        });

    } catch (err) {
        console.error(" Submit Test Error:", err);
        return res.status(500).json({
            success: false,
            message: err.message,
            err: err.message
        });
    }
};

export const updateQuestion = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = { ...req.body };

        if (updateData.dimension) {
            updateData.dimension = normalizeDimension(updateData.dimension);
        }

        const updatedQuestion = await PersonalityQuestion.findByIdAndUpdate(
            id,
            { $set: updateData },
            { new: true, runValidators: true }
        );

        if (!updatedQuestion) {
            return res.status(404).json({
                success: false,
                message: "Question not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: " Question updated successfully",
            data: updatedQuestion
        });
    } catch (err) {
        console.error("Update Question Error:", err);
        return res.status(500).json({
            success: false,
            message: err.message,
            err: err.message
        });
    }
};

export const deleteQuestion = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedQuestion = await PersonalityQuestion.findByIdAndDelete(id);

        if (!deletedQuestion) {
            return res.status(404).json({
                success: false,
                message: "Question not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: " Question deleted successfully"
        });
    } catch (err) {
        console.error(" Delete Question Error:", err);
        return res.status(500).json({
            success: false,
            message: err.message,
            err: err.message
        });
    }
};

export const getMyResults = async (req, res) => {
    try {
        if (!req.user || !req.user._id) {
            console.warn(" Get My Results: User not authenticated");
            return res.status(401).json({
                success: false,
                message: "User not authenticated"
            });
        }

        const userId = req.user._id;
        console.log(" Searching for submissions with userId:", userId);

        // Get all submissions
        const submissions = await PersonalitySubmission.find({
            userId: userId
        })
            .sort({ createdAt: -1 })
            .limit(10);

        console.log(` Found ${submissions.length} submissions for user ${userId}`);

        // Transform each submission to match submitTest response format
        const results = await Promise.all(submissions.map(async (submission) => {
            const personalityType = submission.resultType;
            const scores = submission.scores;

            // Reconstruct stats from scores
            // Note: scores are already stored as percentages (0-100) in database
            const ieScore = scores.IE || 0;
            const snScore = scores.SN || 0;
            const tfScore = scores.TF || 0;
            const jpScore = scores.JP || 0;

            const stats = {
                introversionRatio: ieScore,
                extroversionRatio: 100 - ieScore,
                sensingRatio: snScore,
                intuitionRatio: 100 - snScore,
                thinkingRatio: tfScore,
                feelingRatio: 100 - tfScore,
                judgingRatio: jpScore,
                perceivingRatio: 100 - jpScore
            };

            // Get personality type data (overview, strengths, weaknesses, career paths)
            const typeData = personalityTypes[personalityType] || {};

            // Find suitable courses for this personality type
            const suitableCourses = await Course.find({
                suitablePersonalityTypes: personalityType,
                isPublished: true,
                isDeleted: false
            }).limit(6)
                .select('title slug thumbnail description suitablePersonalityTypes difficulty categoryId')
                .populate('categoryId', 'name');

            // Strip HTML from course descriptions
            const cleanedCourses = suitableCourses.map(course => ({
                ...course.toObject(),
                description: stripHtml(course.description)
            }));

            return {
                personalityType,
                stats,
                overview: typeData.overview || "",
                strengths: {
                    strengths: typeData.strengths || [],
                    weaknesses: typeData.weaknesses || []
                },
                career: typeData.sections?.suitableCareerPaths || {
                    environment: "",
                    careers: []
                },
                suitableCourses: cleanedCourses,
                submittedAt: submission.createdAt
            };
        }));

        return res.status(200).json({
            success: true,
            data: results
        });
    } catch (err) {
        console.error(" Get My Results Error:", err);
        console.error(" Error details:", {
            message: err.message,
            stack: err.stack,
            userId: req.user?._id
        });
        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

export const updateCourseMapping = async (req, res) => {
    try {
        const { personalityType, courseIds } = req.body;
        if (!personalityType) {
            return res.status(400).json({ success: false, message: "Personality type is required" });
        }

        // 1. Remove this personality type from all courses
        await Course.updateMany(
            { suitablePersonalityTypes: personalityType },
            { $pull: { suitablePersonalityTypes: personalityType } }
        );

        // 2. Add this personality type to selected courses
        if (courseIds && courseIds.length > 0) {
            await Course.updateMany(
                { _id: { $in: courseIds } },
                { $addToSet: { suitablePersonalityTypes: personalityType } }
            );
        }

        return res.status(200).json({
            success: true,
            message: `Course mapping updated for ${personalityType}`
        });
    } catch (error) {
        console.error("Error updating course mapping:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};
