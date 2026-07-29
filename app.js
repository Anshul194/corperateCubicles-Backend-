import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import fs from "fs";
import routes from "./routes/index.js";
import passport from "passport";
import path from "path";
import { fileURLToPath } from "url";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { initRedis } from "./config/redisClient.js";

// Define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Register Passport JWT strategy before using passport
import "./config/jwt-authenticate.js";

const app = express();

// SECURITY: NODE_ENV gates the Secure flag on auth cookies (unless COOKIE_SECURE
// is set — utils/tokens/setTokensCookies.js) and error-stack suppression in the
// global error handler below. An unset NODE_ENV in production silently downgrades
// both, so warn loudly at boot instead of failing open in silence.
if (!process.env.NODE_ENV) {
  console.warn(
    "⚠️  NODE_ENV is not set. Auth cookies will be issued WITHOUT the Secure " +
    "attribute (unless COOKIE_SECURE=true) and error responses will include " +
    "stack traces. Set NODE_ENV=production in production."
  );
}

// Serve static files.
// SECURITY: uploaded files are user-controlled. Serving an uploaded .html/.svg/.js
// inline lets it execute in a victim's browser (stored XSS) under our origin. Send
// nosniff on everything and force a download for types that can execute, while
// still serving images/PDF/video inline.
const EXECUTABLE_UPLOAD_EXTS = new Set([
  ".html", ".htm", ".xhtml", ".svg", ".xml", ".js", ".mjs", ".css",
]);
app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"), {
    // PERF: without maxAge, express.static sends Cache-Control: public,max-age=0
    // and browsers revalidate every thumbnail/avatar/news image on each page
    // view. Upload filenames are unique (timestamp + random suffix), so a 7-day
    // browser cache is safe; ETag/Last-Modified still allow cheap revalidation.
    maxAge: "7d",
    etag: true,
    lastModified: true,
    setHeaders: (res, filePath) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
      // The web apps (edrilla.com, lapaas.com, admin.edrilla.com) embed these
      // files cross-origin (<img> etc. against api.edrilla.com), so uploads —
      // and ONLY uploads — must carry a permissive CORP. The API keeps
      // helmet's same-origin default (see helmet() below).
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      if (EXECUTABLE_UPLOAD_EXTS.has(path.extname(filePath).toLowerCase())) {
        res.setHeader("Content-Disposition", "attachment");
      }
    },
  })
);

// CORS config — dynamic origin to support credentials (wildcard '*' is
// incompatible with credentials:true per the browser spec)
const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:5174",
  "https://edrilla.com",
  "https://www.edrilla.com",
  "https://admin.edrilla.com",
  "https://api.edrilla.com",
  "http://edrila.nexprism.in",
  "https://edrila.nexprism.in",
  "https://lapaas.com",
  "https://www.lapaas.com",
  "https://corperate-cubicles-admin-ba4i-8loh08han.vercel.app",
  "https://corperate-cubicles-admin-ba4i-8loh08han.vercel.app/",

  "https://corperate-cubicles.vercel.app",

  "https://corperate-cubicles.vercel.app/",
  "https://corperate-cubicles-admin-ba4i.vercel.app/",
  "https://corperate-cubicles-admin-ba4i.vercel.app"
];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman, server-to-server)
    if (!origin) return callback(null, true);
    // Allow any localhost port for local development
    if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    // SECURITY: deny unknown origins. Previously this reflected EVERY origin with
    // `credentials: true`, which let any website issue authenticated cross-site
    // requests against the API. Unknown origins are now rejected outright.
    return callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true,
  optionsSuccessStatus: 200,
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "x-access-token",
    "x-refresh-token",
    "X-Requested-With",
  ],
  exposedHeaders: ["x-access-token", "x-refresh-token"],
};
app.use(cors(corsOptions));
// Handle OPTIONS preflight for all routes (path-to-regexp v8+ compatible syntax)
app.options("/{*splat}", cors(corsOptions));

// Trust the first proxy (nginx) so req.ip / rate limiting use the real client IP.
app.set("trust proxy", 1);

// Security headers (apply before routes).
// CORP uses helmet's same-origin default: it protects API JSON responses from
// cross-origin no-cors reads (Spectre-class side channels). Cross-origin media
// embedding is only needed for /uploads, which is mounted BEFORE helmet and
// sets its own `Cross-Origin-Resource-Policy: cross-origin` header above.
app.use(helmet());

// Body parsers.
// NOTE: previously express.json() was registered twice — first with the default
// 100KB limit (which silently won and rejected legitimate large content) and then
// with a 2GB limit (dead code AND a memory-exhaustion DoS vector). A global
// express.raw({type:'application/octet-stream', limit:'2gb'}) was also registered,
// which would buffer entire 2GB uploads into RAM. Large media is uploaded via the
// streaming /chunk routes and multer, so a single sane JSON limit is correct here.
const JSON_BODY_LIMIT = process.env.JSON_BODY_LIMIT || "25mb";
app.use(express.json({ limit: JSON_BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: JSON_BODY_LIMIT }));
app.use(cookieParser());
app.use(passport.initialize());

// Rate limiting. A generous global limiter blunts scraping/DoS; a strict limiter
// guards authentication endpoints against credential brute-force.
// SCALING: express-rate-limit defaults to a per-process MemoryStore — with N
// instances behind a load balancer each instance keeps its own counters (the
// effective budget multiplies by N and resets on every deploy/restart). When
// Redis is configured (same env gate as config/redisClient.js, which otherwise
// substitutes an in-memory stub that cannot back a RedisStore), share counters
// across instances via rate-limit-redis; otherwise keep the default MemoryStore
// (local dev / single instance). Limits themselves are unchanged.
const redisConfigured = !!(
  process.env.REDIS_HOST &&
  process.env.REDIS_PORT &&
  process.env.REDIS_PASSWORD
);
const limiterStore = (prefix) =>
  redisConfigured
    ? new RedisStore({
      prefix, // distinct prefix per limiter so their counters never collide
      // Resolve the shared client lazily per command: limiters are built at
      // module load, before the async Redis connection is established.
      sendCommand: async (...args) => (await initRedis()).sendCommand(args),
    })
    : undefined; // undefined => express-rate-limit's default MemoryStore

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX) || 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests, please try again later." },
  store: limiterStore("rl:global:"),
});
app.use(globalLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AUTH_RATE_LIMIT_MAX) || 20,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { success: false, message: "Too many attempts, please try again later." },
  store: limiterStore("rl:auth:"),
});
// Apply the strict limiter to credential-sensitive endpoints regardless of which
// router ultimately handles them.
const AUTH_PATH_PATTERN = /(login|signin|sign-in|register|signup|sign-up|forgot-password|reset-password|change-password|send-otp|verify-otp|otp)/i;
app.use((req, res, next) => {
  if (AUTH_PATH_PATTERN.test(req.path)) return authLimiter(req, res, next);
  return next();
});

// Set global timeouts for large file operations
app.use((req, res, next) => {
  // Set much longer timeouts for chunk upload routes
  if (req.path.includes('/chunk') || req.path.includes('/upload')) {
    req.setTimeout(7200000); // 120 minutes (2 hours)
    res.setTimeout(7200000); // 120 minutes (2 hours)
  } else if (req.path.includes('/video') || req.path.includes('/file')) {
    req.setTimeout(1800000); // 30 minutes for video/file operations
    res.setTimeout(1800000); // 30 minutes for video/file operations
  } else {
    req.setTimeout(600000); // 10 minutes for other routes
    res.setTimeout(600000); // 10 minutes for other routes
  }
  next();
});

// Debug (optional)

// API Routes
app.use("/", routes);

// 404 handler for unmatched routes.
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// Global error handler. Previously the app had none, so unhandled errors fell
// through to Express's default handler, which leaks stack traces in non-production
// and can hang requests thrown from async handlers. This centralises error
// responses and avoids leaking internals.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // RESOURCE CLEANUP: if multer already wrote files to disk for this request,
  // an errored request would orphan them in uploads/ forever (most controllers
  // only unlink on their success path). Best-effort delete any multer artifacts
  // here. Controllers that persisted the upload before erroring can opt out by
  // setting `req.fileCommitted = true` after their DB write.
  if (!req.fileCommitted) {
    const uploadedFiles = [
      req.file,
      ...(Array.isArray(req.files)
        ? req.files
        : Object.values(req.files || {}).flat()),
    ].filter(Boolean);
    for (const file of uploadedFiles) {
      if (file && file.path) {
        fs.promises.unlink(file.path).catch(() => { });
      }
    }
  }

  // CORS rejections surface as errors here.
  if (err && /not allowed by CORS/i.test(err.message || "")) {
    return res.status(403).json({ success: false, message: "Origin not allowed" });
  }

  const status = err.status || err.statusCode || 500;
  console.error("Unhandled error:", err);

  if (res.headersSent) return; // delegate to default handler if response started

  const isProd = process.env.NODE_ENV === "production";
  res.status(status).json({
    success: false,
    message: status === 500 && isProd ? "Internal server error" : err.message || "Internal server error",
    ...(isProd ? {} : { stack: err.stack }),
  });
});

export default app;

