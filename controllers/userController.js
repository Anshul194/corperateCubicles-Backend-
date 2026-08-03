import mongoose from "mongoose";
import path from "path";
import { promises as fs } from "fs";
import User from "../models/user.js";
import FcmToken from "../models/fcmTokens.js";
import notificationService from "../utils/notificationService.js";
import Course from "../models/Course.js";
import CourseBundle from "../models/CourseBundle.js";
import Assignment from "../models/Assignment.js";
import CourseEnrollment from "../models/CourseEnrollment.js";
import UserService from "../service/userService.js";
import { getUserLeaderboard } from "../service/leaderboardService.js"; // <-- Add this import
import { Token } from "../utils/index.js"; // contains generateToken, setTokensCookies, etc.
import { initRedis } from "../config/redisClient.js";
import emailService from "../utils/emailService.js";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import {
  cleanupExpiredAccessTokensForUser,
  getAllAccessTokensForUser,
  blacklistAccessToken,
} from "../utils/tokens/generateTokens.js";
import UserRefreshToken from "../models/UserRefreshToken.js";
import DeviceApproval from "../models/DeviceApproval.js";
import LoginLog from "../models/LoginLog.js";
import Role from "../models/Role.js";

const userService = new UserService();

export const signup = async (req, res) => {
  try {
    //console.log("📩 Request Body user signup:", req.body);

    // ✅ Email format check
    if (!/^\S+@\S+\.\S+$/.test(req.body.email)) {
      return res.status(400).json({
        message: "Please enter a valid email address",
        data: {},
        success: false,
        err: { email: "Invalid format — must contain '@' and domain" },
      });
    }

    // ✅ Check if is_verify is explicitly true
    if (req.body.is_verify !== true) {
      return res.status(400).json({
        message: "Email not verified",
        data: {},
        success: false,
        err: { email: "Please verify your email before signing up" },
      });
    }

    const user = await userService.getUserByEmail(req.body.email);
    if (user) {
      return res.status(400).json({
        message: "Email already exists",
        data: {},
        success: false,
        err: {},
      });
    }

    // Create new user.
    // SECURITY: never trust a client-supplied role on public signup — doing so let
    // anyone self-register as 'admin'/'instructor' (privilege escalation). Role is
    // hard-forced to 'student'; elevation happens only via the admin-gated
    // updateUserRole endpoint.
    const newUser = await userService.signup({
      email: req.body.email,
      password: req.body.password,
      fullName: req.body.fullName,
      role: "student",
      is_verify: req.body.is_verify, // Pass is_verify to the service
    });

    //console.log("✅ New user created:", newUser);

    const userId = newUser._id.toString();

    // Generate tokens
    const { accessToken, refreshToken, accessTokenExp, refreshTokenExp } = await Token.generateTokens(newUser, req.body.platform || "web", req.body.deviceId);

    // Connect to Redis
    const redis = await initRedis();

    // Store tokens in Redis with TTL
    if (redis) {
      const accessTTL = Math.max(1, Math.floor((accessTokenExp - Date.now()) / 1000));
      const refreshTTL = Math.max(1, Math.floor((refreshTokenExp - Date.now()) / 1000));

      await redis.set(`accessToken:${accessToken}`, "valid", { EX: accessTTL });
      await redis.set(`refreshToken:${refreshToken}`, userId, { EX: refreshTTL });
    }

    // Cache user data in Redis (expires in 1 hour)
    await redis.setEx(
      `user:${userId}`,
      3600,
      JSON.stringify({
        _id: newUser._id,
        email: newUser.email,
        fullName: newUser.fullName,
        roles: newUser.roles,
        profilePicture: newUser.profilePicture,
        bio: newUser.bio,
        phone: newUser.phone,
        address: newUser.address,
        company: newUser.company,
        createdAt: newUser.createdAt,
        updatedAt: newUser.updatedAt,
        is_verify: newUser.is_verify, // Include is_verify in cache
      })
    );

    // Set tokens as HTTP-only cookies (no maxAge)
    Token.setTokensCookies(res, accessToken, refreshToken);

    // SECURITY: web clients authenticate exclusively via the httpOnly cookies set
    // above — echoing the raw JWTs in the JSON body lets any XSS read/exfiltrate
    // them, defeating the httpOnly protection. Only mobile/app clients (which use
    // the Authorization header and cannot read cookies) get body tokens.
    const isWeb = req.body.platform === "web";

    return res.status(201).json({
      success: true,
      message: "✅ Successfully created a new user",
      data: {
        user: newUser,
        accessToken, refreshToken,
      },
      err: {},
    });
  } catch (err) {
    console.error("❌ Signup Error:", err);
    return res.status(500).json({
      message: err.message,
      data: {},
      success: false,
      err: err.message,
    });
  }
};

//updateFcmToken
export const updateFcmToken = async (req, res) => {
  try {
    const { token, deviceId, platform } = req.body;
    // SECURITY: the userId is taken from the authenticated token ONLY. Any
    // client-supplied req.body.userId is ignored — honouring it let anonymous
    // callers bind their device token to a victim's userId and receive that
    // user's push notifications.
    const userId = req.user._id;

    if (!token || !deviceId) {
      return res.status(400).json({ message: "Token and deviceId required" });
    }

    let existing = null;

    // First check if deviceId exists with userId null (legacy guest
    // registration) → claim it for the authenticated user
    existing = await FcmToken.findOne({ deviceId, userId: null });

    if (existing) {
      existing.userId = userId;
      existing.token = token;
      existing.platform = platform || existing.platform;
      existing.updatedAt = new Date();
      await existing.save();
    } else {
      // Now check if same userId already exists for this device
      existing = await FcmToken.findOne({ deviceId, userId });

      if (existing) {
        // Update existing entry for same user
        existing.token = token;
        existing.platform = platform || existing.platform;
        existing.updatedAt = new Date();
        await existing.save();
      } else {
        // New user login on same device → create new entry
        await FcmToken.create({
          token,
          deviceId,
          userId,
          platform,
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: "FCM token updated/created",
      data: {
        token,
        deviceId,
        userId,
        platform,
      },
    });
  } catch (error) {
    console.error("❌ Error updating FCM token:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update FCM token",
    });
  }
};

//sendTestNotification
export const sendTestNotification = async (req, res) => {
  try {
    const token = req.body.token;
    const data = {
      title: "Order_Notification",
      description: "Your order has been shipped",
      order_id: "12345",
      type: "order_status",
    };
    const response = await notificationService.sendPushNotification(
      token,
      data
    );
    //console.log("Test notification response:", response);

    // Save notification response
    if (response.success) {
      const notification = new Notification({
        data,
        status: 0,
        user_id: req.user._id,
      });
      await notification.save();
    }

    return res.status(200).json(response);
  } catch (error) {
    console.error("❌ Error sending test notification:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to send test notification",
    });
  }
};

export const createUserByAdmin = async (req, res) => {
  try {
    const { email, password, fullName } = req.body;
    // Admin may choose a role; default to student. Never let an admin be created here.
    const VALID_ROLES = ["admin", "instructor", "student", "news_editor", "trainer", "moderator"];
    let role = req.body.role || "student";
    role = String(role).toLowerCase();
    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}`,
      });
    }

    if (!email || !password || !fullName) {
      return res.status(400).json({
        success: false,
        message: "Email, password, and fullName are required",
      });
    }

    const existingUser = await userService.getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email already exists",
      });
    }

    const newUser = await userService.adminCreateUser({
      email,
      password,
      fullName,
      role,
    });

    // Auto-assign the Role doc matching the base role (if one exists) so the
    // user's RBAC `roles` reflect their base role too.
    try {
      const Role = mongoose.models.Role || (await import("../models/Role.js")).default;
      const roleDoc = await Role.findOne({ name: role, isActive: true }).select("_id");
      if (roleDoc) {
        newUser.roles = [roleDoc._id];
        await newUser.save();
      }
    } catch (e) {
      console.error("Auto-assign role doc failed:", e.message);
    }

    return res.status(201).json({
      success: true,
      message: "✅ User created successfully",
      data: newUser,
    });
  } catch (error) {
    console.error("❌ Admin create user error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getMyProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await userService.getUserById(userId);
    // Get latest personality submission for the user
    let personality = null;
    try {
      const PersonalitySubmission = (await import('../models/PersonalitySubmission.js')).default;
      personality = await PersonalitySubmission.findOne({ userId }).sort({ createdAt: -1 }).lean();
    } catch (e) {
      console.error('Error fetching personality submission:', e);
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
        data: {},
        err: {},
      });
    }

    // Load role/permission info for sidebar filtering & RBAC
    let roleDoc = null;
    let permissionNames = [];
    try {
      const isSuperAdmin = ["admin", "superadmin", "ADMIN"].includes(user.role);
      if (user.roles && user.roles.length > 0) {
        roleDoc = await mongoose.models.Role?.find({
          _id: { $in: user.roles },
          isActive: true,
        }).populate("permissions").populate("modules").lean();
      } else if (user.role) {
        const found = await mongoose.models.Role?.findOne({
          name: user.role,
          isActive: true,
        }).populate("permissions").populate("modules").lean();
        roleDoc = found ? [found] : null;
      }
      if (roleDoc && Array.isArray(roleDoc)) {
        roleDoc.forEach((r) => {
          (r.permissions || []).forEach((p) => {
            if (p && p.name) permissionNames.push(p.name);
            if (p && p.resource) permissionNames.push(`${p.resource}:${p.action}`);
          });
        });
      }
      // Admins/superadmins always have every permission & module.
      if (isSuperAdmin) {
        permissionNames = ["*"];
        if (roleDoc && Array.isArray(roleDoc)) {
          roleDoc = roleDoc.map((r) => ({ ...r, permissions: ["*"] }));
        }
      }
    } catch (e) {
      console.error("Error loading role permissions:", e);
    }

    return res.status(200).json({
      success: true,
      message: "✅ User profile fetched successfully",
      data: {
        user: {
          _id: user._id,
          email: user.email,
          fullName: user.fullName,
          is_verify: user.is_verify,
          role: user.role,
          roles: user.roles,
          roleDocs: roleDoc || null,
          permissions: permissionNames,
          profilePicture: user.profilePicture,
          enrolledCourses: user.enrolledCourses,
          teachingCourses: user.teachingCourses,
          qualifications: user.qualifications,
          documentation: user.documentation,
          bio: user.bio,
          phone: user.phone,
          address: user.address,
          company: user.company, // <-- add company object
          skills: user.skills, // ✅ Correctly added here
          education: user.education, // ✅ Correctly added here
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          personality: personality ? {
            resultType: personality.resultType,
            scores: personality.scores,
            createdAt: personality.createdAt
          } : null
        },
      },
      err: {},
    });
  } catch (err) {
    console.error("❌ Error fetching profile:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve profile",
      data: {},
      err: err.message,
    });
  }
};

// export const updateProfile = async (req, res) => {
//   try {
//     if (req.fileValidationError) {
//       return res.status(400).json({
//         success: false,
//         message: req.fileValidationError,
//         data: {},
//         err: req.fileValidationError,
//       });
//     }

//     const userId = req.user?._id?.toString();
//     if (!userId) {
//       return res.status(400).json({
//         success: false,
//         message: "User ID is required",
//         data: {},
//         err: {},
//       });
//     }

//     const allowedFields = [
//       "fullName",
//       "bio",
//       "phone",
//       "address",
//       "education",
//       "skills",
//       "documentation",
//     ];
//     const updateData = {};
//     let oldImagePath;

//     for (const field of allowedFields) {
//       if (req.body[field]) {
//         updateData[field] = req.body[field];
//       }
//     }

//     if (req.files && req.files.profilePicture && req.files.profilePicture[0]) {
//       const currentUser = await userService.getUserById(userId);
//       if (currentUser.profilePicture && currentUser.profilePicture !== "default-profile.png") {
//         oldImagePath = path.join("uploads", currentUser.profilePicture);
//       }
//       updateData.profilePicture = req.files.profilePicture[0].filename;
//     }

//     // ✅ Handle documentation[] files with documentation[0].name format
//     if (req.files && req.files.documentation && req.files.documentation.length > 0) {
//       const documentationArray = [];

//       for (let i = 0; i < req.files.documentation.length; i++) {
//         const file = req.files.documentation[i];
//         const nameField = `documentation[${i}].name`;
//         const docName = req.body[nameField] || file.originalname;

//         documentationArray.push({
//           name: docName,
//           Doc: file.filename,
//         });
//       }

//       const currentUser = await userService.getUserById(userId);
//       if (currentUser.documentation && currentUser.documentation.length > 0) {
//         updateData.documentation = [...currentUser.documentation, ...documentationArray];
//       } else {
//         updateData.documentation = documentationArray;
//       }
//     }

//     // Handle role-specific fields
//     if (req.body.role === "student" && req.body.enrolledCourses) {
//       try {
//         updateData.enrolledCourses = Array.isArray(req.body.enrolledCourses)
//           ? req.body.enrolledCourses
//           : JSON.parse(req.body.enrolledCourses);
//       } catch {
//         updateData.enrolledCourses = req.body.enrolledCourses;
//       }
//     }

//     if (req.body.role === "instructor" && req.body.teachingCourses) {
//       try {
//         updateData.teachingCourses = Array.isArray(req.body.teachingCourses)
//           ? req.body.teachingCourses
//           : JSON.parse(req.body.teachingCourses);
//       } catch {
//         updateData.teachingCourses = req.body.teachingCourses;
//       }
//     }

//     if (req.body.address) {
//   try {
//     updateData.address = JSON.parse(req.body.address);
//   } catch (e) {
//     return res.status(400).json({
//       success: false,
//       message: "Invalid address format",
//       data: {},
//       err: e.message,
//     });
//   }
// }

//     if (req.body.role === "instructor" && req.body.qualifications) {
//       try {
//         updateData.qualifications = Array.isArray(req.body.qualifications)
//           ? req.body.qualifications
//           : JSON.parse(req.body.qualifications);
//       } catch {
//         updateData.qualifications = req.body.qualifications;
//       }
//     }

//     if (Object.keys(updateData).length === 0) {
//       return res.status(400).json({
//         success: false,
//         message: "No valid fields to update",
//         data: {},
//         err: {},
//       });
//     }

//     const updatedUser = await userService.updateUserById(userId, updateData);

//     if (!updatedUser) {
//       if (req.files) {
//         const fs = require("fs").promises;
//         if (req.files.profilePicture && req.files.profilePicture[0]) {
//           try {
//             await fs.unlink(req.files.profilePicture[0].path);
//           } catch {}
//         }
//         if (req.files.documentation) {
//           for (const file of req.files.documentation) {
//             try {
//               await fs.unlink(file.path);
//             } catch {}
//           }
//         }
//       }
//       return res.status(404).json({
//         success: false,
//         message: "User not found",
//         data: {},
//         err: {},
//       });
//     }

//     if (oldImagePath) {
//       try {
//         const fs = require("fs").promises;
//         await fs.unlink(oldImagePath);
//       } catch {}
//     }

//     // 🔄 Update Redis cache
//     const redis = await initRedis();
//     const userCacheData = {
//       _id: updatedUser._id,
//       email: updatedUser.email,
//       fullName: updatedUser.fullName,
//       roles: updatedUser.roles,
//       profilePicture: updatedUser.profilePicture,
//       bio: updatedUser.bio,
//       phone: updatedUser.phone,
//       address: updatedUser.address,
//       education: updatedUser.education,
//       skills: updatedUser.skills,
//       enrolledCourses: updatedUser.enrolledCourses,
//       teachingCourses: updatedUser.teachingCourses,
//       qualifications: updatedUser.qualifications,
//       documentation: updatedUser.documentation,
//       createdAt: updatedUser.createdAt,
//       updatedAt: updatedUser.updatedAt,
//     };

//     await redis.setEx(`user:${userId}`, 3600, JSON.stringify(userCacheData));
//     const userSessionKey = `user_session:${userId}`;
//     if (await redis.exists(userSessionKey)) {
//       await redis.setEx(userSessionKey, 3600, JSON.stringify(userCacheData));
//     }

//     return res.status(200).json({
//       success: true,
//       message: "Profile updated successfully",
//       data: { user: updatedUser },
//       err: {},
//     });
//   } catch (err) {
//     if (req.files) {
//       const fs = require("fs").promises;
//       if (req.files.profilePicture && req.files.profilePicture[0]) {
//         try {
//           await fs.unlink(req.files.profilePicture[0].path);
//         } catch {}
//       }
//       if (req.files.documentation) {
//         for (const file of req.files.documentation) {
//           try {
//             await fs.unlink(file.path);
//           } catch {}
//         }
//       }
//     }
//     return res.status(500).json({
//       success: false,
//       message: err.message,
//       data: {},
//       err: err.message,
//     });
//   }
// };
export const updateProfile = async (req, res) => {
  try {
    if (req.fileValidationError) {
      return res.status(400).json({
        success: false,
        message: req.fileValidationError,
        data: {},
        err: req.fileValidationError,
      });
    }

    const userId = req.user?._id?.toString();
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
        data: {},
        err: {},
      });
    }

    const allowedFields = [
      "fullName",
      "bio",
      "phone",
      "address",
      "education",
      "skills",
      "documentation",
      "company", // <-- allow company update
    ];
    const updateData = {};
    let oldImagePath;

    for (const field of allowedFields) {
      if (req.body[field]) {
        updateData[field] = req.body[field];
      }
    }

    // Phone validation (simple international format, 10-15 digits)
    if (updateData.phone) {
      const phoneRegex = /^\+?[0-9]{10,15}$/;
      if (!phoneRegex.test(updateData.phone)) {
        return res.status(400).json({
          success: false,
          message: "Invalid phone number format",
          data: {},
          err: "Invalid phone",
        });
      }
    }

    const currentUser = await userService.getUserById(userId);

    // Handle profile picture
    if (req.files?.profilePicture?.[0]) {
      if (
        currentUser?.profilePicture &&
        currentUser.profilePicture !== "default-profile.png"
      ) {
        oldImagePath = path.join("uploads", currentUser.profilePicture);
      }
      updateData.profilePicture = req.files.profilePicture[0].filename;
    }

    // Handle documentation uploads
    if (req.files?.documentation?.length) {
      const documentationArray = req.files.documentation.map((file, index) => {
        const docName =
          req.body[`documentation[${index}].name`] || file.originalname;
        return { name: docName, Doc: file.filename };
      });

      updateData.documentation = currentUser?.documentation?.length
        ? [...currentUser.documentation, ...documentationArray]
        : documentationArray;
    }

    // Parse complex fields
    if (req.body.role === "student" && req.body.enrolledCourses) {
      try {
        updateData.enrolledCourses = Array.isArray(req.body.enrolledCourses)
          ? req.body.enrolledCourses
          : JSON.parse(req.body.enrolledCourses);
      } catch {
        updateData.enrolledCourses = req.body.enrolledCourses;
      }
    }

    if (req.body.role === "instructor" && req.body.teachingCourses) {
      try {
        updateData.teachingCourses = Array.isArray(req.body.teachingCourses)
          ? req.body.teachingCourses
          : JSON.parse(req.body.teachingCourses);
      } catch {
        updateData.teachingCourses = req.body.teachingCourses;
      }
    }

    if (req.body.address) {
      try {
        updateData.address = JSON.parse(req.body.address);
      } catch (e) {
        return res.status(400).json({
          success: false,
          message: "Invalid address format",
          data: {},
          err: e.message,
        });
      }
    }

    if (req.body.role === "instructor" && req.body.qualifications) {
      try {
        updateData.qualifications = Array.isArray(req.body.qualifications)
          ? req.body.qualifications
          : JSON.parse(req.body.qualifications);
      } catch {
        updateData.qualifications = req.body.qualifications;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields to update",
        data: {},
        err: {},
      });
    }

    const updatedUser = await userService.updateUserById(userId, updateData);

    if (!updatedUser) {
      await cleanUploadedFiles(req.files);
      return res.status(404).json({
        success: false,
        message: "User not found",
        data: {},
        err: {},
      });
    }

    // Delete old profile picture if needed
    if (oldImagePath) {
      try {
        await fs.unlink(oldImagePath);
      } catch { }
    }

    // Update Redis cache
    const redis = await initRedis();
    const userCacheData = {
      _id: updatedUser._id,
      email: updatedUser.email,
      fullName: updatedUser.fullName,
      roles: updatedUser.roles,
      profilePicture: updatedUser.profilePicture,
      bio: updatedUser.bio,
      phone: updatedUser.phone,
      address: updatedUser.address,
      company: updatedUser.company, // <-- add company object
      education: updatedUser.education,
      skills: updatedUser.skills,
      enrolledCourses: updatedUser.enrolledCourses,
      teachingCourses: updatedUser.teachingCourses,
      qualifications: updatedUser.qualifications,
      documentation: updatedUser.documentation,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt,
    };

    await redis.setEx(`user:${userId}`, 3600, JSON.stringify(userCacheData));
    const sessionKey = `user_session:${userId}`;
    if (await redis.exists(sessionKey)) {
      await redis.setEx(sessionKey, 3600, JSON.stringify(userCacheData));
    }

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: { user: updatedUser },
      err: {},
    });
  } catch (err) {
    await cleanUploadedFiles(req.files);
    return res.status(500).json({
      success: false,
      message: "Something went wrong",
      data: {},
      err: err.message,
    });
  }
};

// 🔧 Helper: Delete uploaded files if needed
async function cleanUploadedFiles(files) {
  if (!files) return;

  if (files.profilePicture?.[0]) {
    try {
      await fs.unlink(files.profilePicture[0].path);
    } catch { }
  }

  if (files.documentation?.length) {
    for (const file of files.documentation) {
      try {
        await fs.unlink(file.path);
      } catch { }
    }
  }
}

const parseUserAgent = (userAgent) => {
  const browserRegex = /(chrome|firefox|safari|edge|opera)\/?\s*(\d+)/i;
  const match = userAgent.match(browserRegex);

  return {
    browserName: match ? match[1] : "Unknown",
    browserVersion: match ? match[2] : "Unknown",
  };
};

// Helper function to create login log
const createLoginLog = async (
  userId,
  deviceId,
  deviceInfo,
  loginStatus = "success",
  sessionId = null
) => {
  try {
    const loginLog = new LoginLog({
      userId: userId || null,
      deviceId: deviceId || "unknown",
      deviceInfo,
      loginStatus,
      sessionId: sessionId || null,
      loginTime: new Date(),
    });

    await loginLog.save();
    //console.log(
    //   `✅ Login log created: ${loginStatus} for deviceId: ${deviceId || "unknown"
    //   }`
    // );
    return loginLog;
  } catch (error) {
    console.error("❌ Error creating login log:", {
      error: error.message,
      userId,
      deviceId,
      loginStatus,
    });
    return null;
  }
};

// Login controller
export const login = async (req, res) => {
  try {
    //console.log("📩 Request Body user login:", req.body);

    const { email, password, deviceId, platform } = req.body;
    const isWeb = platform === 'web';

    const deviceInfo = {
      platform: platform || "web",
      userAgent: req.headers["user-agent"] || "",
      ipAddress: req.ip || req.connection.remoteAddress || "",
      deviceName: req.body.deviceName || "",
      ...parseUserAgent(req.headers["user-agent"] || ""),
    };

    // Validation
    if (!email || !password) {
      await createLoginLog(null, deviceId || "unknown", deviceInfo, "failed");
      return res.status(400).json({
        message: "Email and password are required",
        data: {},
        success: false,
        err: { message: "Missing required fields" },
      });
    }

    // Authenticate user credentials
    const loginResult = await userService.login(email, password);

    // If login fails, log the attempt and return early
    if (!loginResult || !loginResult.success) {
      await createLoginLog(null, deviceId || "unknown", deviceInfo, "failed");
      return res.status(401).json({
        message: "Invalid email or password",
        data: {},
        success: false,
        err: { message: "Invalid credentials" },
      });
    }

    const user = loginResult?.userObj;
    const userId = user._id.toString();

    // Record device for tracking — non-blocking
    if (deviceId) {
      try {
        const existingDevice = await DeviceApproval.findOne({ userId, deviceId });
        if (!existingDevice) {
          await DeviceApproval.create({
            userId,
            deviceId,
            deviceInfo,
            status: "pending",
          });
        }
      } catch (e) {
        console.error("Device approval record error:", e.message);
      }
    }

    // Only generate tokens if everything is successful
    const { accessToken, refreshToken, accessTokenExp, refreshTokenExp } = await Token.generateTokens(user, platform || "web", null);

    // Connect to Redis
    const redis = await initRedis();

    // Store tokens in Redis with TTL
    if (redis) {
      const accessTTL = Math.max(1, Math.floor((accessTokenExp - Date.now()) / 1000));
      const refreshTTL = Math.max(1, Math.floor((refreshTokenExp - Date.now()) / 1000));

      await redis.set(`accessToken:${accessToken}`, "valid", { EX: accessTTL });
      await redis.set(`refreshToken:${refreshToken}`, userId, { EX: refreshTTL });
    }

    // Cache user data in Redis (expires in 1 hour)
    await redis.setEx(
      `user:${userId}`,
      3600,
      JSON.stringify({
        _id: user._id,
        email: user.email,
        fullName: user.fullName,
        roles: user.roles,
        profilePicture: user.profilePicture,
        bio: user.bio,
        phone: user.phone,
        address: user.address,
        company: user.company,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      })
    );

    // Set tokens as HTTP-only cookies (no maxAge)
    Token.setTokensCookies(res, accessToken, refreshToken);

    // Create successful login log
    const sessionId = jwt.decode(accessToken)?.jti || accessToken.substring(0, 10);
    await createLoginLog(userId, deviceId || "unknown", deviceInfo, "success", sessionId);

    // SECURITY: never return credential material. The user object was fetched with
    // includeSensitive (needed for the bcrypt comparison), so strip the password
    // hash and reset-token fields before responding.
    const {
      password: _password,
      passwordResetToken: _passwordResetToken,
      passwordResetExpiry: _passwordResetExpiry,
      ...safeUser
    } = loginResult.userObj;

    // Modified response structure
    // SECURITY: web clients authenticate exclusively via the httpOnly cookies set
    // above — echoing the raw JWTs in the JSON body lets any XSS read/exfiltrate
    // them, defeating the httpOnly protection. Only mobile/app clients (which use
    // the Authorization header and cannot read cookies) get body tokens.
    return res.status(200).json({
      success: true,
      message: "✅ Successfully logged in",
      data: {
        user: safeUser,
        accessToken, refreshToken,
      },
      err: {},
    });
  } catch (err) {
    console.error("❌ Login Error:", err?.message);
    const deviceInfo = {
      platform: req.body.platform || "web",
      userAgent: req.headers["user-agent"] || "",
      ipAddress: req.ip || req.connection.remoteAddress || "",
      deviceName: req.body.deviceName || "",
      ...parseUserAgent(req.headers["user-agent"] || ""),
    };
    await createLoginLog(null, req.body.deviceId || "unknown", deviceInfo, "failed");
    return res.status(500).json({
      message: "An error occurred during login",
      data: {},
      success: false,
      err: err.message,
    });
  }
};

export const getUserById = async (req, res) => {
  try {
    // //console.log("📩 Request Params getUserById:", req.user);

    // //console.log("📩 Authenticated User:", req);

    const id = req.user?._id; // Get user ID from request params or authenticated user

    // Validate if ID is provided
    if (!id) {
      return res.status(400).json({
        message: "User ID is required",
        data: {},
        success: false,
        err: { message: "Missing user ID parameter" },
      });
    }

    // Get user by ID
    const user = await userService.getUserById(id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
        data: {},
        success: false,
        err: { message: "User with this ID does not exist" },
      });
    }

    // Remove sensitive information before sending response.
    // Defense-in-depth denylist mirroring the repository-layer projection: a bare
    // `{ password, ...rest }` would re-leak the reset token/expiry and OTP fields
    // the moment any of them slipped through, so strip the full credential set here.
    const {
      password,
      passwordResetToken,
      passwordResetExpiry,
      otp,
      otpExpiry,
      otpAttempts,
      ...userResponse
    } = user.toObject ? user.toObject() : user;

    // Populate leaderboard for this user
    let leaderboard = null;
    try {
      leaderboard = await getUserLeaderboard(id);
    } catch (err) {
      leaderboard = null;
    }

    // Attach latest personality test result
    let personality = null;
    try {
      const PersonalitySubmission = (await import('../models/PersonalitySubmission.js')).default;
      personality = await PersonalitySubmission.findOne({ userId: user._id }).sort({ createdAt: -1 }).lean();
    } catch (e) {
      console.error('Error fetching personality submission:', e);
    }
    return res.status(200).json({
      success: true,
      message: "✅ User retrieved successfully",
      data: {
        user: {
          ...userResponse,
          leaderboard, // <-- Add leaderboard to response
          personality: personality ? {
            resultType: personality.resultType,
            scores: personality.scores,
            createdAt: personality.createdAt
          } : null
        },
      },
      err: {},
    });
  } catch (err) {
    console.error("❌ Get User By ID Error:", err);
    return res.status(500).json({
      message: err.message,
      data: {},
      success: false,
      err: err.message,
    });
  }
};

export const blockUser = async (req, res) => {
  try {
    //console.log("📩 Request Body blockUser:", req.body);

    const { userId, isActive, isBanned, banReason } = req.body;

    if (!userId || typeof isActive !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "User ID and isActive (boolean) are required",
        data: {},
        err: { message: "Missing or invalid required fields" },
      });
    }

    // Check if the user exists
    const user = await userService.getUserById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
        data: {},
        err: { message: "User with this ID does not exist" },
      });
    }

    // Update isActive and ban status
    const updatedUser = await userService.blockUserById(userId, {
      isActive,
      isBanned,
      banReason: isBanned ? banReason : undefined,
    });

    //console.log(
    //   `✅ User ${isBanned ? "banned" : isActive ? "unblocked" : "blocked"
    //   } successfully:`,
    //   updatedUser._id
    // );

    // Connect to Redis
    const redis = await initRedis();

    // Update Redis cache with new user data
    const userCacheData = {
      _id: updatedUser._id,
      email: updatedUser.email,
      fullName: updatedUser.fullName,
      roles: updatedUser.roles,
      profilePicture: updatedUser.profilePicture,
      bio: updatedUser.bio,
      phone: updatedUser.phone,
      address: updatedUser.address,
      company: updatedUser.company, // <-- add company object
      education: updatedUser.education,
      skills: updatedUser.skills,
      enrolledCourses: updatedUser.enrolledCourses,
      teachingCourses: updatedUser.teachingCourses,
      qualifications: updatedUser.qualifications,
      isActive: updatedUser.isActive,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt,
    };

    // Cache updated user data (expires in 1 hour)
    await redis.setEx(`user:${userId}`, 3600, JSON.stringify(userCacheData));

    // Update user session cache if exists
    const userSessionKey = `user_session:${userId}`;
    const sessionExists = await redis.exists(userSessionKey);
    if (sessionExists) {
      await redis.setEx(userSessionKey, 3600, JSON.stringify(userCacheData));
    }

    //console.log("🗂️ Redis cache updated for user:", userId);

    return res.status(200).json({
      success: true,
      message: isBanned
        ? `User banned${banReason ? `: ${banReason}` : ""}`
        : `User ${isActive ? "unblocked" : "blocked"} successfully`,
      data: { user: updatedUser },
      err: {},
    });
  } catch (err) {
    console.error("❌ Block User Error:", err);
    return res.status(500).json({
      success: false,
      message: err.message,
      data: {},
      err: err.message,
    });
  }
};

export const changeUserPassword = async (req, res) => {
  try {
    const { oldPassword, newPassword, confirmPassword } = req.body;

    const userId = req.user?._id || req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    if (!oldPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message:
          "Old password, new password, and confirm password are required",
      });
    }

    const result = await userService.changeUserPassword(
      userId,
      oldPassword,
      newPassword,
      confirmPassword
    );

    return res.status(200).json({
      success: true,
      message: result.message || "Password changed successfully",
    });
  } catch (err) {
    console.error("❌ Change password error:", err);
    return res.status(400).json({
      success: false,
      message: err.message || "Failed to change password",
    });
  }
};

// Fixed Forgot Password Controller
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    //console.log("📩 Forgot password request for:", email);

    // Validate email
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
        data: {},
        err: { message: "Missing email field" },
      });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address",
        data: {},
        err: { message: "Invalid email format" },
      });
    }

    // Check if user exists
    const user = await userService.getUserByEmail(email);
    if (!user) {
      // Don't reveal if email exists or not for security
      return res.status(200).json({
        success: true,
        message:
          "If an account with that email exists, we've sent a password reset link.",
        data: {},
        err: {},
      });
    }

    // SECURITY: do not reveal account state. A blocked/inactive account gets the
    // exact same generic 200 as an unknown email (and no reset email is sent),
    // otherwise the distinct 403 confirms to an attacker that the address is
    // registered (user-enumeration oracle).
    if (!user.isActive) {
      return res.status(200).json({
        success: true,
        message:
          "If an account with that email exists, we've sent a password reset link.",
        data: {},
        err: {},
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    //console.log("🔑 Generated reset token for user:", user.email);

    // Save reset token to database
    await userService.savePasswordResetToken(
      user._id,
      resetToken,
      resetTokenExpiry
    );

    // Send reset email
    try {
      await emailService.sendPasswordResetEmail(
        email,
        resetToken,
        user.fullName || "User"
      );
      //console.log("✅ Password reset email sent successfully");
    } catch (emailError) {
      console.error("❌ Email sending failed:", emailError);
      // Continue with success response to avoid revealing issues
    }

    return res.status(200).json({
      success: true,
      message:
        "If an account with that email exists, we've sent a password reset link.",
      data: {},
      err: {},
    });
  } catch (error) {
    console.error("❌ Forgot password error:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong. Please try again later.",
      data: {},
      err: error.message,
    });
  }
};

// Fixed Reset Password Controller
export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword, confirmPassword } = req.body;

    //console.log("🔄 Password reset attempt with token");

    // Validate inputs
    if (!token || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Token, new password, and confirm password are required",
        data: {},
        err: { message: "Missing required fields" },
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "New password and confirm password do not match",
        data: {},
        err: { message: "Password mismatch" },
      });
    }

    // Password strength validation
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long",
        data: {},
        err: { message: "Password too short" },
      });
    }

    // Additional password strength checks
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({
        success: false,
        message:
          "Password must contain at least one uppercase letter, one lowercase letter, and one number",
        data: {},
        err: { message: "Password not strong enough" },
      });
    }

    // Reset password using service
    const result = await userService.resetPassword(token, newPassword);

    if (result.success) {
      //console.log("✅ Password reset successful");

      return res.status(200).json({
        success: true,
        message:
          "Password has been reset successfully. You can now login with your new password.",
        data: {},
        err: {},
      });
    }
  } catch (error) {
    console.error("❌ Reset password error:", error);

    // Handle specific error types
    if (error.message.includes("Invalid or expired")) {
      return res.status(400).json({
        success: false,
        message:
          "Reset token is invalid or has expired. Please request a new password reset.",
        data: {},
        err: error.message,
      });
    }

    return res.status(400).json({
      success: false,
      message: error.message || "Failed to reset password",
      data: {},
      err: error.message,
    });
  }
};

// Helper function to invalidate all user tokens
const invalidateUserTokens = async (userId) => {
  try {
    const redis = await initRedis();

    // Get all refresh token keys
    const refreshTokenKeys = await redis.keys(`refreshToken:*`);

    // Find and delete tokens belonging to this user
    for (const key of refreshTokenKeys) {
      const storedUserId = await redis.get(key);
      if (storedUserId === userId) {
        await redis.del(key);
        //console.log(`🗑️ Deleted refresh token: ${key}`);
      }
    }

    // Get all access token keys
    const accessTokenKeys = await redis.keys(`accessToken:*`);

    // Delete all access tokens (more secure approach)
    // In a production environment, you might want to maintain a user-token mapping
    for (const key of accessTokenKeys) {
      const tokenValue = await redis.get(key);
      if (tokenValue === "valid") {
        // You could implement additional logic here to check if token belongs to user
        // For now, we'll clear user-specific cache
      }
    }

    // Clear user cache and access token sets
    await redis.del(`user:accessTokens:web:${userId}`);
    await redis.del(`user:accessTokens:app:${userId}`);
    await redis.del(`user:${userId}`);
    await redis.del(`user_session:${userId}`);

    //console.log(`🗑️ User tokens and cache cleared for: ${userId}`);
  } catch (error) {
    console.error("❌ Error invalidating user tokens:", error);
  }
};

export const deleteDocument = async (req, res) => {
  try {
    const userId = req.user._id;
    const { documentId } = req.params;

    //console.log("🗑️ Deleting document:", { userId, documentId });

    if (!mongoose.Types.ObjectId.isValid(documentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid document ID format",
        data: {},
        err: "Invalid ObjectId",
      });
    }

    const deletedDoc = await userService.deleteDocumentById(userId, documentId);

    if (!deletedDoc) {
      return res.status(404).json({
        success: false,
        message: "Document not found or already deleted",
        data: {},
        err: "Document not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: `Document "${deletedDoc.name}" deleted successfully`,
      data: {
        name: deletedDoc.name,
        file: deletedDoc.Doc,
      },
      err: {},
    });
  } catch (error) {
    console.error("❌ Delete document error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete document",
      data: {},
      err: error.message,
    });
  }
};

export const deleteEducation = async (req, res) => {
  try {
    const userId = req.user._id; // Extracted from JWT
    const { educationId } = req.params;

    //console.log("🗑️ Deleting education:", { userId, educationId });

    // Validate education ID format
    if (!mongoose.Types.ObjectId.isValid(educationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid education ID format",
        data: {},
        err: "Invalid ObjectId",
      });
    }

    // Call service to delete education
    const deletedEducation = await userService.deleteEducationById(
      userId,
      educationId
    );

    if (!deletedEducation) {
      return res.status(404).json({
        success: false,
        message: "Education entry not found or already deleted",
        data: {},
        err: "Education not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: `Education entry from "${deletedEducation.institution}" deleted successfully`,
      data: {
        institution: deletedEducation.institution,
        degree: deletedEducation.degree,
        fieldOfStudy: deletedEducation.fieldOfStudy,
      },
      err: {},
    });
  } catch (error) {
    console.error("❌ Delete education error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete education entry",
      data: {},
      err: error.message,
    });
  }
};

export const getUserDashboard = async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 10 } = req.query;
    const dashboardData = await userService.getUserDashboard(
      userId,
      parseInt(page),
      parseInt(limit)
    );

    if (!dashboardData.courses.length) {
      return res.status(404).json({
        success: false,
        message: "No active courses found.",
        data: {
          allCoursesCount: dashboardData.allCoursesCount,
          activeCoursesCount: 0,
          certificatesCount: dashboardData.certificatesCount,
          courses: [],
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: dashboardData,
    });
  } catch (error) {
    console.error("Get User Dashboard Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve dashboard data",
      error: error.message,
    });
  }
};

// Logout the current session: blacklist the access token, drop the web refresh
// token, and clear the httpOnly auth cookies (essential now that web auth lives in
// cookies — clearing client storage alone would NOT end the session).
export const logout = async (req, res) => {
  try {
    const token =
      req.cookies?.accessToken ||
      (req.headers.authorization?.startsWith("Bearer ")
        ? req.headers.authorization.slice(7)
        : null) ||
      req.headers["x-access-token"];

    if (token && token !== "null" && token !== "undefined") {
      try {
        const decoded = jwt.decode(token);
        const exp = decoded?.exp ? decoded.exp * 1000 : Date.now() + 60 * 1000;
        await blacklistAccessToken(token, exp);
        if (decoded?._id) {
          // Revoke the refresh token for the platform that is logging out.
          // Mobile presents its refresh token via the X-Refresh-Token header;
          // web carries it in the httpOnly cookie. Previously this always
          // deleted only platform:"web", so mobile logout never revoked.
          const platform = req.headers["x-refresh-token"] ? "app" : "web";
          await UserRefreshToken.deleteMany({ userId: decoded._id, platform });
        }
      } catch (e) {
        // Non-fatal — still clear cookies below.
      }
    }

    Token.clearTokensCookies(res);
    return res.status(200).json({ success: true, message: "Logged out" });
  } catch (err) {
    Token.clearTokensCookies(res);
    return res.status(200).json({ success: true, message: "Logged out" });
  }
};

// API: POST /logout-all-sessions
export const logoutAllSessions = async (req, res) => {
  try {
    const userId = req.body.userId || req.user?._id;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID required",
        data: {},
        err: { message: "Missing user ID" }
      });
    }

    // Use the service method
    const result = await userService.logoutFromAllDevices(userId);

    // Also clear this device's auth cookies.
    Token.clearTokensCookies(res);

    return res.status(200).json({
      success: true,
      message: result.message,
      data: { userId },
      err: {}
    });
  } catch (err) {
    console.error("❌ logoutAllSessions controller error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to logout all sessions",
      data: {},
      err: err.message
    });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const userId = req.params.id;
    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const requester = req.user;

    //Allow only self or admin
    const isSelf = requester._id?.toString() === userId;
    const isAdmin =
      requester.roles?.includes("admin") || requester.role === "admin";

    if (!isSelf && !isAdmin) {
      return res
        .status(403)
        .json({
          success: false,
          message: "You are not authorized to delete this user",
        });
    }

    // 1. Delete all enrollments for this user
    await CourseEnrollment.deleteMany({ userId });

    // 2. Optionally: Remove user from enrolledStudents in Course and CourseBundle
    // (If you store user IDs in those arrays)
    await Course.updateMany({}, { $pull: { enrolledStudents: userId } });
    await CourseBundle.updateMany({}, { $pull: { enrolledStudents: userId } });

    // 3. Delete the user
    const deletedUser = await User.findByIdAndDelete(userId);

    // 4. Optionally: Remove user's created courses, assignments, etc. (if required)
    await Course.deleteMany({ instructorId: userId });
    await Assignment.deleteMany({ createdBy: userId });

    return res
      .status(200)
      .json({ success: true, message: "User and related records deleted" });
  } catch (error) {
    console.error("❌ Delete User Error:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: "Failed to delete user",
        error: error.message,
      });
  }
};

export const getOverviewDashboard = async (req, res) => {
  try {
    //console.log("📊 Fetching overview dashboard data");

    // Allow admin, instructor, and student roles (temporary for development)
    const allowedRoles = ['admin', 'instructor', 'student'];
    const userRole = req.user.role || (req.user.roles && req.user.roles[0]);

    if (!allowedRoles.includes(userRole) && !req.user.roles?.some(r => allowedRoles.includes(r))) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin, Instructor, or Student privileges required.",
        data: {},
        err: { message: "Unauthorized access" },
      });
    }

    const dashboardData = await userService.getOverviewDashboard();

    return res.status(200).json({
      success: true,
      message: "✅ Overview dashboard data retrieved successfully",
      data: dashboardData,
      err: {},
    });
  } catch (error) {
    console.error("❌ Get Overview Dashboard Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve overview dashboard data",
      data: {},
      err: error.message,
    });
  }
};

export const banOrShadowBanUser = async (req, res) => {
  try {
    const { userId, banType, banReason } = req.body;
    if (!userId || !banType || !["ban", "shadowBan"].includes(banType)) {
      return res.status(400).json({
        success: false,
        message: "userId and banType ('ban' or 'shadowBan') are required",
        err: {},
      });
    }

    // Only admin can ban/shadow-ban
    if (!req.user.roles?.includes("admin") && req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin privileges required",
        err: {},
      });
    }

    const updatedUser = await userService.banOrShadowBanUser(
      userId,
      banType,
      banReason
    );

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
        err: {},
      });
    }

    return res.status(200).json({
      success: true,
      message:
        banType === "ban"
          ? `User banned${banReason ? `: ${banReason}` : ""}`
          : `User shadow banned${banReason ? `: ${banReason}` : ""}`,
      data: { user: updatedUser },
      err: {},
    });
  } catch (err) {
    console.error("❌ Ban/ShadowBan User Error:", err);
    return res.status(500).json({
      success: false,
      message: err.message,
      err: err.message,
    });
  }
};

export const unbanUser = async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required",
        err: {},
      });
    }

    // Only admin can unban
    if (!req.user.roles?.includes("admin") && req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin privileges required",
        err: {},
      });
    }

    const updatedUser = await userService.unbanUser(userId);

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
        err: {},
      });
    }

    return res.status(200).json({
      success: true,
      message: "User unbanned successfully",
      data: { user: updatedUser },
      err: {},
    });
  } catch (err) {
    console.error("❌ Unban User Error:", err);
    return res.status(500).json({
      success: false,
      message: err.message,
      err: err.message,
    });
  }
};

export const listDeviceApprovalRequests = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "", status } = req.query;

    // Convert query params to numbers
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    if (isNaN(pageNum) || pageNum < 1 || isNaN(limitNum) || limitNum < 1) {
      return res.status(400).json({
        message: "Invalid page or limit parameters",
        data: {},
        success: false,
        err: { message: "Page and limit must be positive numbers" },
      });
    }

    // Validate status if provided
    const allowedStatuses = ["pending", "approved", "rejected"];
    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: "Invalid status parameter",
        data: {},
        success: false,
        err: { message: "Status must be one of: pending, approved, rejected" },
      });
    }

    // Build query
    const query = {};
    if (status) {
      query.status = status;
    }

    if (search) {
      // Find matching users first to search by user name or email
      const matchingUsers = await User.find({
        $or: [
          { email: { $regex: search, $options: "i" } },
          { fullName: { $regex: search, $options: "i" } },
        ],
      }).select("_id").lean();

      const matchingUserIds = matchingUsers.map((user) => user._id);

      query.$or = [
        { deviceId: { $regex: search, $options: "i" } },
        { "deviceInfo.platform": { $regex: search, $options: "i" } },
        { "deviceInfo.deviceName": { $regex: search, $options: "i" } },
        { userId: { $in: matchingUserIds } }
      ];
    }

    // Get total count of matching documents
    const totalDocuments = await DeviceApproval.countDocuments(query);

    // Fetch device approvals with pagination, user population, and sort desc
    const deviceApprovals = await DeviceApproval.find(query)
      .populate("userId", "fullName email profilePicture roles")
      .select(
        "_id userId deviceId deviceInfo status requestedAt approvedAt approvedBy isActive isFirstDevice"
      )
      .sort({ requestedAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean();

    return res.status(200).json({
      success: true,
      message: "✅ Device approval requests retrieved successfully",
      data: {
        deviceApprovals,
        total: totalDocuments,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalDocuments / limitNum),
      },
      err: {},
    });
  } catch (err) {
    console.error(
      "❌ Error retrieving device approval requests:",
      err?.message
    );
    return res.status(500).json({
      message: "Failed to retrieve device approval requests",
      data: {},
      success: false,
      err: err.message,
    });
  }
};

// Approve a device approval request
export const manageDeviceRequest = async (req, res) => {
  try {
    const { deviceApprovalId, status, rejectionReason } = req.body;
    const adminId = req.user._id; // Assuming req.user is set by passport middleware

    // Validate inputs
    if (!deviceApprovalId) {
      return res.status(400).json({
        message: "Device approval ID is required",
        data: {},
        success: false,
        err: { message: "Missing required field" },
      });
    }

    if (!status || !["approve", "reject"].includes(status)) {
      return res.status(400).json({
        message: "Status must be 'approve' or 'reject'",
        data: {},
        success: false,
        err: { message: "Invalid status" },
      });
    }

    if (status === "reject" && !rejectionReason) {
      return res.status(400).json({
        message: "Rejection reason is required for rejecting a device",
        data: {},
        success: false,
        err: { message: "Missing rejection reason" },
      });
    }

    const deviceApproval = await DeviceApproval.findById(deviceApprovalId);
    if (!deviceApproval) {
      return res.status(404).json({
        message: "Device approval request not found",
        data: {},
        success: false,
        err: { message: "Device approval not found" },
      });
    }

    if (deviceApproval.status !== "pending") {
      return res.status(400).json({
        message: `Device is already ${deviceApproval.status}`,
        data: {},
        success: false,
        err: { message: `Device already ${deviceApproval.status}` },
      });
    }

    // Handle approve or reject
    if (status === "approve") {
      // Deactivate all other DIFFERENT devices for the same user
      await DeviceApproval.updateMany(
        { userId: deviceApproval.userId, deviceId: { $ne: deviceApproval.deviceId }, isActive: true },
        { $set: { isActive: false } }
      );

      // Also mark all other pending requests FOR THE SAME DEVICE as approved and active
      await DeviceApproval.updateMany(
        { userId: deviceApproval.userId, deviceId: deviceApproval.deviceId, status: "pending" },
        {
          $set: {
            status: "approved",
            isActive: true,
            approvedAt: new Date(),
            approvedBy: adminId
          }
        }
      );

      // Approve the current device request record
      deviceApproval.status = "approved";
      deviceApproval.isActive = true;
      deviceApproval.approvedAt = new Date();
      deviceApproval.approvedBy = adminId;
      deviceApproval.rejectionReason = null;
    } else {
      // Reject the device (and other pending requests for the same device)
      await DeviceApproval.updateMany(
        { userId: deviceApproval.userId, deviceId: deviceApproval.deviceId, status: "pending" },
        {
          $set: {
            status: "rejected",
            isActive: false,
            rejectionReason: rejectionReason,
            approvedBy: adminId
          }
        }
      );

      deviceApproval.status = "rejected";
      deviceApproval.isActive = false;
      deviceApproval.approvedAt = null;
      deviceApproval.approvedBy = adminId;
      deviceApproval.rejectionReason = rejectionReason;
    }

    await deviceApproval.save();

    // Log the action in LoginLog
    const deviceInfo = deviceApproval.deviceInfo || {};
    const logStatus =
      status === "approve" ? "device_approved" : "device_rejected";
    await createLoginLog(
      deviceApproval.userId,
      deviceApproval.deviceId,
      deviceInfo,
      logStatus
    );

    return res.status(200).json({
      success: true,
      message: `✅ Device approval request ${status}d successfully`,
      data: { deviceApproval },
      err: {},
    });
  } catch (err) {
    console.error(
      `❌ Error ${status === "approve" ? "approving" : "rejecting"
      } device request:`,
      err?.message
    );
    return res.status(500).json({
      message: `Failed to ${status === "approve" ? "approve" : "reject"
        } device request`,
      data: {},
      success: false,
      err: err.message,
    });
  }
};

// Add this to your routes file
export const searchUsers = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: "Authentication failed" });
    }

    const { q } = req.query;
    const currentUserId = req.user._id;

    if (!q || q.trim().length === 0) {
      return res.status(400).json({ message: "Search query is required" });
    }

    // Search users by name or email, exclude current user
    const users = await User.find({
      _id: { $ne: currentUserId },
      $or: [
        { fullName: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
      ],
    })
      .select("fullName email")
      .limit(20)
      .lean();

    return res.status(200).json({
      message: "Users found successfully",
      users,
    });
  } catch (error) {
    console.error("Search users error:", error);
    return res.status(500).json({ message: "Failed to search users" });
  }
};


export const sendOtpviaemail = async (req, res) => {
  try {
    const { email } = req.body;

    // Validate email
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
        data: {},
        err: { message: "Missing email field" },
      });
    }

    //check email already exist and verify 

    const user = await userService.getUserByEmail(email);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        is_exist: false,
        is_verify: false,
        message: "Please provide a valid email address",
        data: {},
        err: { message: "Invalid email format" },
      });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Connect to Redis
    const redis = await initRedis();

    // Store OTP in Redis with 10-minute expiration
    await redis.setEx(`otp:${email}`, 600, otp);

    // Send OTP email
    try {
      await emailService.sendOtpEmail(email, otp);
      //console.log("✅ OTP email sent successfully");
    } catch (emailError) {
      console.error("❌ Email sending failed:", emailError);
      // Continue with success to avoid revealing issues
    }

    // SECURITY NOTE: is_exist / is_verify are a user-enumeration oracle (they
    // reveal whether an email is registered). They CANNOT be removed yet: the
    // Flutter app (lms_app email_verification_dialog.dart, new_checkout_screen.dart)
    // and the web checkout (frontend Checkout.jsx) branch their signup/checkout
    // flows on these booleans. Removing them requires a coordinated client
    // release. The HTTP status and message are kept uniform regardless of
    // account existence.
    return res.status(200).json({
      success: true,
      is_exist: user ? true : false,
      is_verify: user ? user.is_verify : false,
      message: "OTP has been sent to the provided email.",
      data: {},
      err: {},
    });
  } catch (error) {
    console.error("❌ Send OTP error:", error);
    return res.status(500).json({
      success: false,
      is_exist: false,
      is_verify: false,
      message: "Something went wrong. Please try again later.",
      data: {},
      err: error.message,
    });
  }
};

export const googleLogin = async (req, res) => {
  try {
    const { platform, deviceId } = req.body;

    // SECURITY: this endpoint previously trusted a client-supplied `email`, so an
    // attacker could authenticate as ANY account (including admins) just by POSTing
    // that account's email — a full account-takeover. We now require a Google OAuth
    // access token and verify it server-side against Google, deriving the identity
    // (email/name) from Google's verified response — never from the request body.
    const googleAccessToken = req.body.googleAccessToken || req.body.accessToken;
    if (!googleAccessToken) {
      return res.status(400).json({
        message: "Google access token is required",
        success: false,
      });
    }

    let googleProfile;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${googleAccessToken}` },
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!userInfoRes.ok) {
        return res.status(401).json({ message: "Invalid Google credentials", success: false });
      }
      googleProfile = await userInfoRes.json();
    } catch (e) {
      return res.status(401).json({ message: "Could not verify Google credentials", success: false });
    }

    const email = String(googleProfile.email || "").toLowerCase().trim();
    const emailVerified =
      googleProfile.email_verified === true || googleProfile.email_verified === "true";
    if (!email || !emailVerified) {
      return res.status(401).json({ message: "Google account email is not verified", success: false });
    }
    const fullName = googleProfile.name || googleProfile.given_name || "Google User";

    const isWeb = platform === 'web';

    // Build device info same as login
    const deviceInfo = {
      platform: platform || "web",
      userAgent: req.headers["user-agent"] || "",
      ipAddress: req.ip || req.connection.remoteAddress || "",
      deviceName: req.body.deviceName || "",
      ...parseUserAgent(req.headers["user-agent"] || "")
    };

    // Google signup or find user — `email` is now a Google-verified identity.
    const { user: newUser, existed } = await userService.googlesignup(
      { email, fullName, role: "student", is_verify: true },
      res
    );

    const userId = newUser._id.toString();

    // Record device for tracking — non-blocking
    if (deviceId) {
      try {
        if (existed) {
          // User already existed — this could be a different person logging in
          // via Google with the same email. Always create a fresh pending request
          // (deactivate old ones for this device) so the admin is notified.
          await DeviceApproval.updateMany(
            { userId, deviceId },
            { $set: { isActive: false } }
          );
          await DeviceApproval.create({
            userId,
            deviceId,
            deviceInfo,
            status: "pending",
          });
        } else {
          // New user — only create if no record exists for this device
          const existingDevice = await DeviceApproval.findOne({ userId, deviceId });
          if (!existingDevice) {
            await DeviceApproval.create({
              userId,
              deviceId,
              deviceInfo,
              status: "pending",
            });
          }
        }
      } catch (e) {
        console.error("Device approval record error:", e.message, e);
      }
    }

    const { accessToken, refreshToken, accessTokenExp, refreshTokenExp } = await Token.generateTokens(newUser, platform || "web", deviceId);

    const redis = await initRedis();

    // Store tokens in Redis with TTL
    if (redis) {
      const accessTTL = Math.max(1, Math.floor((accessTokenExp - Date.now()) / 1000));
      const refreshTTL = Math.max(1, Math.floor((refreshTokenExp - Date.now()) / 1000));

      await redis.set(`accessToken:${accessToken}`, "valid", { EX: accessTTL });
      await redis.set(`refreshToken:${refreshToken}`, userId, { EX: refreshTTL });
    }

    await redis.setEx(
      `user:${userId}`,
      3600,
      JSON.stringify({
        _id: newUser._id,
        email: newUser.email,
        fullName: newUser.fullName,
        roles: newUser.roles,
        profilePicture: newUser.profilePicture,
        bio: newUser.bio,
        phone: newUser.phone,
        address: newUser.address,
        company: newUser.company,
        createdAt: newUser.createdAt,
        updatedAt: newUser.updatedAt,
        is_verify: newUser.is_verify,
      })
    );

    Token.setTokensCookies(res, accessToken, refreshToken);

    // SECURITY: web clients authenticate exclusively via the httpOnly cookies set
    // above — echoing the raw JWTs in the JSON body lets any XSS read/exfiltrate
    // them, defeating the httpOnly protection. Only mobile/app clients (which use
    // the Authorization header and cannot read cookies) get body tokens.
    return res.status(200).json({
      success: true,
      message: "Google login successful",
      data: {
        user: newUser,
        accessToken, refreshToken,
      },
    });
  } catch (err) {
    return res.status(500).json({
      message: "Google login error",
      success: false,
      err: err.message,
    });
  }
};





export const verifyOtpviaemail = async (req, res) => {
  try {
    const { email, otp } = req.body;

    // Validate inputs
    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required",
        data: {},
        err: { message: "Missing required fields" },
      });
    }

    // Connect to Redis
    const redis = await initRedis();

    // Get stored OTP
    const storedOtp = await redis.get(`otp:${email}`);

    if (!storedOtp) {
      return res.status(400).json({
        success: false,
        message: "OTP is invalid or expired",
        data: {},
        err: { message: "Invalid or expired OTP" },
      });
    }

    if (storedOtp !== otp.toString()) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
        data: {},
        err: { message: "OTP mismatch" },
      });
    }

    // Delete OTP from Redis after successful verification
    await redis.del(`otp:${email}`);

    return res.status(200).json({
      success: true,
      message: "OTP verified successfully",
      data: {},
      err: {},
    });
  } catch (error) {
    console.error("❌ Verify OTP error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to verify OTP",
      data: {},
      err: error.message,
    });
  }
};

// Check device approval status (called from course page)
export const checkDeviceApprovalStatus = async (req, res) => {
  try {
    const { deviceId } = req.query;
    const userId = req.user._id;

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message: "deviceId is required",
        data: {},
        err: { message: "Missing deviceId" },
      });
    }

    // First, look for any active approved record for this device
    let deviceApproval = await DeviceApproval.findOne({
      userId,
      deviceId,
      status: "approved",
      isActive: true,
    }).sort({ requestedAt: -1 });

    // If no active approved record found, look for the most recent record of any status
    if (!deviceApproval) {
      deviceApproval = await DeviceApproval.findOne({
        userId,
        deviceId,
      }).sort({ requestedAt: -1 });
    }

    const approved = deviceApproval?.status === "approved" && deviceApproval?.isActive === true;

    return res.status(200).json({
      success: true,
      message: approved ? "Device is approved" : "Device is not approved",
      data: {
        approved,
        deviceStatus: deviceApproval?.status || "no_device",
        deviceApproval: deviceApproval
          ? {
            id: deviceApproval._id,
            status: deviceApproval.status,
            isActive: deviceApproval.isActive,
            isFirstDevice: deviceApproval.isFirstDevice,
          }
          : null,
      },
      err: {},
    });
  } catch (err) {
    console.error("Error checking device approval status:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to check device approval status",
      data: {},
      err: err.message,
    });
  }
};

// Update user role (Admin only)
export const updateUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
        data: {},
        err: { message: 'userId is required' },
      });
    }

    if (!role || !['admin', 'instructor', 'student'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Valid role is required (admin, instructor, or student)',
        data: {},
        err: { message: 'Invalid role' },
      });
    }

    const user = await userService.getUserById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        data: {},
        err: {},
      });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { role },
      { new: true }
    ).select('-password');

    return res.status(200).json({
      success: true,
      message: 'User role updated successfully',
      data: { user: updatedUser },
      err: {},
    });
  } catch (error) {
    console.error('❌ Update User Role Error:', error);
    return res.status(500).json({
      success: false,
      message: error.message,
      data: {},
      err: error.message,
    });
  }
};



