import Quiz from '../models/Quiz.js';
import QuizSubmission from '../models/QuizSubmission.js';

export default class QuizRepository {
  async create(data) {
    try {
      //console.log('QuizRepository.create called with data:', data);
      const quiz = await Quiz.create(data);
      if (!quiz) {
        throw new Error('Quiz creation failed');
      }
      if (quiz && quiz.lesson) {
        await Quiz.model('Lesson').findByIdAndUpdate(
          quiz.lesson,
          { $push: { quizzes: quiz._id } },
          { new: true }
        );
      }
      //console.log('QuizRepository.create success:', quiz);
      return quiz;
    } catch (error) {
      console.error('QuizRepository.create error:', error);
      throw error;
    }
  }

  async findAll({ page = 1, limit = 10, search = '', sortBy = 'createdAt', sortOrder = 'asc', filters = {} }) {
    try {
      //console.log('QuizRepository.findAll called with:', { page, limit, search, sortBy, sortOrder, filters });

      const query = { ...filters };

      if (search) {
        query['questions.question'] = { $regex: search, $options: 'i' };
      }

      const skip = (page - 1) * limit;

      const quizzes = await Quiz.find(query)
        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limit)
        .populate('course', 'title')
        .populate('lesson', 'title');

      const total = await Quiz.countDocuments(query);

      return {
        data: quizzes,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      console.error('QuizRepository.findAll error:', error);
      throw error;
    }
  }

  async findById(id) {
    try {
      //console.log('QuizRepository.findById called with id:', id);
      const quiz = await Quiz.findById(id)
        .populate('course', 'title')
        .populate('lesson', 'title');
      //console.log('QuizRepository.findById success:', quiz);
      return quiz;
    } catch (error) {
      console.error('QuizRepository.findById error:', error);
      throw error;
    }
  }

  async update(id, data) {
    try {
      //console.log('QuizRepository.update called with id:', id, 'and data:', data);
      const updatedQuiz = await Quiz.findByIdAndUpdate(id, data, { new: true })
        .populate('course', 'title')
        .populate('lesson', 'title');
      //console.log('QuizRepository.update success:', updatedQuiz);
      return updatedQuiz;
    } catch (error) {
      console.error('QuizRepository.update error:', error);
      throw error;
    }
  }

  async delete(id) {
    try {
      //console.log('QuizRepository.delete called with id:', id);
      const deletedQuiz = await Quiz.findByIdAndDelete(id);
      //console.log('QuizRepository.delete success:', deletedQuiz);
      return deletedQuiz;
    } catch (error) {
      console.error('QuizRepository.delete error:', error);
      throw error;
    }
  }

  async createSubmission(data) {
    try {
      //console.log('QuizRepository.createSubmission called with data:', data);
      const submission = await QuizSubmission.create(data);
      //console.log('QuizRepository.createSubmission success:', submission);
      return submission;
    } catch (error) {
      console.error('QuizRepository.createSubmission error:', error);
      throw error;
    }
  }

  async findSubmissionsByUser(userId, { page = 1, limit = 10 }) {
    try {
      //console.log('QuizRepository.findSubmissionsByUser called with userId:', userId);
      const skip = (page - 1) * limit;
      const submissions = await QuizSubmission.find({ user: userId })
        .sort({ submittedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({
          path: 'quiz',
          populate: [
            { path: 'course', select: 'title' },
            { path: 'lesson', select: 'title' }
          ]
        })
        .lean();

      const total = await QuizSubmission.countDocuments({ user: userId });

      //console.log('QuizRepository.findSubmissionsByUser success:', { total, submissions });
      return {
        data: submissions,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      console.error('QuizRepository.findSubmissionsByUser error:', error);
      throw error;
    }
  }

  async findSubmissionById(submissionId, userId) {
    try {
      //console.log('QuizRepository.findSubmissionById called with submissionId:', submissionId, 'userId:', userId);
      const submission = await QuizSubmission.findOne({ _id: submissionId, user: userId })
        .populate({
          path: 'quiz',
          populate: [
            { path: 'course', select: 'title' },
            { path: 'lesson', select: 'title' }
          ]
        })
        .lean();
      //console.log('QuizRepository.findSubmissionById success:', submission);
      return submission;
    } catch (error) {
      console.error('QuizRepository.findSubmissionById error:', error);
      throw error;
    }
  }

  async findAllSubmissions({ page = 1, limit = 10, sortBy = 'submittedAt', sortOrder = 'desc', filters = {} }) {
    try {
      //console.log('QuizRepository.findAllSubmissions called with:', { page, limit, sortBy, sortOrder, filters });

      const skip = (page - 1) * limit;

      const submissions = await QuizSubmission.find(filters)
        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limit)
        .populate({
          path: 'quiz',
          populate: [
            { path: 'course', select: 'title' },
            { path: 'lesson', select: 'title' }
          ]
        })
        .populate('user', 'name email')
        .lean();

      const total = await QuizSubmission.countDocuments(filters);

      //console.log('QuizRepository.findAllSubmissions success:', { total, submissions });
      return {
        data: submissions,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      console.error('QuizRepository.findAllSubmissions error:', error);
      throw error;
    }
  }
}