import VideoSession from '../models/VideoSession.js';

class VideoSessionRepository {
    async create(sessionData) {
        try {
            const session = new VideoSession(sessionData);
            return await session.save();
        } catch (error) {
            console.error('Error in create:', error);
            throw error;
        }
    }

    async findById(id) {
        try {
            return await VideoSession.findById(id);
        } catch (error) {
            console.error('Error in findById:', error);
            throw error;
        }
    }

    async findBySessionId(sessionId) {
        try {
            return await VideoSession.findOne({ sessionId });
        } catch (error) {
            console.error('Error in findBySessionId:', error);
            throw error;
        }
    }

    async findBySessionIdAndUserId(sessionId, userId) {
        try {
            return await VideoSession.findOne({ sessionId, userId });
        } catch (error) {
            console.error('Error in findBySessionIdAndUserId:', error);
            throw error;
        }
    }

    async updateMany(filter, update) {
        try {
            return await VideoSession.updateMany(filter, update);
        } catch (error) {
            console.error('Error in updateMany:', error);
            throw error;
        }
    }

    async findOneAndUpdate(filter, update, options = {}) {
        try {
            return await VideoSession.findOneAndUpdate(filter, update, options);
        } catch (error) {
            console.error('Error in findOneAndUpdate:', error);
            throw error;
        }
    }

    // Hard cap so the analytics dashboard can't pull an unbounded number of
    // full session docs into memory. Callers may override via options.limit/skip.
    static MAX_FIND_RESULTS = 5000;

    async find(query = {}, options = {}) {
        try {
            const limit = Math.min(
                Number(options.limit) || VideoSessionRepository.MAX_FIND_RESULTS,
                VideoSessionRepository.MAX_FIND_RESULTS
            );
            const skip = Number(options.skip) || 0;

            return await VideoSession.find(query)
                // Project only the fields the dashboard/listing actually use so the
                // unbounded interactions[]/qualityChanges[]/bufferEvents[] arrays
                // aren't hydrated for every session.
                .select('sessionId userId videoId courseId lessonId startTime endTime updatedAt totalWatchTime completionPercentage completed deviceInfo isActive')
                .sort({ startTime: -1 })
                .skip(skip)
                .limit(limit)
                .populate('userId', 'fullName')
                .populate({
                    path: 'videoId',
                    select: 'title lessonId',
                    populate: {
                        path: 'lessonId',
                        select: 'title courseId',
                        // You can enable this if course population is needed:
                        // populate: {
                        //     path: 'courseId',
                        //     select: 'title'
                        // }
                    }
                });
        } catch (error) {
            console.error('Error in find:', error);
            throw error;
        }
    }

    async findActiveSessions(userId, videoId) {
        try {
            return await VideoSession.find({ 
                userId, 
                videoId, 
                isActive: true 
            });
        } catch (error) {
            console.error('Error in findActiveSessions:', error);
            throw error;
        }
    }

    async findByDateRange(startDate, endDate, additionalQuery = {}) {
        try {
            return await VideoSession.find({
                startTime: { $gte: startDate, $lte: endDate },
                ...additionalQuery
            });
        } catch (error) {
            console.error('Error in findByDateRange:', error);
            throw error;
        }
    }
}

const videoSessionRepository = new VideoSessionRepository();
export default videoSessionRepository;
