import express from 'express';
import {
  createBlogPost,
  getAllBlogPosts,
  getBlogPostById,
  updateBlogPost,
  deleteBlogPost
} from '../controllers/blogPostController.js';
import accessTokenAutoRefresh from '../middlewares/accessTokenAutoRefresh.js';
import { isAdmin } from '../middlewares/isAdmin.js';
import passport from 'passport';
import { upload } from '../middlewares/upload-middleware.js';

const router = express.Router();

// Public routes
router.get('/', getAllBlogPosts);
router.get('/:id', getBlogPostById);

// Protected routes
router.use(accessTokenAutoRefresh);
router.use(passport.authenticate('jwt', { session: false }));

// Blog post management (admin only)
router.post('/', isAdmin, upload.single('thumbnail'), createBlogPost);
router.put('/:id', isAdmin, upload.single('thumbnail'), updateBlogPost);
router.delete('/:id', isAdmin, deleteBlogPost);

export default router;