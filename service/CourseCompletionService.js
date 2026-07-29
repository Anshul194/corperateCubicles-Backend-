import cron from 'node-cron';
import Enrollment from '../models/CourseEnrollment.js';
import Course from '../models/Course.js';
import LessonProgress from '../models/LessonProgress.js';
import QuizSubmission from '../models/QuizSubmission.js';
import AssignmentSubmission from '../models/assignmentSubmission.js';
import { trusted } from 'mongoose';

class CourseCompletionService {

  // Mark expired enrollments
  async updateExpiredEnrollments() {
    const now = new Date();
    await Enrollment.updateMany(
      {
        accessExpiry: { $lte: now, $ne: null },
        status: { $ne: 'expired' }
      },
      { $set: { status: 'expired' } }
    ).then(result => {
      console.log(`Marked ${result.modifiedCount} enrollments as expired`);
    });
  }

  // Fetch a course's content totals (video-lessons / quizzes / assignments).
  // When a Map is passed as `cache` (keyed by courseId string), the course tree
  // is fetched at most once per sweep instead of once per enrolled student.
  // Returns null when the course (or its modules) is missing.
  async getCourseContentTotals(courseId, cache = null) {
    const cacheKey = courseId.toString();
    if (cache && cache.has(cacheKey)) {
      return cache.get(cacheKey);
    }

    const course = await Course.findById(courseId).populate({
      path: 'modules',
      populate: { path: 'lessons' }
    });

    let totals = null;
    if (course && course.modules) {
      // Count total content by type
      let totalVideoLessons = 0;
      let totalQuizzes = 0;
      let totalAssignments = 0;

      course.modules.forEach(module => {
        if (module.lessons) {
          module.lessons.forEach(lesson => {
            if (lesson.type === 'video-lesson') totalVideoLessons++;
            if (lesson.type === 'quiz') totalQuizzes++;
            if (lesson.type === 'assignment') totalAssignments++;
          });
        }
      });

      totals = { totalVideoLessons, totalQuizzes, totalAssignments };
    }

    if (cache) {
      cache.set(cacheKey, totals);
    }
    return totals;
  }

  // Simple check: if user completed all video-lessons, quizzes, and assignments.
  // `courseTotalsCache` is an optional Map used by processAllEnrollments so the
  // same course content tree is not re-fetched for every student of that course.
  async checkCourseCompletion(userId, courseId, courseTotalsCache = null) {
    try {
      console.log(`Checking completion for user ${userId} in course ${courseId}`);

      const totals = await this.getCourseContentTotals(courseId, courseTotalsCache);

      if (!totals) {
        console.log(`No course or modules found for ${courseId}`);
        return { isCompleted: true, overallProgress: 100 }; // If no content, consider completed
      }

      const { totalVideoLessons, totalQuizzes, totalAssignments } = totals;

      // Count completed content
      const completedLessons = await LessonProgress.countDocuments({
        userId, courseId, completed: true
      });

      const completedQuizzes = await QuizSubmission.countDocuments({
        user: userId, courseId, is_completed: true, passed: true
      });

      const completedAssignments = await AssignmentSubmission.countDocuments({
        submittedBy: userId, courseId, is_complete: true, status: 'graded'
      });

      console.log(`Course ${courseId} - Total: ${totalVideoLessons} lessons, ${totalQuizzes} quizzes, ${totalAssignments} assignments`);
      console.log(`User ${userId} - Completed: ${completedLessons} lessons, ${completedQuizzes} quizzes, ${completedAssignments} assignments`);

      const totalItems = totalVideoLessons + totalQuizzes + totalAssignments;
      const completedItems = completedLessons + completedQuizzes + completedAssignments;

      let overallProgress = 0;
      if (totalItems > 0) {
        overallProgress = (completedItems / totalItems) * 100;
      } else {
        overallProgress = 100;
      }

      // Cap at 100
      overallProgress = Math.min(overallProgress, 100);
      overallProgress = Math.round(overallProgress * 100) / 100; // Round to 2 decimal places

      // Check if all are completed
      const allCompleted = (completedLessons >= totalVideoLessons) &&
        (completedQuizzes >= totalQuizzes) &&
        (completedAssignments >= totalAssignments);

      return { isCompleted: allCompleted, overallProgress };
    } catch (error) {
      console.error('Error checking course completion:', error);
      return { isCompleted: false, overallProgress: 0 };
    }
  }

  // Process all active enrollments and update completion status
  async processAllEnrollments({ skipExpired = false } = {}) {
    try {
      const BATCH_SIZE = 100;

      let processed = 0;
      let completed = 0;

      // Per-run cache of course content totals (keyed by courseId string) so a
      // course's modules→lessons tree is fetched once per sweep, not once per
      // enrolled student.
      const courseTotalsCache = new Map();

      // Stream enrollments with a bounded cursor so the entire collection is
      // never loaded into memory at once.
      const cursor = Enrollment.find()
        .populate('userId', 'name')
        .populate('courseId', 'title')
        .cursor({ batchSize: BATCH_SIZE });

      // Accumulate per-enrollment writes and flush them in a single bulkWrite
      // instead of issuing one findByIdAndUpdate query per enrollment.
      let pendingWrites = [];
      const flushWrites = async () => {
        if (pendingWrites.length === 0) return;
        const ops = pendingWrites;
        pendingWrites = [];
        await Enrollment.bulkWrite(ops);
      };

      for (let enrollment = await cursor.next(); enrollment != null; enrollment = await cursor.next()) {
        if (skipExpired && enrollment.status == 'expired') {
          // console.log(`Skipping expired enrollment ${enrollment._id}`);
          continue;
        }

        // Skip if userId or courseId is missing (deleted user/course)
        if (!enrollment.userId || !enrollment.courseId) {
          continue;
        }

        console.log(`Processing enrollment ${enrollment._id} for user ${enrollment.userId.name} in course ${enrollment.courseId.title}`);
        try {
          // If skipExpired is true, we respect the canComplete check (which returns false for expired)
          // If skipExpired is false, we ignore canComplete check and process anyway
          if (skipExpired && typeof enrollment.canComplete === 'function' && !enrollment.canComplete()) {
            console.log(`Enrollment ${enrollment._id} is expired, skipping completion check.`);
            continue;
          }

          const { isCompleted, overallProgress } = await this.checkCourseCompletion(
            enrollment.userId._id,
            enrollment.courseId._id,
            courseTotalsCache
          );
          console.log(`Enrollment ${enrollment._id} completion status: ${isCompleted}, progress: ${overallProgress}%`);

          const updateData = {
            progressPercentage: overallProgress,
            iscompleted: isCompleted
          };

          if (isCompleted && !enrollment.iscompleted) {
            updateData.completedAt = new Date();
            completed++;
          }

          if (isCompleted) {
            if (enrollment.iscompleted) completed++;
          }

          pendingWrites.push({
            updateOne: {
              filter: { _id: enrollment._id },
              update: { $set: updateData }
            }
          });

          if (pendingWrites.length >= BATCH_SIZE) {
            await flushWrites();
          }

          processed++;
        } catch (error) {
          console.error(`Error processing enrollment ${enrollment._id}:`, error?.message);
        }
      }

      // Flush any remaining writes from the final partial batch.
      await flushWrites();

      const result = { processed, completed };
      console.log(`Processing complete: ${processed} processed, ${completed}  marked as completed , timestamp: ${new Date().toISOString()}`);
      return result;
    } catch (error) {
      console.error('Error processing enrollments:', error);
      return { processed: 0, completed: 0 };
    }
  }

  // Start cron job - runs every hour.
  // node-cron runs IN-PROCESS: if this app is scaled horizontally, every
  // instance would schedule its own copy of the sweep and run it concurrently,
  // duplicating reads and bulkWrite updates. The job is therefore gated behind
  // RUN_CRON=true — set it on exactly ONE dedicated instance/worker.
  startCronJob() {
    if (process.env.RUN_CRON !== 'true') {
      console.log('Course completion cron disabled (set RUN_CRON=true on exactly one instance to enable).');
      return;
    }

    cron.schedule('0 * * * *', async () => {
      //console.log('🔄 Running automated course completion check...');
      await this.processAllEnrollments();
    });

    //console.log('⏰ Course completion cron job started - runs every hour');
  }
}

export default new CourseCompletionService();
