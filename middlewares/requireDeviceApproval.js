import jwt from "jsonwebtoken";
import DeviceApproval from "../models/DeviceApproval.js";

// Platforms that represent the mobile app and are therefore subject to device
// approval. Web sessions (web frontend + admin panel) are NEVER enrolled in
// device approval at login (controllers/userController.js: `isWeb` short-circuit),
// so they have no DeviceApproval record and must never be gated here — gating
// them would 400/403 every legitimate web/admin user.
const APP_PLATFORMS = new Set(["app", "android", "ios"]);

// Read the `platform` claim from the access token. The token is signature-verified
// upstream by accessTokenAutoRefresh (jwt.verify) AND by the passport "jwt"
// strategy before this middleware runs, so a trust-only decode is safe here — we
// only need the non-forgeable `platform` claim that login/refresh bake into every
// token (utils/tokens/generateTokens.js). Reading platform from the signed token
// (rather than a client header) is what lets us tell an app client from a web
// client and stops a pending app device from bypassing the gate by simply
// omitting its deviceId.
const getTokenPlatform = (req) => {
  try {
    const authHeader = req.headers?.authorization;
    const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const token = bearer || req.cookies?.accessToken || null;
    if (!token) return undefined;
    return jwt.decode(token)?.platform;
  } catch {
    return undefined;
  }
};

const requireDeviceApproval = async (req, res, next) => {
  try {
    // Must run after passport.authenticate('jwt'); req.user is the DB user doc.
    if (!req.user?._id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
        data: {},
        err: { message: "Missing authenticated user" },
      });
    }

    // Users explicitly exempted from device approval (matches the login flow's
    // `user.skipDeviceApproval` short-circuit).
    if (req.user.skipDeviceApproval === true) return next();

    const platform = getTokenPlatform(req);

    // Web clients (web frontend + admin panel) are never device-gated.
    if (platform === "web") return next();

    const deviceId =
      req.query.deviceId || req.headers["x-device-id"] || req.body?.deviceId;

    const isAppClient = APP_PLATFORMS.has(platform);

    // A non-app client that is not presenting a deviceId (legacy / unknown
    // platform, server-to-server) is treated like web and allowed through —
    // fail-open for non-app traffic so we never lock out a session that was
    // never part of device approval. Every real app client (platform
    // android/ios) still falls through to enforcement below.
    if (!isAppClient && !deviceId) return next();

    // From here the caller is the mobile app (or is explicitly presenting a
    // deviceId), so an approved + active device record is mandatory.
    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message: "Device ID is required to access this resource",
        data: {},
        err: { message: "Missing deviceId" },
      });
    }

    const deviceApproval = await DeviceApproval.findOne({
      userId: req.user._id,
      deviceId,
    }).sort({ requestedAt: -1 });

    const approved =
      deviceApproval?.status === "approved" && deviceApproval?.isActive === true;

    if (!approved) {
      return res.status(403).json({
        success: false,
        message: "Device approval required to access courses",
        data: {
          deviceStatus: deviceApproval?.status || "no_device",
          deviceApproval: deviceApproval
            ? {
                id: deviceApproval._id,
                status: deviceApproval.status,
                isActive: deviceApproval.isActive,
              }
            : null,
        },
        err: { message: "Device not approved", requiresApproval: true },
      });
    }

    next();
  } catch (err) {
    console.error("Device approval middleware error:", err);
    return res.status(500).json({
      success: false,
      message: "Error checking device approval",
      data: {},
      err: err.message,
    });
  }
};

export default requireDeviceApproval;
