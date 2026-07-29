import Course from '../models/Course.js';
import CourseBundle from '../models/CourseBundle.js';
import User from '../models/user.js';
import Order from '../models/Order.js';
import CourseEnrollment from '../models/CourseEnrollment.js';
import LessonProgress from '../models/LessonProgress.js';
import Lesson from '../models/Lesson.js';
import ForumPost from '../models/ForumPost.js'; // If exists
import QuizSubmission from '../models/QuizSubmission.js';
import AssignmentSubmission from '../models/assignmentSubmission.js';

class ProjectAnalyticsService {
  async getProjectSummary() {
    const totalCourses = await Course.countDocuments({ isDeleted: false });
    const totalBundles = await CourseBundle.countDocuments({ isDeleted: false });
    const totalUsers = await User.countDocuments({});
    const totalEnrollments = await CourseEnrollment.countDocuments({});
    const totalRevenue = await Order.aggregate([
      { $group: { _id: null, revenue: { $sum: { $toDouble: '$grandTotal' } } } }
    ]);
    return {
      totalCourses,
      totalBundles,
      totalUsers,
      totalEnrollments,
      totalRevenue: totalRevenue[0]?.revenue || 0
    };
  }

  async getTopEntities() {
    const topCourses = await Course.find({ isDeleted: false })
      .sort({ enrolledStudentsCount: -1 })
      .limit(5)
      .select('title enrolledStudentsCount')
      .lean();
    const topBundles = await CourseBundle.find({ isDeleted: false })
      .sort({ enrolledStudentsCount: -1 })
      .limit(5)
      .select('title enrolledStudentsCount')
      .lean();
    const topUsers = await User.find({})
      .sort({ createdAt: -1 })
      .limit(5)
      .select('fullName email createdAt')
      .lean();
    const topRevenueCourses = await Order.aggregate([
      { $unwind: '$items' },
      { $match: { 'items.type': 'course' } },
      { $group: { _id: '$items.courseId', totalSales: { $sum: { $toDouble: '$items.pricePaid' } } } },
      { $sort: { totalSales: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'courses', localField: '_id', foreignField: '_id', as: 'course' } },
      { $unwind: '$course' },
      { $project: { courseId: '$_id', title: '$course.title', totalSales: 1 } }
    ]);
    return { topCourses, topBundles, topUsers, topRevenueCourses };
  }

  async getTrends(range = '30d') {
    const days = range === '90d' ? 90 : range === '7d' ? 7 : 30;
    const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const enrollments = await CourseEnrollment.aggregate([
      { $match: { enrolledAt: { $gte: start } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$enrolledAt" } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    const sales = await Order.aggregate([
      { $match: { createdAt: { $gte: start } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, revenue: { $sum: { $toDouble: '$grandTotal' } } } },
      { $sort: { _id: 1 } }
    ]);
    const signups = await User.aggregate([
      { $match: { createdAt: { $gte: start } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    return { enrollments, sales, signups };
  }

  // Detailed stats for a course
  async getCourseStats(courseId) {
    const course = await Course.findById(courseId).lean();
    if (!course) return { error: 'Course not found' };
    const enrollments = await CourseEnrollment.find({ courseId }).lean();
    const completed = enrollments.filter(e => e.status === 'completed').length;
    const active = enrollments.filter(e => e.status === 'active').length;
    const revenue = await Order.aggregate([
      { $unwind: '$items' },
      { $match: { 'items.type': 'course', 'items.courseId': course._id } },
      { $group: { _id: null, total: { $sum: { $toDouble: '$items.pricePaid' } } } }
    ]);
    return {
      courseId: course._id,
      title: course.title,
      totalEnrollments: enrollments.length,
      activeEnrollments: active,
      completedEnrollments: completed,
      totalRevenue: revenue[0]?.total || 0
    };
  }

  // Detailed stats for a user
  async getUserStats(userId) {
    const user = await User.findById(userId).lean();
    if (!user) return { error: 'User not found' };
    const enrollments = await CourseEnrollment.find({ userId }).lean();
    const orders = await Order.find({ userId }).lean();
    const spent = orders.reduce((sum, o) => {
      if (o.grandTotal && typeof o.grandTotal === 'object' && o.grandTotal.$numberDecimal) {
        return sum + parseFloat(o.grandTotal.$numberDecimal);
      }
      return sum + (o.grandTotal || 0);
    }, 0);
    return {
      userId: user._id,
      name: user.fullName,
      email: user.email,
      totalEnrollments: enrollments.length,
      totalOrders: orders.length,
      totalSpent: spent
    };
  }

  // Detailed stats for a bundle
  async getBundleStats(bundleId) {
    const bundle = await CourseBundle.findById(bundleId).lean();
    if (!bundle) return { error: 'Bundle not found' };
    const enrollments = bundle.enrolledStudents?.length || 0;
    const revenue = await Order.aggregate([
      { $unwind: '$items' },
      { $match: { 'items.type': 'courseBundle', 'items.courseBundleId': bundle._id } },
      { $group: { _id: null, total: { $sum: { $toDouble: '$items.pricePaid' } } } }
    ]);
    return {
      bundleId: bundle._id,
      title: bundle.title,
      totalEnrollments: enrollments,
      totalRevenue: revenue[0]?.total || 0
    };
  }

  // Revenue breakdown by course, bundle, user
  async getRevenueBreakdown() {
    // Course revenue with course name
    const courseRevenueRaw = await Order.aggregate([
      { $unwind: '$items' },
      { $match: { 'items.type': 'course' } },
      { $group: { _id: '$items.courseId', total: { $sum: { $toDouble: '$items.pricePaid' } } } }
    ]);
    const courseIds = courseRevenueRaw.map(r => r._id);
    const courses = await Course.find({ _id: { $in: courseIds } }).select('_id title').lean();
    const courseRevenue = courseRevenueRaw.map(r => {
      const course = courses.find(c => c._id.toString() === r._id.toString());
      return {
        _id: r._id,
        name: course ? course.title : null,
        total: r.total
      };
    });

    // Bundle revenue with bundle name
    const bundleRevenueRaw = await Order.aggregate([
      { $unwind: '$items' },
      { $match: { 'items.type': 'courseBundle' } },
      { $group: { _id: '$items.courseBundleId', total: { $sum: { $toDouble: '$items.pricePaid' } } } }
    ]);
    const bundleIds = bundleRevenueRaw.map(r => r._id);
    const bundles = await CourseBundle.find({ _id: { $in: bundleIds } }).select('_id title').lean();
    const bundleRevenue = bundleRevenueRaw.map(r => {
      const bundle = bundles.find(b => b._id.toString() === r._id.toString());
      return {
        _id: r._id,
        name: bundle ? bundle.title : null,
        total: r.total
      };
    });

    // User revenue, ensure total is a number
    const userRevenueRaw = await Order.aggregate([
      { $group: { _id: '$userId', total: { $sum: { $toDouble: '$grandTotal' } } } }
    ]);
    const userRevenue = userRevenueRaw.map(r => ({
      _id: r._id,
      total: r.total
    }));

    return { courseRevenue, bundleRevenue, userRevenue };
  }

  // Recent activity logs
  async getActivityLogs() {
    const recentOrders = await Order.find({}).sort({ createdAt: -1 }).limit(10).lean();
    const recentEnrollments = await CourseEnrollment.find({}).sort({ enrolledAt: -1 }).limit(10).lean();
    const recentSignups = await User.find({}).sort({ createdAt: -1 }).limit(10).lean();
    return { recentOrders, recentEnrollments, recentSignups };
  }

  // Helper to format seconds to "X min Y sec"
  formatWatchTime(seconds) {
    if (!seconds || isNaN(seconds)) return "0 min";
    // If value is in milliseconds, convert to seconds
    if (seconds > 100000) seconds = Math.round(seconds / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return secs > 0 ? `${mins} min ${secs} sec` : `${mins} min`;
  }

  // Analytics for a particular student
  async getStudentAnalytics(studentId) {
    if (!studentId) return { error: 'Student ID required' };
    // Only non-sensitive fields are needed here; never load password/reset/otp data.
    const user = await User.findById(studentId).select('fullName email role').lean();
    if (!user || user.role !== 'student') return { error: 'Student not found' };

    // Enrollments
    const enrollments = await CourseEnrollment.find({ userId: studentId }).lean();
    const totalEnrollments = enrollments.length;
    const completedCourses = enrollments.filter(e => e.status === 'completed').length;
    const activeCourses = enrollments.filter(e => e.status === 'active').length;

    // Orders
    const orders = await Order.find({ userId: studentId }).lean();
    const totalOrders = orders.length;
    const totalSpent = orders.reduce((sum, o) => {
      if (o.grandTotal && typeof o.grandTotal === 'object' && o.grandTotal.$numberDecimal) {
        return sum + parseFloat(o.grandTotal.$numberDecimal);
      }
      return sum + (o.grandTotal || 0);
    }, 0);

    // Course details
    const courseIds = enrollments.map(e => e.courseId);
    const courses = await Course.find({ _id: { $in: courseIds } }).select('_id title').lean();

    // Fetch all lesson progress for this user
    const lessonProgresses = await LessonProgress.find({ userId: studentId }).lean();

    // Fetch quiz submissions for this user
    const quizSubmissions = await QuizSubmission.find({ user: studentId }).lean();

    // Fetch assignment submissions for this user
    const assignmentSubmissions = await AssignmentSubmission.find({ submittedBy: studentId }).lean();

    // Collect all lessonIds, quizIds, assignmentIds for mapping
    const lessonIds = [
      ...lessonProgresses.map(lp => lp.lessonId?.toString()).filter(Boolean),
      ...quizSubmissions.map(qs => qs.lessonId?.toString()).filter(Boolean),
      ...assignmentSubmissions.map(as => as.lessonId?.toString()).filter(Boolean)
    ];
    const uniqueLessonIds = [...new Set(lessonIds)];
    const lessons = await Lesson.find({ _id: { $in: uniqueLessonIds } }).select('_id title').lean();
    const lessonTitleMap = {};
    lessons.forEach(l => { lessonTitleMap[l._id.toString()] = l.title; });

    // Collect all courseIds for mapping
    const allCourseIds = [
      ...lessonProgresses.map(lp => lp.courseId?.toString()).filter(Boolean),
      ...quizSubmissions.map(qs => qs.courseId?.toString()).filter(Boolean),
      ...assignmentSubmissions.map(as => as.courseId?.toString()).filter(Boolean),
      ...enrollments.map(e => e.courseId?.toString()).filter(Boolean)
    ];
    const uniqueCourseIds = [...new Set(allCourseIds)];
    const allCourses = await Course.find({ _id: { $in: uniqueCourseIds } }).select('_id title').lean();
    const courseTitleMap = {};
    allCourses.forEach(c => { courseTitleMap[c._id.toString()] = c.title; });

    // Collect all quizIds for mapping
    const quizIds = quizSubmissions.map(qs => qs.quiz?.toString()).filter(Boolean);
    const quizzes = quizIds.length
      ? await import('../models/Quiz.js').then(m => m.default.find({ _id: { $in: quizIds } }).select('_id quizTitle').lean())
      : [];
    const quizTitleMap = {};
    quizzes.forEach(q => { quizTitleMap[q._id.toString()] = q.quizTitle; });

    // Collect all assignmentIds for mapping
    const assignmentIds = assignmentSubmissions.map(as => as.assignmentId?.toString()).filter(Boolean);
    const assignments = assignmentIds.length
      ? await import('../models/Assignment.js').then(m => m.default.find({ _id: { $in: assignmentIds } }).select('_id title').lean())
      : [];
    const assignmentTitleMap = {};
    assignments.forEach(a => { assignmentTitleMap[a._id.toString()] = a.title; });

    // Build course progress map for aggregating progress per course
    const courseProgressMap = {};
    lessonProgresses.forEach(lp => {
      const cid = lp.courseId?.toString();
      if (!courseProgressMap[cid]) {
        courseProgressMap[cid] = { totalLessons: 0, completedLessons: 0, totalWatchTime: 0, lessonProgress: [] };
      }
      courseProgressMap[cid].totalLessons += 1;
      if (lp.completed) courseProgressMap[cid].completedLessons += 1;
      courseProgressMap[cid].totalWatchTime += lp.watchTime || 0;
      courseProgressMap[cid].lessonProgress.push(lp);
    });

    // Build progress details per enrollment
    const progressDetails = enrollments.map(e => {
      const cid = e.courseId?.toString();
      const courseTitle = courses.find(c => c._id?.toString() === cid)?.title || '';
      const cp = courseProgressMap[cid] || { totalLessons: 0, completedLessons: 0, totalWatchTime: 0, lessonProgress: [] };
      const progress = cp.totalLessons > 0 ? Math.round((cp.completedLessons / cp.totalLessons) * 100) : 0;
      const timeSpent = this.formatWatchTime(cp.totalWatchTime);
      const lastActivity = cp.lessonProgress.length
        ? cp.lessonProgress.reduce((latest, lp) =>
            lp.lastUpdatedAt > latest.lastUpdatedAt ? lp : latest, cp.lessonProgress[0]
          ).lastUpdatedAt
        : e.enrolledAt;
      return {
        courseId: e.courseId,
        courseTitle,
        status: e.status,
        progress,
        timeSpent,
        lastActivity,
        lessons: cp.lessonProgress.map(lp => ({
          lessonId: lp.lessonId,
          lessonTitle: lessonTitleMap[lp.lessonId?.toString()] || '',
          progressPercentage: lp.progressPercentage,
          completed: lp.completed,
          watchTime: this.formatWatchTime(lp.watchTime),
          lastUpdatedAt: lp.lastUpdatedAt,
          startedAt: lp.startedAt,
          sessionId: lp.sessionId
        }))
      };
    });

    // Aggregate total time spent across all courses
    const totalTimeSpentRaw = lessonProgresses.reduce((sum, lp) => sum + (lp.watchTime || 0), 0);
    const totalTimeSpent = this.formatWatchTime(totalTimeSpentRaw);

    // Recent learning activity (last 10 lesson progress updates)
    const recentLearningActivity = lessonProgresses
      .sort((a, b) => b.lastUpdatedAt - a.lastUpdatedAt)
      .map(lp => {
        return {
          courseId: lp.courseId,
          courseName: courseTitleMap[lp.courseId?.toString()] || '',
          lessonId: lp.lessonId,
          lessonName: lessonTitleMap[lp.lessonId?.toString()] || '',
          progressPercentage: lp.progressPercentage,
          completed: lp.completed,
          watchTime: this.formatWatchTime(lp.watchTime),
          lastUpdatedAt: lp.lastUpdatedAt,
          startedAt: lp.startedAt,
          sessionId: lp.sessionId,
          sessionDetails: {
            sessionId: lp.sessionId,
            startedAt: lp.startedAt,
            lastUpdatedAt: lp.lastUpdatedAt
          }
        };
      });

    // Session activity (login/logout) - if you have a SessionLog model, fetch here
    const sessionActivity = []; // Fill from SessionLog if available

    // Recent enrollments/orders
    const recentEnrollments = enrollments.slice(-5).map(e => ({
      courseId: e.courseId,
      courseName: courseTitleMap[e.courseId?.toString()] || '',
      enrolledAt: e.enrolledAt,
      status: e.status
    }));
    const recentOrders = orders.slice(-5).map(o => ({
      orderId: o._id,
      grandTotal: o.grandTotal,
      createdAt: o.createdAt
    }));

    // Forum analytics (posts, replies, etc.)
    let forumStats = {};
    try {
      // Count posts and replies for the user
      const posts = await ForumPost.countDocuments({ user: studentId });
      const repliesAgg = await ForumPost.aggregate([
        { $unwind: "$replies" },
        { $match: { "replies.user": studentId } },
        { $group: { _id: "$replies.user", totalReplies: { $sum: 1 }, lastReplyAt: { $max: "$replies.createdAt" } } }
      ]);
      const totalReplies = repliesAgg[0]?.totalReplies || 0;
      const lastReplyAt = repliesAgg[0]?.lastReplyAt || null;
      const lastPost = await ForumPost.findOne({ user: studentId }).sort({ createdAt: -1 }).lean();
      forumStats = {
        totalPosts: posts,
        totalReplies,
        lastPostAt: lastPost?.createdAt || null,
        lastReplyAt
      };
    } catch {
      forumStats = { totalPosts: 0, totalReplies: 0, lastPostAt: null, lastReplyAt: null };
    }

    // Recent quiz submissions (last 5)
    const recentQuizSubmissions = quizSubmissions
      .sort((a, b) => b.submittedAt - a.submittedAt)
      .map(qs => ({
        _id: qs._id,
        quizId: qs.quiz,
        quizTitle: quizTitleMap[qs.quiz?.toString()] || '',
        courseId: qs.courseId,
        courseTitle: courseTitleMap[qs.courseId?.toString()] || '',
        lessonId: qs.lessonId,
        lessonTitle: lessonTitleMap[qs.lessonId?.toString()] || '',
        score: qs.score,
        totalMarks: qs.totalMarks,
        passed: qs.passed,
        percentage: qs.percentage,
        submittedAt: qs.submittedAt
      }));

    // Recent assignment submissions (last 5)
    const recentAssignmentSubmissions = assignmentSubmissions
      .sort((a, b) => b.submittedAt - a.submittedAt)
      .map(as => ({
        _id: as._id,
        assignmentId: as.assignmentId,
        assignmentTitle: assignmentTitleMap[as.assignmentId?.toString()] || '',
        courseId: as.courseId,
        courseTitle: courseTitleMap[as.courseId?.toString()] || '',
        lessonId: as.lessonId,
        lessonTitle: lessonTitleMap[as.lessonId?.toString()] || '',
        status: as.status,
        is_complete: as.is_complete,
        scoreGiven: as.scoreGiven,
        feedback: as.feedback,
        submittedAt: as.submittedAt,
        gradedAt: as.gradedAt
      }));

    return {
      studentId,
      name: user.fullName,
      email: user.email,
      totalEnrollments,
      completedCourses,
      activeCourses,
      totalOrders,
      totalSpent,
      enrolledCourses: courses,
      progressDetails,
      totalTimeSpent,
      recentLearningActivity,
      sessionActivity,
      recentEnrollments,
      recentOrders,
      forumStats,
      quizSubmissions: recentQuizSubmissions,
      assignmentSubmissions: recentAssignmentSubmissions
    };
  }
}

export default new ProjectAnalyticsService();
