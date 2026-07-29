export function getClientIP(req) {
    return req.headers['x-forwarded-for'] || 
                 req.headers['x-real-ip'] || 
                 req.connection.remoteAddress || 
                 req.socket.remoteAddress ||
                 (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
                 req.ip ||
                 '127.0.0.1';
}

export function validateSessionData(sessionData) {
    const required = ['courseId', 'videoId'];
    const missing = required.filter(field => !sessionData[field]);
    
    if (missing.length > 0) {
        throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }
    
    return true;
}

export function sanitizeDeviceInfo(deviceInfo) {
    if (!deviceInfo) return {};
    
    return {
        userAgent: deviceInfo.userAgent?.substring(0, 500) || '',
        platform: deviceInfo.platform?.substring(0, 100) || '',
        language: deviceInfo.language?.substring(0, 10) || '',
        screenResolution: deviceInfo.screenResolution?.substring(0, 20) || '',
        timezone: deviceInfo.timezone?.substring(0, 50) || ''
    };
}

export function calculateCompletionPercentage(currentTime, duration) {
    if (!duration || duration <= 0) return 0;
    return Math.min(100, Math.max(0, (currentTime / duration) * 100));
}

export function formatDuration(seconds) {
    if (!seconds || seconds <= 0) return '0s';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
        return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
        return `${minutes}m ${secs}s`;
    } else {
        return `${secs}s`;
    }
}

/**
 * Escape user-supplied input so it can be used safely inside a RegExp.
 * Prevents ReDoS / catastrophic-backtracking by treating the input as a
 * literal string rather than a regex pattern.
 * @param {string} str - Raw user input
 * @returns {string} Escaped string safe for RegExp construction
 */
export function escapeRegex(str = '') {
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function isValidUUID(uuid) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
}

export function generateAnalyticsReport(sessions) {
    const totalSessions = sessions.length;
    const totalWatchTime = sessions.reduce((sum, s) => sum + (s.totalWatchTime || 0), 0);
    const uniqueUsers = new Set(sessions.map(s => s.userId)).size;
    const completedSessions = sessions.filter(s => s.completed).length;
    
    return {
        totalSessions,
        totalWatchTime: formatDuration(totalWatchTime),
        uniqueUsers,
        completionRate: totalSessions > 0 ? ((completedSessions / totalSessions) * 100).toFixed(2) : 0,
        averageWatchTime: totalSessions > 0 ? formatDuration(totalWatchTime / totalSessions) : '0s'
    };
}
