import express from "express";
import { getAllNotifications, markNotificationsRead,markNotificationsReadSingle,sendNotification, sendNotificationToCourse} from "../controllers/notificationController.js";
import accessTokenAutoRefresh from "../middlewares/accessTokenAutoRefresh.js";
import passport from "passport";
import { isAdmin } from "../middlewares/isAdmin.js";
import { upload } from "../middlewares/upload-middleware.js";
import mongoose from "mongoose";
import Notification from "../models/Notifications.js";

const notificationRouter = express.Router();

// ✅ Get only logged-in user's unread notifications
notificationRouter.get(
  "/",
  accessTokenAutoRefresh,
  passport.authenticate("jwt", { session: false }),
  getAllNotifications
);
notificationRouter.put(
  "/mark-read",
  accessTokenAutoRefresh,
  passport.authenticate("jwt", { session: false }),
  markNotificationsRead
);


notificationRouter.put(
  "/mark-read/:id",
  accessTokenAutoRefresh,
  passport.authenticate("jwt", { session: false }),
  markNotificationsReadSingle
);

notificationRouter.post(
  "/send",
  accessTokenAutoRefresh,
  passport.authenticate("jwt", { session: false }),
  isAdmin,
  upload.single("image"), // single image upload
  sendNotification
);

// ✅ Send bulk notification to specific course students
notificationRouter.post(
  "/send-to-course/:courseId",
  accessTokenAutoRefresh,
  passport.authenticate("jwt", { session: false }),
  isAdmin,
  upload.single("image"), // single image upload
  sendNotificationToCourse
);

// ✅ Get notifications for a specific course
notificationRouter.get(
  "/course/:courseId",
  accessTokenAutoRefresh,
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    try {
      const userId = req.user._id;
      const { courseId } = req.params;

      if (!mongoose.isValidObjectId(courseId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid course ID format",
        });
      }

      // Get notifications specific to this course for the user
      const notifications = await Notification.find({
        user_id: userId,
        "data.courseId": courseId
      }).sort({ created_at: -1 });

      return res.status(200).json({
        success: true,
        message: "✅ Course notifications retrieved successfully",
        data: {
          courseId,
          notifications,
          total: notifications.length
        },
      });
    } catch (err) {
      console.error("❌ Get Course Notifications Error:", err);
      return res.status(500).json({
        success: false,
        message: err.message,
      });
    }
  }
);

// ✅ Get notification statistics for a course (admin only)
notificationRouter.get(
  "/course/:courseId/stats",
  accessTokenAutoRefresh,
  passport.authenticate("jwt", { session: false }),
  isAdmin,
  async (req, res) => {
    try {
      const { courseId } = req.params;

      if (!mongoose.isValidObjectId(courseId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid course ID format",
        });
      }

      // Get notification statistics for this course
      const totalNotifications = await Notification.countDocuments({
        "data.courseId": courseId
      });

      const unreadNotifications = await Notification.countDocuments({
        "data.courseId": courseId,
        status: 1
      });

      const readNotifications = await Notification.countDocuments({
        "data.courseId": courseId,
        status: 0
      });

      return res.status(200).json({
        success: true,
        message: "✅ Course notification statistics retrieved successfully",
        data: {
          courseId,
          totalNotifications,
          unreadNotifications,
          readNotifications,
          readRate: totalNotifications > 0 ? ((readNotifications / totalNotifications) * 100).toFixed(2) + '%' : '0%'
        },
      });
    } catch (err) {
      console.error("❌ Get Course Notification Stats Error:", err);
      return res.status(500).json({
        success: false,
        message: err.message,
      });
    }
  }
);

// ✅ Get ALL notifications in the system (admin only)
notificationRouter.get(
  "/admin/all",
  accessTokenAutoRefresh,
  passport.authenticate("jwt", { session: false }),
  isAdmin,
  async (req, res) => {
    try {
      const { page = 1, limit = 20, status, courseId, userId, type } = req.query;
      const pageNum = Math.max(parseInt(page) || 1, 1);
      const limitNum = Math.min(Math.max(parseInt(limit) || 20, 1), 100);
      const skip = (pageNum - 1) * limitNum;

      // Build filter conditions
      const filter = {};
      
      if (status !== undefined) {
        filter.status = parseInt(status);
      }
      
      if (courseId && mongoose.isValidObjectId(courseId)) {
        filter["data.courseId"] = courseId;
      }
      
      if (userId && mongoose.isValidObjectId(userId)) {
        filter.user_id = new mongoose.Types.ObjectId(userId);
      }
      
      if (type) {
        filter["data.type"] = type;
      }

      // Get notifications with pagination
      const notifications = await Notification.find(filter)
        .populate("user_id", "name email role")
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean();

      // Get total count
      const total = await Notification.countDocuments(filter);

      return res.status(200).json({
        success: true,
        message: "✅ All notifications retrieved successfully",
        data: {
          notifications,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum),
            hasNext: pageNum < Math.ceil(total / limitNum),
            hasPrev: pageNum > 1
          },
          filters: {
            status,
            courseId,
            userId,
            type
          }
        },
      });
    } catch (err) {
      console.error("❌ Get All Notifications (Admin) Error:", err);
      return res.status(500).json({
        success: false,
        message: err.message,
      });
    }
  }
);

// ✅ Get notification statistics for entire system (admin only)
notificationRouter.get(
  "/admin/stats",
  accessTokenAutoRefresh,
  passport.authenticate("jwt", { session: false }),
  isAdmin,
  async (req, res) => {
    try {
      const totalNotifications = await Notification.countDocuments();
      const unreadNotifications = await Notification.countDocuments({ status: 1 });
      const readNotifications = await Notification.countDocuments({ status: 0 });
      
      // Get notifications by type
      const typeStats = await Notification.aggregate([
        {
          $group: {
            _id: "$data.type",
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } }
      ]);

      // Get recent notifications (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const recentNotifications = await Notification.countDocuments({
        created_at: { $gte: sevenDaysAgo }
      });

      // Get notifications by course (top 10)
      const courseStats = await Notification.aggregate([
        {
          $match: {
            "data.courseId": { $exists: true, $ne: null }
          }
        },
        {
          $group: {
            _id: "$data.courseId",
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]);

      return res.status(200).json({
        success: true,
        message: "✅ System notification statistics retrieved successfully",
        data: {
          overview: {
            totalNotifications,
            unreadNotifications,
            readNotifications,
            readRate: totalNotifications > 0 ? ((readNotifications / totalNotifications) * 100).toFixed(2) + '%' : '0%',
            recentNotifications
          },
          typeBreakdown: typeStats,
          topCourses: courseStats
        },
      });
    } catch (err) {
      console.error("❌ Get System Notification Stats Error:", err);
      return res.status(500).json({
        success: false,
        message: err.message,
      });
    }
  }
);

// ✅ Delete notification(s) (admin only)
notificationRouter.delete(
  "/admin/:notificationId",
  accessTokenAutoRefresh,
  passport.authenticate("jwt", { session: false }),
  isAdmin,
  async (req, res) => {
    try {
      const { notificationId } = req.params;

      if (!mongoose.isValidObjectId(notificationId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid notification ID format",
        });
      }

      const deletedNotification = await Notification.findByIdAndDelete(notificationId);

      if (!deletedNotification) {
        return res.status(404).json({
          success: false,
          message: "Notification not found",
        });
      }

      return res.status(200).json({
        success: true,
        message: "✅ Notification deleted successfully",
        data: {
          deletedNotification: {
            id: deletedNotification._id,
            title: deletedNotification.data?.title,
            type: deletedNotification.data?.type
          }
        },
      });
    } catch (err) {
      console.error("❌ Delete Notification Error:", err);
      return res.status(500).json({
        success: false,
        message: err.message,
      });
    }
  }
);


export default notificationRouter;
