import VideoAnalyticsService from '../service/VideoAnalyticsService.js';
import SearchService from '../service/SearchService.js';
import Course from '../models/Course.js';
import CourseBundle from '../models/CourseBundle.js';
import escapeRegExp from '../utils/escapeRegExp.js';

class AnalyticsController {
    async getDashboard(req, res) {
        try {
            const { timeRange = '7d', courseId = 'all' } = req.query;
            
            // Validate timeRange
            const validTimeRanges = ['1d', '7d', '30d', '90d', '1y'];
            if (!validTimeRanges.includes(timeRange)) {
                return res.status(400).json({ 
                    error: 'Invalid time range. Valid options: 1d, 7d, 30d, 90d, 1y' 
                });
            }

            const dashboardData = await VideoAnalyticsService.getDashboardData(timeRange, courseId);
            
            res.json({
                success: true,
                data: dashboardData,
                timeRange,
                courseId
            });

        } catch (error) {
            // console.error('Error fetching dashboard data:', error);
            res.status(500).json({ 
                error: 'Failed to fetch dashboard data' 
            });
        }
    }


    async getAllVideoSessions(req, res) {
        try {
          
const videoSessions= await VideoAnalyticsService.getAllVideoSessions();

            res.json({
                success: true,
                data: videoSessions,
                message: 'Video session analytics fetched successfully'
            });
        } catch (error) {
            // console.error('Error fetching video session analytics:', error);
            res.status(500).json({
                error: 'Failed to fetch video session analytics'
            });
        }
    }


    async getVideoMetrics(req, res) {
        try {
            const { videoId } = req.params;
            const { timeRange = '7d' } = req.query;

            // This would be implemented to get specific video metrics
            // For now, returning a placeholder response
            
            res.json({
                success: true,
                data: {
                    videoId,
                    metrics: {
                        views: 0,
                        totalWatchTime: 0,
                        completionRate: 0,
                        engagement: 0
                    }
                },
                message: 'Video metrics retrieved successfully'
            });

        } catch (error) {
            // console.error('Error fetching video metrics:', error);
            res.status(500).json({ 
                error: 'Failed to fetch video metrics' 
            });
        }
    }

    async getUserAnalytics(req, res) {
        try {
            const { userId } = req.params;
            const { timeRange = '7d' } = req.query;

            // This would be implemented to get specific user analytics
            // For now, returning a placeholder response
            
            res.json({
                success: true,
                data: {
                    userId,
                    analytics: {
                        totalWatchTime: 0,
                        videosWatched: 0,
                        avgCompletionRate: 0,
                        lastActive: new Date().toISOString()
                    }
                },
                message: 'User analytics retrieved successfully'
            });

        } catch (error) {
            // console.error('Error fetching user analytics:', error);
            res.status(500).json({ 
                error: 'Failed to fetch user analytics' 
            });
        }
    }

    async searchContent(req, res) {
        try {
            const { 
                q: searchQuery = '', 
                type = 'all',  // 'all', 'course', 'bundle'
                page = 1,
                limit = 10,
                sortBy = 'relevance', // 'relevance', 'title', 'createdAt', 'price', 'popularity'
                categoryId,
                level,
                minPrice,
                maxPrice
            } = req.query;

            // Build search options
            const searchOptions = {
                query: searchQuery,
                type,
                page,
                limit,
                sortBy,
                filters: {
                    categoryId,
                    level,
                    minPrice,
                    maxPrice
                }
            };

            const searchResults = await SearchService.searchContent(searchOptions);

            res.json({
                success: true,
                message: 'Search completed successfully',
                data: searchResults
            });

        } catch (error) {
            // console.error('Error in content search:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to perform search'
            });
        }
    }


     /**
     * Get search suggestions based on partial query
     * @param {string} query - Partial search query
     * @param {number} limit - Number of suggestions
     * @returns {Array} Array of search suggestions with type
     */

    async getSearchSuggestions(req, res) {
        try {
            const { q = '', limit = 5 } = req.query;
            const query = String(q);

            if (!query || query.length < 2) {
                return res.json({
                    success: true,
                    data: [],
                    message: 'Query too short'
                });
            }

            // escapeRegExp caps length at 200 and escapes regex metacharacters
            // to prevent ReDoS / regex injection from this public endpoint.
            const searchRegex = new RegExp(escapeRegExp(query.trim()), 'i');
            const suggestions = [];

            // Get course titles
            const courses = await Course.find({
                isDeleted: false,
                isPublished: true,
                title: searchRegex
            })
            .select('title')
            .limit(Number(limit))
            .lean();

            courses.forEach(course => {
                suggestions.push({ title: course.title, type: 'course' });
            });

            // Get bundle titles
            const bundles = await CourseBundle.find({
                title: searchRegex
            })
            .select('title')
            .limit(Number(limit))
            .lean();

            bundles.forEach(bundle => {
                suggestions.push({ title: bundle.title, type: 'bundle' });
            });

            // Remove duplicates by title and type
            const uniqueSuggestions = [];
            const seen = new Set();
            for (const s of suggestions) {
                const key = `${s.title}|${s.type}`;
                if (!seen.has(key)) {
                    uniqueSuggestions.push(s);
                    seen.add(key);
                }
                if (uniqueSuggestions.length >= limit) break;
            }

            return res.json({
                success: true,
                data: uniqueSuggestions,
                query
            });
        } catch (error) {
            // console.error('Error fetching search suggestions:', error);
            return res.status(500).json({
                success: false,
                error: error.message || 'Failed to fetch search suggestions'
            });
        }
    }
}

export default new AnalyticsController();