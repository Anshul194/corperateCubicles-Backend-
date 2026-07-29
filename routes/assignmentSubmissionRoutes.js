import express from "express";
import { upload } from "../middlewares/upload-middleware.js";
import passport from "passport";
import accessTokenAutoRefresh from "../middlewares/accessTokenAutoRefresh.js";
import { isAdmin } from "../middlewares/isAdmin.js";
import {
  submitAssignment,
  getMySubmissions,
  getMySubmissionByAssignment,
  getAllSubmissionsForAssignment,
  gradeSubmission,
  deleteSubmission,
  getAllSubmissions,
  getSubmissionById,
} from "../controllers/assignmentSubmissionController.js";

const router = express.Router();

router.post(
  "/",
  upload.single("submissionFile"),
  accessTokenAutoRefresh,
  passport.authenticate("jwt", { session: false }),
  submitAssignment
);

router.get(
  "/my",
  accessTokenAutoRefresh,
  passport.authenticate("jwt", { session: false }),
  getMySubmissions
);

router.get(
  "/my/:assignmentId",
  accessTokenAutoRefresh,
  passport.authenticate("jwt", { session: false }),
  getMySubmissionByAssignment
);

router.get(
  "/byID/:id",
  accessTokenAutoRefresh,
  passport.authenticate("jwt", { session: false }),
  isAdmin,
  getSubmissionById
);

router.put(
  "/:id/grade",
  accessTokenAutoRefresh,
  passport.authenticate("jwt", { session: false }),
  isAdmin,
  gradeSubmission
);

router.delete(
  "/:id",
  accessTokenAutoRefresh,
  passport.authenticate("jwt", { session: false }),
  isAdmin,
  deleteSubmission
);

router.get(
  "/",
  accessTokenAutoRefresh,
  passport.authenticate("jwt", { session: false }),
  isAdmin,
  getAllSubmissions
);

export default router;
