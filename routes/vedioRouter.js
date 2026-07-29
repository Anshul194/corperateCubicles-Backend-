import express from 'express';
import passport from 'passport';
import videoLessonController from '../controllers/videoLessonController.js';
import path from 'path';
import fs from 'fs';
import vedioCypherService from '../service/platforms/videoCypherService.js';

import {upload} from '../middlewares/upload-middleware.js';
import accessTokenAutoRefresh from '../middlewares/accessTokenAutoRefresh.js';
import { isAdmin } from '../middlewares/isAdmin.js';


const VedioRouter = express.Router();

// Auth middleware chains
const requireAuth = [
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
];
const requireAdmin = [...requireAuth, isAdmin];


// Create video lesson with file upload
VedioRouter.post('/', ...requireAdmin, upload.single('video'), videoLessonController.createVideoLesson);

// Add to your routes
VedioRouter.get('/test-videocypher', async (req, res) => {
  try {
    
    const isValid = await vedioCypherService.validateApiKey();
    res.json({ 
      valid: isValid,
      apiKeySet: !!process.env.VIDEOCYPHER_API_KEY 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all video lessons
VedioRouter.get('/', ...requireAdmin, videoLessonController.getAllVideoLessons);

// Video streaming endpoint for manual uploads
VedioRouter.get('/stream/:filename', ...requireAuth, (req, res) => {
  const safeName = path.basename(req.params.filename);
  if (
    safeName !== req.params.filename ||
    safeName.includes('..') ||
    safeName.includes('/') ||
    safeName.includes('\\')
  ) {
    return res.status(400).json({ error: 'Invalid filename' });
  }
  const manualUploadService = require('../services/platforms/manualUploadService.js').default;
  manualUploadService.streamVideo(safeName, req, res);
});

// Thumbnail endpoint for manual uploads
VedioRouter.get('/thumbnail/:filename', ...requireAuth, (req, res) => {
  const safeName = path.basename(req.params.filename);
  if (
    safeName !== req.params.filename ||
    safeName.includes('..') ||
    safeName.includes('/') ||
    safeName.includes('\\')
  ) {
    return res.status(400).json({ error: 'Invalid filename' });
  }
  const thumbsRoot = path.resolve(process.env.MANUAL_UPLOAD_PATH || 'uploads/videos', 'thumbnails');
  const resolved = path.resolve(thumbsRoot, safeName);
  if (resolved !== thumbsRoot && !resolved.startsWith(thumbsRoot + path.sep)) {
    return res.status(400).json({ error: 'Invalid path' });
  }
  if (fs.existsSync(resolved)) {
    res.sendFile(resolved);
  } else {
    res.status(404).json({ error: 'Thumbnail not found' });
  }
});

// Get video lesson by ID
VedioRouter.get('/:id', ...requireAuth, videoLessonController.getVideoLesson);

// Get video lessons by lesson ID
VedioRouter.get('/lesson/:lessonId', ...requireAuth, videoLessonController.getVideoLessonsByLesson);

// Get video lessons by platform
VedioRouter.get('/platform/:platform', ...requireAdmin, videoLessonController.getVideoLessonsByPlatform);

// Get video lessons by status
VedioRouter.get('/status/:status', ...requireAdmin, videoLessonController.getVideoLessonsByStatus);

// Update video lesson
VedioRouter.put('/:id', ...requireAdmin, upload.single('video'), videoLessonController.updateVideoLesson);

// Update video status
VedioRouter.patch('/:id/status', ...requireAdmin, videoLessonController.updateVideoStatus);

// Delete video lesson
VedioRouter.delete('/:id', ...requireAdmin, videoLessonController.deleteVideoLesson);

export default VedioRouter;
