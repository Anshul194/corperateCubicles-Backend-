import SecurityIncidentRepository from '../repository/SecurityIncidentRepository.js';

class SecurityService {
    async recordIncident(userId, incidentData, userAgent, ipAddress) {
        const { sessionId, courseId, videoId, incidentType, details } = incidentData;

        // Determine severity based on incident type
        const severity = this.determineSeverity(incidentType);

        const incident = await SecurityIncidentRepository.create({
            sessionId,
            userId,
            courseId,
            videoId,
            incidentType,
            severity,
            details,
            userAgent,
            ipAddress
        });

        // Handle high severity incidents
        if (severity === 'High') {
            console.warn(`High severity security incident: ${incidentType} for user ${userId}`);
            // Add additional logic here (notifications, temporary bans, etc.)
        }

        return { 
            message: 'Security incident recorded',
            incidentId: incident._id,
            severity
        };
    }

    async getIncidents(filter = {}, page = 1, limit = 20) {
        return await SecurityIncidentRepository.find(filter, page, limit);
    }

    async checkUserSecurityStatus(userId) {
        const recentIncidents = await SecurityIncidentRepository.findRecentIncidents(userId, 24);
        return {
            hasRecentIncidents: recentIncidents.length > 0,
            incidentCount: recentIncidents.length,
            isBlocked: recentIncidents.length > 3
        };
    }

    determineSeverity(incidentType) {
        const highRiskIncidents = ['devtools_detected', 'unauthorized_access', 'content_download_attempt'];
        const lowRiskIncidents = ['context_menu_blocked', 'drag_blocked'];

        if (highRiskIncidents.includes(incidentType)) {
            return 'High';
        } else if (lowRiskIncidents.includes(incidentType)) {
            return 'Low';
        }
        return 'Medium';
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

export default new SecurityService();