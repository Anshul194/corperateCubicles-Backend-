import QuizService from '../service/quizService.js';
import { initRedis } from '../config/redisClient.js';

const quizService = new QuizService();

export const createQuiz = async (req, res) => {
  try {
    const quizData = { ...req.body };
    const quiz = await quizService.createQuiz(quizData);

    const redis = await initRedis();
    await redis.del('quizzes:all*');

    res.status(201).json({ success: true, message: 'Quiz created', data: quiz });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getAllQuizzes = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      sortBy = 'createdAt',
      sortOrder = 'asc',
      courseId,
      lessonId
    } = req.query;

    const filters = {};
    if (courseId) filters.course = courseId;
    if (lessonId) filters.lesson = lessonId;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      search,
      sortBy,
      sortOrder,
      filters
    };

    const cacheKey = `quizzes:all:${JSON.stringify(options)}`;
    const redis = await initRedis();
    const cached = await redis.get(cacheKey);

    if (cached) {
      return res.status(200).json({ success: true, message: 'Quizzes from cache', ...JSON.parse(cached), fromCache: true });
    }

    const quizzes = await quizService.getAllQuizzes(options);
    await redis.setEx(cacheKey, 300, JSON.stringify(quizzes));

    res.status(200).json({ success: true, message: 'Quizzes fetched', ...quizzes });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getQuizById = async (req, res) => {
  try {
    const { quizId } = req.params;
    const redis = await initRedis();
    const cached = await redis.get(`quiz:${quizId}`);

    if (cached) {
      return res.status(200).json({ success: true, data: JSON.parse(cached), fromCache: true });
    }

    const quiz = await quizService.getQuizById(quizId);
    if (!quiz) return res.status(404).json({ success: false, message: 'Quiz not found' });

    await redis.setEx(`quiz:${quizId}`, 300, JSON.stringify(quiz));
    res.status(200).json({ success: true, data: quiz });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updateQuiz = async (req, res) => {
  try {
    const { quizId } = req.params;
    const quizData = { ...req.body };
    const updated = await quizService.updateQuiz(quizId, quizData);

    const redis = await initRedis();
    await redis.del('quizzes:all*');
    await redis.del(`quiz:${quizId}`);

    res.status(200).json({ success: true, message: 'Quiz updated', data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteQuiz = async (req, res) => {
  try {
    const { quizId } = req.params;
    const deleted = await quizService.deleteQuiz(quizId);

    const redis = await initRedis();
    await redis.del('quizzes:all*');
    await redis.del(`quiz:${quizId}`);

    res.status(200).json({ success: true, message: 'Quiz deleted', data: deleted });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};