import jwt from "jsonwebtoken";
import UserRefreshToken from "../../models/UserRefreshToken.js";
import { ServerConfig } from "../../config/server.config.js";
import { initRedis } from "../../config/redisClient.js";

let redisInstance = null;
const getRedis = async () => {
  try {
    if (!redisInstance) redisInstance = await initRedis();
    return redisInstance;
  } catch (err) {
    console.warn("[REDIS] Redis unavailable, using in-memory fallback");
    return null;
  }
};

// In-memory fallback stores (only used when Redis is not configured).
// SCALING NOTE: these Maps are PER-PROCESS — in a multi-instance deployment a
// token blacklisted (logout/revocation) on one instance is still accepted by
// every other instance, and the lists vanish on restart/deploy. Fine for local
// dev; any multi-instance deploy must configure REDIS_HOST/PORT/PASSWORD so
// revocation state is shared.
const memoryBlacklist = new Map();
const memoryUserTokens = new Map();

const ACCESS_TOKEN_BLACKLIST_PREFIX = "accessToken:blacklist:";
const USER_ACCESS_TOKENS_PREFIX = "user:accessTokens:";

// Store issued access token for user in Redis or fallback
const storeAccessTokenForUser = async (userId, token, exp, platform = "web") => {
  const redis = await getRedis();
  const platformKey = platform === "web" ? "web" : "app";
  const key = `${USER_ACCESS_TOKENS_PREFIX}${platformKey}:${userId}`;

  if (redis) {
    // Store token with expiration as score in a sorted set
    await redis.zAdd(key, [{ score: exp, value: token }]);
  } else {
    const memKey = `${userId}:${platformKey}`;
    if (!memoryUserTokens.has(memKey)) memoryUserTokens.set(memKey, []);
    memoryUserTokens.get(memKey).push({ token, exp });
  }
};

// Get all active access tokens for user from Redis or fallback
const getAllAccessTokensForUser = async (userId, platform = "web") => {
  const redis = await getRedis();
  const platformKey = platform === "web" ? "web" : "app";
  const key = `${USER_ACCESS_TOKENS_PREFIX}${platformKey}:${userId}`;

  if (redis) {
    // Get all tokens with expiration > now
    const now = Date.now();
    return await redis.zRangeByScore(key, now, '+inf');
  } else {
    const now = Date.now();
    const memKey = `${userId}:${platformKey}`;
    return (memoryUserTokens.get(memKey) || [])
      .filter(t => t.exp > now)
      .map(t => t.token);
  }
};

// Remove expired tokens from user's set
const cleanupExpiredAccessTokensForUser = async (userId, platform = "web") => {
  const redis = await getRedis();
  const platformKey = platform === "web" ? "web" : "app";
  const key = `${USER_ACCESS_TOKENS_PREFIX}${platformKey}:${userId}`;

  if (redis) {
    const now = Date.now();
    await redis.zRemRangeByScore(key, '-inf', now);
  } else {
    const memKey = `${userId}:${platformKey}`;
    if (memoryUserTokens.has(memKey)) {
      const now = Date.now();
      memoryUserTokens.set(memKey, memoryUserTokens.get(memKey).filter(t => t.exp > now));
    }
  }
};

const blacklistAccessToken = async (token, exp) => {
  const redis = await getRedis();
  // Set blacklist with TTL equal to token's remaining lifetime
  const ttl = Math.floor((exp - Date.now()) / 1000);
  if (ttl > 0) {
    if (redis) {
      await redis.setEx(`${ACCESS_TOKEN_BLACKLIST_PREFIX}${token}`, ttl, "1");
    } else {
      memoryBlacklist.set(token, Date.now() + ttl * 1000);
    }
    //console.log(`[BLACKLIST] Token ${token.substring(0, 12)}... set for ${ttl}s`);
  } else {
    //console.log(`[BLACKLIST] Token ${token.substring(0, 12)}... not set (expired)`);
  }
};

const isAccessTokenBlacklisted = async (token, user) => {
  // SECURITY: no admin bypass. Previously admins skipped the blacklist entirely,
  // which meant an admin token could never be revoked (logout did not take effect).
  // The blacklist is only populated on explicit logout / forced invalidation, so
  // checking it for every role is correct and does not break multi-device sessions.
  const redis = await getRedis();
  if (redis) {
    const result = await redis.get(`${ACCESS_TOKEN_BLACKLIST_PREFIX}${token}`);
    return result === "1";
  } else {
    const expiry = memoryBlacklist.get(token);
    return expiry && expiry > Date.now();
  }
};

const getTokenExp = (token) => {
  try {
    const decoded = jwt.decode(token);
    return decoded?.exp ? decoded.exp * 1000 : null;
  } catch {
    return null;
  }
};

const generateTokens = async (user, platform = "web", deviceId = null) => {
  try {
    if (!user || !user._id) {
      throw new Error("User object is missing or invalid");
    }

    const payload = { _id: user._id, roles: user.role || user.roles, platform };

    // Define secrets
    const accessSecret = process.env.JWT_ACCESS_TOKEN_SECRET_KEY || process.env.JWT_ACCESS_SECRET;
    const refreshSecret = process.env.JWT_REFRESH_TOKEN_SECRET_KEY;

    if (!accessSecret || !refreshSecret) {
      throw new Error("JWT secrets are not defined in environment variables");
    }

    // Generate tokens.
    // SECURITY: previously both tokens used a 10-year expiry, which made a stolen
    // token effectively permanent and defeated session control. Use short-lived
    // access tokens (auto-refreshed via the refresh token) and a bounded refresh
    // token lifetime. Both are overridable via env for ops flexibility.
    const accessTokenExpiry = process.env.JWT_ACCESS_EXPIRY || '1d';
    const refreshTokenExpiry = process.env.JWT_REFRESH_EXPIRY || '30d';
    const accessToken = jwt.sign(payload, accessSecret, { expiresIn: accessTokenExpiry });
    const refreshToken = jwt.sign(payload, refreshSecret, { expiresIn: refreshTokenExpiry });

    // Calculate expiration times
    const decodedAccess = jwt.decode(accessToken);
    const decodedRefresh = jwt.decode(refreshToken);

    const accessTokenExp = decodedAccess?.exp ? decodedAccess.exp * 1000 : Date.now() + 1000 * 60 * 60 * 24 * 365 * 10;
    const refreshTokenExp = decodedRefresh?.exp ? decodedRefresh.exp * 1000 : Date.now() + 1000 * 60 * 60 * 24 * 365 * 10;

    // Determine platform key for aggregation
    const platformKey = platform === "web" ? "web" : "app";

    // SECURITY: admins are single-session. A new admin login revokes the admin's
    // refresh tokens on EVERY platform (and, below, blacklists their previous
    // access tokens on both platforms), so re-logging-in is an effective
    // compromise response for privileged accounts. Students/instructors keep the
    // existing per-platform policy (one web + one app session can coexist) so
    // mobile multi-device flows are unaffected.
    const isAdmin = user?.role === "admin" || (Array.isArray(user?.roles) && user?.roles.includes("admin")) || user?.roles === "admin";

    if (isAdmin) {
      await UserRefreshToken.deleteMany({ userId: user._id });
    } else if (platformKey === "web") {
      // Delete existing refresh tokens for this SPECIFIC platform/aggregation
      // This allows web and app to coexist
      await UserRefreshToken.deleteMany({ userId: user._id, platform: "web" });
    } else {
      // For app, we logout other app sessions to ensure single app device policy
      // but keep web sessions
      await UserRefreshToken.deleteMany({
        userId: user._id,
        platform: { $in: ["app", "android", "ios"] }
      });
    }

    // Save new refresh token
    const newRefreshToken = new UserRefreshToken({
      userId: user._id,
      token: refreshToken,
      expiresAt: new Date(refreshTokenExp),
      platform: platform,
      deviceId: deviceId
    });
    await newRefreshToken.save();

    // Blacklist previous access tokens for ALL roles.
    // SECURITY: this block previously skipped admins entirely, so an admin
    // re-logging-in (e.g. after a suspected compromise) left their old access
    // tokens valid until natural expiry — the one role whose tokens matter most
    // was the only one that could not be revoked by re-login. Non-admins are
    // revoked per-platform (web and app sessions can coexist); admins are
    // revoked on BOTH platforms to enforce single-session.
    const platformsToRevoke = isAdmin ? ["web", "app"] : [platform];
    for (const revokePlatform of platformsToRevoke) {
      await cleanupExpiredAccessTokensForUser(user._id, revokePlatform);
      const previousTokens = await getAllAccessTokensForUser(user._id, revokePlatform);

      if (previousTokens.length > 0) {
        const now = Date.now();
        const blacklistPromise = previousTokens.map((prevToken) => {
          const exp = getTokenExp(prevToken) || (now + 1000 * 60 * 60);
          return blacklistAccessToken(prevToken, exp);
        });
        await Promise.all(blacklistPromise);

        // Clear the specific platform's access token list from Redis
        const redis = await getRedis();
        if (redis) {
          const revokeKey = revokePlatform === "web" ? "web" : "app";
          const key = `${USER_ACCESS_TOKENS_PREFIX}${revokeKey}:${user._id}`;
          await redis.del(key);
        }
      }
    }

    // Store new access token for user in Redis under platform key
    await storeAccessTokenForUser(user._id, accessToken, accessTokenExp, platform);

    return {
      accessToken,
      refreshToken,
      accessTokenExp,
      refreshTokenExp
    };
  } catch (error) {
    console.error('❌ Error in generateTokens:', error);
    throw new Error(`Token generation failed: ${error.message}`);
  }
};

// SECURITY: revoke EVERY session for a user — delete all refresh tokens (DB) and
// blacklist all tracked access tokens on both platforms. Called after password
// change / password reset so that any stolen session dies with the old password
// (previously a reset left the attacker's refresh token valid for up to 30d).
// Refresh-token deletion is the hard guarantee (DB-backed); access-token
// blacklisting is best-effort (Redis with in-memory fallback) and is additionally
// backstopped by the iat-vs-passwordChangedAt check in config/jwt-authenticate.js.
const revokeAllUserSessions = async (userId) => {
  await UserRefreshToken.deleteMany({ userId });

  for (const platform of ["web", "app"]) {
    try {
      await cleanupExpiredAccessTokensForUser(userId, platform);
      const tokens = await getAllAccessTokensForUser(userId, platform);

      if (tokens.length > 0) {
        const now = Date.now();
        await Promise.all(
          tokens.map((token) => {
            const exp = getTokenExp(token) || (now + 1000 * 60 * 60);
            return blacklistAccessToken(token, exp);
          })
        );
      }

      const redis = await getRedis();
      if (redis) {
        await redis.del(`${USER_ACCESS_TOKENS_PREFIX}${platform}:${userId}`);
      }
    } catch (error) {
      // Best-effort: refresh tokens are already gone and the JWT-strategy
      // passwordChangedAt check rejects stale access tokens regardless.
      console.error(`❌ Failed to blacklist ${platform} access tokens for user ${userId}:`, error.message);
    }
  }
};

const generateTokenForResetPassword = async (user) => {
  try {
    const payload = { _id: user._id, roles: user.role };
    const secret = ServerConfig.JWT_EMAIL_RESET_SECRET;
    const token = jwt.sign({ userID: user._id }, secret, { expiresIn: "15m" });
    return token;
  } catch (error) {
    console.error('❌ Error in generateTokenForResetPassword:', error);
    throw new Error(`Reset token generation failed: ${error.message}`);
  }
};

export { generateTokens, generateTokenForResetPassword, isAccessTokenBlacklisted, blacklistAccessToken, cleanupExpiredAccessTokensForUser, getAllAccessTokensForUser, revokeAllUserSessions };

// Only refresh tokens are stored and managed for session control.
// Access tokens are stateless and cannot be forcibly invalidated unless you implement a blacklist.
// Use isAccessTokenBlacklisted(token) in your auth middleware to reject blacklisted tokens.