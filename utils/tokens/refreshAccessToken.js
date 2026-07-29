import User from "../../models/user.js";
import UserRefreshToken from "../../models/UserRefreshToken.js";
import { generateTokens } from "./generateTokens.js";
import { verifyRefreshToken } from "./verifyToken.js";

const refreshAccessToken = async (req, res) => {
  try {
    let oldRefreshToken = req.cookies.refreshToken || req.headers["x-refresh-token"];

    //console.log("🔄 Raw refresh token:", oldRefreshToken ? "Present" : "Missing");
    //console.log("🔄 Refresh token type:", typeof oldRefreshToken);

    // Handle JSON parsing for headers if needed
    if (typeof oldRefreshToken === 'string' && oldRefreshToken.startsWith('{')) {
      try {
        oldRefreshToken = JSON.parse(oldRefreshToken);
        //console.log("📝 Parsed refresh token from JSON");
      } catch (e) {
        //console.log("⚠️ Failed to parse refresh token as JSON, using as string");
      }
    }

    if (!oldRefreshToken) {
      //console.log("❌ No refresh token provided");
      throw new Error("No refresh token provided");
    }

    // Verify Refresh Token is valid or not
    //console.log("🔍 Verifying refresh token...");
    const { tokenDetails, error } = await verifyRefreshToken(oldRefreshToken);
    //console.log("📊 Verification result - error:", error, "tokenDetails:", !!tokenDetails);

    if (error) {
      //console.log("❌ Token verification failed:", error.message || 'Unknown error');
      throw new Error(`Invalid refresh token: ${error.message || 'Unknown error'}`);
    }

    // Find User based on Refresh Token detail id
    //console.log("🔍 Looking for user with ID:", tokenDetails._id);
    const user = await User.findById(tokenDetails._id);

    if (!user) {
      //console.log("❌ User not found for ID:", tokenDetails._id);
      throw new Error("User not found");
    }
    //console.log("✅ Found user:", user._id);

    // Additional verification: check if token still exists and is not blacklisted
    const userRefreshToken = await UserRefreshToken.findOne({
      userId: tokenDetails._id,
      token: oldRefreshToken,
      blacklisted: false
    });

    //console.log("📊 Database refresh token found:", !!userRefreshToken);
    //console.log("📊 Database token blacklisted:", userRefreshToken?.blacklisted);

    if (!userRefreshToken) {
      //console.log("❌ Refresh token not found in database or is blacklisted");
      throw new Error("Refresh token not found in database or is blacklisted");
    }

    // Generate new access and refresh tokens
    //console.log("🔄 Generating new tokens...");
    const { accessToken, refreshToken, accessTokenExp, refreshTokenExp } = await generateTokens(user, userRefreshToken.platform || "web", userRefreshToken.deviceId);

    //console.log("✅ New tokens generated successfully");
    return {
      newAccessToken: accessToken,
      newRefreshToken: refreshToken,
      newAccessTokenExp: accessTokenExp,
      newRefreshTokenExp: refreshTokenExp
    };

  } catch (error) {
    console.error("❌ RefreshAccessToken error:", error.message);
    // Instead of sending response, throw error to be handled by middleware
    throw error;
  }
};

export { refreshAccessToken };