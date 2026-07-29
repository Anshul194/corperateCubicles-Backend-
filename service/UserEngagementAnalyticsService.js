import User from '../models/user.js';
import CourseEnrollment from '../models/CourseEnrollment.js';
import Course from '../models/Course.js';
import LessonProgress from '../models/LessonProgress.js';

class UserEngagementAnalyticsService {
  // Summary: active users, new signups, engagement
  async getUserEngagementSummary() {
    const totalUsers = await User.countDocuments({});
    const activeUsers = await User.countDocuments({ isActive: true });
    const newSignups = await User.countDocuments({ createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } });
    const enrolledUsers = await CourseEnrollment.distinct('userId').then(arr => arr.length);
    return { totalUsers, activeUsers, newSignups, enrolledUsers };
  }

  // Timeline: daily/weekly signups/logins
  async getUserActivityTimeline(range = '7d') {
    const days = range === '30d' ? 30 : 7;
    const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const pipeline = [
      { $match: { createdAt: { $gte: start } } },
      { $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        signups: { $sum: 1 }
      }},
      { $sort: { _id: 1 } }
    ];
    const signups = await User.aggregate(pipeline);
    // For logins, you need a login log model. Here, just return signups.
    return { signups };
  }

  // Course engagement: views, completions, avg progress
  async getCourseEngagementStats(courseId) {
    const enrollments = await CourseEnrollment.find({ courseId });
    const totalEnrolled = enrollments.length;
    const completed = enrollments.filter(e => e.status === 'completed').length;
    const progresses = await LessonProgress.find({ courseId });
    const avgProgress = progresses.length
      ? progresses.reduce((sum, lp) => sum + (lp.progressPercentage || 0), 0) / progresses.length
      : 0;
    return { totalEnrolled, completed, avgProgress: Math.round(avgProgress) };
  }

  // User engagement details
  async getUserEngagementDetails(userId) {
    const enrollments = await CourseEnrollment.find({ userId });
    const courses = enrollments.map(e => e.courseId);
    const progressArr = await LessonProgress.find({ userId });
    const avgProgress = progressArr.length
      ? progressArr.reduce((sum, lp) => sum + (lp.progressPercentage || 0), 0) / progressArr.length
      : 0;
    return {
      enrolledCourses: courses,
      totalCourses: courses.length,
      avgProgress: Math.round(avgProgress),
      lastAccessed: enrollments.reduce((latest, e) => e.lastAccessedAt > latest ? e.lastAccessedAt : latest, null)
    };
  }

  // Detailed analytics for a user and a course
  async getUserCourseAnalytics(userId, courseId) {
    const Course = (await import('../models/Course.js')).default;
    const CourseEnrollment = (await import('../models/CourseEnrollment.js')).default;
    const LessonProgress = (await import('../models/LessonProgress.js')).default;
    const User = (await import('../models/user.js')).default;

    const user = await User.findById(userId).lean();
    const course = await Course.findById(courseId).lean();
    if (!user || !course) return { error: 'User or course not found' };

    const enrollment = await CourseEnrollment.findOne({ userId, courseId }).lean();
    const lessonProgressArr = await LessonProgress.find({ userId, courseId }).lean();

    const avgProgress = lessonProgressArr.length
      ? lessonProgressArr.reduce((sum, lp) => sum + (lp.progressPercentage || 0), 0) / lessonProgressArr.length
      : 0;

    return {
      user: {
        _id: user._id,
        name: user.fullName,
        email: user.email,
      },
      course: {
        _id: course._id,
        title: course.title,
        description: course.description,
      },
      enrollment: enrollment || null,
      lessonProgress: lessonProgressArr,
      avgProgress: Math.round(avgProgress),
      completedLessons: lessonProgressArr.filter(lp => lp.progressPercentage === 100).length,
      lastAccessed: enrollment?.lastAccessedAt || null
    };
  }
}

export default new UserEngagementAnalyticsService();
