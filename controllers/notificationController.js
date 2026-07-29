import notificationService from "../service/notificationService.js";
import mongoose from "mongoose";

export const getAllNotifications = async (req, res) => {
  try {
    // user ID comes from JWT (passport sets req.user)
    const userId = req.user._id;

    const notifications = await notificationService.getAll(req.query, userId);

    return res.status(200).json({
      success: true,
      message: "✅ Notifications retrieved successfully",
      data: notifications,
      err: {},
    });
  } catch (err) {
    console.error("❌ Get All Notifications Error:", err);
    return res.status(500).json({
      success: false,
      message: err.message,
      data: {},
      err: err.message,
    });
  }
};
export const markNotificationsRead = async (req, res) => {
  try {
    const userId = req.user._id;
    // const deviceId = req.body.deviceId;

    const result = await notificationService.markAllRead(userId);

    return res.status(200).json({
      success: true,
      message: "✅ Notifications marked as read successfully",
      data: result,
      err: {},
    });
  } catch (err) {
    console.error("❌ Mark Notifications Read Error:", err);
    return res.status(500).json({
      success: false,
      message: err.message,
      data: {},
      err: err.message,
    });
  }
};

//markNotificationsReadSingle
export const markNotificationsReadSingle = async (req, res) => {
  try {
    const userId = req.user._id;
    const notificationId = req.params.id;

    const result = await notificationService.markSingleRead(userId, notificationId);

    return res.status(200).json({
      success: true,
      message: "✅ Notification marked as read successfully",
      data: result,
      err: {},
    });
  } catch (err) {
    console.error("❌ Mark Notification Read Error:", err);
    return res.status(500).json({
      success: false,
      message: err.message,
      data: {},
      err: err.message,
    });
  }
};

export const sendNotification = async (req, res) => {
  try {
    const adminUser = req.user;

    if (adminUser.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "❌ Only admins can send notifications",
      });
    }

    const { title, description, data, webPushLink } = req.body;

    if (!title || !description) {
      return res.status(400).json({
        success: false,
        message: "Title and description are required",
      });
    }

    // ✅ Handle uploaded image
    let notificationData = { title, description, ...data };
    if (req.file) {
      notificationData.image = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
    }

    // Send notification to all students
    const result = await notificationService.sendToAllStudents(notificationData, webPushLink);

    return res.status(200).json({
      success: true,
      message: `✅ Notification sent to ${result.sent} student(s)`,
      data: result,
    });
  } catch (err) {
    console.error("❌ Send Notification Error:", err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

export const sendNotificationToCourse = async (req, res) => {
  try {
    const adminUser = req.user;
    const { courseId } = req.params;

    if (adminUser.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "❌ Only admins can send notifications",
      });
    }

    if (!courseId) {
      return res.status(400).json({
        success: false,
        message: "❌ Course ID is required",
      });
    }

    const { title, description, data, webPushLink } = req.body;

    if (!title || !description) {
      return res.status(400).json({
        success: false,
        message: "Title and description are required",
      });
    }

    // ✅ Handle uploaded image
    let notificationData = { title, description, ...data };
    if (req.file) {
      notificationData.image = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
    }

    // Send notification to course students
    const result = await notificationService.sendToCourseStudents(courseId, notificationData, webPushLink);

    return res.status(200).json({
      success: true,
      message: `✅ Notification sent to ${result.sent} student(s) in course and ${result.savedNotifications} notifications saved to database`,
      data: {
        courseId,
        sent: result.sent,
        failed: result.failed,
        totalStudents: result.totalStudents,
        savedNotifications: result.savedNotifications,
        notificationIds: result.notificationIds
      },
    });
  } catch (err) {
    console.error("❌ Send Course Notification Error:", err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};