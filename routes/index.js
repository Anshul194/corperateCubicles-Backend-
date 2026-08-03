import express from "express";
import multer from "multer";
const router = express.Router();
import userRouter from "./userRoute.js";
import categoryRouter from "./CourseCategoryRouter.js";
import subCategoryRouter from "./SubCategoryRouter.js";
import coursePricingPlanRouter from "./coursePricingPlanRoutes.js";
import quizRouter from "./quizRouter.js";
import pricingPlanDiscountRouter from "./pricingPlanDiscountRouter.js";

import chunkRouter from "./chunkUpload.js"; // Import chunk upload routes
import courseRouter from "./CourseRouter.js";
import coursePlanRouter from "./coursePlanRoutes.js";
import moduleRouter from "./moduleRoutes.js";
import filterRouter from "./filterRoutes.js";
import lessonRouter from "./lesson.js";
import dripRouter from "./dripRouter.js";
import cartRouter from "./cartRouter.js";
import Textrouter from "./textLessonRouter.js";
import FileRouter from "./file-routes.js";
import assignmentRouter from "./assignmentRouter.js";
import Bundlerouter from "./courseBundleRouter.js";
import certificateRouter from "./certificateRoutes.js";
import VedioRouter from "./vedioRouter.js";
import forumRouter from "./forumRoutes.js";
import enrollmentRoutes from "./enrollmentRoutes.js";
import SupportTicket from "./supportTicketRoutes.js";
import checkoutRouter from "./checkoutRoutes.js";
import couponRouter from "./couponRoutes.js";
import assignmentSubmissionRoutes from "./assignmentSubmissionRoutes.js";
import analyticsRouter from "./analytics.js";
import securityRouter from "./security.js";
import vdocipherRouter from "./vdocipher.js";
import videoSessionRouter from "./videoSessions.js";
import faqRouter from "./faqRoutes.js";
import certificateTemplateRouter from "./certificateTemplateRouter.js";
import certificateAssignRouter from "./certificateAssign.js";
import ProgressRouter from "./progressRoutes.js";
import CertificateRouter from "./certificateRoutes.js";
import checkerRoute from "./checker.js"; // Assuming this is the drip checker route
import studentRouter from "./studentRoutes.js";
import adminStudentActivityRouter from "./adminStudentActivityRoutes.js";
import pagesRouter from "./pageRoutes.js";
import Completionrouter from "./courseCompletion.js";
import deleteAccountRequestRouter from "./deleteAccountRequestroutes.js";
import Salesrouter from "./sales-analytics.js";
import settingRouter from "./settingRoutes.js";
import chatRouter from "./chatRoutes.js"; // New chat routes
import eventRouter from "./eventRoutes.js";
import blogpostRouter from "./blogPostRouter.js";
import leaderboardRouter from "./leaderboardRoutes.js";
import dashboardRouter from "./dashboardRoutes.js";
import newsRouter from "./newsRoutes.js";
import aiRouter from "./aiRoutes.js";
import { uploadEditorImage } from "../controllers/newsController.js";
import contentImageUpload from "../middlewares/contentImageUpload.js";
import { isAdmin } from "../middlewares/isAdmin.js";
import accessTokenAutoRefresh from "../middlewares/accessTokenAutoRefresh.js";
import passport from "passport";

import UserEngagementrouter from "./user-engagement-analytics.js";
import projectrouter from "./project-analytics.js";
import queryRouter from "./queryRoutes.js";
import notificationRouter from "./notification.js";
import job from "./jobPostRouter.js";
import testimonialRouter from "./testimonialRoutes.js";
import bannerRouter from "./bannerRoutes.js";
import personalityRouter from "./personalityRoutes.js";
import zoomRouter from "./zoomRoutes.js"; // Zoom router
import lapaasTicketRouter from "./lapaasTicketRoutes.js";
import aboutRouter from "./aboutRoutes.js";
import siteContentRouter from "./siteContentRoutes.js";
import quickLinkRouter from "./quickLinkRoutes.js";
import roleRouter from "./roleRoutes.js";
import { Route } from "express";

router.get("/", (req, res) => {
  res.send("Hello World!");
});

// User routes
router.use("/", userRouter);
// Student routes
router.use("/students", studentRouter);
// Admin-only student activity feeds (admin panel StudentDetail page)
router.use("/admin/students", adminStudentActivityRouter);

router.use("/coursecategories", categoryRouter);
router.use("/subcategories", subCategoryRouter);
router.use("/courses", courseRouter);
router.use("/course-plans", coursePlanRouter);
router.use("/modules", moduleRouter);
router.use("/filter", filterRouter);
router.use("/pricing-plans", coursePricingPlanRouter);
router.use("/lesson", lessonRouter);
router.use("/drip", dripRouter);
router.use("/cart", cartRouter);
router.use("/text-lesson", Textrouter);
router.use("/files", FileRouter);
router.use("/assignment", assignmentRouter);
router.use("/bundle", Bundlerouter);
router.use("/certificate", certificateRouter);
router.use("/video", VedioRouter);
router.use("/forum", forumRouter);
router.use("/enrollment", enrollmentRoutes);
router.use("/support-tickets", SupportTicket);
router.use("/coupons", couponRouter);
router.use("/checkout", checkoutRouter);
router.use("/quiz", quizRouter);
router.use("/pricing-plan-discounts", pricingPlanDiscountRouter);
router.use("/assignment-submissions", assignmentSubmissionRoutes);
router.use("/analytics", analyticsRouter);
router.use("/security", securityRouter);
router.use("/vdocipher", vdocipherRouter);
router.use("/video-sessions", videoSessionRouter);
router.use("/faqs", faqRouter);
router.use("/certificate-templates", certificateTemplateRouter);
router.use("/assign-certificate", certificateAssignRouter);
router.use("/", ProgressRouter);
router.use("/certificates", CertificateRouter);
router.use("/drip", checkerRoute); // Drip checker route
router.use("/pages", pagesRouter);
router.use("/course-completion", Completionrouter);
router.use("/delete-account", deleteAccountRequestRouter);
router.use("/settings", settingRouter);

router.use("/sales-analytics", Salesrouter); // Drip checker route
router.use("/chunk", chunkRouter); // Chunk upload routes
router.use("/jobs", job); // Job post routes
router.use("/", testimonialRouter);

router.use("/user-engagement-analytics", UserEngagementrouter);
router.use("/project-analytics", projectrouter); // Project analytics route
router.use("/queries", queryRouter);
router.use("/notifications", notificationRouter);
router.use("/chat", chatRouter); // Add chat routes
router.use("/ai", aiRouter); // Add AI chat routes
router.use("/blogposts", blogpostRouter); // Add blog post routes
router.use("/events", eventRouter); // Add event routes
router.use("/leaderboard", leaderboardRouter); // Add leaderboard routes
router.use("/dashboard", dashboardRouter); // Add user dashboard route
router.use("/banners", bannerRouter); // Add banner routes
router.use("/quick-links", quickLinkRouter);
router.use("/news", newsRouter); // Add news routes
router.use("/personality", personalityRouter); // Add personality test routes
router.use("/zoom", zoomRouter); // Zoom routes
router.use("/lapaas-ticket", lapaasTicketRouter); // LapaasOS ticket ingestion
router.use("/", aboutRouter); // About & Team routes
router.use("/site-content", siteContentRouter); // Site content routes
router.use("/roles", roleRouter); // Role, permission & module management routes

// Image upload route for EditorJS (requires authentication)
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: 0,
        message: "File too large. Maximum size is 10MB",
      });
    }
    return res.status(400).json({
      success: 0,
      message: err.message || "File upload error",
    });
  }
  if (err) {
    return res.status(400).json({
      success: 0,
      message: err.message || "File upload error",
    });
  }
  next();
};

router.post(
  "/images",
  accessTokenAutoRefresh,
  passport.authenticate("jwt", { session: false }),
  isAdmin,
  contentImageUpload.single("image"),
  handleMulterError,
  uploadEditorImage
);

export default router;
