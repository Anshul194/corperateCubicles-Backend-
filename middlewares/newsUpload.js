import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

// Allowed mime types for images
const ALLOWED_MIME = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/jfif', // JPEG File Interchange Format
];

const ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.jfif'];

// Used to derive a safe extension when the client filename has none (the file
// may have passed fileFilter on MIME type alone).
const MIME_TO_EXT = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
  'image/jfif': '.jfif',
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const today = new Date().toISOString().slice(0, 10);
    const dir = path.join(process.cwd(), 'uploads', 'news', today);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    // SECURITY: never store the client-supplied filename verbatim. Same-named
    // uploads on the same day used to silently overwrite each other (multer's
    // diskStorage truncates existing files), letting any user who could reach
    // this route clobber previously uploaded media. Generate a unique,
    // non-guessable name and keep only a validated, lowercased extension.
    // Controllers build the served URL from req.file.path, so clients are
    // unaffected by the rename.
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
    // Also check file extension as fallback (some browsers may not send correct MIME type)
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExtensions = ALLOWED_EXTENSIONS;

    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type. Only images are allowed (PNG, JPEG, JPG, GIF, WEBP, SVG, JFIF)'), false);
    }
  }
};

export default multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10 MB per file
});

