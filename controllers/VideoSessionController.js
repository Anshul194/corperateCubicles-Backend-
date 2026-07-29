import VideoSessionService from '../service/VideoSessionService.js';
import { getClientIP } from '../utils/helper.js';

class VideoSessionController {
    async startSession(req, res) {
        try {
            const result = await VideoSessionService.startSession(
                req.user.id,
                req.body,
                getClientIP(req)
            );
            res.json(result);
        } catch (error) {
            console.error('Error starting analytics session:', error);
            res.status(error.message.includes('required') ? 400 : 500).json({ 
                error: error.message || 'Failed to start analytics session' 
            });
        }
    }

    async endSession(req, res) {
        try {
            const result = await VideoSessionService.endSession(req.user.id, req.body);
            res.json(result);
        } catch (error) {
            console.error('Error ending analytics session:', error);
            res.status(error.message === 'Session not found' ? 404 : 500).json({ 
                error: error.message || 'Failed to end analytics session' 
            });
        }
    }

    async trackEvent(req, res) {
        try {
            const result = await VideoSessionService.trackEvent(req.user.id, req.body);
            res.json(result);
        } catch (error) {
            console.error('Error tracking video event:', error);
            res.status(error.message === 'Session not found' ? 404 : 500).json({ 
                error: error.message || 'Failed to track event' 
            });
        }
    }

    async updateWatchTime(req, res) {
        try {
            const result = await VideoSessionService.updateWatchTime(req.user.id, req.body);
            res.json(result);
        } catch (error) {
            console.error('Error updating watch time:', error);
            res.status(error.message === 'Session not found' ? 404 : 500).json({ 
                error: error.message || 'Failed to update watch time' 
            });
        }
    }

    async completeLesson(req, res) {
        try {
            const { courseId, lessonId } = req.params;
            const { completed, sessionId } = req.body;

            const result = await VideoSessionService.updateLessonCompletion(
                req.user.id,
                courseId,
                lessonId,
                completed,
                sessionId
            );

            res.json(result);
        } catch (error) {
            console.error('Error updating completion status:', error);
            res.status(500).json({ error: 'Failed to update completion status' });
        }
    }
}

export default new VideoSessionController();