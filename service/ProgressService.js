import progressRepository from '../repository/ProgressRepository.js';
import CourseEnrollment from '../models/CourseEnrollment.js';

class ProgressService {
  async getLessonProgress(userId, lessonId) {
    try {
      // //console.log(`Getting lesson progress for user ${userId}, lesson ${lessonId}`);

      const progress = await progressRepository.findByUserAndLesson(userId, lessonId);

      if (!progress) {
        return {
          userId,
          lessonId,
          progressPercentage: 0,
          watchTime: 0,
          currentPosition: 0,
          lastPosition: 0,
          completed: false,
          completionPercentage: 0,
          coveredSegments: [],
          totalCovered: 0
        };
      }

      return progress;
    } catch (error) {
      console.error(`Failed to get lesson progress: ${error.message}`);
      throw error;
    }
  }

  async updateLessonProgress(userId, lessonId, courseId, updateData) {
    try {
      console.log(`Updating lesson progress for user ${userId}, lesson ${lessonId}`, updateData);

      // Validate update data
      const validatedData = this.validateProgressData(updateData);
      //console.log(`Validated progress data for user ${userId}, lesson ${lessonId}:`, validatedData);

      const progress = await progressRepository.updateProgress(userId, lessonId, courseId, { ...updateData, ...validatedData });

      // Log significant milestones
      if (progress.progressPercentage >= 25 && progress.progressPercentage < 50) {
        // console.log(`User ${userId} reached 25% progress in lesson ${lessonId}`);
      } else if (progress.progressPercentage >= 50 && progress.progressPercentage < 75) {
        // console.log(`User ${userId} reached 50% progress in lesson ${lessonId}`);
      } else if (progress.progressPercentage >= 75 && progress.progressPercentage < 90) {
        // console.log(`User ${userId} reached 75% progress in lesson ${lessonId}`);
      }

      // console.log(`Lesson progress updated for user ${userId}, lesson ${lessonId}:`, progress);
      return progress;
    } catch (error) {
      console.error(`Failed to update lesson progress: ${error.message}`);
      throw error;
    }
  }

  async completeLessonProgress(userId, lessonId, completionData = {}) {
    try {
      //console.log(`Completing lesson for user ${userId}, lesson ${lessonId}`, completionData);

      const progress = await progressRepository.markCompleted(userId, lessonId, {
        ...completionData,
        completionPercentage: completionData.completionPercentage || 100
      });

      //console.log(`Lesson ${lessonId} completed by user ${userId}`);

      // You might want to trigger additional events here like:
      // - Award certificates
      // - Send notifications
      // - Update course progress
      // - Analytics tracking

      return progress;
    } catch (error) {
      console.error(`Failed to complete lesson: ${error.message}`);
      throw error;
    }
  }

  async getCourseProgress(userId, courseId) {
    try {
      //console.log(`Getting course progress for user ${userId}, course ${courseId}`);

      const progress = await progressRepository.getCourseProgress(userId, courseId);

      // Add additional computed metrics
      const enhancedProgress = {
        ...progress,
        isCompleted: progress.courseCompletionPercentage >= 100,
        estimatedTimeRemaining: this.calculateEstimatedTimeRemaining(progress),
        progressTrend: await this.calculateProgressTrend(userId, courseId)
      };

      return enhancedProgress;
    } catch (error) {
      console.error(`Failed to get course progress: ${error.message}`);
      throw error;
    }
  }

  async getUserProgressOverview(userId, options = {}) {
    try {
      //console.log(`Getting progress overview for user ${userId}`);

      const [userProgress, stats, recentProgress] = await Promise.all([
        progressRepository.getUserProgress(userId, options),
        progressRepository.getProgressStats(userId),
        progressRepository.getRecentProgress(userId, 5)
      ]);

      return {
        ...userProgress,
        stats,
        recentProgress
      };
    } catch (error) {
      console.error(`Failed to get user progress overview: ${error.message}`);
      throw error;
    }
  }

  async initializeLessonProgress(userId, courseId, lessonId, sessionId, metadata = {}) {
    try {
      //console.log(`Initializing lesson progress for user ${userId}, lesson ${lessonId}`);

      const progressData = {
        userId,
        courseId,
        lessonId,
        sessionId,
        progressPercentage: 0,
        watchTime: 0,
        currentPosition: 0,
        lastPosition: 0,
        completed: false,
        completionPercentage: 0,
        coveredSegments: [],
        totalCovered: 0,
        videoType: metadata.videoType || 'direct',
        videoDuration: metadata.videoDuration || 0,
        metadata: {
          userAgent: metadata.userAgent,
          screenResolution: metadata.screenResolution,
          timezone: metadata.timezone,
          platform: metadata.platform
        }
      };

      const courseupdate = await CourseEnrollment.findOneAndUpdate(
        { userId, courseId },
        { lastVideoPlayed: lessonId },
        { new: true }
      );

      //console.log(`last play video updated for user ${userId}, course ${courseId}`, courseupdate); 

      return await progressRepository.createProgress(progressData);
    } catch (error) {
      console.error(`Failed to initialize lesson progress: ${error.message}`);
      throw error;
    }
  }

  async resetLessonProgress(userId, courseId, lessonId) {
    try {
      //console.log(`Resetting lesson progress for user ${userId}, lesson ${lessonId}`);

      const resetData = {
        progressPercentage: 0,
        watchTime: 0,
        currentPosition: 0,
        lastPosition: 0,
        completed: false,
        completionPercentage: 0,
        coveredSegments: [],
        totalCovered: 0,
        lastUpdatedAt: new Date()
      };

      return await progressRepository.updateProgress(userId, lessonId, courseId, resetData);
    } catch (error) {
      console.error(`Failed to reset lesson progress: ${error.message}`);
      throw error;
    }
  }

  // Helper methods
  validateProgressData(data) {
    const validated = {};

    if (data.progressPercentage !== undefined) {
      validated.progressPercentage = Math.max(0, Math.min(100, data.progressPercentage));
    }

    if (data.watchTime !== undefined) {
      validated.watchTime = Math.max(0, data.watchTime);
    }

    if (data.currentPosition !== undefined) {
      validated.currentPosition = Math.max(0, data.currentPosition);
    }

    if (data.lastPosition !== undefined) {
      validated.lastPosition = Math.max(0, data.lastPosition);
    }

    if (data.coveredSegments !== undefined) {
      validated.coveredSegments = data.coveredSegments.filter(segment =>
        segment.start >= 0 && segment.end > segment.start
      );
    }

    if (data.sessionId !== undefined) {
      validated.sessionId = data.sessionId;
    }

    return validated;
  }

  calculateEstimatedTimeRemaining(progress) {
    if (progress.totalWatchTime === 0 || progress.averageProgress === 0) {
      return null;
    }

    const estimatedTotalTime = (progress.totalWatchTime / progress.averageProgress) * 100;
    return Math.max(0, estimatedTotalTime - progress.totalWatchTime);
  }

  async calculateProgressTrend(userId, courseId) {
    try {
      // Get progress data from last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const recentProgress = await progressRepository.getUserProgress(userId, {
        courseId,
        updatedAfter: sevenDaysAgo
      });

      if (recentProgress.progress.length < 2) {
        return 'insufficient_data';
      }

      // Calculate trend based on progress changes
      const progressChanges = recentProgress.progress.map(p => p.progressPercentage);
      const isIncreasing = progressChanges[0] < progressChanges[progressChanges.length - 1];

      return isIncreasing ? 'improving' : 'stable';
    } catch (error) {
      console.error(`Failed to calculate progress trend: ${error.message}`);
      return 'unknown';
    }
  }
}

export default new ProgressService();