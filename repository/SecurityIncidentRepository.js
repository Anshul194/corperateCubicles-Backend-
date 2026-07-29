import SecurityIncident from '../models/SecurityIncident.js';

class SecurityIncidentRepository {
    async create(incidentData) {
        const incident = new SecurityIncident(incidentData);
        return await incident.save();
    }

    async find(query, page = 1, limit = 20) {
        const skip = (page - 1) * limit;
        const incidents = await SecurityIncident.find(query)
            .populate('userId', 'fullName email')
            .populate('courseId', 'title')
            .populate('videoId', 'title')
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(limit)
            .lean();
        
        const total = await SecurityIncident.countDocuments(query);

        return {
            data: incidents,
            total,
            page,
            pages: Math.ceil(total / limit)
        };
    }

    async findRecentIncidents(userId, hours = 24) {
        return await SecurityIncident.find({
            userId,
            severity: 'High',
            timestamp: { $gte: new Date(Date.now() - hours * 60 * 60 * 1000) },
            resolved: false
        });
    }

    async findByDateRange(startDate, endDate, additionalQuery = {}) {
        return await SecurityIncident.find({
            timestamp: { $gte: startDate, $lte: endDate },
            ...additionalQuery
        });
    }
}

export default new SecurityIncidentRepository();