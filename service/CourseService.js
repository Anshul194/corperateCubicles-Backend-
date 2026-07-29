import CourseRepository from "../repository/CourseRepository.js";
import CourseCategory from "../models/CourseCategory.js";
import SubCategory from "../models/SubCategory.js";
import User from "../models/user.js";
import slugify from "slugify";
import mongoose from "mongoose";
import Course from "../models/Course.js";
import CoursePlan from "../models/CoursePlan.js"
import escapeRegExp from "../utils/escapeRegExp.js";

class CourseService {
  constructor() {
    this.repository = new CourseRepository();
  }

  async generateUniqueSlug(title, excludeId = null) {

    try {
      console?.log("Generating unique slug for title:", title);
      const baseSlug = slugify(title, { lower: true, strict: true });
      let slug = baseSlug;
      let counter = 1;

      while (true) {
        const existingCourse = await this.repository.findBy({ slug });
        if (
          !existingCourse ||
          (excludeId && existingCourse._id.toString() === excludeId)
        ) {
          return slug;
        }
        slug = `${baseSlug}-${counter}`;
        counter++;
      }
    } catch (error) {
      //console.log("sdf",error?.message);
      throw new Error("Error generating unique slug");
    }
  }

  async create(courseData) {
    try {
      if (!courseData) {
        throw new Error("Course data is undefined");
      }

      //console.log("Creating course with data:", courseData);

      const {
        title,
        categoryId,
        subCategoryId,
        instructorId,
        topic,
        prerequisites,
      } = courseData;
      if (!title) {
        throw new Error(
          "Title is required"
        );
      }

      // Validate prerequisites
      if (!prerequisites) {
        courseData.prerequisites = "None";
      }

      // Validate categoryId only if provided and not empty
      if (categoryId && categoryId !== "") {
        const category = await CourseCategory.findOne({
          _id: categoryId,
          isDeleted: false,
        });
        if (!category) {
          throw new Error("Invalid or non-existent category");
        }
      } else {
        courseData.categoryId = null;
      }

      // Validate subCategoryId only if provided and not empty
      if (subCategoryId && subCategoryId !== "") {
        const subCategory = await SubCategory.findOne({
          _id: subCategoryId,
          isDeleted: false,
        });
        if (!subCategory) {
          throw new Error("Invalid or non-existent subcategory");
        }
      } else {
        courseData.subCategoryId = null;
      }

      // Validate instructorId
      // const instructor = await User.findOne({ _id: instructorId, role: 'instructor' });
      // if (!instructor) {
      //   throw new Error('Invalid or non-existent instructor');
      // }

      // Validate tags (max 5)
      if (courseData.tags && courseData.tags.length > 5) {
        throw new Error("Maximum 5 tags allowed");
      }

      // Coerce isFeatured to boolean when provided
      const toBoolean = (v) => {
        if (typeof v === 'boolean') return v;
        if (typeof v === 'string') return v === 'true' || v === '1';
        if (typeof v === 'number') return v === 1;
        return false;
      };
      if (courseData.isFeatured !== undefined) {
        courseData.isFeatured = toBoolean(courseData.isFeatured);
      }

      const slug = await this.generateUniqueSlug(title);
      // Ensure salePrice is included if present
      const course = await this.repository.create({ ...courseData, slug, salePrice: courseData.salePrice });
      return course;
    } catch (error) {
      throw error;
    }
  }

  async getById(id) {
    try {
      const course = await this.repository.findById(id);
      if (!course) {
        throw new Error("Course not found");
      }
      return course;
    } catch (error) {
      throw error;
    }
  }

  //updateCoursePlans
  async updateCoursePlans(courseId, plans) {
    try {
      if (!mongoose.Types.ObjectId.isValid(courseId)) {
        throw new Error("Invalid course ID format");
      }
      // Validate each plan and update or create
      for (const plan of plans) {
        if (!plan.name || !plan.price || !plan.duration || !plan.durationType) {
          throw new Error("Invalid course plan data");
        }
        if (!["Month", "Year", "Day"].includes(plan.durationType)) {
          throw new Error("Invalid duration type in course plan");
        }
        if (isNaN(plan.price) || plan.price < 0) {
          throw new Error("Invalid price in course plan");
        }
        if (isNaN(plan.duration) || plan.duration <= 0) {
          throw new Error("Invalid duration in course plan");
        }
        const coursePlanData = {
          courseId,
          name: plan.name,
          price: Number(plan.price),
          description: plan.description || '',
          durationType: plan.durationType,
          duration: Number(plan.duration),
          salePrice: plan.salePrice ? Number(plan.salePrice) : 0,
          status: plan.status || 'active'
        };
        if (plan._id) {
          // Update existing plan
          await CoursePlan.findOneAndUpdate(
            { _id: plan._id, courseId },
            { $set: coursePlanData },
            { new: true, runValidators: true }
          );
        } else {
          // Create new plan
          await CoursePlan.create(coursePlanData);
        }
      }
    } catch (error) {
      console.error("Error updating course plans:", error);
      throw new Error("Failed to update course plans");
    }
  }

  async getBySlug(slug) {
    try {
      const course = await this.repository.findBySlug(slug);
      if (!course) {
        throw new Error("Course not found");
      }
      return course;
    } catch (error) {
      throw error;
    }
  }

  async getAll(options = {}) {
    try {
      // If caller provided a top-level courseposition flag, forward into filter
      if (options.courseposition === true || options.courseposition === 'true') {
        options.filter = options.filter || {};
        options.filter.courseposition = 'true';
      }

      const coursesWithPagination = await this.repository.findAll(options);
      // --- Populate plans for each course here ---
      if (coursesWithPagination?.data && Array.isArray(coursesWithPagination.data)) {
        const CoursePlan = (await import("../models/CoursePlan.js")).default;
        const courseIds = coursesWithPagination.data.map(c => c._id);
        // Match both string and ObjectId courseId in CoursePlan
        const plans = await CoursePlan.find({ courseId: { $in: courseIds } }).lean();
        const plansByCourse = {};
        plans.forEach(plan => {
          const cid = plan.courseId?.toString?.() || plan.courseId;
          if (!plansByCourse[cid]) plansByCourse[cid] = [];
          plansByCourse[cid].push(plan);
        });
        coursesWithPagination.data.forEach(course => {
          course.plans = plansByCourse[course._id.toString()] || [];
        });
      }
      return coursesWithPagination;
    } catch (error) {
      throw error;
    }
  }

  async updateById(id, updateData, user) {
    try {
      console?.log("up", updateData)
      const { title, categoryId, subCategoryId, instructorId, topic, tags } =
        updateData;
      const updateFields = { ...updateData };

      //console.log("Updating course with ID:", title);
      if (title) {
        updateFields.slug = await this.generateUniqueSlug(title, id);
      }

      // Validate categoryId only if provided and not empty
      if (categoryId !== undefined) {
        if (categoryId && categoryId !== "") {
          const category = await CourseCategory.findOne({
            _id: categoryId,
            isDeleted: false,
          });
          if (!category) {
            throw new Error("Invalid or non-existent category");
          }
          updateFields.categoryId = categoryId;
        } else {
          updateFields.categoryId = null;
        }
      }

      // Validate subCategoryId only if provided and not empty
      if (subCategoryId !== undefined) {
        if (subCategoryId && subCategoryId !== "") {
          const subCategory = await SubCategory.findOne({
            _id: subCategoryId,
            isDeleted: false,
          });
          if (!subCategory) {
            throw new Error("Invalid or non-existent subcategory");
          }
          updateFields.subCategoryId = subCategoryId;
        } else {
          updateFields.subCategoryId = null;
        }
      }

      // if (instructorId) {
      //   const instructor = await User.findOne({
      //     _id: instructorId,
      //     role: "instructor",
      //   });
      //   if (!instructor) {
      //     throw new Error("Invalid or non-existent instructor");
      //   }
      // }

      // if (topic && (!Array.isArray(topic) || topic.length === 0)) {
      //   throw new Error("Topic must be a non-empty array");
      // }

      if (tags && tags.length > 5) {
        throw new Error("Maximum 5 tags allowed");
      }

      // Restrict instructor updates to their own courses
      if (
        user.roles === "instructor" &&
        instructorId &&
        instructorId !== user._id.toString()
      ) {
        throw new Error("Instructors can only update their own courses");
      }

      // Coerce isFeatured to boolean if present in update
      const toBoolean = (v) => {
        if (typeof v === 'boolean') return v;
        if (typeof v === 'string') return v === 'true' || v === '1';
        if (typeof v === 'number') return v === 1;
        return false;
      };
      if (updateFields.isFeatured !== undefined) {
        updateFields.isFeatured = toBoolean(updateFields.isFeatured);
      }

      if (Object.keys(updateFields).length === 0) {
        throw new Error("No valid fields to update");
      }

      // --- Ensure salePrice is always set and in correct type ---
      if (updateFields.salePrice !== undefined) {
        // Accept string, number, or Decimal128
        if (
          typeof updateFields.salePrice === "string" ||
          typeof updateFields.salePrice === "number"
        ) {
          updateFields.salePrice = mongoose.Types.Decimal128.fromString(
            updateFields.salePrice.toString() || "0"
          );
        }
        // If already Decimal128, leave as is
      }

      const updatedCourse = await this.repository.updateById(id, updateFields);
      if (!updatedCourse) {
        throw new Error("Course not found");
      }
      return updatedCourse;
    } catch (error) {
      throw error;
    }
  }

  async softDeleteById(id, user) {
    try {
      const course = await this.repository.findById(id);
      if (!course) {
        throw new Error("Course not found");
      }

      // Restrict instructors to deleting their own courses
      if (
        user.roles === "instructor" &&
        course.instructorId.toString() !== user._id.toString()
      ) {
        throw new Error("Instructors can only delete their own courses");
      }

      const deletedCourse = await this.repository.softDeleteById(id);
      return deletedCourse;
    } catch (error) {
      throw error;
    }
  }

  async getMyCourses(userId, userRole, options = {}) {
    try {
      // Validate userId format
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new Error("Invalid user ID format");
      }

      const {
        page = 1,
        limit = 10,
        sortBy = "createdAt",
        sortOrder = "desc",
        filter = {},
        search = ""
      } = options;

      // For instructors/admins - get courses they created
      if (userRole === "instructor" || userRole === "admin") {
        const coursesWithPagination = await this.repository.findMyCourses({
          ...options,
          filter: {
            ...filter,
            instructorId: new mongoose.Types.ObjectId(userId),
            isDeleted: false
          }
        });

        return {
          courses: coursesWithPagination.data,
          total: coursesWithPagination.total,
          page: coursesWithPagination.page,
          limit: coursesWithPagination.limit,
          totalPages: coursesWithPagination.totalPages,
          userRole,
          type: 'created'
        };
      } else {
        // For students - get enrolled courses
        const enrollments = await this.getUserEnrollments(userId);
        const enrolledCourseIds = enrollments.map(enrollment =>
          new mongoose.Types.ObjectId(enrollment.courseId)
        );

        if (enrolledCourseIds.length === 0) {
          return {
            courses: [],
            total: 0,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: 0,
            userRole,
            type: 'enrolled'
          };
        }

        const coursesWithPagination = await this.repository.findMyCourses({
          ...options,
          filter: {
            ...filter,
            _id: { $in: enrolledCourseIds },
            isDeleted: false
          }
        });

        // Add enrollment details to each course
        const coursesWithEnrollment = coursesWithPagination.data.map(course => {
          const enrollment = enrollments.find(e =>
            e.courseId.toString() === course._id.toString()
          );

          return {
            ...course,
            enrollment: {
              enrolledAt: enrollment?.enrolledAt,
              status: enrollment?.status,
              progress: enrollment?.progress || 0,
              completedLessons: enrollment?.completedLessons || [],
              lastAccessedAt: enrollment?.lastAccessedAt
            }
          };
        });

        return {
          courses: coursesWithEnrollment,
          total: coursesWithPagination.total,
          page: coursesWithPagination.page,
          limit: coursesWithPagination.limit,
          totalPages: coursesWithPagination.totalPages,
          userRole,
          type: 'enrolled'
        };
      }
    } catch (error) {
      throw error;
    }
  }

  // Helper method to get user enrollments (you'll need to implement based on your Enrollment model)
  async getUserEnrollments(userId) {
    try {
      // Assuming you have an Enrollment model
      // const Enrollment = require('../models/Enrollment.js');
      // return await Enrollment.find({ 
      //   userId: userId, 
      //   status: { $in: ['active', 'completed'] } 
      // }).populate('courseId');

      // For now, return empty array - implement based on your enrollment system
      return [];
    } catch (error) {
      console.error('Error fetching user enrollments:', error);
      return [];
    }
  }

  async getPopularCourses(options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = "createdAt",
        sortOrder = "desc"
      } = options;

      // Set filter to only get popular courses
      const filterOptions = {
        page,
        limit,
        sortBy,
        sortOrder,
        filter: {
          popular: true,
          isDeleted: false // Also exclude deleted courses
        }
      };

      const popularCoursesWithPagination = await this.repository.findAll(filterOptions);

      return {
        courses: popularCoursesWithPagination.data,
        total: popularCoursesWithPagination.total,
        page: popularCoursesWithPagination.page,
        limit: popularCoursesWithPagination.limit,
        totalPages: popularCoursesWithPagination.totalPages
      };
    } catch (error) {
      throw error;
    }
  }

  async filterCourses(options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        search = '',
        filters = {},
      } = options;

      // Updated duration ranges
      const durationMap = {
        '0-2 hours': { $lte: 120 }, // 0 to 120 minutes
        '2-5 hours': { $gt: 120, $lte: 300 }, // 121 to 300 minutes
        '5-10 hours': { $gt: 300, $lte: 600 }, // 301 to 600 minutes
        '10-20 hours': { $gt: 600, $lte: 1200 }, // 601 to 1200 minutes
        '20+ hours': { $gt: 1200 }, // More than 1200 minutes
      };

      // Build filter object
      let filter = { isDeleted: false };

      if (filters.categoryId) {
        filter.categoryId = new mongoose.Types.ObjectId(filters.categoryId);
      }

      if (filters.price) {
        if (filters.price === 'Free') {
          filter.price = 0;
        } else if (filters.price === 'Paid') {
          filter.price = { $gt: 0 };
        }
      }

      // Handle difficulty as a single value
      if (filters.difficulty) {
        filter.level = { $in: [filters.difficulty] }; // Matches courses where level array includes the specified difficulty
      }

      if (filters.isPublished !== undefined) {
        filter.isPublished = filters.isPublished; // Filter by isPublished status
      } else {
        filter.isPublished = true; // Default to published courses
      }

      // Handle duration based on the provided range
      if (filters.duration) {
        // Normalize duration input (e.g., "0-2" -> "0-2 hours")
        let normalizedDuration = filters.duration;
        if (normalizedDuration && !normalizedDuration.includes('hours')) {
          // Map common short forms to full durationMap keys
          const durationShortMap = {
            '0-2': '0-2 hours',
            '2-5': '2-5 hours',
            '5-10': '5-10 hours',
            '10-20': '10-20 hours',
            '20+': '20+ hours',
          };
          normalizedDuration = durationShortMap[normalizedDuration] || normalizedDuration;
        }

        const durationRange = durationMap[normalizedDuration];
        if (durationRange) {
          filter.duration = durationRange; // Apply the range from durationMap
        } else {
          // Treat as an exact value
          const durationInMinutes = parseInt(filters.duration);
          if (!isNaN(durationInMinutes)) {
            filter.duration = durationInMinutes;
          }
        }
      }

      // Add search query
      let searchQuery = {};
      if (search) {
        // escapeRegExp caps length at 200 and escapes regex metacharacters
        // so user-supplied search is matched literally (prevents ReDoS).
        const safeSearch = escapeRegExp(String(search));
        searchQuery = {
          $or: [
            { title: { $regex: safeSearch, $options: 'i' } },
            { description: { $regex: safeSearch, $options: 'i' } },
            { seoMetaDescription: { $regex: safeSearch, $options: 'i' } },
            { topic: { $regex: safeSearch, $options: 'i' } },
            { languages: { $regex: safeSearch, $options: 'i' } },
          ],
        };
      }

      const finalFilter = { ...filter, ...searchQuery };

      const coursesWithPagination = await this.repository.findAll({
        page,
        limit,
        sortBy,
        sortOrder,
        filter: finalFilter,
      });

      // --- Filter enrolledStudents by active enrollments ---
      if (coursesWithPagination?.data && Array.isArray(coursesWithPagination.data)) {
        const CourseEnrollment = (await import("../models/CourseEnrollment.js")).default;
        const courseIds = coursesWithPagination.data.map(c => c._id);

        // Fetch all active enrollments for these courses
        const enrollments = await CourseEnrollment.find({
          courseId: { $in: courseIds },
          status: 'active'
        }).select('userId courseId').lean();

        // Map courseId to array of active userIds
        const activeEnrolledByCourse = {};
        enrollments.forEach(e => {
          const cid = e.courseId?.toString();
          if (!activeEnrolledByCourse[cid]) activeEnrolledByCourse[cid] = [];
          activeEnrolledByCourse[cid].push(e.userId?.toString());
        });

        // Replace enrolledStudents with only active ones
        coursesWithPagination.data.forEach(course => {
          const cid = course._id?.toString();
          course.enrolledStudents = activeEnrolledByCourse[cid] || [];
        });
      }

      return coursesWithPagination;
    } catch (error) {
      throw error;
    }
  }

  async sortCourses(options = {}) {
    try {
      const {
        sortBy = 'newest',
        page = 1,
        limit = 10,
        search = '',
        filters = {},
      } = options;

      // Log the sortBy option for debugging
      //console.log('Service sortBy:', sortBy);
      //console.log('Filters:', filters);
      //console.log('Search:', search);

      // Map sortBy to sort criteria
      const sortMap = {
        priceAsc: { priceDouble: 1 }, // Sort by converted price (ascending)
        priceDesc: { priceDouble: -1 }, // Sort by converted price (descending)
        newest: { createdAt: -1 },
        oldest: { createdAt: 1 },
        popular: { enrolledStudentsCount: -1 }, // Sort by enrolledStudentsCount (descending)
      };

      const sortCriteria = sortMap[sortBy] || sortMap.newest;
      //console.log('Sort Criteria:', sortCriteria);

      // Updated duration ranges
      const durationMap = {
        '0-2 hours': { $lte: 120 }, // 0 to 120 minutes
        '2-5 hours': { $gt: 120, $lte: 300 }, // 121 to 300 minutes
        '5-10 hours': { $gt: 300, $lte: 600 }, // 301 to 600 minutes
        '10-20 hours': { $gt: 600, $lte: 1200 }, // 601 to 1200 minutes
        '20+ hours': { $gt: 1200 }, // More than 1200 minutes
      };

      // Build filter object
      let filter = { isDeleted: false };

      if (filters.categoryId) {
        filter.categoryId = new mongoose.Types.ObjectId(filters.categoryId);
      }

      if (filters.price) {
        if (filters.price === 'Free') {
          filter.price = { $eq: mongoose.Types.Decimal128.fromString('0') };
        } else if (filters.price === 'Paid') {
          filter.price = { $gt: mongoose.Types.Decimal128.fromString('0') };
        }
      }

      // Handle difficulty as a single value
      if (filters.difficulty) {
        filter.level = { $in: [filters.difficulty] };
      }

      // Handle duration based on the provided range
      if (filters.duration) {
        let normalizedDuration = filters.duration;
        if (normalizedDuration && !normalizedDuration.includes('hours')) {
          const durationShortMap = {
            '0-2': '0-2 hours',
            '2-5': '2-5 hours',
            '5-10': '5-10 hours',
            '10-20': '10-20 hours',
            '20+': '20+ hours',
          };
          normalizedDuration = durationShortMap[normalizedDuration] || normalizedDuration;
        }

        const durationRange = durationMap[normalizedDuration];
        if (durationRange) {
          filter.duration = durationRange;
        } else {
          const durationInMinutes = parseInt(filters.duration);
          if (!isNaN(durationInMinutes)) {
            filter.duration = durationInMinutes;
          }
        }
      }

      // Add search query
      let searchQuery = {};
      if (search) {
        // escapeRegExp caps length at 200 and escapes regex metacharacters
        // so user-supplied search is matched literally (prevents ReDoS).
        const safeSearch = escapeRegExp(String(search));
        searchQuery = {
          $or: [
            { title: { $regex: safeSearch, $options: 'i' } },
            { description: { $regex: safeSearch, $options: 'i' } },
            { seoMetaDescription: { $regex: safeSearch, $options: 'i' } },
            { topic: { $regex: safeSearch, $options: 'i' } },
            { languages: { $regex: safeSearch, $options: 'i' } },
          ],
        };
      }

      const finalFilter = { ...filter, ...searchQuery };

      // Use aggregation for price and popular sorting
      let courses, total;
      if (sortBy === 'priceAsc' || sortBy === 'priceDesc' || sortBy === 'popular') {
        const pipeline = [
          { $match: finalFilter },
          {
            $addFields: {
              priceDouble: { $toDouble: '$price' }, // Convert Decimal128 to double for price sorting
            },
          },
          { $sort: sortCriteria }, // Use sortCriteria for priceDouble or enrolledStudentsCount
          { $skip: (page - 1) * limit },
          { $limit: limit },
          {
            $lookup: {
              from: 'coursecategories',
              localField: 'categoryId',
              foreignField: '_id',
              as: 'categoryId',
            },
          },
          { $unwind: { path: '$categoryId', preserveNullAndEmptyArrays: true } },
          {
            $lookup: {
              from: 'subcategories',
              localField: 'subCategoryId',
              foreignField: '_id',
              as: 'subCategoryId',
            },
          },
          { $unwind: { path: '$subCategoryId', preserveNullAndEmptyArrays: true } },
          {
            $lookup: {
              from: 'users',
              localField: 'instructorId',
              foreignField: '_id',
              as: 'instructorId',
            },
          },
          { $unwind: { path: '$instructorId', preserveNullAndEmptyArrays: true } },
          {
            $lookup: {
              from: 'modules',
              localField: 'modules',
              foreignField: '_id',
              as: 'modules',
            },
          },
        ];

        courses = await Course.aggregate(pipeline);
        total = (await Course.aggregate([{ $match: finalFilter }, { $count: 'total' }]))[0]?.total || 0;
      } else {
        // Use repository findAll for non-price, non-popular sorting
        const coursesWithPagination = await this.repository.findAll({
          page,
          limit,
          sort: sortCriteria,
          filter: finalFilter,
        });

        courses = coursesWithPagination.data;
        total = coursesWithPagination.total;
      }

      return {
        courses,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      console.error('Sort Courses Service Error:', error);
      throw new Error(`Failed to sort courses: ${error.message}`);
    }
  }


}

export default CourseService;
