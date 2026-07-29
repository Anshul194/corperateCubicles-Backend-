import CouponRepository from '../repository/CouponRepository.js';
import AppError from '../utils/app-error.js';
import { StatusCodes } from 'http-status-codes';
import User from '../models/user.js'; // Assuming you have a User model to check user existence
import mongoose from 'mongoose';
import Course from '../models/Course.js';

class CouponService {
  constructor() {
    this.repository = new CouponRepository();
  }

  async create(couponData) {
    try {
      const {
        code,
        description,
        discountType,
        discountAmount,
        discountPercent,
        maxDiscountValue,
        minOrderAmount,
        usageLimit,
        usageLimitPerUser,
        startDate,
        endDate,
        isActive,
        applicableCourses
      } = couponData;

      // Validate required fields
      if (!code || !discountType || !startDate || !endDate) {
        throw new Error('Code, discount type, start date, and end date are required');
      }

      // Validate discount type and values
      if (discountType === 'flat' && (!discountAmount || discountAmount <= 0)) {
        throw new Error('Discount amount is required for flat discount type');
      }

      if (discountType === 'percentage' && (!discountPercent || discountPercent <= 0 || discountPercent > 100)) {
        throw new Error('Valid discount percentage (1-100) is required for percentage discount type');
      }

      // Bound discounts: reject negative values; percentage must be 0..100
      if (discountAmount !== undefined && discountAmount < 0) {
        throw new Error('Discount amount must be greater than or equal to 0');
      }

      if (discountPercent !== undefined && (discountPercent < 0 || discountPercent > 100)) {
        throw new Error('Discount percentage must be between 0 and 100');
      }

      // Validate dates
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (start >= end) {
        throw new Error('End date must be after start date');
      }

      // Check if coupon code already exists
      const existingCoupon = await this.repository.findByCode(code);
      if (existingCoupon) {
        throw new Error('Coupon code already exists');
      }

      // Validate applicableCourses if provided
      if (applicableCourses && Array.isArray(applicableCourses) && applicableCourses.length > 0) {
        // Validate each course ID is a valid ObjectId
        const invalidCourseIds = applicableCourses.filter(
          courseId => !mongoose.Types.ObjectId.isValid(courseId)
        );

        if (invalidCourseIds.length > 0) {
          throw new Error(`Invalid course IDs: ${invalidCourseIds.join(', ')}. Course IDs must be valid MongoDB ObjectIds (24-character hexadecimal strings).`);
        }

        // Optionally verify that courses exist
        const existingCourses = await Course.find({
          _id: { $in: applicableCourses },
          isDeleted: { $ne: true }
        }).select('_id title');

        if (existingCourses.length !== applicableCourses.length) {
          const foundIds = existingCourses.map(c => c._id.toString());
          const notFoundIds = applicableCourses.filter(id => !foundIds.includes(id.toString()));
          throw new Error(`Courses not found: ${notFoundIds.join(', ')}. Please provide valid course IDs.`);
        }
      }

      // Whitelist fields taken from the caller to avoid persisting arbitrary input
      const couponPayload = {
        code,
        description,
        discountType,
        discountAmount,
        discountPercent,
        maxDiscountValue,
        minOrderAmount,
        usageLimit,
        usageLimitPerUser,
        startDate,
        endDate,
        isActive,
        applicableCourses
      };

      for (const key of Object.keys(couponPayload)) {
        if (couponPayload[key] === undefined) {
          delete couponPayload[key];
        }
      }

      const coupon = await this.repository.create(couponPayload);
      return coupon;
    } catch (error) {
      throw error;
    }
  }

  async getById(id) {
    try {
      const coupon = await this.repository.findById(id);
      if (!coupon) {
        throw new Error('Coupon not found');
      }
      return coupon;
    } catch (error) {
      throw error;
    }
  }

  async getAll(query) {
    try {
      const {
        page = 1,
        limit = 10,
        filters = "{}",
        searchFields = "{}",
        sort = "{}",
        includeExpired = "false" // 🔹 NEW: allow including expired if needed
      } = query;

      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.max(1, parseInt(limit));
      const skip = (pageNum - 1) * limitNum;

      // ✅ Safe JSON parsing (fallback to empty object)
      let parsedFilters, parsedSearchFields, parsedSort;
      try {
        parsedFilters = JSON.parse(filters || "{}");
      } catch {
        parsedFilters = {};
      }
      try {
        parsedSearchFields = JSON.parse(searchFields || "{}");
      } catch {
        parsedSearchFields = {};
      }
      try {
        parsedSort = JSON.parse(sort || "{}");
      } catch {
        parsedSort = {};
      }

      // 🔹 Build query conditions
      const queryConditions = {};

      // Exclude expired coupons unless explicitly requested
      if (includeExpired !== "true") {
        queryConditions.endDate = { $gte: new Date() };
      }

      // Apply filters (exact matches)
      for (const [key, value] of Object.entries(parsedFilters)) {
        if (value !== "" && value !== undefined && value !== null) {
          queryConditions[key] = value;
        }
      }

      // Apply search (regex-based for partial matches)
      const searchConditions = [];
      for (const [field, term] of Object.entries(parsedSearchFields)) {
        if (term && term.trim() !== "") {
          searchConditions.push({ [field]: { $regex: term, $options: "i" } });
        }
      }
      if (searchConditions.length > 0) {
        queryConditions.$or = searchConditions;
      }

      // 🔹 Build sort conditions
      const sortConditions = {};
      if (Object.keys(parsedSort).length > 0) {
        for (const [field, direction] of Object.entries(parsedSort)) {
          sortConditions[field] = direction === "asc" ? 1 : -1;
        }
      } else {
        sortConditions.createdAt = -1; // default sort: newest first
      }

      // 🔹 Fetch from repo
      const { coupons, total } = await this.repository.findAllWithPagination(
        queryConditions,
        sortConditions,
        skip,
        limitNum
      );

      return {
        result: coupons,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      };
    } catch (error) {
      console.error("Error fetching coupons:", error.message);
      throw new AppError(
        "Cannot fetch data of all coupons",
        StatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  }


  async updateById(id, updateData) {
    try {
      const updateFields = {};
      const allowedFields = [
        'code', 'description', 'discountType', 'discountAmount', 'discountPercent',
        'maxDiscountValue', 'minOrderAmount', 'usageLimit', 'usageLimitPerUser',
        'startDate', 'endDate', 'isActive', 'applicableCourses'
      ];

      // Filter and validate update fields
      for (const field of allowedFields) {
        if (updateData[field] !== undefined) {
          updateFields[field] = updateData[field];
        }
      }

      if (Object.keys(updateFields).length === 0) {
        throw new Error('No valid fields to update');
      }

      // Validate code uniqueness if updating
      if (updateFields.code) {
        const existingCoupon = await this.repository.findByCode(updateFields.code);
        if (existingCoupon && existingCoupon._id.toString() !== id) {
          throw new Error('Coupon code already exists');
        }
      }

      // Validate discount values if updating
      if (updateFields.discountType === 'flat' && updateFields.discountAmount <= 0) {
        throw new Error('Discount amount must be greater than 0 for flat discount');
      }

      if (updateFields.discountType === 'percentage' &&
        (updateFields.discountPercent <= 0 || updateFields.discountPercent > 100)) {
        throw new Error('Discount percentage must be between 1 and 100');
      }

      // Bound discounts regardless of whether discountType is included in the update:
      // reject negative flat amounts; clamp percentage to 0..100
      if (updateFields.discountAmount !== undefined && updateFields.discountAmount < 0) {
        throw new Error('Discount amount must be greater than or equal to 0');
      }

      if (updateFields.discountPercent !== undefined &&
        (updateFields.discountPercent < 0 || updateFields.discountPercent > 100)) {
        throw new Error('Discount percentage must be between 0 and 100');
      }

      // Validate dates if updating
      if (updateFields.startDate && updateFields.endDate) {
        const start = new Date(updateFields.startDate);
        const end = new Date(updateFields.endDate);
        if (start >= end) {
          throw new Error('End date must be after start date');
        }
      }

      const updatedCoupon = await this.repository.updateById(id, updateFields);
      if (!updatedCoupon) {
        throw new Error('Coupon not found');
      }
      return updatedCoupon;
    } catch (error) {
      throw error;
    }
  }

  async softDeleteById(id) {
    try {
      const deletedCoupon = await this.repository.softDeleteById(id);
      if (!deletedCoupon) {
        throw new Error('Coupon not found');
      }
      return deletedCoupon;
    } catch (error) {
      throw error;
    }
  }

  async validateCoupon(code, orderAmount, email, courseId = null) {
    try {
      const coupon = await this.repository.findByCode(code);

      const user = email ? await User.findOne({ email }) : null;
      const userId = user ? user._id : null;

      if (!coupon) {
        throw new Error('Invalid coupon code');
      }

      // Check active status
      if (!coupon.isActive) {
        throw new Error('Coupon is not active');
      }

      // Check date validity
      const now = new Date();

      if (now < new Date(coupon.startDate)) {
        throw new Error('Coupon is not yet valid');
      }

      if (now > new Date(coupon.endDate)) {
        throw new Error('Coupon has expired');
      }

      // Check applicable courses. `courseId` may be a single id (legacy
      // callers) or an array of ids (student checkout sends courseIds).
      if (coupon.applicableCourses && coupon.applicableCourses.length > 0) {

        const requestedCourseIds = (Array.isArray(courseId) ? courseId : [courseId])
          .filter(Boolean)
          .map(id => id.toString());

        if (requestedCourseIds.length === 0) {
          throw new Error(
            'This coupon is only valid for specific courses. Please provide a course ID.'
          );
        }

        const applicableIds = coupon.applicableCourses.map(course =>
          (course._id || course).toString()
        );

        const isApplicable = requestedCourseIds.some(id => applicableIds.includes(id));

        if (!isApplicable) {
          throw new Error('This coupon is not valid for the selected course');
        }
      }

      // Check minimum order amount
      if (orderAmount < coupon.minOrderAmount) {
        throw new Error(
          `Minimum order amount of ₹${coupon.minOrderAmount} required`
        );
      }

      // Check global usage limit
      if (coupon.usageLimit > 0) {
        const totalUsage = coupon.usedBy.reduce(
          (sum, user) => sum + user.usageCount,
          0
        );

        if (totalUsage >= coupon.usageLimit) {
          throw new Error('Coupon usage limit exceeded');
        }
      }

      // Check per-user usage limit
      if (userId && coupon.usageLimitPerUser > 0) {

        const userUsage = coupon.usedBy.find(
          user => user.userId.toString() === userId.toString()
        );

        if (
          userUsage &&
          userUsage.usageCount >= coupon.usageLimitPerUser
        ) {
          throw new Error(
            'You have reached the usage limit for this coupon'
          );
        }
      }

      // Calculate discount
      let discountAmount = 0;

      if (coupon.discountType === 'flat') {

        discountAmount = coupon.discountAmount;

      } else if (coupon.discountType === 'percentage') {

        discountAmount =
          (orderAmount * coupon.discountPercent) / 100;

        // Apply max discount cap
        if (
          coupon.maxDiscountValue > 0 &&
          discountAmount > coupon.maxDiscountValue
        ) {
          discountAmount = coupon.maxDiscountValue;
        }
      }

      // Prevent discount exceeding order amount
      if (discountAmount > orderAmount) {
        discountAmount = orderAmount;
      }

      const finalAmount = orderAmount - discountAmount;

      return {
        coupon: {
          _id: coupon._id,
          code: coupon.code,
          description: coupon.description,
          discountType: coupon.discountType,
          discountAmount: coupon.discountAmount,
          discountPercent: coupon.discountPercent,
          maxDiscountValue: coupon.maxDiscountValue,
          minOrderAmount: coupon.minOrderAmount,
          applicableCourses: coupon.applicableCourses,
        },

        orderAmount,
        discountAmount,
        finalAmount,
        isValid: true,
      };

    } catch (error) {
      throw error;
    }
  }

  async applyCoupon(code, orderAmount, email, courseId = null) {
    try {
      // First validate the coupon
      const validationResult = await this.validateCoupon(code, orderAmount, email, courseId);

      // Update usage count
      // await this.repository.incrementUsage(validationResult.coupon._id, userId);

      return {
        ...validationResult,
        message: 'Coupon applied successfully'
      };
    } catch (error) {
      throw error;
    }
  }
}

export default CouponService;