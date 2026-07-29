import AssignmentSubmissionService from '../service/assignmentSubmissionService.js';
import VideoSessionRepository from '../repository/VideoSessionRepository.js';
import { getGlobalLeaderboard } from '../service/leaderboardService.js';
import User from '../models/user.js';
import CourseEnrollment from '../models/CourseEnrollment.js';
import Certificate from '../models/Certificate.js';
import Leaderboard from '../models/Leaderboard.js';
import News from '../models/News.js';
import Assignment from '../models/Assignment.js';

const assignmentService = new AssignmentSubmissionService();

class DashboardController {
  async getDashboard(req, res) {
    try {
      const userId = req.user?._id || req.user?.id;

      // 1. Fetch User and Core Stats
      const [user, enrollments, news, leaderboardData, certificatesCount] = await Promise.all([
        User.findById(userId).select('fullName email profilePicture role bio phone company address education skills mobileVerified emailVerified').lean(),
        CourseEnrollment.find({ userId, isWithdrawn: false }).populate('courseId', 'title thumbnail').lean(),
        News.find({ status: 'active' }).sort({ publishedAt: -1 }).limit(5).select('title summary publishedAt imageUrl').lean(),
        Leaderboard.findOne({ userId }).lean(),
        Certificate.countDocuments({ user_id: userId, status: 'issued' })
      ]);

      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      // 2. Process Enrollment Stats
      const activeCourses = enrollments.filter(e => e.status === 'active').map(e => ({
        courseId: e.courseId?._id,
        title: e.courseId?.title,
        thumbnail: e.courseId?.thumbnail,
        progress: e.progressPercentage || 0,
        enrolledAt: e.enrolledAt
      }));

      const completedCoursesCount = enrollments.filter(e => e.iscompleted).length;

      // 3. Fetch and Process Submissions
      const submissions = await assignmentService.getMySubmissions(userId);
      const recentSubmissions = (submissions || [])
        .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))
        .slice(0, 5)
        .map(s => ({
          id: s._id,
          assignmentTitle: s.assignmentId?.title || s.assignmentTitle || '',
          courseTitle: s.courseId?.title || s.courseTitle || '',
          status: s.status,
          submittedAt: s.submittedAt
        }));

      // 4. Fetch Pending Assignments
      const enrolledCourseIds = enrollments.map(e => e.courseId?._id);
      const allAssignments = await Assignment.find({ courseId: { $in: enrolledCourseIds } }).limit(10).lean();
      const submittedAssignmentIds = submissions.map(s => s.assignmentId?._id?.toString() || s.assignmentId?.toString());
      
      const upcomingAssignments = allAssignments
        .filter(a => !submittedAssignmentIds.includes(a._id.toString()))
        .slice(0, 5)
        .map(a => ({
          id: a._id,
          title: a.title,
          courseId: a.courseId
        }));

      // 5. Fetch Recent video sessions (Continue Learning)
      const sessions = await VideoSessionRepository.find({ userId });
        
      const recentSessions = (sessions || [])

        .sort((a, b) => new Date(b.updatedAt || b.startTime) - new Date(a.updatedAt || a.startTime))
        .slice(0, 5)
        .map(s => ({
          sessionId: s.sessionId,
          videoTitle: s.videoId?.title || '',
          lessonTitle: s.lessonId?.title || '',
          courseId: s.courseId,
          lastWatchedAt: s.updatedAt || s.endTime || s.startTime,
          completionPercentage: s.completionPercentage || 0
        }));

      // 6. Top learners from leaderboard
      const topLearners = await getGlobalLeaderboard(10);
      
      // 7. Get User's own Rank
      let userRank = null;
      try {
        const { getUserLeaderboard } = await import('../controllers/userController.js');
        userRank = await getUserLeaderboard(userId);
      } catch (e) {
        userRank = leaderboardData ? { ...leaderboardData, rank: 'N/A' } : null;
      }

      res.json({
        success: true,
        data: {
          allCoursesCount: enrollments.length,
          activeCoursesCount: activeCourses.length,
          certificatesCount: certificatesCount,
          profile: {
            ...user,
            stats: {
              enrolledCourses: enrollments.length,
              completedCourses: completedCoursesCount,
              certificatesEarned: certificatesCount,
              xp: leaderboardData?.xp || 0,
              level: leaderboardData?.level || 'Beginner',
              rank: userRank?.rank || 'N/A'
            }
          },
          activeCourses,
          continueLearning: recentSessions,
          upcomingAssignments,
          recentSubmissions,
          recentNews: news,
          topLearners,
          leaderboard: userRank
        }
      });

    } catch (err) {
      console.error('Dashboard Error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  }
}

export default new DashboardController();


