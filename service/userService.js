import UserRepository from "../repository/userRepository.js";
import { getUserLeaderboard } from '../service/leaderboardService.js';
import { revokeAllUserSessions } from "../utils/tokens/generateTokens.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";

// Password-reset tokens are password-equivalents: only their sha256 hash is
// stored at rest, the raw token only ever travels in the reset email/URL.
const hashResetToken = (resetToken) =>
  crypto.createHash("sha256").update(String(resetToken)).digest("hex");

class UserService {
  constructor() {
    this.userRepository = new UserRepository();
  }

  // Password comparison
  // Async Password comparison
  async comparePassword(inputPassword, hashedPassword) {
    try {
      // SECURITY: never log plaintext passwords or password hashes.
      const isMatch = await bcrypt.compare(inputPassword, hashedPassword);
      if (isMatch) {
        //console.log("✅ Password match successful");
      } else {
        console.warn("❌ Password match failed");
      }
      return isMatch; // ✅ This is correct
    } catch (error) {
      console.error("❌ Password comparison error:", error);
      return false; // ✅ This is also correct
    }
  }


  // Password hashing
  async hashPassword(password) {
    try {
      const salt = await bcrypt.genSalt(10);
      const hashed = await bcrypt.hash(password, salt);
      return hashed;
    } catch (error) {
      console.error("❌ Error during password hashing:", error);
      throw new Error("Failed to hash password");
    }
  }

  async adminCreateUser({ email, password, fullName, role }) {
    const hashedPassword = await this.hashPassword(password);
    return await this.userRepository.create({
      email,
      password: hashedPassword,
      fullName,
      role, // always 'student'
      emailVerified: true // since admin creates, assume verified
    });
  }




  async getUserByEmail(email) {
    try {
      return await this.userRepository.findBy({ email, status: { $ne: 'inactive' } });
    } catch (error) {
      console.error("getUserByEmail error:", error);
      throw error;
    }
  }

  async getUserById(id) {
    try {
      const user = await this.userRepository.findBy({ _id: id });
      // Ensure enrollments include accessExpiry and enrolledAt
      if (user && Array.isArray(user.enrollments)) {
        user.enrollments = user.enrollments.map(enrollment => ({
          ...enrollment,
          accessExpiry: enrollment.accessExpiry,
          enrolledAt: enrollment.enrolledAt || enrollment.createdAt
        }));
      }
      return user;
    } catch (error) {
      console.error("getUserById error:", error);
      throw error;
    }
  }

  //googlesignup
  async googlesignup({ email, password, fullName, role, is_verify }) {
    try {
      const existingUser = await this.userRepository.findBy({ email });
      if (!existingUser) {
        // Google accounts have no local password — generate a strong random one so
        // the account can't be accessed with a guessable/known credential.
        const pwd = password || crypto.randomBytes(32).toString("hex");
        const hashedPassword = await this.hashPassword(pwd);
        return await this.userRepository.create({
          fullName,
          email,
          password: hashedPassword,
          // SECURITY: never provision a Google account with an elevated role.
          role: "student",
          is_verify // Include is_verify in the create call
        });

      } else {
        return existingUser;

      }
    } catch (error) {
      console.error("signup error:", error);
      throw error;
    }
  }




  async signup({ fullName, email, password, role, is_verify, phone = '' }) {
    try {
      // SECURITY: never fall back to a shared hardcoded password ("student").
      // Every guest/OAuth account created with that constant could be taken over
      // via POST /login with the known password. If no password is supplied,
      // generate a per-account cryptographically random one instead.
      const hashedPassword = await this.hashPassword(
        password ? password : crypto.randomBytes(32).toString("hex")
      );
      return await this.userRepository.create({
        fullName,
        email,
        password: hashedPassword,
        role,
        is_verify, // Include is_verify in the create call
        phone
      });
    } catch (error) {
      console.error("signup error:", error);
      throw error;
    }
  }

  async login(email, password) {
    try {
      if (!email || !password) {
        //console.log("⚠️ Missing email or password");
        return { success: false, message: "Email and password are required" };
      }

      //console.log("🔹 Attempting login for email:", email);
      // Auth needs the password hash for bcrypt comparison — opt into sensitive fields.
      const user = await this.userRepository.findOne({ email }, { includeSensitive: true });

      if (!user || !user._id) {
        //console.log("⚠️ No user found with this email.");
        return { success: false, message: "Invalid email or password" };
      }

      const userObj = user.toObject ? user.toObject() : user;

      if (userObj.status === 'inactive') {
        //console.log("⚠️ Account is inactive");
        return {
          success: false,
          message: "No Account Found. Please contact support.",
          code: "INACTIVE_ACCOUNT"
        };
      }

      const isPasswordValid = await this.comparePassword(password, userObj.password);
      //console.log("🔹 Password valid:", isPasswordValid);

      if (!isPasswordValid) {
        //console.log("⚠️ Invalid password.");
        return { success: false, message: "Invalid email or password" };
      }

      //console.log("✅ Login successful for user:", userObj.email);
      // Return user directly in the success case
      return { success: true, userObj };
    } catch (error) {
      console.error("❌ Login error:", error?.message || error);
      return { success: false, message: "An error occurred during login" };
    }
  }


  async getAllUsers(page = 1, limit = 10, filter = {}, sort = {}) {
    try {
      const skip = (page - 1) * limit;
      const users = await this.userRepository.findMany(filter, sort, skip, limit);
      const total = await this.userRepository.count(filter);
      return { users, page, limit, total };
    } catch (error) {
      console.error("getAllUsers error:", error);
      throw error;
    }
  }

  async updateUserById(userId, updateData) {
    try {
      //console.log("🔄 Updating user by ID:", userId);
      //console.log("🧪 [DEBUG] Update Data:", updateData);
      return await this.userRepository.updateById(userId, updateData);
    } catch (error) {
      console.error("updateUserById error:", error);
      throw error;
    }
  }

  async blockUserById(userId, updateData) {
    try {
      return await this.userRepository.updateById(userId, updateData);
    } catch (error) {
      console.error("blockUserById error:", error);
      throw error;
    }
  }

  async changeUserPassword(userId, oldPassword, newPassword, confirmPassword) {
    //console.log("🔄 Starting password change process for user:", userId);
    //console.log("🧪 [DEBUG] Old Password:", oldPassword);
    //console.log("🧪 [DEBUG] New Password:", newPassword);
    //console.log("🧪 [DEBUG] Confirm Password:", confirmPassword);

    try {
      if (!userId || !oldPassword || !newPassword || !confirmPassword) {
        console.warn("⚠️ Validation failed: Missing required fields");
        throw new Error("All fields are required");
      }

      //console.log("✅ All input fields provided");
      // Verifying the current password requires the stored hash — opt into sensitive fields.
      const user = await this.userRepository.findBy({ _id: userId }, { includeSensitive: true });

      if (!user) {
        console.warn("❌ User not found for ID:", userId);
        throw new Error("User not found");
      }

      //console.log("🔍 User fetched successfully:", user.email);

      // const isOldPasswordValid = await this.comparePassword(oldPassword, user.password);
      const isOldPasswordValid = await this.comparePassword(oldPassword, user.password);

      if (!isOldPasswordValid) {
        console.warn("❌ Incorrect old password for user:", user.email);
        throw new Error("Current password is incorrect");
      }

      //console.log("🔒 Old password verified successfully");

      if (newPassword !== confirmPassword) {
        console.warn("⚠️ New password and confirm password do not match");
        throw new Error("New password and confirm password do not match");
      }

      if (newPassword.length < 6) {
        console.warn("⚠️ New password is too short");
        throw new Error("New password must be at least 6 characters long");
      }

      const isSameAsOld = await this.comparePassword(newPassword, user.password);
      if (isSameAsOld) {
        console.warn("⚠️ New password is same as the old password");
        throw new Error("New password must be different from current password");
      }

      //console.log("🔧 All validations passed, proceeding to hash new password");
      const newHashedPassword = await this.hashPassword(newPassword);
      //console.log("🔐 New password hashed successfully");

      const updatedUser = await this.userRepository.update(userId, {
        password: newHashedPassword,
        passwordChangedAt: new Date()
      });

      if (!updatedUser) {
        console.error("❌ Failed to update password in database");
        throw new Error("Failed to update password");
      }

      // SECURITY: a password change must terminate every existing session,
      // otherwise a stolen refresh token (30d) keeps minting fresh access tokens
      // after the user has changed their password. Mirrors the logout-all flow:
      // delete all refresh tokens + blacklist tracked access tokens. Best-effort —
      // the password is already changed, and stale access tokens are also rejected
      // by the passwordChangedAt check in the JWT strategy.
      try {
        await revokeAllUserSessions(userId);
      } catch (revokeError) {
        console.error("❌ Failed to revoke sessions after password change:", revokeError.message);
      }

      //console.log("✅ Password updated successfully for user:", user.email);
      return { success: true, message: "Password updated successfully" };
    } catch (error) {
      console.error("❌ Error during changeUserPassword:", error.message);
      throw error;
    }
  }


  async savePasswordResetToken(userId, resetToken, resetTokenExpiry) {
    try {
      // SECURITY: store only the sha256 hash of the reset token. A DB dump/backup
      // (or an over-broad query) must never yield directly-usable reset tokens.
      // The raw token is emailed to the user and re-hashed on redemption.
      const updatedUser = await this.userRepository.update(userId, {
        passwordResetToken: hashResetToken(resetToken),
        passwordResetExpiry: resetTokenExpiry
      });

      if (!updatedUser) {
        throw new Error("Failed to save reset token - user not found");
      }

      //console.log("✅ Reset token saved for user:", userId);
      return updatedUser;
    } catch (error) {
      console.error("❌ Save reset token error:", error);
      throw new Error("Failed to save reset token");
    }
  }

  async resetPassword(resetToken, newPassword) {
    try {
      // SECURITY: the DB holds only the sha256 hash of the reset token, so hash
      // the user-supplied value before the lookup (hashResetToken also coerces to
      // string, neutralising NoSQL operator injection via req.body.token).
      const user = await this.userRepository.findBy({
        passwordResetToken: hashResetToken(resetToken),
        passwordResetExpiry: { $gt: new Date() }
      });

      if (!user) throw new Error("Invalid or expired reset token");
      if (!user.isActive) throw new Error("Account is blocked. Please contact support.");

      const hashedPassword = await this.hashPassword(newPassword);
      const updatedUser = await this.userRepository.update(user._id, {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpiry: null,
        passwordChangedAt: new Date()
      });

      if (!updatedUser) throw new Error("Failed to reset password");

      // SECURITY: a password reset is the user's primary "I've been compromised"
      // remedy — it must log out every existing session (including an attacker's
      // stolen refresh/access tokens). Best-effort: the reset itself succeeded,
      // and the JWT strategy's passwordChangedAt check rejects stale access
      // tokens even if blacklisting fails here.
      try {
        await revokeAllUserSessions(user._id);
      } catch (revokeError) {
        console.error("❌ Failed to revoke sessions after password reset:", revokeError.message);
      }

      //console.log("✅ Password reset successfully for user:", user.email);
      return { success: true, message: "Password reset successfully" };
    } catch (error) {
      console.error("❌ Reset password service error:", error);
      throw error;
    }
  }

  async deleteDocumentById(userId, documentId) {
    try {
      const user = await this.userRepository.findBy({ _id: userId });
      if (!user) throw new Error("User not found");

      const document = user.documentation.find(doc => doc._id?.toString() === documentId);
      if (!document) throw new Error("Document not found in user's documentation");

      await this.userRepository.deleteDocumentFromArray(userId, documentId);
      //console.log("✅ Document deleted successfully for user:", userId);
      return document;
    } catch (error) {
      console.error("❌ Delete document service error:", error);
      throw error;
    }
  }


  // services/userService.js
  async deleteEducationById(userId, educationId) {
    try {
      const user = await this.userRepository.findBy({ _id: userId });
      if (!user) throw new Error("User not found");

      // Find the education entry in the user's education array
      const education = user.education.find(edu => edu._id?.toString() === educationId);
      if (!education) throw new Error("Education entry not found in user's education");

      // Delete the education entry from the user's education array
      await this.userRepository.deleteEducationFromArray(userId, educationId);
      //console.log("✅ Education deleted successfully for user:", userId);
      return education;
    } catch (error) {
      console.error("❌ Delete education service error:", error);
      throw error;
    }
  }


  async getUserDashboard(userId, page = 1, limit = 10) {
    try {
      const [courses, allCoursesCount, activeCoursesCount, certificatesCount] = await Promise.all([
        this.userRepository.getActiveCoursesByUserId(userId, page, limit),
        this.userRepository.countAllCoursesByUserId(userId),
        this.userRepository.countActiveCoursesByUserId(userId),
        this.userRepository.countCertificatesByUserId(userId),
      ]);

      // Leaderboard population
      let leaderboard = null;
      try {
        leaderboard = await getUserLeaderboard(userId); // Use named import function
      } catch (err) {
        leaderboard = null;
      }

      return { allCoursesCount, activeCoursesCount, certificatesCount, courses, leaderboard };
    } catch (error) {
      throw new Error(`Dashboard service error: ${error.message}`);
    }
  }

  async getOverviewDashboard() {
    try {
      //console.log("📡 Fetching overview dashboard data from repository");

      const dashboardData = await this.userRepository.getOverviewDashboard();

      return {
        counts: {
          totalCourses: dashboardData.totalCourses,
          totalSupportTickets: dashboardData.totalSupportTickets,
          totalStudents: dashboardData.totalStudents,
          totalForumThreads: dashboardData.totalForumThreads,
          todaySales: dashboardData.todaySales,
          thisMonthSales: dashboardData.thisMonthSales,
          thisYearSales: dashboardData.thisYearSales,
          totalSales: dashboardData.totalSales,
          platformIncome: dashboardData.platformIncome
        },
        latest: {
          courses: dashboardData.latestCourses,
          supportTickets: dashboardData.latestSupportTickets,
          forumThreads: dashboardData.latestForumThreads
        }
      };
    } catch (error) {
      console.error("❌ Overview dashboard service error:", error);
      throw new Error(`Failed to fetch overview dashboard data: ${error.message}`);
    }
  }

  async banOrShadowBanUser(userId, banType, banReason) {
    try {
      let updateData = {};
      if (banType === "ban") {
        updateData = { isBanned: true, banReason, isShadowBanned: false, isActive: false };
      } else if (banType === "shadowBan") {
        updateData = { isShadowBanned: true, banReason, isBanned: false, isActive: true };
      }
      return await this.userRepository.updateById(userId, updateData);
    } catch (error) {
      console.error("banOrShadowBanUser error:", error);
      throw error;
    }
  }

  async unbanUser(userId) {
    try {
      // Remove both ban and shadowBan flags, clear banReason, set active
      const updateData = { isBanned: false, isShadowBanned: false, banReason: null, isActive: true };
      return await this.userRepository.updateById(userId, updateData);
    } catch (error) {
      console.error("unbanUser error:", error);
      throw error;
    }
  }

  async logoutFromAllDevices(userId) {
    try {
      const { initRedis } = await import("../config/redisClient.js");
      const { cleanupExpiredAccessTokensForUser, getAllAccessTokensForUser, blacklistAccessToken } = await import("../utils/tokens/generateTokens.js");
      const jwt = await import("jsonwebtoken");
      const UserRefreshToken = (await import("../models/UserRefreshToken.js")).default;

      // Connect to Redis
      const redis = await initRedis();

      // Get all refresh token keys and find tokens belonging to this user
      const refreshTokenKeys = await redis.keys(`refreshToken:*`);
      const userAccessTokens = [];

      for (const key of refreshTokenKeys) {
        const storedUserId = await redis.get(key);
        if (storedUserId === userId.toString()) {
          // Extract the actual refresh token from the key
          const refreshToken = key.replace('refreshToken:', '');

          // Try to get associated access tokens (if your system stores this mapping)
          // If not, we'll get them from the utility function
          await redis.del(key);
        }
      }

      // Cleanup expired tokens first for both platforms
      await cleanupExpiredAccessTokensForUser(userId, "web");
      await cleanupExpiredAccessTokensForUser(userId, "app");

      // Get all active access tokens for the user from both platforms
      const webTokens = await getAllAccessTokensForUser(userId, "web");
      const appTokens = await getAllAccessTokensForUser(userId, "app");
      const tokens = [...webTokens, ...appTokens];

      // Blacklist all active access tokens immediately
      for (const token of tokens) {
        try {
          const decoded = jwt.default.decode(token);
          const exp = decoded?.exp ? decoded.exp * 1000 : Date.now() + (24 * 60 * 60 * 1000); // 24 hours from now if no exp

          // Blacklist the token with proper expiration
          await blacklistAccessToken(token, exp);

          // Also remove from Redis access token store
          await redis.del(`accessToken:${token}`);

          console.log(`🚫 Blacklisted access token for user: ${userId}`);
        } catch (tokenError) {
          console.error("❌ Error processing token:", tokenError);
          // Continue with other tokens even if one fails
        }
      }

      // Clear both Redis sets
      await redis.del(`user:accessTokens:web:${userId}`);
      await redis.del(`user:accessTokens:app:${userId}`);

      // Delete all refresh tokens from database
      await UserRefreshToken.deleteMany({ userId });

      // Get all access token keys from Redis and remove user's tokens
      const accessTokenKeys = await redis.keys(`accessToken:*`);

      for (const key of accessTokenKeys) {
        try {
          const token = key.replace('accessToken:', '');
          const decoded = jwt.default.decode(token);

          // Check if token belongs to this user
          if (decoded && decoded.userId === userId.toString()) {
            await redis.del(key);

            // Ensure it's blacklisted
            const exp = decoded.exp ? decoded.exp * 1000 : Date.now() + (24 * 60 * 60 * 1000);
            await blacklistAccessToken(token, exp);
          }
        } catch (error) {
          // Continue with other tokens
          console.error("❌ Error processing access token key:", error);
        }
      }

      // Clear user cache
      await redis.del(`user:${userId}`);
      await redis.del(`user_session:${userId}`);

      console.log(`✅ All sessions logged out and tokens blacklisted for user: ${userId}`);
      return {
        success: true,
        message: "Successfully logged out from all devices and blacklisted all tokens"
      };
    } catch (error) {
      console.error("❌ Error in logoutFromAllDevices service:", error);
      throw new Error("Failed to logout from all devices");
    }
  }
}

export default UserService;
