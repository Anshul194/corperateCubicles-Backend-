import UserEngagementAnalyticsService from '../service/UserEngagementAnalyticsService.js';

// Total active users, new signups, engagement stats
export const getUserEngagementSummary = async (req, res) => {
  try {
    const data = await UserEngagementAnalyticsService.getUserEngagementSummary();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// User activity timeline (daily/weekly signups, logins)
export const getUserActivityTimeline = async (req, res) => {
  try {
    const { range = '7d' } = req.query;
    const data = await UserEngagementAnalyticsService.getUserActivityTimeline(range);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Course engagement (views, completions, avg progress)
export const getCourseEngagementStats = async (req, res) => {
  try {
    const { courseId } = req.params;
    const data = await UserEngagementAnalyticsService.getCourseEngagementStats(courseId);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// User engagement details (per user)
export const getUserEngagementDetails = async (req, res) => {
  try {
    const { userId } = req.params;
    const data = await UserEngagementAnalyticsService.getUserEngagementDetails(userId);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Detailed analytics for a user and a course
export const getUserCourseAnalytics = async (req, res) => {
  try {
    const { userId, courseId } = req.params;
    const data = await UserEngagementAnalyticsService.getUserCourseAnalytics(userId, courseId);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
