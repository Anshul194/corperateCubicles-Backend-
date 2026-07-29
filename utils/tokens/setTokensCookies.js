import jwt from "jsonwebtoken";

// SECURITY: tokens are delivered to web clients as httpOnly cookies so that
// cross-site scripting cannot read them from JS (unlike localStorage). Mobile/app
// clients continue to use the Authorization header (they receive the tokens in the
// response body).
//
// Flags:
//  - httpOnly: JS can never read the access/refresh cookies.
//  - secure:   only over HTTPS in production. In dev (http://localhost) it must be
//              false or the browser silently drops the cookie.
//  - sameSite: 'lax' works for same-site (incl. subdomain api) requests and blocks
//              most CSRF. Override with COOKIE_SAMESITE='none' (requires secure) for
//              a truly cross-site frontend/api split.
//  - domain:   set COOKIE_DOMAIN='.edrilla.com' to share the cookie across subdomains.
const isProd = () => process.env.NODE_ENV === "production";

// SECURITY: the Secure attribute previously hinged ONLY on NODE_ENV==='production'
// — a single mis-set env var silently shipped auth cookies over plain HTTP.
// COOKIE_SECURE provides an explicit override independent of NODE_ENV:
//   COOKIE_SECURE=true   -> Secure always on (set this in production)
//   COOKIE_SECURE=false  -> Secure always off (plain-HTTP local/staging only)
//   unset/empty          -> falls back to NODE_ENV === 'production' (unchanged)
const cookieSecure = () => {
  const override = process.env.COOKIE_SECURE;
  if (override !== undefined && override !== "") return override === "true";
  return isProd();
};

const baseCookie = () => ({
  httpOnly: true,
  secure: cookieSecure(),
  sameSite: process.env.COOKIE_SAMESITE || "lax",
  path: "/",
  ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
});

// Cookie lifetime from the token's own exp claim, falling back to a sensible default.
const lifetimeMs = (token, fallbackMs) => {
  try {
    const exp = jwt.decode(token)?.exp;
    if (exp) return Math.max(0, exp * 1000 - Date.now());
  } catch {
    /* ignore */
  }
  return fallbackMs;
};

const setTokensCookies = (res, accessToken, refreshToken) => {
  res.cookie("accessToken", accessToken, {
    ...baseCookie(),
    maxAge: lifetimeMs(accessToken, 24 * 60 * 60 * 1000), // 1d default
  });

  res.cookie("refreshToken", refreshToken, {
    ...baseCookie(),
    maxAge: lifetimeMs(refreshToken, 30 * 24 * 60 * 60 * 1000), // 30d default
  });

  // Non-httpOnly marker so the SPA can cheaply tell it is authenticated WITHOUT
  // ever exposing a real token to JS.
  res.cookie("is_auth", "1", {
    httpOnly: false,
    secure: cookieSecure(),
    sameSite: process.env.COOKIE_SAMESITE || "lax",
    path: "/",
    ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
    maxAge: lifetimeMs(refreshToken, 30 * 24 * 60 * 60 * 1000),
  });
};

// Clear the auth cookies on logout. The attributes (path/domain/sameSite/secure)
// must match how they were set or the browser won't remove them.
const clearTokensCookies = (res) => {
  const opts = {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: process.env.COOKIE_SAMESITE || "lax",
    path: "/",
    ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
  };
  res.clearCookie("accessToken", opts);
  res.clearCookie("refreshToken", opts);
  res.clearCookie("is_auth", { ...opts, httpOnly: false });
};

export { setTokensCookies, clearTokensCookies };
