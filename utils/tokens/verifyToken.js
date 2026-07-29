import jwt from "jsonwebtoken";
import UserRefreshToken from "../../models/UserRefreshToken.js";
import { ServerConfig } from "../../config/server.config.js";

const verifyRefreshToken = async (refreshToken) => {
  try {
    //console.log("🔍 verifyRefreshToken called with:", refreshToken ? "token present" : "no token");
    
    if (!refreshToken || typeof refreshToken !== 'string') {
      //console.log("❌ Invalid refresh token format");
      return { error: true, message: "Invalid refresh token format" };
    }

    const privateKey = process.env.JWT_REFRESH_TOKEN_SECRET_KEY;
    //console.log("🔑 Private key exists:", !!privateKey);
    
    if (!privateKey) {
      //console.log("❌ JWT refresh secret not configured");
      return { error: true, message: "JWT refresh secret not configured" };
    }

    // First, verify the JWT token signature and expiration
    //console.log("🔐 Verifying JWT token signature...");
    let tokenDetails;
    try {
      tokenDetails = jwt.verify(refreshToken, privateKey);
      //console.log("✅ JWT verification successful, user ID:", tokenDetails._id);
    } catch (jwtError) {
      //console.log("❌ JWT verification failed:", jwtError.message);
      return { error: true, message: `JWT verification failed: ${jwtError.message}` };
    }

    // Then, check if token exists in database and is not blacklisted
    //console.log("🔍 Looking for refresh token in database...");
    //console.log("🔍 Searching for token:", refreshToken.substring(0, 50) + "...");
    
    const userRefreshToken = await UserRefreshToken.findOne({ 
      token: refreshToken,
      userId: tokenDetails._id, // Also match user ID for extra security
      blacklisted: false // Only find non-blacklisted tokens
    });
    
    //console.log("📊 Database lookup result:", !!userRefreshToken);
    
    if (!userRefreshToken) {
      //console.log("❌ Refresh token not found in database or is blacklisted");
      
      // Debug: Let's see what tokens exist for this user
      const userTokens = await UserRefreshToken.find({ userId: tokenDetails._id });
      //console.log(`🔍 Found ${userTokens.length} tokens for user ${tokenDetails._id}:`);
      userTokens.forEach((tokenDoc, index) => {
        //console.log(`  Token ${index + 1}:`, {
        //   tokenStart: tokenDoc.token ? tokenDoc.token.substring(0, 50) + "..." : "null",
        //   blacklisted: tokenDoc.blacklisted,
        //   createdAt: tokenDoc.createdAt,
        //   expiresAt: tokenDoc.expiresAt
        // });
      });
      
      return { error: true, message: "Refresh token not found in database or is blacklisted" };
    }

    // Remove expiry check

    //console.log("✅ Token verification successful");
    return {
      tokenDetails,
      error: false,
      message: "Valid refresh token",
    };
  } catch (error) {
    console.error("❌ verifyRefreshToken unexpected error:", error);
    return { error: true, message: `Verification error: ${error.message}` };
  }
};

const verifyResetToken = (token) => {
  try {
    const privateKey = ServerConfig.JWT_EMAIL_RESET_SECRET;
    return jwt.verify(token, privateKey);
  } catch (error) {
    throw { error: true, message: "Invalid reset token" };
  }
};

export { verifyRefreshToken, verifyResetToken };