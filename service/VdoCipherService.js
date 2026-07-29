import axios from 'axios';
import VdoCipherTokenRepository from '../repository/VdoCipherTokenRepository.js';

class VdoCipherService {
    constructor() {
        this.apiKey = process.env.VIDEOCYPHER_API_KEY;
        this.apiUrl = 'https://dev.vdocipher.com/api';
    }

    async linkExistingVideo(videoId, lessonData) {
        try {
            //console.log(`🔗 Linking existing VdoCipher video: videoId=${videoId}`);
            
            // First, get video details and validate status
            const videoDetails = await this.getVideoDetails(videoId);
            
            if (!videoDetails.isReady) {
                throw new Error(`Video is not ready for linking. Status: ${videoDetails.status}`);
            }

            // Generate playback data for the video (but don't store in VdoCipherTokenRepository yet)
            // This is just to verify the video can generate OTP
            const playbackData = await this.generatePlaybackData(videoId, lessonData.userId || 'system');

            // Return combined data for database storage (same structure as uploaded videos)
            const linkedVideoData = {
                videoId: videoDetails.videoId,
                title: lessonData.title || videoDetails.title,
                description: lessonData.description || videoDetails.description,
                sourcePlatform: 'videocypher',
                uploadMethod: 'existing_video_id',
                status: videoDetails.status,
                secureUrl: videoDetails.secureUrl,
                embedUrl: videoDetails.secureUrl,
                originalUrl: videoDetails.secureUrl,
                thumbnail: videoDetails.thumbnail,
                quality: videoDetails.quality,
                duration: videoDetails.duration,
                size: videoDetails.size,
                uploadTime: videoDetails.uploadTime,
                tags: videoDetails.tags,
                lessonId: lessonData.lessonId,
                linkedAt: new Date().toISOString(),
                isLinked: true, // Flag to indicate this was linked, not uploaded
                // Store initial playback capability verification
                playbackVerified: true,
                lastPlaybackCheck: new Date().toISOString()
            };

            //console.log(`✅ Successfully prepared existing video data for linking: videoId=${videoId}`);
            return linkedVideoData;

        } catch (error) {
            console.error(`❌ Error linking existing VdoCipher video: videoId=${videoId}`, error.message);
            throw error;
        }
    }

    async validateExistingVideo(videoId) {
        try {
            //console.log(`🔍 Validating existing VdoCipher video: videoId=${videoId}`);
            
            // Quick validation - just check if video exists and is ready
            const videoDetails = await this.getVideoDetails(videoId);
            
            return {
                isValid: videoDetails.isReady,
                status: videoDetails.status,
                title: videoDetails.title,
                duration: videoDetails.duration,
                thumbnail: videoDetails.thumbnail,
                reason: videoDetails.isReady ? 'Video is ready for linking' : `Video status: ${videoDetails.status}`
            };

        } catch (error) {
            console.error(`❌ Error validating VdoCipher video: videoId=${videoId}`, error.message);
            return {
                isValid: false,
                status: 'error',
                reason: error.message
            };
        }
    }

//   async generatePlaybackData(videoId, userId, additionalData = {}) {
//   try {
//     const requestBody = {
//       ttl: 300,
//     };

//     if (userId && userId !== "system") {
//       requestBody.user = {
//         id: userId, // ✅ mandatory
//         name: additionalData.userEmail || userId, // optional but useful
//         meta: {
//           lessonId: additionalData.lessonId,
//           courseId: additionalData.courseId,
//         },
//       };
//     }

//     console.log("📤 Sending to VdoCipher:", requestBody);

//     // 🧩 Construct a curl command for debugging / support
//     const curlCommand = `
// curl -X POST '${this.apiUrl}/videos/${videoId}/otp' \\
//   -H 'Authorization: Apisecret ${this.apiKey}' \\
//   -H 'Content-Type: application/json' \\
//   -d '${JSON.stringify(requestBody, null, 2)}'
//     `;
//     console.log("🐛 Debug CURL (send this to VdoCipher support):\n", curlCommand);

//     const otpResponse = await axios.post(
//       `${this.apiUrl}/videos/${videoId}/otp`,
//       requestBody,
//       {
//         headers: {
//           Authorization: `Apisecret ${this.apiKey}`,
//           "Content-Type": "application/json",
//         },
//       }
//     );

//     console.log("✅ VdoCipher OTP generated successfully:", otpResponse.data);
//     console.log("✅ For userId:", userId);

//     return {
//       otp: otpResponse.data.otp,
//       playbackInfo: otpResponse.data.playbackInfo,
//       ttl: 300,
//       fetchedAt: new Date().toISOString(),
//     };
//   } catch (error) {
//     console.error(
//       "❌ VdoCipher API error:",
//       error.response?.data || error.message
//     );

//     // Optional: include curl command in error logs for context
//     console.error("❗ CURL used:\n", `
// curl -X POST '${this.apiUrl}/videos/${videoId}/otp' \\
//   -H 'Authorization: Apisecret ${this.apiKey}' \\
//   -H 'Content-Type: application/json' \\
//   -d '${JSON.stringify(requestBody, null, 2)}'
//     `);

//     throw new Error("Failed to generate VdoCipher playback data");
//   }
// }



async  generatePlaybackData(videoId, userId) {
  try {
    // 🔹 Body as per official viewer-based analytics format
    const requestBody = {
      ttl: 300,
      userId,
    };

    // 🧩 Log request + curl for debugging / support
    const curlCommand = `
curl -X POST '${process.env.VDOCIPHER_API_URL || "https://dev.vdocipher.com/api"}/videos/${videoId}/otp' \\
  -H 'Authorization: Apisecret ${this.apiKey}' \\
  -H 'Content-Type: application/json' \\
  -d '${JSON.stringify(requestBody, null, 2)}'
    `;
    console.log("🐛 Debug CURL (send this to VdoCipher support if needed):\n", curlCommand);

    // 🔹 Make the actual request
    const otpResponse = await axios.post(
      `${process.env.VDOCIPHER_API_URL || "https://dev.vdocipher.com/api"}/videos/${videoId}/otp`,
      requestBody,
      {
        headers: {
          Authorization: `Apisecret ${this.apiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ VdoCipher OTP generated successfully:", otpResponse.data);

    return {
      otp: otpResponse.data.otp,
      playbackInfo: otpResponse.data.playbackInfo,
      ttl: 300,
      fetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("❌ VdoCipher API error:", error.response?.data || error.message);
    throw new Error("Failed to generate VdoCipher playback data");
  }
}








    async deleteVideo(videoId) {
        try {
            //console.log(`🗑️ Initiating deletion of VideoCypher video: videoId=${videoId}`);
            const response = await axios.delete(`${this.apiUrl}/videos/${videoId}`, {
                headers: {
                    'Authorization': `Apisecret ${this.apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            //console.log(`✅ Successfully deleted video from VideoCypher: videoId=${videoId}`, response.data);
            return response.data;
        } catch (error) {
            console.error(`❌ Error deleting VideoCypher video: videoId=${videoId}`, error?.response?.data || error.message);
            throw new Error(`Failed to delete video from VideoCypher: ${error.message}`);
        }
    }

    async linkExistingVideoSimple(videoId, lessonData) {
        try {
            //console.log(`🔗 Linking existing VdoCipher video (simple): videoId=${videoId}`);
            
            // First, validate video exists and get basic info (don't enforce ready status for initial link)
            const response = await axios.get(`${this.apiUrl}/videos/${videoId}`, {
                headers: {
                    'Authorization': `Apisecret ${this.apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            const videoData = response.data;
            //console.log(`✅ Video found in VdoCipher: videoId=${videoId}`, { status: videoData.status, title: videoData.title });

            // Return structured data for database storage - don't require ready status for linking
            const linkedVideoData = {
                videoId: videoData.id,
                title: lessonData.title || videoData.title || '',
                description: lessonData.description || videoData.description || '',
                sourcePlatform: 'videocypher',
                uploadMethod: 'existing_video_id',
                status: videoData.status || 'pending',
                secureUrl: videoData.files?.[0]?.url || '',
                embedUrl: videoData.files?.[0]?.url || '',
                originalUrl: videoData.files?.[0]?.url || '',
                thumbnail: videoData.poster || '',
                quality: lessonData.quality || videoData.files?.[0]?.quality || 'auto',
                duration: videoData.length || 0,
                size: videoData.size || 0,
                uploadTime: videoData.upload_time || new Date().toISOString(),
                tags: videoData.tags || [],
                lessonId: lessonData.lessonId,
                linkedAt: new Date().toISOString(),
                isLinked: true,
                // Note: Don't validate playback until video is ready
                readyForPlayback: videoData.status === 'ready'
            };

            //console.log(`✅ Successfully prepared video data for linking: videoId=${videoId}`);
            return linkedVideoData;

        } catch (error) {
            console.error(`❌ Error linking VdoCipher video: videoId=${videoId}`, error?.response?.data || error.message);
            
            if (error.response?.status === 404) {
                throw new Error('Video not found in VdoCipher. Please verify the Video ID is correct.');
            } else if (error.response?.status === 403) {
                throw new Error('Access denied. Please check your VdoCipher API credentials.');
            }
            
            throw new Error(`Failed to link video: ${error.message}`);
        }
    }

    // Modified getVideoDetails to be more lenient for linking
    async getVideoDetails(videoId, requireReady = true) {
        try {
            //console.log(`🔍 Fetching video details from VdoCipher: videoId=${videoId}`);
            
            const response = await axios.get(`${this.apiUrl}/videos/${videoId}`, {
                headers: {
                    'Authorization': `Apisecret ${this.apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            const videoData = response.data;
            
            //console.log(`✅ Successfully fetched video details: videoId=${videoId}`, videoData);
            
            // Only validate ready status if required
            if (requireReady && videoData.status !== 'ready') {
                throw new Error(`Video is not ready for streaming. Current status: ${videoData.status}. Please wait for processing to complete.`);
            }

            // Return structured video details
            return {
                videoId: videoData.id,
                title: videoData.title || '',
                description: videoData.description || '',
                status: videoData.status,
                duration: videoData.length || 0,
                thumbnail: videoData.poster || '',
                secureUrl: videoData.files?.[0]?.url || '',
                quality: videoData.files?.[0]?.quality || 'auto',
                size: videoData.size || 0,
                uploadTime: videoData.upload_time,
                tags: videoData.tags || [],
                isReady: videoData.status === 'ready'
            };

        } catch (error) {
            console.error(`❌ Error fetching VdoCipher video details: videoId=${videoId}`, error?.response?.data || error.message);
            
            if (error.response?.status === 404) {
                throw new Error('Video not found. Please verify the Video ID is correct.');
            } else if (error.response?.status === 403) {
                throw new Error('Access denied. Please check your VdoCipher API credentials.');
            } else if (error.message.includes('not ready')) {
                throw error; // Re-throw status validation errors
            }
            
            throw new Error(`Failed to fetch video details: ${error.message}`);
        }
    }

    // Helper method to get video metadata for already linked videos
    async getLinkedVideoMetadata(videoId) {
        try {
            //console.log(`📊 Fetching metadata for linked video: videoId=${videoId}`);
            
            const videoDetails = await this.getVideoDetails(videoId);
            
            return {
                videoId: videoDetails.videoId,
                title: videoDetails.title,
                description: videoDetails.description,
                status: videoDetails.status,
                duration: videoDetails.duration,
                thumbnail: videoDetails.thumbnail,
                secureUrl: videoDetails.secureUrl,
                quality: videoDetails.quality,
                size: videoDetails.size,
                isReady: videoDetails.isReady,
                lastChecked: new Date().toISOString()
            };

        } catch (error) {
            console.error(`❌ Error fetching linked video metadata: videoId=${videoId}`, error.message);
            throw error;
        }
    }

    // Main method to handle video operations - decides between upload vs link
    async handleVideoOperation(operationType, data) {
        try {
            if (operationType === 'link_existing') {
                // Pass userId explicitly
                return await this.linkExistingVideoSimple(data.videoId, { ...data, userId: data.userId });
            } else if (operationType === 'upload_new') {
                // For new file upload - handle separately
                throw new Error('File upload should be handled by upload service, not VdoCipherService');
            } else {
                throw new Error(`Unknown operation type: ${operationType}`);
            }
        } catch (error) {
            console.error(`❌ Error in handleVideoOperation: ${operationType}`, error.message);
            throw error;
        }
    }

    // Quick validation method for frontend
    async quickValidateVideoId(videoId) {
        try {
            //console.log(`⚡ Quick validation for videoId: ${videoId}`);
            
            const response = await axios.get(`${this.apiUrl}/videos/${videoId}`, {
                headers: {
                    'Authorization': `Apisecret ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000 // 10 second timeout for quick validation
            });

            const videoData = response.data;
            
            return {
                exists: true,
                videoId: videoData.id,
                title: videoData.title || 'Untitled Video',
                status: videoData.status,
                isReady: videoData.status === 'ready',
                duration: videoData.length || 0,
                thumbnail: videoData.poster || '',
                message: videoData.status === 'ready' 
                    ? 'Video is ready for linking' 
                    : `Video status: ${videoData.status} - can still be linked`
            };

        } catch (error) {
            console.error(`❌ Quick validation failed for videoId: ${videoId}`, error?.response?.data || error.message);
            
            if (error.response?.status === 404) {
                return {
                    exists: false,
                    message: 'Video not found. Please check the Video ID.'
                };
            } else if (error.response?.status === 403) {
                return {
                    exists: false,
                    message: 'Access denied. Please check API credentials.'
                };
            }
            
            return {
                exists: false,
                message: `Validation failed: ${error.message}`
            };
        }
    }
}

export default new VdoCipherService();