import multer from "multer";
import path from "path";

// Allow-list of mime types accepted by this middleware. It backs both the
// /files router (documents) and the /video router (videos), so the list
// covers common document and video types. Anything else is rejected.
const ALLOWED_MIME = [
  // Documents
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  // Images
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
  // Video
  "video/mp4",
  "video/mpeg",
  "video/quicktime",
  "video/x-msvideo", // .avi
  "video/x-matroska", // .mkv
  "video/webm",
  "video/ogg",
];

const ALLOWED_EXTENSIONS = [
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".txt",
  ".csv",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".mp4",
  ".mpeg",
  ".mpg",
  ".mov",
  ".avi",
  ".mkv",
  ".webm",
  ".ogg",
  ".ogv",
];

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME.includes(file.mimetype)) {
    cb(null, true);
    return;
  }
  // Fall back to extension check (some clients send a generic mime type).
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_EXTENSIONS.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error("Unsupported file type"), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter,
  limits: {
    fileSize: 200 * 1024 * 1024, // 200 MB per file (accommodates video uploads)
    files: 10, // cap files per request (e.g. for upload.array / upload.any)
  },
});
export { upload };
