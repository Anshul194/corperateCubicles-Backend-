import VideoAnalyticsRepository from '../repository/VideoAnalyticsRepository.js';
import VideoSessionRepository from '../repository/VideoSessionRepository.js';
import SecurityIncidentRepository from '../repository/SecurityIncidentRepository.js';

class VideoAnalyticsService {
    async updateDailyAnalytics(session) {
        const date = new Date(session.startTime);
        date.setHours(0, 0, 0, 0);

        await VideoAnalyticsRepository.findOneAndUpdate(
            { 
                videoId: session.videoId, 
                courseId: session.courseId, 
                date 
            },
            {
                $inc: {
                    'metrics.totalViews': 1,
                    'metrics.totalWatchTime': session.totalWatchTime || 0
                },
                updatedAt: new Date()
            },
            { 
                upsert: true, 
                new: true 
            }
        );
    }

    async getDashboardData(timeRange = '7d', courseId = null) {
        // Calculate date range
        const { startDate, endDate } = this.calculateDateRange(timeRange);

        // Build query
        const query = { startTime: { $gte: startDate } };
        if (courseId && courseId !== 'all') {
            query.courseId = courseId;
        }

        // Fetch data
        const sessions = await VideoSessionRepository.find(query);
        const securityIncidents = await SecurityIncidentRepository.findByDateRange(
            startDate, 
            endDate,
            courseId && courseId !== 'all' ? { courseId } : {}
        );

        // Calculate metrics
        const overview = this.calculateOverview(sessions, securityIncidents);
        const timeSeriesData = this.generateTimeSeriesData(sessions, startDate, endDate);
        const videoPerformance = this.generateVideoPerformance(sessions);
        const userEngagement = this.generateUserEngagement(sessions);
        const deviceStats = this.generateDeviceStats(sessions);
        const platformStats = this.generatePlatformStats(sessions);

        return {
            overview,
            timeSeriesData,
            videoPerformance,
            userEngagement,
            deviceStats,
            platformStats,
            securityIncidents: securityIncidents.slice(0, 10).map(incident => ({
                id: incident._id,
                type: incident.incidentType,
                severity: incident.severity,
                timestamp: incident.timestamp,
                description: this.getIncidentDescription(incident.incidentType),
                status: incident.resolved ? 'Resolved' : 'Active'
            }))
        };
    }

    calculateDateRange(timeRange) {
        const now = new Date();
        let startDate;
        
        switch (timeRange) {
            case '1d':
                startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                break;
            case '30d':
                startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                break;
            case '90d':
                startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
                break;
            case '1y':
                startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
                break;
            default: // 7d
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        }

        return { startDate, endDate: now };
    }

    calculateOverview(sessions, securityIncidents) {
        const totalViews = sessions.length;
        const totalWatchTime = sessions.reduce((sum, s) => sum + (s.totalWatchTime || 0), 0);
        const activeUsers = new Set(sessions.map(s => s.userId)).size;
        const avgCompletionRate = sessions.length > 0 
            ? sessions.reduce((sum, s) => sum + (s.completionPercentage || 0), 0) / sessions.length 
            : 0;

        return {
            totalViews,
            totalWatchTime: Math.round(totalWatchTime / 3600), // Convert to hours
            activeUsers,
            avgCompletionRate: Math.round(avgCompletionRate * 10) / 10,
            securityIncidents: securityIncidents.length
        };
    }


    async getAllVideoSessions(filter = {}) {
        return await VideoSessionRepository.find(filter);
    }


    generateTimeSeriesData(sessions, startDate, endDate) {
        const data = [];
        const dayMs = 24 * 60 * 60 * 1000;
        
        for (let d = new Date(startDate); d <= endDate; d.setTime(d.getTime() + dayMs)) {
            const dayStart = new Date(d);
            const dayEnd = new Date(d.getTime() + dayMs);
            
            const daySessions = sessions.filter(s => 
                s.startTime >= dayStart && s.startTime < dayEnd
            );
            
            data.push({
                date: dayStart.toISOString().split('T')[0],
                views: daySessions.length,
                watchTime: Math.round(daySessions.reduce((sum, s) => sum + (s.totalWatchTime || 0), 0) / 60),
                users: new Set(daySessions.map(s => s.userId)).size,
                completionRate: daySessions.length > 0 
                    ? daySessions.reduce((sum, s) => sum + (s.completionPercentage || 0), 0) / daySessions.length 
                    : 0
            });
        }
        
        return data;
    }

   generateVideoPerformance(sessions) {
    const videoStats = {};

    sessions.forEach(session => {
        const video = session.videoId;
        const videoId = video?._id?.toString() || session.videoId?.toString();
        if (!videoId) return;

        if (!videoStats[videoId]) {
            videoStats[videoId] = {
                videoId: videoId,
                title: video?.title || `Video ${videoId}`,
                views: 0,
                totalWatchTime: 0,
                completions: 0,
                completionRates: []
            };
        }

        const stats = videoStats[videoId];
        stats.views++;
        stats.totalWatchTime += session.totalWatchTime || 0;
        if (session.completionPercentage) {
            stats.completionRates.push(session.completionPercentage);
        }
        if (session.completed) {
            stats.completions++;
        }
    });

    return Object.values(videoStats).map(stats => ({
        id: stats.videoId,
        title: stats.title,
        views: stats.views,
        watchTime: Math.round(stats.totalWatchTime / 60),
        completionRate: stats.completionRates.length > 0
            ? stats.completionRates.reduce((a, b) => a + b, 0) / stats.completionRates.length
            : 0,
        engagement: Math.random() * 5 + 5 // Placeholder - replace with actual metric
    }));
}


    generateUserEngagement(sessions) {
    const userStats = {};

    sessions.forEach(session => {
        const userId = session.userId;
        if (!userStats[userId]) {
            userStats[userId] = {
                userId,
                name: session.user?.name || `User ${userId}`,
                totalWatchTime: 0,
                videosWatched: 0,
                completionRates: [],
                lastActive: session.startTime
            };
        }

        const stats = userStats[userId];
        stats.totalWatchTime += session.totalWatchTime || 0;
        stats.videosWatched++;
        if (session.completionPercentage) {
            stats.completionRates.push(session.completionPercentage);
        }
        if (session.startTime > stats.lastActive) {
            stats.lastActive = session.startTime;
        }
    });

    return Object.values(userStats).map(stats => ({
        userId: stats.userId,
        name: stats.name,
        totalWatchTime: Math.round(stats.totalWatchTime / 3600),
        videosWatched: stats.videosWatched,
        avgCompletionRate: stats.completionRates.length > 0 
            ? stats.completionRates.reduce((a, b) => a + b, 0) / stats.completionRates.length 
            : 0,
        lastActive: stats.lastActive.toISOString().split('T')[0]
    }));
}


    generateDeviceStats(sessions) {
        const deviceCounts = { desktop: 0, mobile: 0, tablet: 0 };
        
        sessions.forEach(session => {
            const userAgent = session.deviceInfo?.userAgent?.toLowerCase() || '';
            if (userAgent.includes('mobile')) {
                deviceCounts.mobile++;
            } else if (userAgent.includes('tablet')) {
                deviceCounts.tablet++;
            } else {
                deviceCounts.desktop++;
            }
        });
        
        const total = sessions.length || 1;
        return [
            { name: 'Desktop', value: Math.round((deviceCounts.desktop / total) * 100), color: '#8884d8' },
            { name: 'Mobile', value: Math.round((deviceCounts.mobile / total) * 100), color: '#82ca9d' },
            { name: 'Tablet', value: Math.round((deviceCounts.tablet / total) * 100), color: '#ffc658' }
        ];
    }

    generatePlatformStats(sessions) {
        const total = sessions.length || 1;
        return [
            { name: 'Web', value: Math.round((sessions.length * 0.6) / total * 100), color: '#8884d8' },
            { name: 'Mobile App', value: Math.round((sessions.length * 0.4) / total * 100), color: '#82ca9d' }
        ];
    }

    getIncidentDescription(incidentType) {
        const descriptions = {
            'context_menu_blocked': 'User attempted to access context menu',
            'keyboard_shortcut_blocked': 'User attempted to use blocked keyboard shortcuts',
            'devtools_detected': 'Developer tools were detected as open',
            'tab_hidden': 'User switched to another tab while video was playing',
            'drag_blocked': 'User attempted to drag video content',
            'unauthorized_access': 'Unauthorized access attempt detected'
        };
        
        return descriptions[incidentType] || 'Security incident occurred';
    }
}

export default new VideoAnalyticsService();