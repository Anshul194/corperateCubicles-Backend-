import TextLessonService from "../service/textLessonService.js";
import { initRedis } from "../config/redisClient.js";
import NotificationService from "../service/notificationService.js"; // Import notification service

// Create a new text lesson
export const createTextLesson = async (req, res) => {
  try {
    //console.log("Request body:", req.body);
    //console.log("Uploaded files:", req.files);
    let attachments = [];

    if (req.file) {
      attachments.push({
        fileName: req.file.originalname,
        uploadedAt: new Date(),
      });
    } else if (req.files && req.files.length > 0) {
      attachments = req.files.map((file) => ({
        fileName: file.originalname,
        uploadedAt: new Date(),
      }));
    }

    const lessonData = {
      ...req.body,
      attachments,
    };

    const lesson = await TextLessonService.createTextLesson(lessonData);

    const redis = await initRedis();
    await redis.del("textlessons:all*");

    // Notify enrolled students
    const notificationData = {
      title: 'New File Available',
      body: `A new file titled "${lesson.title}" has been added to your course.`,
    };
    await NotificationService.notifyEnrolledUsers(lesson.courseId, notificationData);

    res
      .status(201)
      .json({
        success: true,
        message: "Text lesson created successfully",
        data: lesson,
      });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Get all text lessons
export const getAllTextLessons = async (req, res) => {
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

    const cacheKey = `textlessons:all:${JSON.stringify(options)}`;
    const redis = await initRedis();
    const cached = await redis.get(cacheKey);

    if (cached) {
      return res
        .status(200)
        .json({
          success: true,
          message: "Text lessons fetched from cache",
          ...JSON.parse(cached),
          fromCache: true,
        });
    }

    const lessons = await TextLessonService.getAllTextLessons(options);
    await redis.setEx(cacheKey, 300, JSON.stringify(lessons));

    res
      .status(200)
      .json({
        success: true,
        message: "Text lessons fetched successfully",
        ...lessons,
      });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get a single text lesson by ID
export const getTextLessonById = async (req, res) => {
  try {
    const lesson = await TextLessonService.getTextLessonById(req.params.id);
    if (!lesson) {
      return res
        .status(404)
        .json({ success: false, message: "Text lesson not found" });
    }
    res.json({
      success: true,
      message: "Text lesson fetched successfully",
      data: lesson,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update a text lesson
export const updateTextLesson = async (req, res) => {
  try {
    const lesson = await TextLessonService.updateTextLesson(
      req.params.id,
      req.body
    );
    if (!lesson) {
      return res
        .status(404)
        .json({ success: false, message: "Text lesson not found" });
    }

    const redis = await initRedis();
    await redis.del("textlessons:all*");

    res.json({
      success: true,
      message: "Text lesson updated successfully",
      data: lesson,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Delete a text lesson
export const deleteTextLesson = async (req, res) => {
  try {
    const deleted = await TextLessonService.deleteTextLesson(req.params.id);
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Text lesson not found" });
    }

    const redis = await initRedis();
    await redis.del("textlessons:all*");

    res.json({ success: true, message: "Text lesson deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
