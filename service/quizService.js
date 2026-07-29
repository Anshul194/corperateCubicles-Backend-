import fcmTokens from '../models/fcmTokens.js';
import QuizRepository from '../repository/quizRepository.js';
import NotificationService from "../utils/notificationService.js";

export default class QuizService {
  constructor() {
    this.quizRepository = new QuizRepository();
  }

  async createQuiz(data) {
    try {
      //console.log('QuizService: Creating quiz with data:', data);
      const createdQuiz = await this.quizRepository.create(data);
      //console.log('QuizService: Quiz created successfully:', createdQuiz);
      return createdQuiz;
    } catch (error) {
      console.error('QuizService: Error in createQuiz:', error);
      throw error;
    }
  }

  async getAllQuizzes(query) {
    try {
      return await this.quizRepository.findAll(query);
    } catch (error) {
      console.error('QuizService: Error in getAllQuizzes:', error);
      throw error;
    }
  }

  async getQuizById(id) {
    try {
      return await this.quizRepository.findById(id);
    } catch (error) {
      console.error('QuizService: Error in getQuizById:', error);
      throw error;
    }
  }

  async updateQuiz(id, data) {
    try {
      //console.log('QuizService: Updating quiz with ID:', id, 'and data:', data);
      return await this.quizRepository.update(id, data);
    } catch (error) {
      console.error('QuizService: Error in updateQuiz:', error);
      throw error;
    }
  }

  async deleteQuiz(id) {
    try {
      return await this.quizRepository.delete(id);
    } catch (error) {
      console.error('QuizService: Error in deleteQuiz:', error);
      throw error;
    }
  }

async submitQuiz(quizId, userId, answers) {
  try {
    //console.log('QuizService: Submitting quiz with ID:', quizId, 'for user:', userId);
    const quiz = await this.quizRepository.findById(quizId);
    if (!quiz) {
      throw new Error('Quiz not found');
    }

    let totalQuestions = 0;
    quiz.sections.forEach(section => {
      totalQuestions += section.questions.length;
    });

    // If quiz.totalMarks is defined, use it, otherwise default to totalQuestions
    const totalMarks = quiz.totalMarks || totalQuestions;
    const marksPerQuestion = totalQuestions > 0 ? totalMarks / totalQuestions : 1;

    let score = 0;
    let totalCorrectQuestions = 0;
    let totalWrongQuestions = 0;
    const submissionAnswers = [];

    const questionMap = new Map();
    quiz.sections.forEach(section => {
      section.questions.forEach(question => {
        questionMap.set(question.question, question);
      });
    });

    for (const answer of answers) {
      const question = questionMap.get(answer.question);
      if (question) {
        // Unanswered questions (timed quizzes auto-submit at 0:00 with
        // selectedOption: null for blanks) score 0 and count as wrong.
        const isAnswered = ['A', 'B', 'C', 'D'].includes(answer.selectedOption);
        const isCorrect = isAnswered && question.correctAnswer === answer.selectedOption;

        if (isCorrect) {
          score += marksPerQuestion;
          totalCorrectQuestions += 1;
        } else {
          totalWrongQuestions += 1;
        }

        // Only persist answered questions: the QuizSubmission schema requires
        // selectedOption ∈ {A,B,C,D}, so storing null would fail validation.
        if (isAnswered) {
          submissionAnswers.push({
            question: answer.question,
            selectedOption: answer.selectedOption
          });
        }
      } else {
        console.warn(`Question not found: ${answer.question}`);
        totalWrongQuestions += 1;
      }
    }

    const percentage = totalMarks > 0 ? Number(((score / totalMarks) * 100).toFixed(2)) : 0;

    const submissionData = {
      user: userId,
      quiz: quizId,
      courseId: quiz.course || null,
      lessonId: quiz.lesson || null,
      answers: submissionAnswers,
      score,
      totalMarks,
      passed: score >= quiz.passMark,
      is_completed: score >= quiz.passMark,
      totalQuestions,
      totalCorrectQuestions,
      totalWrongQuestions,
      percentage
    };

    const submission = await this.quizRepository.createSubmission(submissionData);
    //console.log('QuizService: Quiz submitted successfully:', submission);

    const notificationData = {
      title: 'Quiz Submitted',
      body: `Your quiz for the course has been successfully submitted.`,
      type: 'quiz_submission',
      referenceId: submission._id
    };

    const fcm = await fcmTokens.findOne({ userId: userId });
    if(fcm) {
      await NotificationService.sendPushNotification(fcm?.token, notificationData);
    }

    return {
      _id: submission._id,
      score: submission.score,
      totalMarks: submission.totalMarks,
      passed: submission.passed,
      is_completed: submission.is_completed,
      courseId: submission.courseId,
      lessonId: submission.lessonId,
      totalQuestions: submission.totalQuestions,
      totalCorrectQuestions: submission.totalCorrectQuestions,
      totalWrongQuestions: submission.totalWrongQuestions,
      percentage: submission.percentage
    };
  } catch (error) {
    console.error('QuizService: Error in submitQuiz:', error);
    throw error;
  }
}


  async getMySubmittedQuizzes(userId, query) {
    try {
      //console.log('QuizService: Fetching submitted quizzes for user:', userId);
      const submissions = await this.quizRepository.findSubmissionsByUser(userId, query);
      //console.log('QuizService: Submitted quizzes fetched successfully:', submissions);
      return submissions;
    } catch (error) {
      console.error('QuizService: Error in getMySubmittedQuizzes:', error);
      throw error;
    }
  }

  async getSubmittedQuiz(submissionId, userId) {
    try {
      //console.log('QuizService: Fetching submission with ID:', submissionId, 'for user:', userId);
      const submission = await this.quizRepository.findSubmissionById(submissionId, userId);
      if (!submission) {
        throw new Error('Submission not found or not authorized');
      }
      //console.log('QuizService: Submission fetched successfully:', submission);
      return submission;
    } catch (error) {
      console.error('QuizService: Error in getSubmittedQuiz:', error);
      throw error;
    }
  }

   async getAllSubmissions(query) {
    try {
      //console.log('QuizService: Fetching all submissions with query:', query);
      const submissions = await this.quizRepository.findAllSubmissions(query);
      //console.log('QuizService: All submissions fetched successfully:', submissions);
      return submissions;
    } catch (error) {
      console.error('QuizService: Error in getAllSubmissions:', error);
      throw error;
    }
  }
  
}