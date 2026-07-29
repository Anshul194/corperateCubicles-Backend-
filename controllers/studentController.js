import mongoose from "mongoose";
import UserService from "../service/userService.js";
import ProjectAnalyticsService from "../service/ProjectAnalyticsService.js";
import CourseEnrollment from "../models/CourseEnrollment.js"; // <-- Add this import
import ForumThread from "../models/ForumThread.js";
import ForumReply from "../models/ForumReply.js";
import JobPosting from "../models/JobPosting.js";
import escapeRegExp from "../utils/escapeRegExp.js";

const userService = new UserService();

// Drop any keys beginning with '$' from a client-supplied object so Mongo
// query operators cannot be injected (e.g. {"status":{"$ne":"x"}}).
const stripDollarKeys = (obj) => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  const clean = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key.startsWith('$')) continue;
    clean[key] =
      value && typeof value === 'object' && !Array.isArray(value)
        ? stripDollarKeys(value)
        : value;
  }
  return clean;
};

export const getAllStudents = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search?.trim();
    const filter = { role: 'student' };

    // ✅ Parse filters from query (JSON string)
    if (req.query.filters) {
      // Strip '$'-prefixed keys so Mongo operators cannot be injected.
      const parsedFilters = stripDollarKeys(JSON.parse(req.query.filters));

      if (typeof parsedFilters.isActive !== "undefined") {
        // Convert string to boolean if needed
        filter.isActive =
          parsedFilters.isActive === "true" || parsedFilters.isActive === true;
      }

      // Add any other parsed filters (optional)
      // Only accept plain strings — objects could carry Mongo operators.
      if (parsedFilters.status && typeof parsedFilters.status === 'string') {
        filter.status = parsedFilters.status;
      }
    }

    // 🔍 Field-based searches
    // escapeRegExp caps length at 200 and escapes regex metacharacters so
    // user input is matched literally (prevents ReDoS / regex injection).
    if (req.query.fullName) {
      filter.fullName = { $regex: escapeRegExp(String(req.query.fullName)), $options: 'i' };
    }
    if (req.query.email) {
      filter.email = { $regex: escapeRegExp(String(req.query.email)), $options: 'i' };
    }
    if (req.query.phone) {
      filter.phone = { $regex: escapeRegExp(String(req.query.phone)), $options: 'i' };
    }

    // 🔍 General search
    if (search) {
      const safeSearch = escapeRegExp(String(search));
      filter.$or = [
        { fullName: { $regex: safeSearch, $options: 'i' } },
        { email: { $regex: safeSearch, $options: 'i' } },
        { phone: { $regex: safeSearch, $options: 'i' } }
      ];
    }

    const sort = { createdAt: -1 };

    const { users, total } = await userService.getAllUsers(page, limit, filter, sort);

    return res.status(200).json({
      success: true,
      message: "✅ Students fetched successfully",
      data: {
        students: users,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      },
      err: {}
    });
  } catch (error) {
    console.error("❌ Error in getAllStudents:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch students",
      data: {},
      err: error.message
    });
  }
};



export const getStudentById = async (req, res) => {
  try {
    const { id } = req.params;

    const student = await userService.getUserById(id);

    if (!student || student.role !== 'student') {
      return res.status(404).json({
        success: false,
        message: 'Student not found',
        data: {},
        err: {}
      });
    }

    // Fetch enrollments from CourseEnrollment collection
    const enrollments = await CourseEnrollment.find({ userId: student._id })
      .populate('courseId') // <-- Correct field name
      .lean();

    // Map enrollments to include accessExpiry and enrolledAt, and rename courseId to course
    const mappedEnrollments = enrollments.map(enrollment => ({
      ...enrollment,
      course: enrollment.courseId, // expose as 'course'
      accessExpiry: enrollment.accessExpiry,
      enrolledAt: enrollment.enrolledAt || enrollment.createdAt,
    }));

    // Attach mapped enrollments to student object
    const studentObj = student.toObject ? student.toObject() : student;
    studentObj.enrollments = mappedEnrollments;

    // Attach latest personality test result
    let personality = null;
    try {
      const PersonalitySubmission = (await import('../models/PersonalitySubmission.js')).default;
      personality = await PersonalitySubmission.findOne({ userId: student._id }).sort({ createdAt: -1 }).lean();
    } catch (e) {
      console.error('Error fetching personality submission:', e);
    }
    studentObj.personality = personality ? {
      resultType: personality.resultType,
      scores: personality.scores,
      createdAt: personality.createdAt
    } : null;

    return res.status(200).json({
      success: true,
      message: '✅ Student fetched successfully',
      data: { student: studentObj },
      err: {}
    });
  } catch (error) {
    console.error("❌ Error in getStudentById:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch student",
      data: {},
      err: error.message
    });
  }
};

export const getStudentAnalytics = async (req, res) => {
  try {
    const { id } = req.params;
    const analytics = await ProjectAnalyticsService.getStudentAnalytics(id);
    if (analytics.error) {
      return res.status(404).json({
        success: false,
        message: analytics.error,
        data: {},
        err: {}
      });
    }
    return res.status(200).json({
      success: true,
      message: "✅ Student analytics fetched successfully",
      data: analytics,
      err: {}
    });
  } catch (error) {
    console.error("❌ Error in getStudentAnalytics:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch student analytics",
      data: {},
      err: error.message
    });
  }
};

// ---------------------------------------------------------------------------
// Student activity (admin panel StudentDetail page)
// GET /admin/students/:id/forum-posts | /forum-replies | /job-posts
// Response shape: { success, message, data: [...], total, page, limit, totalPages }
// (StudentDetail.tsx reads response.data?.data as the items array.)
// ---------------------------------------------------------------------------

const parseActivityPagination = (req) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
  return { page, limit, skip: (page - 1) * limit };
};

const listStudentActivity = (Model, ownerField, label) => async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid student id",
        data: [],
        err: { message: "Invalid student id" },
      });
    }

    const { page, limit, skip } = parseActivityPagination(req);
    const filter = { [ownerField]: id };

    const [items, total] = await Promise.all([
      Model.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Model.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      message: `✅ Student ${label} fetched successfully`,
      data: items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 0,
      err: {},
    });
  } catch (error) {
    console.error(`❌ Error fetching student ${label}:`, error);
    return res.status(500).json({
      success: false,
      message: `Failed to fetch student ${label}`,
      data: [],
      err: error.message,
    });
  }
};

// Forum threads authored by the student (ForumThread.createdBy)
export const getStudentForumPosts = listStudentActivity(
  ForumThread,
  "createdBy",
  "forum posts"
);

// Forum replies authored by the student (ForumReply.repliedBy)
export const getStudentForumReplies = listStudentActivity(
  ForumReply,
  "repliedBy",
  "forum replies"
);

// Job postings created by the student (JobPosting.createdBy)
export const getStudentJobPosts = listStudentActivity(
  JobPosting,
  "createdBy",
  "job posts"
);
