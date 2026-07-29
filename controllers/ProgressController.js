import axios from 'axios';
import progressService from '../service/ProgressService.js';
import Module from '../models/Module.js';
import Lesson from '../models/Lesson.js';
import LessonProgress from '../models/LessonProgress.js';
import DripTarget from '../models/DripTarget.js';
import DripRule from '../models/DripRule.js';
import User from '../models/user.js';
import Course from '../models/Course.js';
import CourseService from "../service/CourseService.js";
import { evaluateDripCondition, determineUnlockStatus, evaluateUnlockConditions } from './unlockConditionChecker.js';
import mongoose from 'mongoose';

const courseService = new CourseService();

const getVdoCipherOTPModern = async (videoId) => {
  try {
    const apiKey = process.env.VDOCIPHER_API_KEY;
    if (!apiKey) {
      throw new Error('VDOCIPHER_API_KEY environment variable is not set');
    }

    const response = await axios.post(
      `https://dev.vdocipher.com/api/videos/${videoId}/otp`,
      {
        ttl: 300,
        annotate: JSON.stringify([]),
      },
      {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Apisecret ${apiKey}`,
        },
      }
    );

    return response.data;
  } catch (error) {
    throw error;
  }
};

// GET lesson progress
export const getLessonProgress = async (req, res) => {
  try {
    const { courseId, lessonId } = req.params;
    const userId = req.user.id;

    const progress = await progressService.getLessonProgress(userId, lessonId);

    res.status(200).json({ success: true, data: progress });
  } catch (error) {
    console.error(`Get lesson progress error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to get lesson progress',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// PUT update progress
export const updateLessonProgress = async (req, res) => {
  try {
    const { courseId, lessonId } = req.params;
    const userId = req.user.id;
    const updateData = req.body;


    //console.log(`Updating progress for user ${userId}, lesson ${lessonId}`, updateData);

    const progress = await progressService.updateLessonProgress(userId, lessonId, courseId, updateData);

    res.status(200).json({
      success: true,
      message: 'Progress updated successfully',
      data: progress
    });
  } catch (error) {
    console.error(`Update lesson progress error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to update lesson progress',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};


export const updateLessonProgressDirect = async (userId, lessonId, courseId, updateData) => {
  try {
    //console.log(`Direct update progress for user ${userId}, lesson ${lessonId}`, updateData);

    const progress = await progressService.updateLessonProgress(userId, lessonId, courseId, updateData);
    return progress;
  } catch (error) {
    console.error(`Direct update lesson progress error: ${error.message}`);
    throw error;
  }
};


// POST mark as complete
export const completeLessonProgress = async (req, res) => {
  try {
    const { courseId, lessonId } = req.params;
    const userId = req.user.id;
    const completionData = req.body;

    const progress = await progressService.completeLessonProgress(userId, lessonId, completionData);

    res.status(200).json({
      success: true,
      message: 'Lesson completed successfully',
      data: progress
    });
  } catch (error) {
    console.error(`Complete lesson error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to complete lesson',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// GET course progress summary
export const getCourseProgress = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;

    //console.log(`Fetching course progress for user ${userId}, course ${courseId}`);


    const progress = await progressService.getCourseProgress(userId, courseId);

    res.status(200).json({ success: true, data: progress });
  } catch (error) {
    console.error(`Get course progress error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to get course progress',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// GET overall progress overview
export const getUserProgressOverview = async (req, res) => {
  try {
    const userId = req.user.id;
    const options = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
      courseId: req.query.courseId,
      completed: req.query.completed !== undefined ? req.query.completed === 'true' : undefined
    };

    const overview = await progressService.getUserProgressOverview(userId, options);

    res.status(200).json({ success: true, data: overview });
  } catch (error) {
    console.error(`Get user progress overview error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to get progress overview',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// POST initialize lesson progress
export const initializeLessonProgress = async (req, res) => {
  try {
    const { courseId, lessonId } = req.params;
    const userId = req.user.id;
    const { sessionId, metadata } = req.body;

    const progress = await progressService.initializeLessonProgress(
      userId,
      courseId,
      lessonId,
      sessionId,
      metadata
    );

    res.status(201).json({
      success: true,
      message: 'Lesson progress initialized successfully',
      data: progress
    });
  } catch (error) {
    //console.log(`Initialize lesson progress error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to initialize lesson progress',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// DELETE reset lesson progress
export const resetLessonProgress = async (req, res) => {
  try {
    const { courseId, lessonId } = req.params;
    const userId = req.user.id;

    const progress = await progressService.resetLessonProgress(userId, courseId, lessonId);

    res.status(200).json({
      success: true,
      message: 'Lesson progress reset successfully',
      data: progress
    });
  } catch (error) {
    console.error(`Reset lesson progress error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to reset lesson progress',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// GET course lessons status (locked/unlocked and progress)
export const getCourseLessonsStatus = async (req, res) => {
  try {
    const { courseId, userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(courseId) || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid courseId or userId' });
    }

    // Ownership/role guard: a user may only read their own progress unless they
    // are an admin/instructor. Prevents read-only IDOR via the :userId param.
    const requesterId = (req.user._id || req.user.id).toString();
    if (String(userId) !== requesterId && !['admin', 'instructor'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    // 1. Fetch full course data using courseService
    const course = await courseService.getById(courseId);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    // 2. Process VdoCipher videos (Identical to getCourseById)
    if (course.modules) {
      let vdoCipherVideos = 0;
      let successfulOTPs = 0;
      let failedOTPs = 0;
      let totalVideoLessons = 0;
      let platformBreakdown = {};
      let vdoCipherVideoIds = [];
      const vdoCipherVideoLessons = [];

      const isVdoCipherPlatform = (platform) => {
        if (!platform) return false;
        const normalizedPlatform = platform.toLowerCase();
        return normalizedPlatform === 'vdocipher' ||
          normalizedPlatform === 'videocypher' ||
          normalizedPlatform === 'vdocypher';
      };

      for (const module of course.modules) {
        if (module.lessons && module.isPublished) {
          for (const lesson of module.lessons) {
            if (lesson.videoLessons) {
              for (const videoLesson of lesson.videoLessons) {
                totalVideoLessons++;
                const platform = videoLesson.sourcePlatform || 'unknown';
                platformBreakdown[platform] = (platformBreakdown[platform] || 0) + 1;
                if (isVdoCipherPlatform(videoLesson.sourcePlatform) && videoLesson.videoId && videoLesson.videoId.trim() !== '') {
                  vdoCipherVideos++;
                  vdoCipherVideoIds.push({
                    videoId: videoLesson.videoId,
                    title: videoLesson.title,
                    moduleTitle: module.title,
                    lessonTitle: lesson.title,
                    originalPlatform: videoLesson.sourcePlatform
                  });
                  vdoCipherVideoLessons.push(videoLesson);
                }
              }
            }
          }
        }
      }

      if (vdoCipherVideos > 0) {
        // Add timeout to prevent hanging on slow VdoCipher API calls
        const vdoCipherTimeout = 5000; // 5 seconds per video
        await Promise.all(
          vdoCipherVideoLessons.map(async (videoLesson) => {
            try {
              const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('VdoCipher API timeout')), vdoCipherTimeout)
              );
              const vdoCipherData = await Promise.race([
                getVdoCipherOTPModern(videoLesson.videoId),
                timeoutPromise
              ]);
              videoLesson.vdoCipherPlayback = {
                otp: vdoCipherData.otp,
                playbackInfo: vdoCipherData.playbackInfo,
                ttl: vdoCipherData.ttl || 300,
                fetchedAt: new Date().toISOString()
              };
              successfulOTPs++;
            } catch (error) {
              videoLesson.vdoCipherPlayback = {
                error: 'Failed to fetch playback info',
                errorMessage: error.message,
                errorDetails: error.response?.data || null,
                fetchedAt: new Date().toISOString()
              };
              failedOTPs++;
            }
          })
        );
      }

      course.videoProcessingInfo = {
        totalVideoLessons,
        totalVdoCipherVideos: vdoCipherVideos,
        successfulOTPs,
        failedOTPs,
        platformBreakdown,
        vdoCipherVideoIds,
        processedAt: new Date().toISOString()
      };
    }

    // 3. Filter enrolledStudents (Identical to getCourseById)
    const CourseEnrollment = (await import("../models/CourseEnrollment.js")).default;
    const activeEnrollments = await CourseEnrollment.find({
      courseId: course._id,
      status: 'active'
    }).select('userId').lean();
    course.enrolledStudents = activeEnrollments.map(e => e.userId?.toString());

    // 4. Fetch user progress
    const progressRecords = await LessonProgress.find({ userId, courseId });
    const progressMap = progressRecords.reduce((acc, p) => {
      acc[p.lessonId.toString()] = p;
      return acc;
    }, {});

    // 5. Fetch drip rules
    const targetIds = [];
    if (course.modules) {
      course.modules.forEach(m => {
        targetIds.push(m._id);
        if (m.lessons) {
          m.lessons.forEach(l => targetIds.push(l._id));
        }
      });
    }

    const dripTargets = await DripTarget.find({ targetId: { $in: targetIds } }).populate('dripRuleId');
    const dripMap = dripTargets.reduce((acc, dt) => {
      if (!acc[dt.targetId.toString()]) acc[dt.targetId.toString()] = [];
      acc[dt.targetId.toString()].push(dt);
      return acc;
    }, {});



    // 6. Inject lock status and progress into course structure
    // Process modules in batches to prevent timeout
    if (course.modules) {
      const BATCH_SIZE = 5; // Process 5 modules at a time
      for (let i = 0; i < course.modules.length; i += BATCH_SIZE) {
        const moduleBatch = course.modules.slice(i, i + BATCH_SIZE);
        await Promise.all(
          moduleBatch.map(async (module) => {
            try {
              // Evaluate module unlock
              const moduleDripTargets = dripMap[module._id.toString()] || [];

              // Pre-compute the in-memory "drip disabled for this user" flag once per
              // module (reused for the module itself and every one of its lessons).
              // When drip is disabled, evaluateUnlockConditions' result is unconditionally
              // overwritten below, so we skip the call entirely to avoid its per-module/
              // per-lesson DB query storm (Module/Lesson.findById, DripTarget.find, and
              // every per-rule UserProgress lookup) on this path.
              const moduleDripDisabledForUser = Array.isArray(module.dripSettingDisabledFor) &&
                module.dripSettingDisabledFor.some(id => id.toString() === userId.toString());

              let moduleEvaluation;
              try {
                if (moduleDripDisabledForUser) {
                  moduleEvaluation = {
                    success: true,
                    canUnlock: true,
                    message: 'Drip is disabled for this user on this module',
                    satisfiedConditions: [],
                    failedConditions: [],
                    totalConditions: 0
                  };
                } else {
                  moduleEvaluation = await evaluateUnlockConditions(userId, module._id, 'module', moduleDripTargets.length > 0 ? moduleDripTargets : null);
                }
              } catch (err) {
                console.error(`Error evaluating module ${module._id}:`, err);
                moduleEvaluation = { canUnlock: true, success: false, error: err.message };
              }

              module.isLocked = !moduleEvaluation.canUnlock;
              module.dripEvaluation = moduleEvaluation; // Inject full evaluation

              if (module.lessons) {
                // Process lessons in parallel
                await Promise.all(
                  module.lessons.map(async (lesson) => {
                    try {
                      // Use the new shared evaluation logic
                      // We pass the module to check for disabled drip settings, but evaluateUnlockConditions 
                      // expects checking DB for module if we don't pass specific structure. 
                      // However, evaluateUnlockConditions handles the "drip disabled" check internally 
                      // if we let it fetch, or we can check here.
                      // Optimization: To avoid N+1 DB calls inside evaluateUnlockConditions for extracting module drip settings, 
                      // we should ideally pass context. But the current refactor doesn't fully support passing module context 
                      // into evaluateUnlockConditions easily without changing its signature significantly for the "drip disabled" check.
                      // For now, we will use the existing patterns but call the new function.
                      // Note: We need to pass the pre-fetched dripTargets to avoid DB calls if possible, 
                      // but evaluateUnlockConditions accepts them as 4th arg.

                      // Get drip targets for this lesson from our map
                      const lessonDripTargets = dripMap[lesson._id.toString()] || [];

                      let lessonEvaluation;
                      try {
                        // Parent module has drip disabled for this user (computed in-memory
                        // above): evaluateUnlockConditions' result would be overwritten, so
                        // skip the call and its per-lesson DB query storm entirely.
                        if (moduleDripDisabledForUser) {
                          lessonEvaluation = {
                            success: true,
                            canUnlock: true,
                            message: 'Drip is disabled for this user on the parent module',
                            satisfiedConditions: [],
                            failedConditions: [],
                            totalConditions: 0
                          };
                        } else {
                          // We pass the pre-fetched targets to avoid DB lookups
                          lessonEvaluation = await evaluateUnlockConditions(userId, lesson._id, 'lesson', lessonDripTargets.length > 0 ? lessonDripTargets : null);
                        }
                      } catch (err) {
                        console.error(`Error evaluating lesson ${lesson._id}:`, err);
                        lessonEvaluation = { canUnlock: true, success: false, error: err.message };
                      }

                      const progress = progressMap[lesson._id.toString()];

                      lesson.isLocked = module.isLocked || !lessonEvaluation.canUnlock;
                      lesson.dripEvaluation = lessonEvaluation; // Inject full evaluation

                      lesson.progress = progress ? {
                        _id: progress._id,
                        courseId: progress.courseId, // This might be an ID, if populated we need to check. usually ObjectId in model.
                        lessonId: progress.lessonId,
                        userId: progress.userId,
                        sessionId: progress.sessionId,

                        completed: progress.completed,
                        completedAt: progress.completedAt,
                        completionPercentage: progress.completionPercentage,

                        progressPercentage: progress.progressPercentage,
                        watchTime: progress.watchTime,
                        currentPosition: progress.currentPosition,
                        lastPosition: progress.lastPosition,
                        lastUpdatedAt: progress.lastUpdatedAt,

                        coveredSegments: progress.coveredSegments,
                        totalCovered: progress.totalCovered,
                        videoDuration: progress.videoDuration,
                        videoType: progress.videoType,

                        startedAt: progress.startedAt,
                        updatedAt: progress.updatedAt,
                        createdAt: progress.createdAt
                      } : {
                        completed: false,
                        progressPercentage: 0,
                        watchTime: 0,
                        currentPosition: 0,
                        lastPosition: 0,
                        completionPercentage: 0
                      };
                    } catch (lessonError) {
                      console.error(`Error processing lesson ${lesson._id}:`, lessonError.message);
                      // Set default values on error
                      lesson.isLocked = module.isLocked || false;
                      lesson.progress = {
                        progressPercentage: 0,
                        completed: false
                      };
                    }
                  })
                );
              }
            } catch (moduleError) {
              console.error(`Error processing module ${module._id}:`, moduleError.message);
              // Set default values on error
              module.isLocked = false;
              if (module.lessons) {
                module.lessons.forEach(lesson => {
                  lesson.isLocked = false;
                  lesson.progress = {
                    progressPercentage: 0,
                    completed: false
                  };
                });
              }
            }
          })
        );
      }
    }

    // 7. Strip HTML from description if requested (original text)
    if (course.description) {
      course.description = course.description.replace(/<[^>]*>?/gm, '').trim();
    }

    // 8. Return standardized response
    res.status(200).json({
      success: true,
      message: "✅ Course retrieved successfully with status and progress",
      data: { course },
      err: {},
    });

  } catch (error) {
    console.error(`Get course lessons status error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to get course lessons status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
