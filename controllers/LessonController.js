import LessonService from '../service/LessonService.js';
import { initRedis } from '../config/redisClient.js';
import Lesson from '../models/Lesson.js';
import NotificationService from "../service/notificationService.js";

const lessonService = new LessonService();

export const createLesson = async (req, res) => {
  //console.log('Creating lesson with data:', req.body);

  try {
    const lessonData = { ...req.body };

    // For multer.fields(), req.files is an object with arrays per field name
    if (req.files) {
      if (req.files['fileUrl'] && req.files['fileUrl'][0]) {
        lessonData.fileUrl = `/uploads/${req.files['fileUrl'][0].filename}`;
      }
      if (req.files['image'] && req.files['image'][0]) {
        lessonData.image = `/uploads/${req.files['image'][0].filename}`;
      }
    }

    const lesson = await lessonService.createLesson(lessonData);

    // Notify enrolled users about the new lesson
    const notificationData = {
      title: "New Lesson Added",
      description: `A new lesson titled "${lesson.title}" has been added to your course.`,
      type: "new_lesson",
    };
    await NotificationService.notifyEnrolledUsers(lesson.courseId, notificationData);

    const redis = await initRedis();
    await redis.del('lessons:all*');

    res.status(201).json({ success: true, message: 'Lesson created', data: lesson });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getAllLessons = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      sortBy = 'order',
      sortOrder = 'asc',
      moduleId
    } = req.query;

    const filters = {};
    if (moduleId) filters.moduleId = moduleId;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      search,
      sortBy,
      sortOrder,
      filters
    };

    const cacheKey = `lessons:all:${JSON.stringify(options)}`;
    const redis = await initRedis();
    const cached = await redis.get(cacheKey);

    if (cached) {
      return res.status(200).json({ success: true, message: 'Lessons from cache', ...JSON.parse(cached), fromCache: true });
    }

    const lessons = await lessonService.getAllLessons(options);
    await redis.setEx(cacheKey, 300, JSON.stringify(lessons));

    res.status(200).json({ success: true, message: 'Lessons fetched', ...lessons });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getLessonById = async (req, res) => {
  try {
    const { lessonId } = req.params;
    const redis = await initRedis();
    const cached = await redis.get(`lesson:${lessonId}`);

    if (cached) {
      return res.status(200).json({ success: true,  message:"data cached "  ,data: JSON.parse(cached), fromCache: true });
    }

    const lesson = await lessonService.getLessonById(lessonId);
    if (!lesson) return res.status(404).json({ success: false, message: 'Lesson not found' });

    await redis.setEx(`lesson:${lessonId}`, 300, JSON.stringify(lesson));
    res.status(200).json({ success: true,  message: "data get"   ,data: lesson });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updateLesson = async (req, res) => {
  try {
    const { lessonId } = req.params;
    const lessonData = { ...req.body };

    if (req.files) {
      if (req.files['fileUrl'] && req.files['fileUrl'][0]) {
        lessonData.fileUrl = `/uploads/${req.files['fileUrl'][0].filename}`;
      }
      if (req.files['image'] && req.files['image'][0]) {
        lessonData.image = `/uploads/${req.files['image'][0].filename}`;
      }
    }

    const updated = await lessonService.updateLesson(lessonId, lessonData);

    const redis = await initRedis();
    await redis.del('lessons:all*');
    await redis.del(`lesson:${lessonId}`);

    res.status(200).json({ success: true, message: 'Lesson updated', data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteLesson = async (req, res) => {
  try {
    const { lessonId } = req.params;
    const deleted = await lessonService.deleteLesson(lessonId);

    const redis = await initRedis();
    await redis.del('lessons:all*');
    await redis.del(`lesson:${lessonId}`);

    res.status(200).json({ success: true, message: 'Lesson deleted', data: deleted });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const toggleMobileOnly = async (req, res) => {
  try {
    const { lessonId } = req.params;
    const { ismobileOnly } = req.body;

    const updated = await Lesson.findByIdAndUpdate(
      lessonId,
      { ismobileOnly },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Lesson not found' });
    }

    return res.status(200).json({ success: true, message: 'Updated successfully', data: updated });
  } catch (error) {
    console.error('Error updating ismobileOnly:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

