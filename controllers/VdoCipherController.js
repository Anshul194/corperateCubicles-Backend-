import VdoCipherService from '../service/VdoCipherService.js';
import SecurityService from '../service/SecurityService.js';

class VdoCipherController {
    async generatePlayback(req, res) {
        try {
            const { courseId } = req.params;
            const { lessonId, videoId } = req.body;
            const userId = req?.user?._id;
            const userEmail = req?.user?.email;

            // Check user security status
            const securityStatus = await SecurityService.checkUserSecurityStatus(userId);
            if (securityStatus.isBlocked) {
                return res.status(403).json({ 
                    error: 'Access temporarily restricted due to security concerns' 
                });
            }

            // Validate required parameters
            if (!videoId) {
                return res.status(400).json({ error: 'Video ID is required' });
            }

            // Pass only analytics fields (no rtext type)
            const playbackData = await VdoCipherService.generatePlaybackData(
                videoId,
                userId,
                { userEmail, lessonId, courseId }
            );

            res.json({
                success: true,
                data: playbackData,
                message: 'Playback data generated successfully'
            });

        } catch (error) {
            console.error('Error generating VdoCipher playback:', error?.message);
            res.status(500).json({ 
                error: 'Failed to generate playback data',
                message: error.message 
            });
        }
    }

    async validateToken(req, res) {
        try {
            const { otp, playbackInfo } = req.body;
            const userId = req.user.id;

            // Basic validation
            if (!otp || !playbackInfo) {
                return res.status(400).json({ 
                    error: 'OTP and playback info are required' 
                });
            }

            // Here you could add additional token validation logic
            // For now, we'll just return success if the token exists

            res.json({
                success: true,
                valid: true,
                message: 'Token is valid'
            });

        } catch (error) {
            console.error('Error validating token:', error);
            res.status(500).json({ 
                error: 'Failed to validate token' 
            });
        }
    }
}

export default new VdoCipherController();