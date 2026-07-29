import User from "../models/user.js";
import Course from "../models/Course.js";
import SupportTicket from "../models/SupportTicket.js";
import ForumThread from "../models/ForumThread.js";
import CourseEnrollment from "../models/CourseEnrollment.js";
import Order from "../models/Order.js";
import CrudRepository from "./crudRepository.js";
import Certificate from "../models/Certificate.js";
import mongoose from "mongoose";

// Sensitive fields that must never be serialized to clients. Queries exclude
// these by default; callers that genuinely need them (auth/login, password
// change) must opt in via { includeSensitive: true }.
const SENSITIVE_USER_FIELDS =
  "-password -passwordResetToken -passwordResetExpiry -otp -otpExpiry -otpAttempts";

class UserRepository extends CrudRepository {
  constructor() {
    super(User);
    this.CourseEnrollment = CourseEnrollment;
    this.Certificate = Certificate;
    // Register Enrollment model if not already registered
    if (!mongoose.models.Enrollment) {
      mongoose.model('Enrollment', CourseEnrollment.schema);
    }
  }

  // Find a user by data and aggregate enrolled courses using $lookup
  async findBy(data, { includeSensitive = false } = {}) {
    try {
      // Find the user first
      const query = User.findOne(data);
      if (!includeSensitive) query.select(SENSITIVE_USER_FIELDS);
      const user = await query.lean();
      if (!user) return null;

      // Use the registered Enrollment model for aggregation
      const enrollments = await this.CourseEnrollment.aggregate([
        { $match: { userId: user._id } },
        {
          $lookup: {
            from: 'courses',
            localField: 'courseId',
            foreignField: '_id',
            as: 'course'
          }
        },
        {
          $lookup: {
            from: 'coursebundles',
            localField: 'CourseBundleId',
            foreignField: '_id',
            as: 'courseBundle'
          }
        },
        {
          $project: {
            _id: 1,
            course: { $arrayElemAt: ['$course', 0] },
            courseBundle: { $arrayElemAt: ['$courseBundle', 0] },
            orderId: 1,
            accessStart: 1,
            accessEnd: 1,
            isActive: 1,
            createdAt: 1,
            updatedAt: 1
          }
        }
      ]);

      return { ...user, enrollments };
    } catch (error) {
      throw error;
    }
  }

  // Lighter findOne that doesn't do expensive enrollment aggregation
  async findOne(data, { includeSensitive = false } = {}) {
    try {
      const query = User.findOne(data);
      if (!includeSensitive) query.select(SENSITIVE_USER_FIELDS);
      return await query.lean();
    } catch (error) {
      throw error;
    }
  }


  async deleteEducationFromArray(userId, educationId) {
    try {
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        {
          $pull: {
            education: { _id: educationId }
          }
        },
        {
          new: true,
          runValidators: true
        }
      );
      return updatedUser;
    } catch (error) {
      console.error("❌ Repository delete education error:", error);
      throw error;
    }
  }

  async updateById(id, updateData) {
    try {
      //console.log("🔄 Updating user by ID:", id);
      //console.log("🧪 [DEBUG] Update Data:", updateData);
      const updatedUser = await User.findByIdAndUpdate(id, updateData, { new: true });
      return updatedUser;
    } catch (error) {
      throw error;
    }
  }

  async findById(id) {
    try {
      const user = await this.model.findById(id);
      return user;
    } catch (error) {
      throw error;
    }
  }

  async findMany(filter = {}, sort = {}, skip = 0, limit = 10) {
    try {
      const result = await this.model
        .find(filter)
        .select(SENSITIVE_USER_FIELDS)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean();
      return result;
    } catch (error) {
      console.error("❌ Error in findMany:", error);
      throw new Error("Failed to fetch data from database");
    }
  }

  async count(filter = {}) {
    try {
      return await this.model.countDocuments(filter);
    } catch (error) {
      console.error("❌ Error in count:", error);
      throw error;
    }
  }

  async deleteDocumentFromArray(userId, documentId) {
    try {
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        {
          $pull: {
            documentation: { _id: documentId }
          }
        },
        {
          new: true,
          runValidators: true
        }
      );
      return updatedUser;
    } catch (error) {
      console.error("❌ Repository delete document error:", error);
      throw error;
    }
  }

  async getActiveCoursesByUserId(userId, page = 1, limit = 10) {
    try {
      const skip = (page - 1) * limit;
      const enrollments = await this.CourseEnrollment.find({
        userId,
        status: 'active'
      })
        .skip(skip)
        .limit(limit)
        .lean();

      const populatedCourses = await Promise.all(enrollments.map(async (enrollment) => {
        if (enrollment.courseId && enrollment.type === 'course') {
          const course = await this.model.db.models.Course.findById(enrollment.courseId)
            .select('title thumbnail description slug level duration price currency tags prerequisites learningOutcomes')
            .lean();
          return {
            type: 'course',
            enrolledAt: enrollment.enrolledAt,
            accessType: enrollment.accessType,
            status: enrollment.status,
            course
          };
        }
        return {
          type: enrollment.type,
          enrolledAt: enrollment.enrolledAt,
          accessType: enrollment.accessType,
          status: enrollment.status
        };
      }));

      return populatedCourses;
    } catch (error) {
      throw new Error(`Error fetching active courses: ${error.message}`);
    }
  }

  async countAllCoursesByUserId(userId) {
    try {
      return await this.CourseEnrollment.countDocuments({ userId });
    } catch (error) {
      throw new Error(`Error counting all courses: ${error.message}`);
    }
  }

  async countActiveCoursesByUserId(userId) {
    try {
      return await this.CourseEnrollment.countDocuments({ userId, status: 'active' });
    } catch (error) {
      throw new Error(`Error counting active courses: ${error.message}`);
    }
  }

  async countCertificatesByUserId(userId) {
    try {
      if (!this.Certificate) {
        throw new Error('Certificate model is not defined');
      }
      return await this.Certificate.countDocuments({ user_id: userId, status: 'issued' });
    } catch (error) {
      throw new Error(`Error counting certificates: ${error.message}`);
    }
  }

  async getOverviewDashboard() {
    try {
      //console.log("🗄️ Fetching overview dashboard data from database");

      // Define date ranges for sales counts in IST (Asia/Kolkata, UTC+5:30).
      // BUG FIX: this previously used `new Date(y, m, d)` — the SERVER's local
      // midnight, not IST. On a UTC host every boundary landed at 05:30 IST, so
      // today/month/year counts mismatched Razorpay's IST reports (and shifted
      // on the 1st). Shift "now" by the IST offset, take the IST calendar date,
      // then shift back to get the true UTC instant of IST midnight.
      const IST_OFFSET_MS = 330 * 60 * 1000; // UTC+5:30, no DST
      const istNow = new Date(Date.now() + IST_OFFSET_MS);
      const startOfDay = new Date(
        Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate()) - IST_OFFSET_MS
      );
      const startOfMonth = new Date(
        Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), 1) - IST_OFFSET_MS
      );
      const startOfYear = new Date(
        Date.UTC(istNow.getUTCFullYear(), 0, 1) - IST_OFFSET_MS
      );

      // Parallel queries for counts
      const [
        totalCourses,
        totalSupportTickets,
        totalStudents,
        totalForumThreads,
        todaySales,
        thisMonthSales,
        thisYearSales,
        paidSalesCount,
        platformIncome
      ] = await Promise.all([
        this.model.db.models.Course.countDocuments({ isDeleted: false, isPublished: true }),
        this.model.db.models.SupportTicket.countDocuments({ isDeleted: false }),
        this.count({ role: 'student', isActive: true }),
        this.model.db.models.ForumThread.countDocuments(),
        this.CourseEnrollment.countDocuments({
          enrolledAt: { $gte: startOfDay },
          status: 'active',
          enrollmentSource: 'purchase'
        }),
        this.CourseEnrollment.countDocuments({
          enrolledAt: { $gte: startOfMonth },
          status: 'active',
          enrollmentSource: 'purchase'
        }),
        this.CourseEnrollment.countDocuments({
          enrolledAt: { $gte: startOfYear },
          status: 'active',
          enrollmentSource: 'purchase'
        }),
        this.CourseEnrollment.countDocuments({ status: 'active', enrollmentSource: 'purchase' }),
        this.model.db.models.Order.aggregate([
          { $match: { 'payment.status': 'paid', isRefunded: false } },
          { $group: { _id: null, total: { $sum: '$grandTotal' } } },
          { $project: { _id: 0, total: { $toDouble: '$total' } } }
        ]).then(result => result[0]?.total || 0)
      ]);
      // --- Add revenue and sales count from admin enrollments ---
      const adminEnrollmentsAgg = await this.CourseEnrollment.aggregate([
        { $match: { enrollmentSource: 'admin', addToRevenue: true, pricePaid: { $gt: 0 } } },
        { $group: { _id: null, total: { $sum: '$pricePaid' }, count: { $sum: 1 } } }
      ]);
      const adminRevenue = Number(adminEnrollmentsAgg[0]?.total || 0);
      const adminSalesCount = Number(adminEnrollmentsAgg[0]?.count || 0);

      // Parallel queries for latest records
      const [latestCourses, latestSupportTickets, latestForumThreads] = await Promise.all([
        this.model.db.models.Course
          .find({ isDeleted: false, isPublished: true })
          .sort({ createdAt: -1 })
          .limit(5)
          .select('title slug thumbnail createdAt')
          .lean(),
        this.model.db.models.SupportTicket
          .find({ isDeleted: false })
          .sort({ createdAt: -1 })
          .limit(5)
          .select('subject category status createdAt')
          .populate('userId', 'fullName email')
          .lean(),
        this.model.db.models.ForumThread
          .find()
          .sort({ createdAt: -1 })
          .limit(5)
          .select('title content createdAt')
          .populate('createdBy', 'fullName')
          .populate('courseId', 'title')
          .lean()
      ]);

      return {
        totalCourses,
        totalSupportTickets,
        totalStudents,
        totalForumThreads,
        todaySales,
        thisMonthSales,
        thisYearSales,
        totalSales: paidSalesCount + adminSalesCount, // <-- include admin sales count
        platformIncome: (platformIncome || 0) + adminRevenue, // <-- include admin revenue
        latestCourses,
        latestSupportTickets,
        latestForumThreads
      };
    } catch (error) {
      console.error("❌ Overview dashboard repository error:", error);
      throw new Error(`Failed to fetch overview dashboard data: ${error.message}`);
    }
  }
}

export default UserRepository;