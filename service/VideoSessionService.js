import { v4 as uuidv4 } from 'uuid';
import VideoSessionRepository from '../repository/VideoSessionRepository.js';
import VideoAnalyticsService from './VideoAnalyticsService.js';

class VideoSessionService {
    async startSession(userId, sessionData, ipAddress) {
        const { courseId, videoId, lessonId, deviceInfo, referrer } = sessionData;

        if (!courseId || !videoId) {
            throw new Error('Course ID and Video ID are required');
        }

        // End any existing active sessions
        await VideoSessionRepository.updateMany(
            { userId, videoId, isActive: true },
            { 
                isActive: false,
                endTime: new Date(),
                updatedAt: new Date()
            }
        );

        const sessionId = uuidv4();
        const session = await VideoSessionRepository.create({
            sessionId,
            userId,
            courseId,
            videoId,
            lessonId,
            deviceInfo,
            ipAddress,
            referrer,
            startTime: new Date()
        });

        return { sessionId, message: 'Analytics session started successfully' };
    }

    async endSession(userId, sessionData) {
        const {
            sessionId,
            totalWatchTime,
            maxWatchedTime,
            completionPercentage,
            interactions,
            qualityChanges,
            bufferEvents,
            completed
        } = sessionData;

        const session = await VideoSessionRepository.findBySessionIdAndUserId(sessionId, userId);
        if (!session) {
            throw new Error('Session not found');
        }

        // Update session data
        const updateData = {
            endTime: new Date(),
            totalWatchTime: totalWatchTime || session.totalWatchTime,
            maxWatchedTime: maxWatchedTime || session.maxWatchedTime,
            completionPercentage: completionPercentage || session.completionPercentage,
            completed: completed || session.completed,
            isActive: false,
            updatedAt: new Date()
        };

        // Add interactions, quality changes, and buffer events
        if (interactions) session.interactions.push(...interactions);
        if (qualityChanges) session.qualityChanges.push(...qualityChanges);
        if (bufferEvents) session.bufferEvents.push(...bufferEvents);

        Object.assign(session, updateData);
        await session.save();

        // Update daily analytics
        await VideoAnalyticsService.updateDailyAnalytics(session);

        return { message: 'Session ended successfully' };
    }

    async trackEvent(userId, eventData) {
        const { sessionId, eventType, timestamp, currentTime, duration, watchProgress, ...additionalData } = eventData;

        const session = await VideoSessionRepository.findBySessionIdAndUserId(sessionId, userId);
        if (!session) {
            throw new Error('Session not found');
        }

        const event = {
            eventType,
            timestamp: new Date(timestamp),
            currentTime: currentTime || 0,
            duration: duration || 0,
            watchProgress: watchProgress || 0,
            additionalData
        };

        session.interactions.push(event);
        session.updatedAt = new Date();
        await session.save();

        return { message: 'Event tracked successfully' };
    }

    async updateWatchTime(userId, watchTimeData) {
        const { sessionId, totalWatchTime, currentTime, maxWatchedTime } = watchTimeData;

        const session = await VideoSessionRepository.findBySessionIdAndUserId(sessionId, userId);
        if (!session) {
            throw new Error('Session not found');
        }

        session.totalWatchTime = totalWatchTime;
        session.maxWatchedTime = Math.max(session.maxWatchedTime, maxWatchedTime || currentTime);
        session.updatedAt = new Date();

        await session.save();
        return { message: 'Watch time updated successfully' };
    }

    async updateLessonCompletion(userId, courseId, lessonId, completed, sessionId) {
        if (sessionId) {
            await VideoSessionRepository.findOneAndUpdate(
                { sessionId, userId },
                { completed, updatedAt: new Date() }
            );
        }

        return { 
            message: 'Completion status updated successfully',
            completed,
            lessonId
        };
    }
}

export default new VideoSessionService();