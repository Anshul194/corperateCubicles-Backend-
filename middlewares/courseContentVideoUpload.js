import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

// Allowed mime types for videos
const ALLOWED_MIME = [
  'video/mp4',
  'video/webm',
  'video/ogg',
  'video/quicktime',
  'video/x-msvideo', // AVI
  'video/x-ms-wmv', // WMV
  'video/mpeg',
];

const ALLOWED_EXTENSIONS = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.wmv', '.mpeg', '.mpg'];

// Used to derive a safe extension when the client filename has none (the file
// may have passed fileFilter on MIME type alone).
const MIME_TO_EXT = {
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/ogg': '.ogg',
  'video/quicktime': '.mov',
  'video/x-msvideo': '.avi',
  'video/x-ms-wmv': '.wmv',
  'video/mpeg': '.mpg',
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const today = new Date().toISOString().slice(0, 10);
    const dir = path.join(process.cwd(), 'uploads', 'courses', 'content', 'videos', today);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    // SECURITY: never store the client-supplied filename verbatim. Same-named
    // uploads on the same day used to silently overwrite each other (multer's
    // diskStorage truncates existing files). Generate a unique, non-guessable
    // name and keep only a validated, lowercased extension. Controllers build
    // the served URL from req.file.path, so clients are unaffected.
    let ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      ext = MIME_TO_EXT[file.mimetype] || '';
    }
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  // Check MIME type
  if (ALLOWED_MIME.includes(file.mimetype)) {
    cb(null, true);
  } else {
    // Also check file extension as fallback
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExtensions = ALLOWED_EXTENSIONS;

    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type. Only videos are allowed (MP4, WebM, OGG, MOV, AVI, WMV, MPEG)'), false);
    }
  }
};

export default multer({
  storage,
  fileFilter,
  limits: { fileSize: 500 * 1024 * 1024 } // 500 MB per file (videos are larger)
});

