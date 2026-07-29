import videoLessonService from '../service/videoLessonService.js';
import fs from "fs";
import path from "path";

// SECURITY: chunked uploads previously passed a raw server filesystem path
// (path.resolve(req.body.filePath)) which let an attacker read/exfiltrate any
// file on the server (e.g. /etc/passwd, .env, service-account keys). We now
// accept only an opaque file identifier/basename and resolve it strictly inside
// the fixed uploads directory with a basename + containment check, mirroring
// routes/chunkUpload.js (safeSegment + isInside).
const UPLOAD_DIR = path.resolve("uploads");

// Reduce any value to a single safe path segment (no separators, no traversal).
const safeSegment = (value) => {
  if (value === undefined || value === null) return null;
  const base = path.basename(String(value));
  if (
    !base ||
    base === "." ||
    base === ".." ||
    base.includes("/") ||
    base.includes("\\") ||
    base.includes("\0")
  ) {
    return null;
  }
  return base;
};

// Ensure `candidate` resolves to a path inside `root` (defence in depth).
const isInside = (root, candidate) => {
  const resolved = path.resolve(candidate);
  return resolved === root || resolved.startsWith(root + path.sep);
};

// Resolve a client-supplied file reference to a path strictly inside UPLOAD_DIR.
// Returns the absolute path if it is a valid, existing file inside the uploads
// directory; otherwise returns null.
const resolveUploadFilePath = (filePathInput) => {
  const fileName = safeSegment(filePathInput);
  if (!fileName) return null;
  const resolved = path.join(UPLOAD_DIR, fileName);
  if (!isInside(UPLOAD_DIR, resolved)) return null;
  if (!fs.existsSync(resolved)) return null;
  return resolved;
};

class VideoLessonController {
  // Create a new video lesson with file upload
 async createVideoLesson(req, res) {
    try {
      let videoFilePath = null;

      if (req.file) {
        // Multer upload
        videoFilePath = req.file.path;
      } else if (req.body.filePath) {
        // Chunked upload: only accept an opaque file id/basename resolved
        // strictly inside the uploads directory (never a raw server path).
        videoFilePath = resolveUploadFilePath(req.body.filePath);
        if (!videoFilePath) {
          return res.status(400).json({
            success: false,
            error: "Provided filePath is invalid or does not exist",
          });
        }
      }

      const result = await videoLessonService.createVideoLesson(
        req.body,
        videoFilePath
      );

      if (result.success) {
        return res.status(201).json({
          success: true,
          data: result.data,
          message: result.message,
          uploadDetails: result.uploadDetails,
        });
      } else {
        return res.status(400).json({
          success: false,
          error: result.error,
          videoLessonId: result.videoLessonId,
        });
      }
    } catch (error) {
      console.error("❌ CreateVideoLesson error:", error);
      return res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  }

  // Update video lesson (support filePath too)
  async updateVideoLesson(req, res) {
    try {
      const { id } = req.params;
      let videoFilePath = null;

      if (req.file) {
        videoFilePath = req.file.path;
      } else if (req.body.filePath) {
        // Only accept an opaque file id/basename resolved strictly inside the
        // uploads directory (never a raw server path).
        videoFilePath = resolveUploadFilePath(req.body.filePath);
        if (!videoFilePath) {
          return res.status(400).json({
            success: false,
            error: "Provided filePath is invalid or does not exist",
          });
        }
      }

      //console.log("📥 Update Video Lesson Request:", req.body);
      //console.log("📥 Video File Path:", videoFilePath);

      const result = await videoLessonService.updateVideoLesson(
        id,
        req.body,
        videoFilePath
      );

      if (result.success) {
        return res.status(200).json({
          success: true,
          data: result.data,
          message: result.message,
        });
      } else {
        return res.status(400).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error) {
      console.error("❌ UpdateVideoLesson error:", error);
      return res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  }


  // Get video lesson by ID
  async getVideoLesson(req, res) {
    try {
      const { id } = req.params;
      const result = await videoLessonService.getVideoLessonById(id);
      
      if (result.success) {
        return res.status(200).json({
          success: true,
          data: result.data
        });
      } else {
        return res.status(404).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  // Get all video lessons with pagination and filtering
  async getAllVideoLessons(req, res) {
    try {
      const { page, limit, sort, status, sourcePlatform, lessonId } = req.query;
      
      const filters = {};
      if (status) filters.status = status;
      if (sourcePlatform) filters.sourcePlatform = sourcePlatform;
      if (lessonId) filters.lessonId = lessonId;
      
      const options = {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 10,
        sort: sort ? JSON.parse(sort) : { createdAt: -1 }
      };
      
      const result = await videoLessonService.getAllVideoLessons(filters, options);
      
      if (result.success) {
        return res.status(200).json({
          success: true,
          data: result.data,
          pagination: result.pagination
        });
      } else {
        return res.status(400).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  // Get video lessons by lesson ID
  async getVideoLessonsByLesson(req, res) {
    try {
      const { lessonId } = req.params;
      const result = await videoLessonService.getVideoLessonsByLessonId(lessonId);
      
      if (result.success) {
        return res.status(200).json({
          success: true,
          data: result.data
        });
      } else {
        return res.status(400).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  // Get video lessons by platform
  async getVideoLessonsByPlatform(req, res) {
    try {
      const { platform } = req.params;
      const result = await videoLessonService.getVideoLessonsByPlatform(platform);
      
      if (result.success) {
        return res.status(200).json({
          success: true,
          data: result.data
        });
      } else {
        return res.status(400).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  // Delete video lesson (soft delete)
  async deleteVideoLesson(req, res) {
    try {
      const { id } = req.params;
      const result = await videoLessonService.deleteVideoLesson(id);
      
      if (result.success) {
        return res.status(200).json({
          success: true,
          message: result.message
        });
      } else {
        return res.status(400).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  // Update video status
  async updateVideoStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const result = await videoLessonService.updateVideoStatus(id, status);
      
      if (result.success) {
        return res.status(200).json({
          success: true,
          data: result.data,
          message: result.message
        });
      } else {
        return res.status(400).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  // Get video lessons by status
  async getVideoLessonsByStatus(req, res) {
    try {
      const { status } = req.params;
      const result = await videoLessonService.getVideoLessonsByStatus(status);
      
      if (result.success) {
        return res.status(200).json({
          success: true,
          data: result.data
        });
      } else {
        return res.status(400).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
}

export default new VideoLessonController();