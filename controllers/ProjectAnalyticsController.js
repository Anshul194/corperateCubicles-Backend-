import ProjectAnalyticsService from '../service/ProjectAnalyticsService.js';

// Overall project analytics summary
export const getProjectSummary = async (req, res) => {
  try {
    const data = await ProjectAnalyticsService.getProjectSummary();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Top entities
export const getTopEntities = async (req, res) => {
  try {
    const data = await ProjectAnalyticsService.getTopEntities();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Time-based trends
export const getTrends = async (req, res) => {
  try {
    const { range = '30d' } = req.query;
    const data = await ProjectAnalyticsService.getTrends(range);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Detailed course stats
export const getCourseStats = async (req, res) => {
  try {
    const { courseId } = req.params;
    const data = await ProjectAnalyticsService.getCourseStats(courseId);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Detailed user stats
export const getUserStats = async (req, res) => {
  try {
    const { userId } = req.params;
    const data = await ProjectAnalyticsService.getUserStats(userId);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Detailed bundle stats
export const getBundleStats = async (req, res) => {
  try {
    const { bundleId } = req.params;
    const data = await ProjectAnalyticsService.getBundleStats(bundleId);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Revenue breakdown
export const getRevenueBreakdown = async (req, res) => {
  try {
    const data = await ProjectAnalyticsService.getRevenueBreakdown();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Activity logs (recent orders, enrollments, signups)
export const getActivityLogs = async (req, res) => {
  try {
    const data = await ProjectAnalyticsService.getActivityLogs();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Full project analytics
export const getFullProjectAnalytics = async (req, res) => {
  try {
    const summary = await ProjectAnalyticsService.getProjectSummary();
    const topEntities = await ProjectAnalyticsService.getTopEntities();
    const trends = await ProjectAnalyticsService.getTrends(req.query.range || '30d');
    const revenueBreakdown = await ProjectAnalyticsService.getRevenueBreakdown();
    const activityLogs = await ProjectAnalyticsService.getActivityLogs();

    res.json({
      success: true,
      data: {
        summary,
        topEntities,
        trends,
        revenueBreakdown,
        activityLogs
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
