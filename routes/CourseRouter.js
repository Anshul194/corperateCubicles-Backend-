import express from 'express';
import multer from 'multer';
import { createCourse, getCourseById, getAllCourses, updateCourse, deleteCourse, getCourseContents, getCourseAttachments,getMyCourses,getCoursesByCategory,getCourseBySlug ,getAllCourseAttachments ,filterCourses, sortCourses, disableDripForUser, addContentSection, updateContentSection, deleteContentSection, reorderContentSections, getContentSections, updateCourseBranding, getCourseLandingPage, uploadCourseEditorImage, uploadCourseEditorVideo, addReview, deleteReview, updateReview } from '../controllers/CourseController.js';
// import { createCourse, getCourseById, getAllCourses, updateCourse, deleteCourse, getCourseContents, getCourseAttachments,getMyCourses  } from '../controllers/CourseController.js';
import accessTokenAutoRefresh from '../middlewares/accessTokenAutoRefresh.js';
import passport from 'passport';
import { isAdmin } from '../middlewares/isAdmin.js';
import isUserBanned from '../middlewares/isUserBanned.js';
import requireDeviceApproval from '../middlewares/requireDeviceApproval.js';
import courseContentImageUpload from '../middlewares/courseContentImageUpload.js';
import courseContentVideoUpload from '../middlewares/courseContentVideoUpload.js';

const courseRouter = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Ensure this directory exists
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});
const upload = multer({ storage });


courseRouter.get(
  '/my-courses',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isUserBanned,
  requireDeviceApproval,
  getMyCourses
);

// Add a review to a course
courseRouter.post(
  '/:courseId/reviews',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  isUserBanned,
  upload.single('image'),
  addReview
);

// Delete a review from a course
courseRouter.delete(
  '/:courseId/reviews/:reviewId',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  isUserBanned,
  deleteReview
);

// Update a review in a course
courseRouter.put(
  '/:courseId/reviews/:reviewId',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  isUserBanned,
  updateReview
);

// Create a course (admin or instructor)
courseRouter.post(
  '/',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  isUserBanned,
  upload.fields([
    { name: 'thumbnail', maxCount: 1 },
    { name: 'coverImage', maxCount: 1 },
    { name: 'mentorImage', maxCount: 1 },
    { name: 'certificateImage', maxCount: 1 },
    { name: 'verticalCarouselImage', maxCount: 1 },
    { name: 'featuredImageBanner', maxCount: 1 },
    // { name: 'demoVideo', maxCount: 1 }
  ]),

  createCourse
);

// Get all courses (public)
courseRouter.get('/contents', getCourseContents);

courseRouter.get('/filter', filterCourses);

courseRouter.get('/sort', sortCourses);
// courseRouter.get('/', getAllCourses);
courseRouter.get(
  '/',
  (req, res, next) => {
    passport.authenticate('jwt', { session: false }, (err, user) => {
      if (user) req.user = user;
      next();
    })(req, res, next);
  },
  getAllCourses
);



// Get a course by ID (public)
courseRouter.get('/:id', getCourseById);

courseRouter.get('/slug/:slug', getCourseBySlug);

courseRouter.get('/category/:categoryId', getCoursesByCategory);



//:courseId/attachments?type=video
// Get course attachments by course ID (public)
courseRouter.get('/:courseId/attachments', getCourseAttachments);
courseRouter.get('/:courseId/all-attachments', getAllCourseAttachments);
// courseRouter.get('/:courseId/all-attachments-new', getAllCourseAttachmentsNested);


// Update a course (admin or instructor)
courseRouter.put(
  '/:id',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  isUserBanned,
  upload.fields([
    { name: 'thumbnail', maxCount: 1 },
    { name: 'coverImage', maxCount: 1 },
    { name: 'mentorImage', maxCount: 1 },
    { name: 'certificateImage', maxCount: 1 },
    { name: 'verticalCarouselImage', maxCount: 1 },
    { name: 'featuredImageBanner', maxCount: 1 },
  ]),
  updateCourse
);

// Delete a course (admin or instructor, soft delete)
courseRouter.delete(
  '/:id',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  isUserBanned,
  deleteCourse
);

// Disable drip setting for a user on a course (admin/instructor only)
courseRouter.post(
  '/:courseId/disable-drip',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  isUserBanned,
  disableDripForUser
);

// ========== DYNAMIC CONTENT SECTION ROUTES ==========

// Get course landing page by slug (public)
courseRouter.get('/landing/:slug', getCourseLandingPage);

// Get all content sections for a course
courseRouter.get(
  '/:courseId/content-sections',
  getContentSections
);

// Add content section to course
courseRouter.post(
  '/:courseId/content-sections',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  isUserBanned,
  addContentSection
);

// Update content section
courseRouter.put(
  '/:courseId/content-sections/:sectionId',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  isUserBanned,
  updateContentSection
);

// Delete content section
courseRouter.delete(
  '/:courseId/content-sections/:sectionId',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  isUserBanned,
  deleteContentSection
);

// Reorder content sections
courseRouter.patch(
  '/:courseId/content-sections/reorder',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  isUserBanned,
  reorderContentSections
);

// Update course branding (colors, logos, highlights)
courseRouter.patch(
  '/:courseId/branding',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  isUserBanned,
  updateCourseBranding
);

// Error handler for multer errors
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: 0,
        message: 'File too large. Maximum size is 10MB.',
      });
    }
    return res.status(400).json({
      success: 0,
      message: err.message || 'File upload error',
    });
  }
  if (err) {
    return res.status(400).json({
      success: 0,
      message: err.message || 'File upload error',
    });
  }
  next();
};

// Upload image for course content editor (Editor.js)
courseRouter.post(
  '/images',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  courseContentImageUpload.single('image'),
  handleMulterError,
  uploadCourseEditorImage
);

// Upload video for course content editor (Editor.js)
courseRouter.post(
  '/videos',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  courseContentVideoUpload.single('video'),
  handleMulterError,
  uploadCourseEditorVideo
);

export default courseRouter;