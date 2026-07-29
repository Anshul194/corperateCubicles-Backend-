import videoLessonRepository from '../repository/videoLessonRepository.js';
import videoCypherService from './platforms/videoCypherService.js';
import VdoCipherService from './VdoCipherService.js';
import youtubeService from './platforms/youtubeService.js';
import mongoose from 'mongoose';
import VideoLesson from '../models/video.js';
import fs from "fs";

class VideoLessonService {
  async createVideoLesson(data, videoFile = null) {
    try {
      if (!data.lessonId) {
        throw new Error('Lesson ID is required');
      }

      if (!data.sourcePlatform) {
        throw new Error('Source platform is required');
      }

      if (data.uploadedBy && !mongoose.isValidObjectId(data.uploadedBy)) {
        throw new Error('Invalid uploadedBy ID format');
      }

      const initialData = {
        ...data,
        status: 'processing',
        secureUrl: '',
        videoId: '',
        thumbnail: '',
      };

      const videoLesson = await videoLessonRepository.create(initialData);

      let uploadResult;

      try {
        switch (data.sourcePlatform) {
          case 'videocypher':
            // Check upload method for VdoCipher
            if (data.uploadMethod == 'existing_video_id') {
              uploadResult = await this.handleVdoCipherExistingVideo(data, videoLesson._id);
            } else {
              // Default to file upload
              uploadResult = await this.handleVideoCypherUpload(videoFile, data, videoLesson._id);
            }
            break;

          case 'youtube':
            //console.log('createVideoLesson data:', data);
            uploadResult = await this.handleYouTubeUpload(data, videoLesson._id);
            break;

          case 'external_link':
            uploadResult = await this.handleExternalLink(data, videoLesson._id);
            break;

          default:
            throw new Error('Unsupported platform');
        }

        const updatedVideoLesson = await videoLessonRepository.updateById(videoLesson._id, {
          secureUrl: uploadResult.secureUrl,
          videoId: uploadResult.videoId,
          thumbnail: uploadResult.thumbnail || '',
          status: 'ready',
          uploadMethod: data.uploadMethod || 'file',
          size: uploadResult.size || 0,
          duration: uploadResult.duration || 0,
          quality: uploadResult.quality || 'auto',
        });

        return {
          success: true,
          data: updatedVideoLesson,
          message: 'Video lesson created and uploaded successfully',
          uploadDetails: uploadResult,
        };
      } catch (uploadError) {
        await videoLessonRepository.updateStatus(videoLesson._id, 'failed');
        console.error('Upload error:', uploadError.message, uploadError);
        return {
          success: false,
          error: `Upload failed: ${uploadError.message}`,
          videoLessonId: videoLesson._id,
        };
      }
    } catch (error) {
      console.error('createVideoLesson error:', error.message, error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // New method to handle existing VdoCipher video linking
  async handleVdoCipherExistingVideo(data, videoLessonId) {
    try {
      //console.log(`🔗 Linking existing VdoCipher video: ${data.videoId}`);
      
      if (!data.videoId) {
        throw new Error('Video ID is required for existing video linking');
      }

      // Use the VdoCipherService to link existing video
      const linkedVideoData = await VdoCipherService.linkExistingVideoSimple(data.videoId, {
        lessonId: data.lessonId,
        title: data.title,
        description: data.description,
        quality: data.quality,
        userId: data.uploadedBy
      });

      //console.log('✅ VdoCipher video linked successfully:', linkedVideoData);

      return {
        videoId: linkedVideoData.videoId,
        secureUrl: linkedVideoData.secureUrl,
        embedUrl: linkedVideoData.embedUrl,
        thumbnail: linkedVideoData.thumbnail,
        duration: linkedVideoData.duration,
        size: linkedVideoData.size,
        quality: linkedVideoData.quality,
        status: linkedVideoData.status,
        platform: 'videocypher',
        uploadMethod: 'existing_video_id',
        isLinked: true
      };

    } catch (error) {
      console.error('❌ Error linking existing VdoCipher video:', error.message);
      throw new Error(`Failed to link existing video: ${error.message}`);
    }
  }

async handleVideoCypherUpload(videoFilePath, data, videoLessonId) {
  if (!videoFilePath) {
    throw new Error("Video file path is required for VideoCypher upload");
  }

  if (!fs.existsSync(videoFilePath)) {
    throw new Error(`Video file not found at path: ${videoFilePath}`);
  }

  const MAX_RETRIES = 3;
  let attempt = 0;
  let lastError = null;

  // RESOURCE LEAK FIX: the local file (multer upload or merged chunk file under
  // uploads/) exists only to be streamed to VdoCipher; once the upload flow ends
  // (success, VdoCipher API failure, or exception) nothing reads it again — the
  // DB stores VdoCipher-hosted URLs only. Delete it in a finally so every exit
  // path is covered. The retry loop re-reads the same path on each attempt, so
  // the unlink wraps the WHOLE loop, never an individual attempt.
  try {
    while (attempt < MAX_RETRIES) {
      try {
        //console.log(`🚀 Uploading to VideoCypher (attempt ${attempt + 1}/${MAX_RETRIES})`);

        const uploadResult = await videoCypherService.uploadVideo({
          file: { path: videoFilePath }, // Pass file path object
          title: data.title,
          description: data.description,
          folderId: process.env.VIDEOCYPHER_FOLDER_ID,
          timeout: 30 * 60 * 1000, // 30 minutes
          onProgress: (progress) => {
            //console.log(`Upload progress: ${progress}%`);
          },
        });

        //console.log("✅ VideoCypher uploadResult:", uploadResult);

        return {
          videoId: uploadResult.videoId,
          secureUrl: uploadResult.playbackUrl,
          thumbnail: uploadResult.thumbnail,
          platform: "videocypher",
          uploadMethod: "file"
        };
      } catch (error) {
        lastError = error;
        attempt++;

        if (error.response?.status === 524) {
          console.error(`⏳ Timeout on attempt ${attempt}. Retrying...`);
          if (attempt < MAX_RETRIES) {
            const waitTime = Math.min(1000 * Math.pow(2, attempt), 10000);
            await new Promise((r) => setTimeout(r, waitTime));
            continue;
          }
        }

        throw new Error(`Upload failed after ${attempt} attempts. Last error: ${lastError.message}`);
      }
    }
  } finally {
    await fs.promises.unlink(videoFilePath).catch((err) => {
      console.warn(`⚠️ Could not delete local upload ${videoFilePath}: ${err.message}`);
    });
  }
}


  async handleYouTubeUpload(data, videoLessonId) {
    try {
      if (!data.youtubeUrl) {
        throw new Error('YouTube URL is required');
      }

      //console.log('handleYouTubeUpload data:', data);

      const urlPattern = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
      if (!urlPattern.test(data.youtubeUrl)) {
        throw new Error('Invalid YouTube URL format');
      }

      const urlResult = await youtubeService.processYouTubeUrl({
        url: data.youtubeUrl,
        title: data.title,
        description: data.description,
        videoLessonId,
      });
      //console.log('urlResult:', urlResult);

      if (!urlResult || typeof urlResult !== 'object') {
        throw new Error('Failed to process YouTube URL: No result returned');
      }

      // const requiredFields = ['videoId', 'youtubeUrl', 'thumbnail', 'watchUrl'];
      // const missingFields = requiredFields.filter((field) => !urlResult[field]);
      // if (missingFields.length > 0) {
      //   throw new Error(`Failed to process YouTube URL: Missing fields - ${missingFields.join(', ')}`);
      // }

      const videoLesson = new VideoLesson({
        lessonId: videoLessonId,
        title: data.title,
        description: data.description,
        sourcePlatform: 'youtube',
        videoId: urlResult.videoId,
        secureUrl: urlResult.embedUrl,
        embedUrl: urlResult.embedUrl,
        originalUrl: data.embedUrl,
        thumbnail: urlResult.thumbnail,
        uploadedBy: data.uploadedBy || null,
        status: 'ready',
        isPublic: data.isPublic || false,
      });

      //console.log('videoLesson:', videoLesson);

      await videoLesson.save();

      return {
        videoId: urlResult.videoId,
        secureUrl: urlResult.watchUrl,
        embedUrl: urlResult.embedUrl,
        thumbnail: urlResult.thumbnail,
        platform: 'youtube',
        videoLessonId: videoLesson._id,
      };
    } catch (error) {
      console.error(`Error in handleYouTubeUpload: ${error.message}`, error);
      throw error;
    }
  }

  async handleExternalLink(data, videoLessonId) {
    if (!data.secureUrl) {
      throw new Error('External URL is required for external link platform');
    }

    const urlPattern = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
    if (!urlPattern.test(data.secureUrl)) {
      throw new Error('Invalid URL format');
    }

    return {
      videoId: data.videoId || 'external',
      secureUrl: data.secureUrl,
      thumbnail: data.thumbnail || '',
      platform: 'external_link',
    };
  }

  async getVideoLessonById(id) {
    try {
      //console.log("Finding video lesson by ID:", id);

      const videoLesson = await videoLessonRepository.findById(id);

      if (!videoLesson) {
        throw new Error('Video lesson not found');
      }

      return {
        success: true,
        data: videoLesson,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async getAllVideoLessons(filters = {}, options = {}) {
    try {
      const result = await videoLessonRepository.findAll(filters, options);

      return {
        success: true,
        data: result.data,
        pagination: result.pagination,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async getVideoLessonsByLessonId(lessonId) {
    try {
      if (!mongoose.isValidObjectId(lessonId)) {
        throw new Error('Invalid lesson ID format');
      }

      const videoLessons = await videoLessonRepository.findByLessonId(lessonId);

      return {
        success: true,
        data: videoLessons,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async getVideoLessonsByPlatform(platform) {
    try {
      const validPlatforms = ['videocypher', 'youtube', 'external_link'];

      if (!validPlatforms.includes(platform)) {
        throw new Error('Invalid source platform');
      }

      const videoLessons = await videoLessonRepository.findByPlatform(platform);

      return {
        success: true,
        data: videoLessons,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

 async updateVideoLesson(id, updateData, videoFilePath) {
  try {
    const videoLesson = await videoLessonRepository.findById(id);
    if (!videoLesson) throw new Error("Video lesson not found");

    // Handle VdoCipher video updates
    if (videoLesson.sourcePlatform === "videocypher") {
      // Check if updating with existing video ID
      if (updateData.uploadMethod === 'existing_video_id' && updateData.videoId) {
        //console.log(`🔗 Updating with existing VdoCipher video: ${updateData.videoId}`);
        
        const linkedVideoData = await VdoCipherService.linkExistingVideoSimple(updateData.videoId, {
          lessonId: videoLesson.lessonId,
          title: updateData.title || videoLesson.title,
          description: updateData.description || videoLesson.description,
          quality: updateData.quality || videoLesson.quality,
          userId: updateData.uploadedBy || videoLesson.uploadedBy
        });

        updateData.secureUrl = linkedVideoData.secureUrl;
        updateData.videoId = linkedVideoData.videoId;
        updateData.thumbnail = linkedVideoData.thumbnail;
        updateData.status = linkedVideoData.status;
        updateData.uploadMethod = 'existing_video_id';
        updateData.duration = linkedVideoData.duration;
        updateData.size = linkedVideoData.size;
        updateData.quality = linkedVideoData.quality;
      }
      // Handle file replacement
      else if (videoFilePath) {
        if (!fs.existsSync(videoFilePath)) {
          throw new Error(`Video file not found at path: ${videoFilePath}`);
        }

        // RESOURCE LEAK FIX: as in handleVideoCypherUpload, the local file is
        // only the source stream for the VdoCipher upload — delete it once the
        // upload has succeeded or failed (finally covers both exit paths).
        try {
          // Delete old video if it exists
          if (videoLesson.videoId) {
            try {
              await videoCypherService.deleteVideo(videoLesson.videoId);
            } catch (e) {
              console.warn("Delete failed, continuing:", e.message);
            }
          }

          const uploadResult = await videoCypherService.uploadVideo({
            file: { path: videoFilePath },
            title: updateData.title || videoLesson.title,
            description: updateData.description || videoLesson.description,
            folderId: process.env.VIDEOCYPHER_FOLDER_ID,
          });

          updateData.secureUrl = uploadResult.playbackUrl;
          updateData.videoId = uploadResult.videoId;
          updateData.thumbnail = uploadResult.thumbnail || "";
          updateData.status = "ready";
          updateData.uploadMethod = "file";
        } finally {
          await fs.promises.unlink(videoFilePath).catch((err) => {
            console.warn(`⚠️ Could not delete local upload ${videoFilePath}: ${err.message}`);
          });
        }
      }
    } else {
      //console.log(`ℹ️ No new video file provided for update`);
    }

    updateData.updatedAt = new Date();

    //console.log(`💾 Updating video lesson in repository with data:`, updateData);
    const updatedVideoLesson = await videoLessonRepository.updateById(id, updateData);
    //console.log(`✅ Video lesson updated successfully:`, updatedVideoLesson);

    return {
      success: true,
      data: updatedVideoLesson,
      message: 'Video lesson updated successfully'
    };
  } catch (error) {
    console.error('❌ Error in updateVideoLesson:', error.message, error);
    return {
      success: false,
      error: error.message
    };
  }
}

  async deleteVideoLesson(id) {
    try {
      if (!mongoose.isValidObjectId(id)) {
        throw new Error('Invalid video lesson ID format');
      }

      const exists = await videoLessonRepository.exists(id);
      if (!exists) {
        throw new Error('Video lesson not found');
      }

      await videoLessonRepository.deleteById(id);

      return {
        success: true,
        message: 'Video lesson deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async updateVideoStatus(id, status) {
    try {
      if (!mongoose.isValidObjectId(id)) {
        throw new Error('Invalid video lesson ID format');
      }

      const validStatuses = ['processing', 'ready', 'failed'];
      if (!validStatuses.includes(status)) {
        throw new Error('Invalid status');
      }

      const exists = await videoLessonRepository.exists(id);
      if (!exists) {
        throw new Error('Video lesson not found');
      }

      const updatedVideoLesson = await videoLessonRepository.updateStatus(id, status);

      return {
        success: true,
        data: updatedVideoLesson,
        message: 'Video status updated successfully',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async getVideoLessonsByStatus(status) {
    try {
      const validStatuses = ['processing', 'ready', 'failed'];
      if (!validStatuses.includes(status)) {
        throw new Error('Invalid status');
      }

      const videoLessons = await videoLessonRepository.findByStatus(status);

      return {
        success: true,
        data: videoLessons,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

export default new VideoLessonService();