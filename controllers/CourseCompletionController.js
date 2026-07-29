import courseCompletionService from '../service/CourseCompletionService.js';
import mongoose from 'mongoose';
import CourseEnrollment from '../models/CourseEnrollment.js';
import VideoLesson from '../models/video.js';
import Lesson from '../models/Lesson.js';

class CourseCompletionController {

  // Simple API to check and update all course completions
  async checkAllCourseCompletions(req, res) {
    try {
      // //console.log('🚀 Starting course completion check for all users...');

      // Update expired enrollments before processing completions
      await courseCompletionService.updateExpiredEnrollments();

      const result = await courseCompletionService.processAllEnrollments({
        skipExpired: false
      });

      res.status(200).json({
        success: true,
        message: 'Course completion check completed',
        data: {
          totalProcessed: result.processed,
          totalCompleted: result.completed,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('❌ Error in course completion check:', error);
      res.status(500).json({
        success: false,
        message: 'Error processing course completions',
        error: error.message
      });
    }
  }

  async updateLastVideoPlayed(req, res) {
    try {
      const { courseId, videoLessonId } = req.body;
      const userId = req.user._id; // Extract userId from JWT token

      //console.log("Update Last Video Played Request:", { userId, courseId, videoLessonId });

      // Validate required fields
      if (!courseId || !videoLessonId) {
        return res.status(400).json({ message: "Course ID and Video Lesson ID are required" });
      }

      // Validate ObjectIds
      if (!mongoose.isValidObjectId(courseId) || !mongoose.isValidObjectId(videoLessonId)) {
        return res.status(400).json({ message: "Invalid Course ID or Video Lesson ID" });
      }

      // Find the course enrollment
      const enrollment = await CourseEnrollment.findOne({
        userId,
        courseId,
        status: "active",
      });

      if (!enrollment) {
        return res.status(404).json({ message: "Enrollment not found or not active" });
      }

      // Verify if the video lesson exists and is not deleted
      const videoLesson = await VideoLesson.findOne({
        _id: videoLessonId,
        isDeleted: false,
      });

      if (!videoLesson) {
        return res.status(404).json({ message: "Video lesson not found or is deleted" });
      }

      // Verify if the video lesson's lessonId belongs to the course
      // const lesson = await Lesson.findOne({
      //   _id: videoLesson.lessonId,
      //   courseId,
      // });

      // if (!lesson) {
      //   return res.status(400).json({ message: "Video lesson does not belong to the specified course" });
      // }

      // Update lastVideoPlayed
      enrollment.lastVideoPlayed = videoLessonId;
      await enrollment.save();

      return res.status(200).json({
        message: "Last video played updated successfully",
        data: {
          courseId,
          videoLessonId,
          userId,
          lastVideoPlayed: enrollment.lastVideoPlayed,
        },
      });
    } catch (err) {
      console.error("Update Last Video Played Error:", err);
      return res.status(500).json({ message: "Failed to update last video played", error: err.message });
    }
  }


}

export default new CourseCompletionController();
