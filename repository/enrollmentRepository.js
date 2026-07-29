import CourseEnrollment from '../models/CourseEnrollment.js';
import Course from '../models/Course.js';
import CourseBundle from '../models/CourseBundle.js';
import UserService from "../service/userService.js";
import User from "../models/user.js";
import { Token } from "../utils/index.js"; // contains generateToken, setTokensCookies, etc.
import { initRedis } from "../config/redisClient.js";
import emailService from '../utils/emailService.js';

import notificationService from "../utils/notificationService.js";
import Notification from "../models/Notifications.js";
import FcmToken from "../models/fcmTokens.js";
import Module from '../models/Module.js';
import CourseChatRoom from '../models/CourseChatRoom.js';


import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import CourseRepository from './CourseRepository.js';
const userService = new UserService();

class EnrollmentRepository {
  async addUserToCourseChat(userId, courseId) {
    try {
      const room = await CourseChatRoom.findOne({ courseId });
      if (room && !room.participants.includes(userId)) {
        room.participants.push(userId);
        await room.save();
        console.log(`✅ Added user ${userId} to course chat room ${room._id} for course ${courseId}`);
      }
    } catch (err) {
      console.error(`❌ Failed to add user ${userId} to course chat room for course ${courseId}:`, err.message);
    }
  }

  async create(data) {
    try {
      if (data.type === 'coursePlan') {
        // Plan-based enrollment
        const CoursePlan = (await import('../models/CoursePlan.js')).default;
        const plan = await CoursePlan.findById(data.coursePlanId || data.coursePlanID || data.planId);
        if (plan) {
          data.courseId = plan.courseId;
          // Set accessType and accessExpiry based on plan's durationType/duration
          let accessType = (plan.durationType || 'lifetime').toLowerCase();
          let enrolledAt = new Date();
          let accessExpiry = null;
          if (plan.duration && ['month', 'year', 'day'].includes(accessType)) {
            let expiry = new Date(enrolledAt);
            if (accessType === 'month') {
              expiry.setMonth(expiry.getMonth() + Number(plan.duration));
            } else if (accessType === 'year') {
              expiry.setFullYear(expiry.getFullYear() + Number(plan.duration));
            } else if (accessType === 'day') {
              expiry.setDate(expiry.getDate() + Number(plan.duration));
            }
            accessExpiry = expiry;
          }
          data.accessType = accessType;
          data.accessExpiry = accessExpiry;
        }
      } else if (data.type === 'courseId') {
        data.courseId = data.courseId || data.CourseId;
        // Fetch course to get accessPeriod and accessType
        const courseDoc = await Course.findById(data.courseId).lean();
        if (courseDoc) {
          data.accessType = courseDoc.accessType || 'lifetime';
          let enrolledAt = new Date();
          let accessExpiry = null;
          if ((data.accessType === 'limited' || data.accessType === 'subscription') && courseDoc.accessPeriod) {
            const periodStr = courseDoc.accessPeriod.trim().toLowerCase();
            let years = 0, months = 0, days = 0;
            const yearMatch = periodStr.match(/(\d+)\s*year/);
            const monthMatch = periodStr.match(/(\d+)\s*month/);
            const dayMatch = periodStr.match(/(\d+)\s*day/);
            if (yearMatch) years = parseInt(yearMatch[1], 10);
            if (monthMatch) months = parseInt(monthMatch[1], 10);
            if (dayMatch) days = parseInt(dayMatch[1], 10);
            let expiry = new Date(enrolledAt);
            if (years > 0) expiry.setFullYear(expiry.getFullYear() + years);
            if (months > 0) expiry.setMonth(expiry.getMonth() + months);
            if (days > 0) expiry.setDate(expiry.getDate() + days);
            if (years > 0 || months > 0 || days > 0) {
              accessExpiry = expiry;
            }
          }
          data.accessExpiry = accessExpiry;
        }
      } else if (data.type === 'courseBundle') {
        data.courseBundle = data.courseBundle || data.CourseBundleId;
        // Fetch bundle to get accessType/accessPeriod
        const CourseBundle = require('../models/CourseBundle.js');
        const bundleDoc = await CourseBundle.findById(data.courseBundle).lean();
        if (bundleDoc) {
          data.accessType = bundleDoc.accessType || 'lifetime';
          let enrolledAt = new Date();
          let accessExpiry = null;
          if ((data.accessType === 'limited' || data.accessType === 'subscription') && bundleDoc.accessPeriod) {
            const periodStr = bundleDoc.accessPeriod.trim().toLowerCase();
            let years = 0, months = 0, days = 0;
            const yearMatch = periodStr.match(/(\d+)\s*year/);
            const monthMatch = periodStr.match(/(\d+)\s*month/);
            const dayMatch = periodStr.match(/(\d+)\s*day/);
            if (yearMatch) years = parseInt(yearMatch[1], 10);
            if (monthMatch) months = parseInt(monthMatch[1], 10);
            if (dayMatch) days = parseInt(dayMatch[1], 10);
            let expiry = new Date(enrolledAt);
            if (years > 0) expiry.setFullYear(expiry.getFullYear() + years);
            if (months > 0) expiry.setMonth(expiry.getMonth() + months);
            if (days > 0) expiry.setDate(expiry.getDate() + days);
            if (years > 0 || months > 0 || days > 0) {
              accessExpiry = expiry;
            }
          }
          data.accessExpiry = accessExpiry;
        }
      }

      // If admin sets custom accessExpiry, override calculated expiry
      if (data.accessExpiry) {
        data.accessExpiry = new Date(data.accessExpiry);
      }
      // If admin sets customPrice, store it in enrollment
      if (data.customPrice !== undefined) {
        data.pricePaid = Number(data.customPrice);
      }
      // Ensure addToRevenue is boolean
      if (typeof data.addToRevenue !== 'boolean') {
        data.addToRevenue = data.addToRevenue === true || data.addToRevenue === 'true';
      }
      // If admin sets addToRevenue, optionally update course revenue/salesCount
      if (data.addToRevenue && data.pricePaid !== undefined && data.courseId) {
        const Course = (await import('../models/Course.js')).default;
        await Course.findByIdAndUpdate(
          data.courseId,
          { $inc: { salesCount: 1, revenue: Number(data.pricePaid) } }
        );
      }

      delete data.CourseId;
      delete data.CourseBundleId;

      const enrollment = await CourseEnrollment.create(data);

      // Send enrollment mail (not order confirmation)
      try {
        const user = await User.findById(data?.userId);
        let courseTitle = null;
        if (data.courseId) {
          const course = await Course?.findById(data?.courseId);
          courseTitle = course ? course?.title : null;
        }
        if (user && user.email) {
          await emailService?.sendEnrollmentMail(
            user?.email,
            user?.fullName || user?.name || "User",
            courseTitle
          );
        }
      } catch (emailError) {
        // Don't block enrollment on email failure
        console.error("❌ Enrollment mail failed:", emailError?.message || emailError);
      }

      if (enrollment) {
        if (data.courseId) {
          await this.addUserToCourseChat(data.userId, data.courseId);
        } else if (data.courseBundleId || data.courseBundle) {
          const bundleId = data.courseBundleId || data.courseBundle;
          const bundle = await CourseBundle.findById(bundleId).populate("courses");
          if (bundle && bundle.courses) {
            for (const course of bundle.courses) {
              await this.addUserToCourseChat(data.userId, course._id);
            }
          }
        }
      }

      return enrollment;
    } catch (error) {
      throw new Error(`Error creating enrollment: ${error.message}`);
    }
  }


  async createFree(data, req, res) {
    try {
      let isFree = false;

      // console?.log("data value", data)
      //console.log("Creating free enrollment for:", data.guestEmail);
      if (!data.guestEmail) {
        return res.status(400).json({ message: "Guest email required." });
      }

      const guestEmail = data.guestEmail;
      const guestName = data.guestName || "Guest User";

      // Step 1: Find or create guest user
      let guestUser = await User.findOne({ email: guestEmail });
      let isNewUser = false;
      // SECURITY: guest accounts were previously created with the shared hardcoded
      // password "student" (mass account takeover via POST /login). Generate a
      // per-account cryptographically random password and email it to the new user.
      let generatedPassword = null;
      if (!guestUser) {
        generatedPassword = crypto.randomBytes(32).toString("hex");
        guestUser = await userService.signup({
          fullName: guestName,
          email: guestEmail,
          password: generatedPassword,
          role: "student",
          is_verify: true
        });
        isNewUser = true;
      }
      const userId = guestUser._id;
      data.userId = userId;

      // Normalize type:
      // If coursePlanId is present → route through plan-based free check
      // Otherwise → convert 'courseId' to 'course' for direct course check
      if (data.type === 'courseId' && data.coursePlanId) {
        // Plan-based free enrollment: check plan price, not course price
        data.coursePlanId = data.coursePlanId || data.coursePlanID || data.planId;
        delete data.courseBundleId;
        delete data.courseBundle;
        delete data.CourseBundleId;

        const CoursePlan = (await import('../models/CoursePlan.js')).default;
        const plan = await CoursePlan.findById(data.coursePlanId);
        if (!plan) throw new Error('Course plan not found');

        // Use the courseId from the plan (source of truth)
        data.courseId = plan.courseId;

        // Set accessType and accessExpiry from plan
        let accessType = (plan.durationType || 'lifetime').toLowerCase();
        let enrolledAt = new Date();
        let accessExpiry = null;
        if (plan.duration && ['month', 'year', 'day'].includes(accessType)) {
          let expiry = new Date(enrolledAt);
          if (accessType === 'month') expiry.setMonth(expiry.getMonth() + Number(plan.duration));
          else if (accessType === 'year') expiry.setFullYear(expiry.getFullYear() + Number(plan.duration));
          else if (accessType === 'day') expiry.setDate(expiry.getDate() + Number(plan.duration));
          accessExpiry = expiry;
        }
        data.accessType = accessType;
        data.accessExpiry = accessExpiry;
        data.type = 'course'; // normalize for enrollment record

        // Free check: validate plan's price (not course's price)
        const planSalePrice = parseFloat(plan.salePrice !== undefined ? plan.salePrice.toString() : '0') || 0;
        const planPrice = parseFloat(plan.price !== undefined ? plan.price.toString() : '0') || 0;

        console.log(`📋 Plan prices → salePrice: ${planSalePrice}, price: ${planPrice}`);

        if (planSalePrice > 0 || planPrice > 0) {
          throw new Error('Course plan is not free');
        }

        // Add user to enrolledStudents + increment count on the course
        await Course.findByIdAndUpdate(data.courseId, {
          $addToSet: { enrolledStudents: data.userId },
          $inc: { enrolledStudentsCount: 1 }
        });

        isFree = true;

      } else if (data.type === 'courseId') {
        // No plan — treat as direct course enrollment, convert type
        data.type = 'course';
      }

      // Ensure only one of courseId or courseBundleId is set
      if (data.type === 'course' && !isFree) {
        data.courseId = data.courseId || data.CourseId;
        delete data.courseBundleId;
        delete data.courseBundle;

        if (data.courseId) {
          const courseDoc = await Course.findById(data.courseId).lean();
          if (!courseDoc) {
            throw new Error('Course not found');
          }
          // Safely convert Decimal128/number price fields to float for comparison
          const salePrice = parseFloat(courseDoc.salePrice ? courseDoc.salePrice.toString() : '0') || 0;
          const price = parseFloat(courseDoc.price ? courseDoc.price.toString() : '0') || 0;

          // Course is free only if BOTH salePrice and price are 0
          // If either is non-zero, the course is paid
          if (salePrice > 0 || price > 0) {
            throw new Error('Course is not free');
          }


          isFree = true;
          data.accessType = courseDoc.accessType || 'lifetime';
          data.accessExpiry = null;

          let enrolledAt = new Date();
          let accessExpiry = null;
          if (
            (data.accessType === "limited" || data.accessType === "subscription") &&
            courseDoc.accessPeriod
          ) {
            const periodStr = courseDoc.accessPeriod.trim().toLowerCase();
            let years = 0, months = 0, days = 0;
            const yearMatch = periodStr.match(/(\d+)\s*year/);
            const monthMatch = periodStr.match(/(\d+)\s*month/);
            const dayMatch = periodStr.match(/(\d+)\s*day/);
            if (yearMatch) years = parseInt(yearMatch[1], 10);
            if (monthMatch) months = parseInt(monthMatch[1], 10);
            if (dayMatch) days = parseInt(dayMatch[1], 10);
            let expiry = new Date(enrolledAt);
            if (years > 0) expiry.setFullYear(expiry.getFullYear() + years);
            if (months > 0) expiry.setMonth(expiry.getMonth() + months);
            if (days > 0) expiry.setDate(expiry.getDate() + days);
            if (years > 0 || months > 0 || days > 0) data.accessExpiry = expiry;
          }

          // Add user to enrolledStudents and increment enrolledStudentsCount
          const hasCourse = true; // Assuming the course exists since we found it
          if (hasCourse) {
            await Course.findByIdAndUpdate(
              data.courseId,
              {
                $addToSet: { enrolledStudents: data.userId }, // avoids duplicates
                $inc: { enrolledStudentsCount: 1 }
              }
            );
          }
        }
      } else if (data.type === 'courseBundle') {
        data.courseBundleId = data.courseBundleId || data.courseBundle || data.CourseBundleId;
        delete data.courseId;
        delete data.CourseId;

        //console.log('Creating free enrollment for course bundle:', data.courseBundleId);
        const bundleDoc = await CourseBundle.findById(data.courseBundleId).lean();
        if (!bundleDoc) {
          throw new Error('Course bundle not found');
        }

        //console.log("price:", bundleDoc.price);
        // Handle Decimal128 price by converting to string for comparison
        if (bundleDoc.price && bundleDoc.price.toString() !== '0') {
          throw new Error('Course bundle is not free');
        }
        isFree = true;
        data.accessType = bundleDoc.accessType || 'lifetime';
        data.accessExpiry = null; // Free bundles typically have lifetime access

        // Add user to enrolledStudents (no enrolledStudentsCount in schema)
        const hasBundle = true; // Assuming the bundle exists since we found it
        if (hasBundle) {
          await CourseBundle.findByIdAndUpdate(
            data.courseBundleId,
            {
              $addToSet: { enrolledStudents: data.userId } // avoids duplicates
            }
          );
        }
      } else if (!isFree) {
        // No branch handled this enrollment — type is unrecognized
        throw new Error(`Invalid enrollment type: ${data.type}`);
      }

      delete data.CourseId;
      delete data.CourseBundleId;
      delete data.courseBundle; // Also remove this to avoid schema error

      if (isFree) {
        data.status = 'active'; // Set to 'active' to match schema enum
        let oldAccessToken =
          req.cookies?.accessToken ||
          (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")
            ? req.headers.authorization.split(" ")[1]
            : undefined) ||
          req.headers["x-access-token"];

        let oldAccessTokenExp = null;
        if (oldAccessToken) {
          const decoded = jwt.decode(oldAccessToken);
          oldAccessTokenExp = decoded?.exp ? decoded.exp * 1000 : null;
        }

        // Create the enrollment in the database
        const courseEnrollment = await CourseEnrollment.create(data);

        const { accessToken, refreshToken, accessTokenExp, refreshTokenExp } =
          await Token.generateTokens(guestUser, oldAccessToken, oldAccessTokenExp);

        const redis = await initRedis();

        let accessTTL = Math.floor((accessTokenExp - Date.now()) / 1000);
        let refreshTTL = Math.floor((refreshTokenExp - Date.now()) / 1000);
        accessTTL = Number.isFinite(accessTTL) && accessTTL > 0 ? accessTTL : 1;
        refreshTTL = Number.isFinite(refreshTTL) && refreshTTL > 0 ? refreshTTL : 1;

        await redis.setEx(`accessToken:${accessToken}`, accessTTL, "valid");
        await redis.setEx(`refreshToken:${refreshToken}`, refreshTTL, userId.toString());

        const currentTime = Date.now();
        const accessMaxAge = Math.max(1000, accessTokenExp - currentTime); // At least 1 second
        const refreshMaxAge = Math.max(1000, refreshTokenExp - currentTime); // At least 1 second

        //console.log("🔧 Token expiration times:", {
        //   accessTokenExp,
        //   refreshTokenExp,
        //   currentTime,
        //   accessMaxAge,
        //   refreshMaxAge
        // });


        Token.setTokensCookies(res, accessToken, refreshToken, accessMaxAge, refreshMaxAge);

        try {
          await emailService.sendOrderConfirmationEmail(
            guestEmail,
            guestName || 'User',
            isNewUser ? generatedPassword : undefined // Only send password if new user
          );
          //console.log("✅ Order confirmation email sent successfully");
        } catch (emailError) {
          console.error("❌ Email sending failed:", emailError);
          // Continue with success response to avoid revealing email existence
        }

        // FCM token is now optional
        let userfcmtoken = null;
        if (data.deviceId && data.token) {
          // If deviceId and token are provided, find or create FCM token using deviceId
          userfcmtoken = await FcmToken.findOne({ deviceId: data.deviceId });
          if (!userfcmtoken) {
            const newFcmToken = new FcmToken({
              userId,
              deviceId: data.deviceId,
              token: data.token,
              platform: data.platform || 'unknown'
            });
            userfcmtoken = await newFcmToken.save();
          } else {
            // Update existing token
            userfcmtoken.token = data.token;
            userfcmtoken.userId = userId;
            await userfcmtoken.save();
          }
        } else if (data.deviceId && !data.token) {
          // Only deviceId provided, try to find existing token
          userfcmtoken = await FcmToken.findOne({ deviceId: data.deviceId });
        } else if (!data.deviceId && data.token) {
          // Only token provided, try to find by userId
          userfcmtoken = await FcmToken.findOne({ userId });
          if (!userfcmtoken) {
            const newFcmToken = new FcmToken({
              userId,
              deviceId: null,
              token: data.token,
              platform: data.platform || 'unknown'
            });
            userfcmtoken = await newFcmToken.save();
          } else {
            userfcmtoken.token = data.token;
            await userfcmtoken.save();
          }
        }
        // If neither deviceId nor token, skip FCM logic

        //console.log("FCM Token found:", userfcmtoken);

        if (userfcmtoken && userfcmtoken.token) {
          const notificationData = {
            title: "Enrollment_Notification",
            description: "You have been successfully enrolled in the course.",
            order_id: courseEnrollment._id.toString(),
            type: "new_enrollment",
          };
          const notiresponse = await notificationService.sendPushNotification(userfcmtoken.token, notificationData);
          //console.log("Push notification response:", notiresponse);

          // Save notification response
          if (notiresponse.success) {
            const notification = new Notification({
              data: notificationData,
              status: 0,
              user_id: userId,
            });
            await notification.save();
          }
        }

        if (courseEnrollment) {
          if (data.courseId) {
            await this.addUserToCourseChat(userId, data.courseId);
          } else if (data.courseBundleId) {
            const bundle = await CourseBundle.findById(data.courseBundleId).populate("courses");
            if (bundle && bundle.courses) {
              for (const course of bundle.courses) {
                await this.addUserToCourseChat(userId, course._id);
              }
            }
          }
        }

        return res.status(201).json({
          message: "Course Enrollment successful",
          courseEnrollment,
          guestUser,
          accessToken,
          refreshToken
        });

      } else {
        throw new Error('Item is not free');
      }
    } catch (error) {
      throw new Error(`Error creating free enrollment: ${error.message}`);
    }
  }

  async findAll(filters = {}) {
    try {
      const query = {};
      if (filters.userId) query.userId = filters.userId;
      if (filters.courseId) query.courseId = filters.courseId;
      // Schema field is `courseBundleId` (ref CourseBundle). Accept the correct
      // key plus the legacy/typo'd ones so the filter actually applies.
      const bundleId = filters.courseBundleId ?? filters.courseBundle ?? filters.courseBundel;
      if (bundleId) query.courseBundleId = bundleId;

      // Enforce mandatory pagination so an unfiltered request can never return
      // and populate the entire CourseEnrollment collection.
      const page = Math.max(parseInt(filters.page, 10) || 1, 1);
      const limit = Math.min(Math.max(parseInt(filters.limit, 10) || 50, 1), 100);
      const skip = (page - 1) * limit;

      return await CourseEnrollment.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({ path: 'userId', select: 'name email', options: { strictPopulate: false } })
        .populate({ path: 'courseId', select: 'title slug', options: { strictPopulate: false } })
        .populate({ path: 'courseBundleId', select: 'title slug', options: { strictPopulate: false } })
        .populate({ path: 'orderId', select: 'orderNo subTotal discount gstRate grandTotal invoice_url', options: { strictPopulate: false } });
    } catch (error) {
      throw new Error(`Error fetching enrollments: ${error.message}`);
    }
  }

  async findById(id) {
    try {
      const enrollment = await CourseEnrollment.findById(id)
        .populate({ path: 'userId', select: 'name email', options: { strictPopulate: false } })
        .populate({ path: 'courseId', select: 'title slug', options: { strictPopulate: false } })
        .populate({ path: 'courseBundle', select: 'title slug', options: { strictPopulate: false } })
        .populate({ path: 'orderId', select: 'orderNo subTotal discount gstRate grandTotal invoice_url', options: { strictPopulate: false } });

      if (!enrollment) {
        throw new Error('Enrollment not found');
      }

      return enrollment;
    } catch (error) {
      throw new Error(`Error finding enrollment by ID: ${error.message}`);
    }
  }

  async update(id, data) {
    try {
      return await CourseEnrollment.findByIdAndUpdate(id, data, { new: true });
    } catch (error) {
      throw new Error(`Error updating enrollment: ${error.message}`);
    }
  }

  async delete(id) {
    try {
      return await CourseEnrollment.findByIdAndDelete(id);
    } catch (error) {
      throw new Error(`Error deleting enrollment: ${error.message}`);
    }
  }
}

export default new EnrollmentRepository();
