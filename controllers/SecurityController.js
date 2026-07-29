import SecurityService from '../.../../service/SecurityService.js';
import { getClientIP } from '../utils/helper.js';

class SecurityController {
    async recordIncident(req, res) {
        try {
            const result = await SecurityService.recordIncident(
                req.user.id,
                req.body,
                req.headers['user-agent'],
                getClientIP(req)
            );
            res.json(result);
        } catch (error) {
            console.error('Error recording security incident:', error);
            res.status(500).json({ error: 'Failed to record security incident' });
        }
    }

    async getIncidents(req, res) {
        try {
            const { page = 1, limit = 20 } = req.query;
            // SECURITY: whitelist filter fields and only accept scalar string
            // values — spreading req.query directly into a Mongo query allows
            // operator injection (e.g. ?severity[$ne]=x).
            const ALLOWED_FILTER_FIELDS = ['incidentType', 'severity', 'userId', 'courseId', 'videoId', 'resolved'];
            const filter = {};
            for (const field of ALLOWED_FILTER_FIELDS) {
                const value = req.query[field];
                if (typeof value === 'string' && value.length > 0) {
                    filter[field] = field === 'resolved' ? value === 'true' : value;
                }
            }
            const result = await SecurityService.getIncidents(filter, parseInt(page), parseInt(limit));
            res.json(result);
        } catch (error) {
            console.error('Error getting security incidents:', error);
            res.status(500).json({ error: 'Failed to get security incidents' });
        }
    }
}

export default new SecurityController();
