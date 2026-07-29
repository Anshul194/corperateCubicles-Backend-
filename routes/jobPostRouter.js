import express from 'express';
import {
  createJobPost,
  getAllJobPosts,
  getJobPostById,
  updateJobPost,
  deleteJobPost,
  submitProposal,
  getMyJobPosts,
  setAdminApprovalStatus // <-- add import
} from '../controllers/jobPostController.js';
import accessTokenAutoRefresh from '../middlewares/accessTokenAutoRefresh.js';
import canManageJobPosts from '../middlewares/canManageJobPosts.js';
import { isAdmin } from '../middlewares/isAdmin.js';
import passport from 'passport';
import { upload } from '../middlewares/upload-middleware.js';

const router = express.Router();

// Public routes
router.get('/', getAllJobPosts);
router.get('/category/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const { page = 1, limit = 10, status = 'active' } = req.query;
    
    // This would need to be implemented in your controller
    const jobs = await JobPost.find({ 
      category: new RegExp(category, 'i'),
      status: status 
    })
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: jobs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: jobs.length
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
router.get('/my-posts', accessTokenAutoRefresh, passport.authenticate('jwt', { session: false }), getMyJobPosts); // Moved before /:id
router.get('/:id', getJobPostById);

// Protected routes
router.use(accessTokenAutoRefresh);
router.use(passport.authenticate('jwt', { session: false }));

// Job post management
router.post('/', canManageJobPosts, upload.single('thumbnail'), createJobPost);
router.post('/:jobId/proposals', upload.single('cv'), submitProposal);
router.put('/:id', canManageJobPosts, upload.single('thumbnail'), updateJobPost);
router.delete('/:id', canManageJobPosts, deleteJobPost);

// Add admin approval route (admin only)
router.patch('/:id/admin-approval', isAdmin, setAdminApprovalStatus);

export default router;