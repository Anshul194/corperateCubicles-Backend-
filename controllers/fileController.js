import fs from "fs";
import path from "path";
import fileService from "../service/file-service.js";
import { initRedis } from "../config/redisClient.js";

// Root directory where uploaded files are stored (matches the multer
// disk-storage destination in middlewares/upload-middleware.js).
const UPLOADS_ROOT = path.resolve(process.cwd(), "uploads");

// Best-effort delete of an uploaded file on disk. The provided path is
// resolved and confined to the uploads directory to avoid path traversal,
// and missing files (ENOENT) are ignored.
const safeUnlink = async (storedPath) => {
  if (!storedPath) return;
  try {
    const resolved = path.resolve(process.cwd(), storedPath);
    if (resolved !== UPLOADS_ROOT && !resolved.startsWith(UPLOADS_ROOT + path.sep)) {
      return; // outside uploads dir; refuse to touch
    }
    await fs.promises.unlink(resolved);
  } catch (err) {
    if (err.code !== "ENOENT") {
      console.error("Failed to delete upload file:", storedPath, err.message);
    }
  }
};

export const createFile = async (req, res) => {
  //console.log("Creating file with data:", req.body);
  const uploadedPath = req.file?.path;
  try {
    const {
      language,
      fileType,
      downloadable,
      active,
      isPublic,
      lessonId,
      courseId,
    } = req.body;
    const filePath = uploadedPath;

    // Fail fast on missing required references so we don't waste a DB round
    // trip and can clean up the orphaned upload below.
    if (!lessonId || !courseId) {
      await safeUnlink(uploadedPath);
      return res.status(400).json({
        success: false,
        message: "lessonId and courseId are required",
      });
    }

    const file = await fileService.createFile({
      lessonId,
      courseId,
      language,
      fileType,
      filePath,
      downloadable,
      active,
      isPublic,
    });

    //console.log("File created with data:", file);
    const redis = await initRedis();
    await redis.del("files:all*");

    res
      .status(201)
      .json({ success: true, message: "File created", data: file });
  } catch (err) {
    //console.log("Error creating file:", err.message);
    // The upload was already written to disk by multer; remove it so failed
    // creates don't leave orphaned files behind.
    await safeUnlink(uploadedPath);
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getFiles = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      sortBy = "createdAt",
      sortOrder = "asc",
      courseId,
      lessonId,
    } = req.query;

    const filters = {};
    if (courseId) filters.courseId = courseId;
    if (lessonId) filters.lessonId = lessonId;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      search,
      sortBy,
      sortOrder,
      filters,
    };

    const cacheKey = `files:all:${JSON.stringify(options)}`;
    const redis = await initRedis();
    const cached = await redis.get(cacheKey);

    if (cached) {
      return res.status(200).json({
        success: true,
        message: "Files from cache",
        ...JSON.parse(cached),
        fromCache: true,
      });
    }

    const files = await fileService.getAllFiles(options);
    await redis.setEx(cacheKey, 300, JSON.stringify(files));

    res.status(200).json({ success: true, message: "Files fetched", ...files });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getFileById = async (req, res) => {
  try {
    const { id } = req.params;

    const redis = await initRedis();
    const cached = await redis.get(`file:${id}`);

    if (cached) {
      return res.status(200).json({
        success: true,
        message: "File from cache",
        data: JSON.parse(cached),
        fromCache: true,
      });
    }

    //console.log("Fetching file with ID:", id);

    const file = await fileService.getFile(id);
    if (!file)
      return res
        .status(404)
        .json({ success: false, message: "File not found" });

    await redis.setEx(`file:${id}`, 300, JSON.stringify(file));

    res
      .status(200)
      .json({ success: true, message: "File fetched", data: file });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updateFile = async (req, res) => {
  try {
    //console.log("Updating file with data:", req.body);
    const { id } = req.params;

    const file = await fileService.updateFile(id, req.body);
    if (!file)
      return res
        .status(404)
        .json({ success: false, message: "File not found" });

    const redis = await initRedis();
    await redis.del("files:all*");
    await redis.del(`file:${id}`);

    res
      .status(200)
      .json({ success: true, message: "File updated", data: file });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteFile = async (req, res) => {
  try {
    const { id } = req.params;

    const file = await fileService.deleteFile(id);
    if (!file)
      return res
        .status(404)
        .json({ success: false, message: "File not found" });

    // Remove the underlying file on disk so deleting a File doc doesn't leak
    // its bytes forever (best-effort, ignores already-missing files).
    await safeUnlink(file.filePath);

    const redis = await initRedis();
    await redis.del("files:all*");
    await redis.del(`file:${id}`);

    res
      .status(200)
      .json({ success: true, message: "File deleted", data: file });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
