import VideoAnalytics from '../models/VideoAnalytics.js';

class VideoAnalyticsRepository {
    async findOneAndUpdate(filter, update, options = {}) {
        try {
            return await VideoAnalytics.findOneAndUpdate(filter, update, options);
        } catch (error) {
            console.error('Error in findOneAndUpdate:', error);
            throw error;
        }
    }

    async create(analyticsData) {
        try {
            const analytics = new VideoAnalytics(analyticsData);
            return await analytics.save();
        } catch (error) {
            console.error('Error in create:', error);
            throw error;
        }
    }

    async find(query) {
        try {
            return await VideoAnalytics.find(query);
        } catch (error) {
            console.error('Error in find:', error);
            throw error;
        }
    }
}

export default new VideoAnalyticsRepository();
