import express from 'express';
import multer from 'multer';
import {
  createEnrollment,
  getAllEnrollments,
  getEnrollmentById,
  deleteEnrollment,
  updateEnrollment,
  adminEnrollStudent,
  createFreeEnrollment,
  removeEnrollmentAndUpdateCourse,
  updateAccessExpiry
} from '../controllers/enrollmentController.js';
import { bulkEnrollFromExcel, enrollFromMigration, bulkEnrollSpecial } from '../controllers/bulkEnrollmentController.js';
import accessTokenAutoRefresh from '../middlewares/accessTokenAutoRefresh.js';
import passport from 'passport';
import { isAdmin } from '../middlewares/isAdmin.js';

import enrollmentService from '../service/enrollmentService.js';

// In-memory multer for Excel uploads (no disk write needed)
const excelUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(xlsx|xls)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files (.xlsx / .xls) are accepted'), false);
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

const router = express.Router();

router.post(
  '/',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  createEnrollment
);
router.get(
  '/',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  getAllEnrollments
);


router.put(
  '/:id/access-expiry',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  updateAccessExpiry
);

router.get(
  '/:id',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  getEnrollmentById
);
router.delete(
  '/:id',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  deleteEnrollment
);
router.put(
  '/:id',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  updateEnrollment
);
router.post('/admin-enroll', accessTokenAutoRefresh, passport.authenticate('jwt', { session: false }), isAdmin, adminEnrollStudent);
router.post(
  '/free-enroll',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  createFreeEnrollment
); // New route for free enrollment
router.delete(
  '/:id/remove',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  removeEnrollmentAndUpdateCourse
); // <-- new route

/**
 * POST /enrollment/bulk-enroll
 * Admin only — upload an Excel sheet to bulk-enroll students into a course.
 * Body (multipart/form-data):
 *   file         – Excel file (.xlsx or .xls)
 *   courseId     – Target course ID
 *   planId       – Target course plan ID
 *   accessExpiry – (optional) ISO date string, defaults to 2026-09-10
 */
router.post(
  '/bulk-enroll',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  excelUpload.single('file'),
  bulkEnrollFromExcel
);

/**
 * POST /enrollment/bulk-enroll-special
 * Admin only — bulk-enroll into primary AND secondary course.
 */
router.post(
  '/bulk-enroll-special',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  excelUpload.single('file'),
  bulkEnrollSpecial
);

/**
 * POST /enrollment/migrate-enroll
 * Admin only — Auto-enroll students who have source-course/plan and 1+ month left.
 */
router.post(
  '/migrate-enroll',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  enrollFromMigration
);

// Get enrollments for a specific course (with auth)
router.get(
  '/courses/:courseId/enrollments',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
      const { courseId } = req.params;
      // You may want to validate ObjectId here
      const enrollments = await enrollmentService.getAllEnrollments({ courseId });
      res.status(200).json({
        success: true,
        message: 'Course enrollments fetched successfully',
        data: enrollments,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);


export default router;
