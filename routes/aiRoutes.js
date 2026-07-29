import express from 'express';
import { startOrContinueChat, getChatHistory, getMessages } from '../controllers/aiChatController.js';
import { getAISettings, updateAISettings } from '../controllers/aiSettingsController.js';
import { addKnowledgeBaseItem, listKnowledgeBaseItems, deleteKnowledgeBaseItem, getKnowledgeBaseItem } from '../controllers/knowledgeBaseController.js';
import multer from 'multer';
import path from 'path';
import rateLimit from 'express-rate-limit';
import passport from 'passport';
import { isAdmin } from '../middlewares/isAdmin.js';

// SECURITY: this upload uses memoryStorage, so every file is buffered fully into
// the Node heap. It previously had NO size/count limits and NO fileFilter — a
// single multipart request with huge parts could OOM the whole backend (the
// global express.json 25mb limit does not apply to multipart bodies).
//
// Caps chosen relative to siblings: images cap at 10MB (newsUpload.js,
// contentImageUpload.js), course docs at 20MB (upload.js), mixed media at 200MB
// (upload-middleware.js), JSON bodies at 25mb (app.js). 50MB comfortably covers
// every document type the KB pipeline parses while bounding heap usage.
//
// The filter mirrors EXACTLY what knowledgeBaseController.addKnowledgeBaseItem
// recognises (pdf/docx/xlsx via mime or extension, plus text/* mimetypes and
// .txt/.md/.markdown/.csv/.log extensions) so no currently-parseable upload is
// rejected; only unparseable binary junk is turned away.
const KB_ALLOWED_MIME = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
];
const KB_ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.xlsx', '.txt', '.md', '.markdown', '.csv', '.log'];

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 50 * 1024 * 1024, // 50 MB per file
        files: 20, // matches the largest sibling multi-file cap (combinedNewsUpload maxCount: 20)
    },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const ok =
            KB_ALLOWED_MIME.includes(file.mimetype) ||
            file.mimetype.startsWith('text/') ||
            KB_ALLOWED_EXTENSIONS.includes(ext);
        if (ok) return cb(null, true);
        cb(new Error('Unsupported knowledge-base file type. Allowed: PDF, DOCX, XLSX, TXT, MD, CSV, LOG'), false);
    },
});

// Translate multer/fileFilter errors into clean 4xx responses instead of a 500.
const handleKbUploadError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
        return res.status(status).json({ success: false, message: err.message || 'File upload error' });
    }
    if (err) {
        return res.status(415).json({ success: false, message: err.message || 'File upload error' });
    }
    next();
};

const router = express.Router();

// Per-user rate limiter for the metered AI chat endpoint. Each request incurs
// third-party OpenAI token cost (chat completion + KB embedding search), so this
// caps request volume per authenticated user (keyed by user id, not IP) to
// prevent token-cost abuse beyond the generous global limiter.
const aiChatLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: Number(process.env.AI_CHAT_RATE_LIMIT_MAX) || 10,
    keyGenerator: (req) => String(req.user?._id || req.ip),
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many AI requests, slow down.' },
});

router.use(passport.authenticate('jwt', { session: false }));
router.post('/chat', aiChatLimiter, startOrContinueChat);
router.get('/history', getChatHistory);
router.get('/messages/:roomId', getMessages);

// AI Settings
router.get('/settings', getAISettings);
router.put('/settings', isAdmin, updateAISettings);

// Knowledge Base
router.get('/knowledge', listKnowledgeBaseItems);
router.post('/knowledge', isAdmin, upload.array('files'), handleKbUploadError, addKnowledgeBaseItem);
router.get('/knowledge/:id', getKnowledgeBaseItem);
router.delete('/knowledge/:id', isAdmin, deleteKnowledgeBaseItem);

export default router;
