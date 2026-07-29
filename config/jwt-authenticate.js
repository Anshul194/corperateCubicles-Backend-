import JWT from "passport-jwt";
import User from "../models/user.js";
import passport from "passport";
import { ServerConfig } from "./server.config.js";
import { isAccessTokenBlacklisted } from "../utils/tokens/generateTokens.js";

const JwtStrategy = JWT.Strategy;
const ExtractJwt = JWT.ExtractJwt;

// Fail fast at boot if the access-token secret is missing, instead of
// registering a strategy with a known placeholder secret (forgeable tokens).
if (!ServerConfig.JWT_ACCESS_SECRET) {
  throw new Error("JWT_ACCESS_TOKEN_SECRET_KEY is required. Please set JWT_ACCESS_TOKEN_SECRET_KEY in your environment variables.");
}

// Web clients send the JWT as a secure httpOnly `accessToken` cookie; mobile/app
// clients send it as an Authorization: Bearer header. Read the cookie FIRST so a
// stale/sentinel Authorization header from a migrated web client is ignored, and
// every JWT-protected route works with cookie auth (not only those behind the
// accessTokenAutoRefresh middleware).
const cookieExtractor = (req) =>
  req && req.cookies && req.cookies.accessToken ? req.cookies.accessToken : null;

const tokenExtractor = ExtractJwt.fromExtractors([
  cookieExtractor,
  ExtractJwt.fromAuthHeaderAsBearerToken(),
]);

const opts = {
  jwtFromRequest: tokenExtractor,
  secretOrKey: ServerConfig.JWT_ACCESS_SECRET,
  // Restrict accepted algorithms to match how tokens are signed (HS256),
  // so attacker-supplied alg headers are ignored (alg-confusion hardening).
  algorithms: ["HS256"],
  // Needed so the verify callback can re-extract the raw token and check the
  // logout/revocation blacklist (the payload alone does not contain the token).
  passReqToCallback: true,
};

passport.use(
  "jwt", // Explicitly name the strategy
  new JwtStrategy(opts, async function (req, jwt_payload, done) {
    try {
      // SECURITY: enforce token revocation centrally. logout / forced device
      // logout blacklists access tokens (utils/tokens/generateTokens.js); without
      // this check, routes gated only by passport (e.g. /ai, /zoom) kept accepting
      // revoked tokens until natural expiry. Re-extract the raw token with the
      // same extractor passport used, and reject if it has been blacklisted.
      const rawToken = tokenExtractor(req);
      if (rawToken && (await isAccessTokenBlacklisted(rawToken, jwt_payload))) {
        return done(null, false);
      }

      const user = await User.findOne({ _id: jwt_payload._id }).select("-password");
      if (!user) {
        return done(null, false);
      }
      // Centralized active/banned check: reject banned or inactive users at the
      // authentication layer so every JWT-protected route is covered without
      // relying on per-route isUserBanned middleware.
      if (user.isBanned === true || user.status === "inactive" || user.isActive === false) {
        return done(null, false);
      }
      // SECURITY: reject access tokens issued BEFORE the user's last password
      // change/reset. Password change/reset revokes refresh tokens and blacklists
      // tracked access tokens, but the blacklist is Redis-backed (with an
      // in-memory fallback that doesn't survive restarts) — this stateless check
      // guarantees a stolen access token dies with the old password. Compared at
      // second granularity (iat is in seconds) so tokens minted in the same
      // second as the change are not rejected.
      if (user.passwordChangedAt && jwt_payload.iat) {
        const changedAtSec = Math.floor(new Date(user.passwordChangedAt).getTime() / 1000);
        if (jwt_payload.iat < changedAtSec) {
          return done(null, false);
        }
      }
      return done(null, user);
    } catch (error) {
      console.error("JWT Strategy Error:", error);
      return done(error, false);
    }
  })
);

export default passport;