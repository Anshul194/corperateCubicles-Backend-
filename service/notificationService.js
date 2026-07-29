import Notification from "../models/Notifications.js";
import FcmToken from "../models/fcmTokens.js";
import fcmService from "../utils/notificationService.js";
import Enrollment from "../models/CourseEnrollment.js";
import User from "../models/user.js";
import mongoose from "mongoose";

class NotificationService {

  async getAll(query, userId) {
    try {
      const { page = 1, limit = 10, sort = "{}" } = query;
      const pageNum = Math.max(parseInt(page) || 1, 1);
      const limitNum = Math.max(parseInt(limit) || 10, 1);
      const skip = (pageNum - 1) * limitNum;

      let parsedSort = {};
      try {
        parsedSort = JSON.parse(sort);
      } catch (err) {
        console.warn("⚠️ Invalid JSON for sort");
      }

      // ✅ Build match condition safely
      const matchConditions = {
        $or: [
          ...(userId ? [{ user_id: mongoose.isValidObjectId(userId) ? userId : new mongoose.Types.ObjectId(userId) }] : []),
          { user_id: null } // admin notifications
        ]
      };

      //console.log("🔍 Match conditions for notifications:", matchConditions);

      const pipeline = [{ $match: matchConditions }];

      // Sorting
      if (Object.keys(parsedSort).length > 0) {
        const sortStage = {};
        for (const [key, val] of Object.entries(parsedSort)) {
          sortStage[key] = val === "asc" ? 1 : -1;
        }
        pipeline.push({ $sort: sortStage });
      } else {
        pipeline.push({ $sort: { created_at: -1 } });
      }

      // Add isRead field based on status (status: 0 = read, status: 1 = unread)
      pipeline.push({
        $addFields: {
          isRead: { $eq: ["$status", 0] } // true if status is 0 (read), false if status is 1 (unread)
        }
      });

      // Pagination
      pipeline.push({
        $facet: {
          data: [{ $skip: skip }, { $limit: limitNum }],
          count: [{ $count: "total" }],
        },
      });

      const [result] = await Notification.aggregate(pipeline);

      const notifications = result?.data || [];
      const total = result?.count[0]?.total || 0;

      //console.log(`📌 Notifications fetched: ${notifications.length}, Total: ${total}`);

      return {
        result: notifications,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      };
    } catch (error) {
      console.error("❌ Error fetching notifications:", error.message);
      throw new Error("Cannot fetch notifications");
    }
  }



   async markAllRead(userId, deviceId) {
    try {
      const result = await Notification.updateMany(
        {
          $or: [
        { user_id: userId }
        // { device_id: deviceId }
          ],
          status: 1 // Fix: looking for unread notifications (1)
        },
        { $set: { status: 0 } } // Fix: setting to read (0)
      );

      return {
        matched: result.matchedCount,
        modified: result.modifiedCount,
      };
    } catch (error) {
      console.error("❌ Error marking notifications as read:", error.message);
      throw new Error("Cannot mark notifications as read");
    }
  }

  //markSingleRead
  async markSingleRead(userId, notificationId) {
    try {
      const result = await Notification.updateOne(
        {
          user_id: userId,
          _id: notificationId,
          status: 1 // Fix: looking for unread notification (1)
        },
        { $set: { status: 0 } } // Fix: setting to read (0)
      );
      return {
        matched: result.matchedCount,
        modified: result.modifiedCount,
      };
    } catch (error) {
      console.error("❌ Error marking notification as read:", error.message);
      throw new Error("Cannot mark notification as read");
    } 
  }
  
async sendToAllStudents(data, webPushLink = null) {
  try {
    console.log("🔥 sendToAllStudents called with data:", data);

    // 1️⃣ Fetch all FCM tokens
    const tokens = await FcmToken.find({}).select("token userId deviceId updatedAt -_id");
    console.log(`🟢 Total tokens fetched: ${tokens.length}`);

    if (!tokens || tokens.length === 0) {
      console.warn("⚠️ No students with FCM tokens found");
      return { success: false, message: "No students with FCM tokens found", sent: 0, failed: 0 };
    }

    // Group by deviceId+token combination and keep only the latest user for each device
    const deviceTokensMap = new Map();
    
    tokens.forEach(t => {
      if (t.token && t.deviceId) {
        const deviceKey = `${t.deviceId}_${t.token}`;
        
        if (!deviceTokensMap.has(deviceKey)) {
          deviceTokensMap.set(deviceKey, t);
        } else {
          // Keep the token with the latest updatedAt
          const existing = deviceTokensMap.get(deviceKey);
          if (new Date(t.updatedAt) > new Date(existing.updatedAt)) {
            deviceTokensMap.set(deviceKey, t);
          }
        }
      }
    });

    console.log(`🟢 Found ${deviceTokensMap.size} unique devices with latest users to notify`);

    let sent = 0;
    let failed = 0;

    // 2️⃣ Send FCM notifications and save to database (one per device, latest user)
    const sendPromises = Array.from(deviceTokensMap.values()).map(async deviceToken => {
      try {
        const res = await fcmService.sendPushNotification([deviceToken.token], data, webPushLink);

        // Check response and save notification only if FCM was successful
        if (res.responses && res.responses[0]) {
          if (res.responses[0].success) {
            // Save notification to database after successful FCM send
            const notification = new Notification({
              user_id: deviceToken.userId,
              device_id: deviceToken.deviceId,
              data: {
                ...data,
                type: data.type || "general_notification"
              },
              status: 1, // 1 = unread (correct)
            });
            await notification.save();

            sent++;
            console.log(`✅ Notification sent and saved for device: ${deviceToken.deviceId}, latest user: ${deviceToken.userId}, updated: ${deviceToken.updatedAt}`);
          } else {
            failed++;
            console.log(`❌ Notification FAILED for device: ${deviceToken.deviceId}, error: ${res.responses[0].error?.message}`);

            // Remove invalid FCM token automatically
            if (res.responses[0].error?.code === "messaging/registration-token-not-registered") {
              await FcmToken.deleteMany({ token: deviceToken.token });
              console.log(`🗑 Removed invalid token for device: ${deviceToken.deviceId}`);
            }
          }
        } else {
          failed++;
          console.warn(`⚠️ Unknown FCM response for device: ${deviceToken.deviceId}`);
        }
      } catch (err) {
        failed++;
        console.error(`❌ FCM ERROR for device: ${deviceToken.deviceId}`, err.message);
      }
    });

    await Promise.all(sendPromises);

    console.log(`📡 FCM sending finished. Total sent: ${sent}, Failed: ${failed}, Unique devices: ${deviceTokensMap.size}`);
    return { success: true, sent, failed, uniqueDevices: deviceTokensMap.size };

  } catch (err) {
    console.error("❌ Error sending notification to all students:", err);
    throw new Error("Cannot send notification to all students");
  }
}

async sendToCourseStudents(courseId, data, webPushLink = null) {
  try {
    console.log("🔥 sendToCourseStudents called with courseId:", courseId, "data:", data);

    // 1️⃣ Validate courseId
    if (!mongoose.isValidObjectId(courseId)) {
      throw new Error("Invalid course ID format");
    }

    // 2️⃣ Get all enrolled students for the specific course
    const enrollments = await Enrollment.find({ 
      courseId: new mongoose.Types.ObjectId(courseId) 
    }).select("userId").lean();

    console.log(`🟢 Found ${enrollments.length} enrollments for course ${courseId}`);

    if (!enrollments || enrollments.length === 0) {
      return { 
        success: false, 
        message: "No students enrolled in this course",
        sent: 0,
        failed: 0,
        totalStudents: 0
      };
    }

    // 3️⃣ Extract user IDs
    const userIds = enrollments.map(e => e.userId);

    // 4️⃣ Get FCM tokens for enrolled students only
    const tokens = await FcmToken.find({
      userId: { $in: userIds }
    }).select("token userId deviceId updatedAt -_id");

    console.log(`🟢 Found ${tokens.length} FCM tokens for enrolled students`);

    if (!tokens || tokens.length === 0) {
      console.warn("⚠️ No enrolled students with FCM tokens found for this course");
      return { 
        success: false, 
        message: "No enrolled students with FCM tokens found for this course",
        sent: 0,
        failed: 0,
        totalStudents: enrollments.length
      };
    }

    // Group by deviceId+token combination and keep only the latest user for each device
    const deviceTokensMap = new Map();
    
    tokens.forEach(t => {
      if (t.token && t.deviceId) {
        const deviceKey = `${t.deviceId}_${t.token}`;
        
        if (!deviceTokensMap.has(deviceKey)) {
          deviceTokensMap.set(deviceKey, t);
        } else {
          // Keep the token with the latest updatedAt
          const existing = deviceTokensMap.get(deviceKey);
          if (new Date(t.updatedAt) > new Date(existing.updatedAt)) {
            deviceTokensMap.set(deviceKey, t);
          }
        }
      }
    });

    console.log(`🟢 Found ${deviceTokensMap.size} unique devices for enrolled students to notify`);

    let sent = 0;
    let failed = 0;
    const savedNotifications = [];

    // 5️⃣ Send FCM notifications to course students and save to database (one per device, latest user)
    const sendPromises = Array.from(deviceTokensMap.values()).map(async deviceToken => {
      try {
        const courseNotificationData = {
          ...data,
          courseId: courseId,
          type: "course_notification"
        };

        const res = await fcmService.sendPushNotification([deviceToken.token], courseNotificationData, webPushLink);

        if (res.responses && res.responses[0]) {
          if (res.responses[0].success) {
            // ✅ Save notification to database after successful FCM send
            try {
              const notification = new Notification({
                user_id: deviceToken.userId,
                device_id: deviceToken.deviceId,
                data: courseNotificationData,
                status: 1, // 1 = unread
              });
              
              const savedNotification = await notification.save();
              savedNotifications.push(savedNotification);
              
              sent++;
              console.log(`✅ Course notification sent and saved for device: ${deviceToken.deviceId}, latest user: ${deviceToken.userId}, notification ID: ${savedNotification._id}, updated: ${deviceToken.updatedAt}`);
            } catch (saveError) {
              console.error(`❌ Error saving notification for device ${deviceToken.deviceId}:`, saveError);
              // Still count as sent since FCM was successful
              sent++;
            }
          } else {
            failed++;
            console.log(`❌ Course notification FAILED for device: ${deviceToken.deviceId}, error: ${res.responses[0].error?.message}`);

            // Remove invalid FCM token
            if (res.responses[0].error?.code === "messaging/registration-token-not-registered") {
              await FcmToken.deleteMany({ token: deviceToken.token });
              console.log(`🗑 Removed invalid token for device: ${deviceToken.deviceId}`);
            }
          }
        } else {
          failed++;
          console.warn(`⚠️ Unknown FCM response for course notification to device: ${deviceToken.deviceId}`);
        }
      } catch (err) {
        failed++;
        console.error(`❌ FCM ERROR for course notification to device: ${deviceToken.deviceId}`, err.message);
      }
    });

    await Promise.all(sendPromises);

    console.log(`📡 Course FCM sending finished. Total sent: ${sent}, Failed: ${failed}, Total enrolled: ${enrollments.length}, Notifications saved: ${savedNotifications.length}, Unique devices: ${deviceTokensMap.size}`);
    
    return { 
      success: true, 
      sent, 
      failed, 
      totalStudents: enrollments.length,
      courseId,
      savedNotifications: savedNotifications.length,
      notificationIds: savedNotifications.map(n => n._id),
      uniqueDevices: deviceTokensMap.size
    };

  } catch (err) {
    console.error("❌ Error sending notification to course students:", err);
    throw new Error(`Cannot send notification to course students: ${err.message}`);
  }
}

  // Update the existing notifyEnrolledUsers method to be more robust
  async notifyEnrolledUsers(courseId, notificationData) {
    try {
      console.log(`🔔 Notifying enrolled users for course: ${courseId}`);
      
      const enrollments = await Enrollment.find({ 
        courseId: new mongoose.Types.ObjectId(courseId) 
      }).select("userId").lean();

      console.log(`Found ${enrollments.length} enrollments`);

      for (const enrollment of enrollments) {
        const fcmToken = await FcmToken.findOne({ userId: enrollment.userId });
        
        if (fcmToken && fcmToken.token) {
          try {
            await fcmService.sendPushNotification([fcmToken.token], notificationData);

            // Save notification
            await Notification.create({
              user_id: enrollment.userId,
              data: {
                ...notificationData,
                courseId: courseId,
                type: "course_enrollment_notification"
              },
              status: 1, // Fix: 1 = unread
            });

            console.log(`✅ Notification sent to user: ${enrollment.userId}`);
          } catch (pushError) {
            console.error(`❌ Failed to send notification to user ${enrollment.userId}:`, pushError);
          }
        } else {
          console.warn(`⚠️ No FCM token found for user: ${enrollment.userId}`);
        }
      }
    } catch (error) {
      console.error("❌ Error notifying enrolled users:", error);
      throw error;
    }
  }

  async notifyJobApproved(jobPost, adminUser) {
    try {
      console.log(`🟢 Job approved notification for job: ${jobPost.title}`);

      // 1️⃣ Notify ONLY the job creator about approval
      const creatorId = jobPost.createdBy._id || jobPost.createdBy;
      // const creatorNotificationData = {
      //   title: "Job Post Approved!",
      //   description: `Your job post "${jobPost.title}" has been approved by admin and is now live.`,
      //   type: "job_approval",
      //   jobId: jobPost._id.toString(),
      //   jobTitle: jobPost.title
      // };

      // // Send approval notification ONLY to creator
      // await this.sendNotificationToUser(creatorId, creatorNotificationData);
      // console.log(`✅ Job approval notification sent to creator: ${creatorId}`);

      // 2️⃣ Send "New Job Available" alert to ALL OTHER users (exclude creator)
      const allUsersNotificationData = {
        title: "New Job Available!",
        description: `A new job "${jobPost.title}" is now available. Check it out!`,
        type: "new_job_alert",
        jobId: jobPost._id.toString(),
        jobTitle: jobPost.title,
        category: jobPost.category,
        budget: jobPost.budget
      };

      // Send new job alert to everyone EXCEPT the creator
      await this.sendNewJobAlertToAllUsers(allUsersNotificationData);
      console.log(`✅ New job alert sent to all users except creator: ${creatorId}`);

    } catch (error) {
      console.error("❌ Error sending job approval notifications:", error);
      throw error;
    }
  }

  async notifyJobRejected(jobPost, adminUser) {
    try {
      console.log(`🔴 Job rejected notification for job: ${jobPost.title}`);

      // Send rejection notification ONLY to the job creator
      const creatorId = jobPost.createdBy._id || jobPost.createdBy;
      const notificationData = {
        title: "Job Post Rejected",
        description: `Your job post "${jobPost.title}" has been rejected by admin. Please review and resubmit if needed.`,
        type: "job_rejection",
        jobId: jobPost._id.toString(),
        jobTitle: jobPost.title,
        adminName: adminUser.fullName || adminUser.name || "Admin"
      };

      await this.sendNotificationToUser(creatorId, notificationData);
      console.log(`✅ Job rejection notification sent ONLY to creator: ${creatorId}`);

    } catch (error) {
      console.error("❌ Error sending job rejection notification:", error);
      throw error;
    }
  }

  async sendNotificationToUser(userId, notificationData) {
    try {
      // Get user's FCM token
      const fcmToken = await FcmToken.findOne({ userId });
      
      if (fcmToken && fcmToken.token) {
        // Send FCM notification
        const fcmResult = await fcmService.sendPushNotification([fcmToken.token], notificationData);
        
        if (fcmResult.success) {
          // Save to database
          const notification = new Notification({
            user_id: userId,
            data: notificationData,
            status: 1, // unread
          });
          
          await notification.save();
          console.log(`✅ Notification sent and saved for user: ${userId}`);
        } else {
          console.log(`❌ Failed to send FCM notification to user: ${userId}`);
        }
      } else {
        // Still save to database even if no FCM token
        const notification = new Notification({
          user_id: userId,
          data: notificationData,
          status: 1, // unread
        });
        
        await notification.save();
        console.log(`📱 No FCM token for user ${userId}, but notification saved to database`);
      }
    } catch (error) {
      console.error(`❌ Error sending notification to user ${userId}:`, error);
      throw error;
    }
  }

  async sendNewJobAlertToAllUsers(notificationData, excludeUserId = null) {
    try {
      console.log(`🔔 Sending new job alert to all devices (latest user per device)`);

      // Get all FCM tokens, optionally excluding creator
      let query = {};
      if (excludeUserId) {
        query = { userId: { $ne: excludeUserId } };
      }

      const tokens = await FcmToken.find(query).select("token userId deviceId updatedAt -_id");

      console.log(`🟢 Found ${tokens.length} total tokens`);

      if (!tokens || tokens.length === 0) {
        console.warn("⚠️ No users with FCM tokens found for new job alert");
        return { success: false, message: "No users to notify", sent: 0, failed: 0 };
      }

      // Group by deviceId+token combination and keep only the latest user for each device
      const deviceTokensMap = new Map();
      
      tokens.forEach(t => {
        if (t.token && t.deviceId) {
          const deviceKey = `${t.deviceId}_${t.token}`;
          
          if (!deviceTokensMap.has(deviceKey)) {
            deviceTokensMap.set(deviceKey, t);
          } else {
            // Keep the token with the latest updatedAt
            const existing = deviceTokensMap.get(deviceKey);
            if (new Date(t.updatedAt) > new Date(existing.updatedAt)) {
              deviceTokensMap.set(deviceKey, t);
            }
          }
        }
      });

      console.log(`🟢 Found ${deviceTokensMap.size} unique devices with latest users to notify about new job`);

      if (deviceTokensMap.size === 0) {
        console.warn("⚠️ No unique devices with FCM tokens found for new job alert");
        return { success: false, message: "No devices to notify", sent: 0, failed: 0 };
      }

      let sent = 0;
      let failed = 0;

      // Send one notification per unique device (to the latest user)
      const sendPromises = Array.from(deviceTokensMap.values()).map(async deviceToken => {
        try {
          const res = await fcmService.sendPushNotification([deviceToken.token], notificationData);

          if (res.responses && res.responses[0]) {
            if (res.responses[0].success) {
              // Save notification to database for the latest user of this device
              const notification = new Notification({
                user_id: deviceToken.userId,
                device_id: deviceToken.deviceId,
                data: notificationData,
                status: 1, // unread
              });
              await notification.save();

              sent++;
              console.log(`✅ New job alert sent to device: ${deviceToken.deviceId}, latest user: ${deviceToken.userId}, updated: ${deviceToken.updatedAt}`);
            } else {
              failed++;
              console.log(`❌ New job alert FAILED for device: ${deviceToken.deviceId}, error: ${res.responses[0].error?.message}`);

              // Remove invalid FCM token
              if (res.responses[0].error?.code === "messaging/registration-token-not-registered") {
                await FcmToken.deleteMany({ token: deviceToken.token });
                console.log(`🗑 Removed invalid token for device: ${deviceToken.deviceId}`);
              }
            }
          } else {
            failed++;
            console.warn(`⚠️ Unknown FCM response for new job alert to device: ${deviceToken.deviceId}`);
          }
        } catch (err) {
          failed++;
          console.error(`❌ FCM ERROR for new job alert to device: ${deviceToken.deviceId}`, err.message);
        }
      });

      await Promise.all(sendPromises);

      console.log(`📡 New job alert sending finished. Total sent: ${sent}, Failed: ${failed}, Unique devices: ${deviceTokensMap.size}`);
      return { success: true, sent, failed, uniqueDevices: deviceTokensMap.size };

    } catch (error) {
      console.error("❌ Error sending new job alert to all users:", error);
      throw error;
    }
  }
}

export default new NotificationService();
