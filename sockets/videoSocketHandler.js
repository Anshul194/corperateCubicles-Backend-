import { updateLessonProgressDirect } from '../controllers/ProgressController.js';
import { consumeRateLimit } from './socketGuards.js';

// Throttle window between accepted progress updates for the same user+lesson.
const PROGRESS_THROTTLE_MS = 30000; // 30 seconds

const videoSocketHandler = (socket) => {
  // Per-socket throttle state. Lives on the socket so it is garbage-collected
  // automatically on disconnect (no module-level Map to leak/scan).
  socket.data.lastProgressUpdate = socket.data.lastProgressUpdate || new Map();

  socket.on('video-progress', async (data) => {
    //console.log('Received video progress data:', data);

    // Per-socket token bucket. The per-lesson throttle below does not stop a
    // flood that varies lessonId (each of which costs an enrollment query).
    if (!consumeRateLimit(socket)) return;

    const { videoId, currentTime, duration, courseId, lessonId } = data;

    // SECURITY: never trust a client-supplied userId. Derive identity from the
    // JWT-authenticated socket established by the connection-level middleware.
    const userId = socket.user?._id;
    if (!userId) {
      return socket.emit('error', { message: 'Unauthorized' });
    }

    // Throttle updates per user/lesson.
    const progressCache = socket.data.lastProgressUpdate;
    const cacheKey = `${userId}-${lessonId || videoId}`;
    const lastUpdate = progressCache.get(cacheKey) || 0;
    const now = Date.now();

    if (now - lastUpdate < PROGRESS_THROTTLE_MS) {
      //console.log(`Progress update throttled for user ${userId}`);
      return;
    }

    progressCache.set(cacheKey, now);

    //console.log(`Received video progress from ${socket.id}:`, data);

    if (!videoId || currentTime === undefined) {
      return socket.emit('error', { message: 'Invalid progress data' });
    }

    try {
      // SECURITY: verify the authenticated user is actually enrolled in this
      // course before writing/upserting any progress. Prevents forging progress
      // and creating rows for courses the user is not enrolled in.
      if (courseId) {
        const CourseEnrollment = (await import('../models/CourseEnrollment.js')).default;
        const enrollment = await CourseEnrollment.findOne({
          userId,
          courseId,
          status: 'active'
        }).select('_id').lean();

        if (!enrollment) {
          return socket.emit('error', { message: 'Not enrolled in this course' });
        }
      }

      // Calculate progress percentage
      const progressPercentage = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

      // Use the lessonId if provided, otherwise fall back to videoId
      const targetLessonId = lessonId || videoId;

      // Call the direct service function with proper data structure
      const updateData = {
        watchTime: currentTime,
        currentPosition: currentTime,
        lastPosition: currentTime,
        progressPercentage: progressPercentage,
        sessionId: socket.id,
        videoDuration: duration,
        ...(progressPercentage > 80 && { completed: true })
      };

      const update = await updateLessonProgressDirect(
        userId,
        targetLessonId,
        courseId,
        updateData
      );

      //console.log(`Updated progress for video ${videoId}, user ${userId}`);

      socket.emit('progress-updated', {
        success: true,
        data: update,
      });
    } catch (err) {
      console.error('Socket DB update error:', err?.message);
      socket.emit('error', { message: 'Failed to update progress' });
    }
  });

  // // Handle video completion
  // socket.on('video-complete', async (data) => {
  //   //console.log('Received video completion data:', data);
    
  //   const { videoId, userId, duration, courseId, lessonId } = data;
    
  //   if (!videoId || !userId) {
  //     return socket.emit('error', { message: 'Invalid completion data' });
  //   }

  //   try {
  //     const targetLessonId = lessonId || videoId;
      
  //     const completionData = {
  //       watchTime: duration || 0,
  //       currentPosition: duration || 0,
  //       lastPosition: duration || 0,
  //       progressPercentage: 100,
  //       completed: true,
  //       completionPercentage: 100,
  //       sessionId: socket.id,
  //       videoDuration: duration
  //     };

  //     const update = await updateLessonProgressDirect(
  //       userId, 
  //       targetLessonId, 
  //       courseId, 
  //       completionData
  //     );

  //     //console.log(`Completed video ${videoId} for user ${userId}`);

  //     // Clear throttle cache for this user/lesson when video is completed
  //     const cacheKey = `${userId}-${targetLessonId}`;
  //     progressCache.delete(cacheKey);

  //     socket.emit('video-completed', {
  //       success: true,
  //       data: update,
  //     });
  //   } catch (err) {
  //     console.error('Socket completion error:', err?.message);
  //     socket.emit('error', { message: 'Failed to mark video as complete' });
  //   }
  // });

  // // Handle video pause/resume for more granular tracking
  // socket.on('video-pause', async (data) => {
  //   const { videoId, userId, currentTime, courseId, lessonId } = data;
    
  //   try {
  //     const targetLessonId = lessonId || videoId;
  //     const updateData = {
  //       lastPosition: currentTime,
  //       sessionId: socket.id
  //     };

  //     await updateLessonProgressDirect(userId, targetLessonId, courseId, updateData);
      
  //     socket.emit('video-paused', { success: true });
  //   } catch (err) {
  //     console.error('Socket pause error:', err?.message);
  //   }
  // });

  // // Handle video resume
  // socket.on('video-resume', async (data) => {
  //   const { videoId, userId, currentTime, courseId, lessonId } = data;
    
  //   try {
  //     const targetLessonId = lessonId || videoId;
  //     const updateData = {
  //       lastPosition: currentTime,
  //       sessionId: socket.id
  //     };

  //     await updateLessonProgressDirect(userId, targetLessonId, courseId, updateData);
      
  //     socket.emit('video-resumed', { success: true });
  //   } catch (err) {
  //     console.error('Socket resume error:', err?.message);
  //   }
  // });

  // // Handle video seek to update position
  // socket.on('video-seek', async (data) => {
  //   const { videoId, userId, currentTime, courseId, lessonId } = data;
    
  //   try {
  //     const targetLessonId = lessonId || videoId;
  //     const updateData = {
  //       lastPosition: currentTime,
  //       sessionId: socket.id
  //     };

  //     await updateLessonProgressDirect(userId, targetLessonId, courseId, updateData);
      
  //     socket.emit('video-seeked', { success: true });
  //   } catch (err) {
  //     console.error('Socket seek error:', err?.message);
  //   }
  // });

  // Clean up cache when socket disconnects
  socket.on('disconnect', () => {
    //console.log(`Socket disconnected: ${socket.id}`);

    // Throttle state lives on socket.data and is garbage-collected with the
    // socket; clear it explicitly to release memory promptly.
    if (socket.data?.lastProgressUpdate) {
      socket.data.lastProgressUpdate.clear();
    }
  });

  // Handle connection event
  socket.on('connect', () => {
    //console.log(`Socket connected: ${socket.id}`);
  });

  // Handle error events
  socket.on('error', (error) => {
    console.error(`Socket error for ${socket.id}:`, error);
  });
};

export default videoSocketHandler;