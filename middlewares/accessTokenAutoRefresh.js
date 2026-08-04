import { Token } from "../utils/index.js";
import jwt from "jsonwebtoken";

const accessTokenAutoRefresh = async (req, res, next) => {
  try {
    // Read the access token — COOKIE FIRST.
    // Web clients authenticate via the secure httpOnly `accessToken` cookie, so it
    // takes precedence; any stale/empty Authorization header a web client still
    // sends is therefore ignored. Mobile/app clients (which carry no cookie) fall
    // back to the x-access-token / Authorization Bearer header.
    let accessToken =
      req.cookies.accessToken ||
      req.headers["x-access-token"] ||
      (req.headers["authorization"]?.startsWith("Bearer ")
        ? req.headers["authorization"].slice(7)
        : null);

    // Treat sentinel / empty values from clients as "no token".
    if (accessToken === "null" || accessToken === "undefined" || accessToken === "") {
      accessToken = null;
    }

    // Handle JSON parsing for headers if needed
    if (typeof accessToken === "string" && accessToken.startsWith("{")) {
      try {
        accessToken = JSON.parse(accessToken);
      } catch (e) {
        // If parsing fails, use the string as is
      }
    }

    // SECURITY: VERIFY the token signature — previously this used jwt.decode()
    // (no signature check), so any forged/unsigned token that wasn't blacklisted
    // passed straight through; routes relying on this middleware alone were
    // reachable with fabricated tokens. Verify with the same secret/algorithm the
    // tokens are issued with (utils/tokens/generateTokens.js):
    //  - valid token        -> pass through (after blacklist check)
    //  - expired token      -> fall through to the refresh-token path
    //  - invalid/forged     -> reject 401 immediately
    const accessSecret =
      process.env.JWT_ACCESS_TOKEN_SECRET_KEY || process.env.JWT_ACCESS_SECRET;
    let decodedUser = null;
    let accessTokenValid = false;
    if (accessToken) {
      try {
        decodedUser = jwt.verify(accessToken, accessSecret, { algorithms: ["HS256"] });
        accessTokenValid = true;
      } catch (e) {
        if (e && e.name === "TokenExpiredError") {
          // Signature is valid but the token is expired: decode the (trusted)
          // payload for blacklisting bookkeeping and try the refresh path below.
          decodedUser = jwt.decode(accessToken);
        } else {
          return res.status(401).json({
            error: "Unauthorized",
            message: "Invalid access token",
          });
        }
      }
    }

    // Check if access token is blacklisted before proceeding
    if (accessToken) {
      const isBlacklisted = await Token.isAccessTokenBlacklisted(accessToken, decodedUser);
      if (isBlacklisted) {
        return res.status(401).json({
          error: "Unauthorized",
          isNewDeviceLogin: true,
          message: "Session expired. Please log in again.",
        });
      }
    }

    // If access token exists, is signature-valid and is not blacklisted, expose it
    // where passport reads it (cookie-first), plus the Authorization header.
    if (accessToken && accessTokenValid) {
      req.cookies = req.cookies || {};
      req.cookies.accessToken = accessToken;
      req.headers["authorization"] = `Bearer ${accessToken}`;
      return next();
    }

    // If access token is missing or expired, try to refresh it
    // Read refresh token from cookies or custom header `X-Refresh-Token`
    let refreshToken = req.cookies.refreshToken || req.headers["x-refresh-token"];

    // Handle JSON parsing for headers if needed
    if (typeof refreshToken === "string" && refreshToken.startsWith("{")) {
      try {
        refreshToken = JSON.parse(refreshToken);
      } catch (e) {
        // If parsing fails, use the string as is
      }
    }

    if (!refreshToken) {
      // If refresh token is also missing, return an unauthorized response
      return res.status(401).json({
        error: "Unauthorized",
        message: "Access and refresh tokens are missing or invalid",
      });
    }

    try {
      // Blacklist old access token if present
      // (was previously a mis-call to Token.generateTokens — dead code at the time,
      // since this path was only reachable with NO access token; now that expired
      // tokens route here, call the actual blacklist helper.)
      if (accessToken) {
        const exp = decodedUser?.exp ? decodedUser.exp * 1000 : Date.now();
        // 🔹 While refreshing, do not blacklist old access token if user is admin
        if (!(decodedUser?.role === "admin" || decodedUser?.roles?.includes("admin"))) {
          await Token.blacklistAccessToken(accessToken, exp);
        }
      }

      // Refresh the access token using the refresh token
      const tokenData = await Token.refreshAccessToken(req, res);

      if (!tokenData) {
        return res.status(401).json({
          error: "Unauthorized",
          message: "Failed to refresh access token",
        });
      }

      const {
        newAccessToken,
        newRefreshToken,
        newAccessTokenExp,
        newRefreshTokenExp,
      } = tokenData;

      // Set the new access and refresh tokens as HTTP-only cookies
      Token.setTokensCookies(
        res,
        newAccessToken,
        newRefreshToken,
        newAccessTokenExp,
        newRefreshTokenExp
      );

      // Also expose the freshly-minted tokens in response headers. Web clients
      // (admin panel / SPA) authenticate via the Authorization header + refresh
      // token in localStorage, NOT via httpOnly cookies (which they cannot read).
      // Without these headers the SPA keeps using its stale tokens: the next
      // expiry would then attempt a refresh with a refresh token that was
      // already rotated/deleted by generateTokens -> forced logout after every
      // access-token lifetime. The CORS config already exposes both headers.
      res.setHeader("x-access-token", newAccessToken);
      res.setHeader("x-refresh-token", newRefreshToken);

      // Expose the freshly-minted token where passport reads it (cookie-first) so
      // the refreshed token is honoured, plus the Authorization header.
      req.cookies = req.cookies || {};
      req.cookies.accessToken = newAccessToken;
      req.headers["authorization"] = `Bearer ${newAccessToken}`;

      return next(); // Proceed to the next middleware
    } catch (refreshError) {
      console.error("Error during token refresh:", refreshError);
      return res.status(401).json({
        error: "Unauthorized",
        message: "Failed to refresh access token or token is invalid",
      });
    }
  }
  catch (error) {
    // Log error and send a response if something goes wrong
    console.error("Error in accessTokenAutoRefresh:", error);
    return res.status(401).json({
      error: "Unauthorized",
      message: "Authentication error",
    });
  }
};

export default accessTokenAutoRefresh;
