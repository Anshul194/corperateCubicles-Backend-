import enrollmentService from '../service/enrollmentService.js';
import Course from '../models/Course.js';
import { initRedis } from '../config/redisClient.js';
import fcmTokenss from "../models/fcmTokens.js";
import notificationService from "../utils/notificationService.js";
import Notification from "../models/Notifications.js";

export const createEnrollment = async (req, res) => {
  try {
    // If plan, set type
    if (req.body.coursePlanId) {
      req.body.type = 'coursePlan';
    }
    const enrollment = await enrollmentService.createEnrollment(req.body, res);

    const redis = await initRedis();
    await redis.del('enrollments:all*');

    res.status(201).json({
      success: true,
      message: 'Enrollment created successfully',
      data: enrollment,
    });
  } catch (error) {
    console.error('createEnrollment Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// notification without 
export const createFreeEnrollment = async (req, res) => {
  try {
    const enrollment = await enrollmentService.createFreeEnrollment(req.body, req, res);

    const redis = await initRedis();
    await redis.del('enrollments:all*');

    res.status(201).json({
      success: true,
      message: 'Free enrollment created successfully',
      data: enrollment,
    });
  } catch (error) {
    console.error('createFreeEnrollment Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};




// Roles allowed to read other users' enrollments.
const ENROLL_ADMIN_ROLES = ['admin', 'instructor'];
const isPrivileged = (user) => {
  if (!user) return false;
  const roles = Array.isArray(user.roles) ? user.roles : [user.role || user.roles];
  return roles.some((r) => ENROLL_ADMIN_ROLES.includes(r));
};

export const getAllEnrollments = async (req, res) => {
  try {
    const { userId, courseId, courseBundel } = req.query;

    // SECURITY (IDOR): a non-privileged caller may only see their OWN enrollments.
    // Previously any authenticated user could read the entire enrollment list (and
    // anyone's via ?userId=). Force the filter to the caller for students.
    const effectiveUserId = isPrivileged(req.user) ? userId : req.user._id.toString();
    const options = { userId: effectiveUserId, courseId, courseBundel };

    const redis = await initRedis();
    const cacheKey = `enrollments:all:${JSON.stringify(options)}`;
    const cached = await redis.get(cacheKey);

    if (cached) {
      return res.status(200).json({
        success: true,
        message: 'Enrollments fetched from cache',
        data: JSON.parse(cached),
        fromCache: true,
      });
    }

    const enrollments = await enrollmentService.getAllEnrollments(options);
    await redis.setEx(cacheKey, 300, JSON.stringify(enrollments));

    res.status(200).json({
      success: true,
      message: 'Enrollments fetched successfully',
      data: enrollments,
    });
  } catch (error) {
    console.error('getAllEnrollments Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getEnrollmentById = async (req, res) => {
  try {
    const enrollment = await enrollmentService.getEnrollmentById(req.params.id);
    if (!enrollment)
      return res.status(404).json({ success: false, message: 'Enrollment not found' });

    // SECURITY (IDOR): only the owner or a privileged user may read an enrollment.
    const ownerId = enrollment.userId?._id?.toString?.() || enrollment.userId?.toString?.();
    if (!isPrivileged(req.user) && ownerId !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    res.status(200).json({
      success: true,
      message: 'Enrollment fetched successfully',
      data: enrollment,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteEnrollment = async (req, res) => {
  try {
    await enrollmentService.deleteEnrollment(req.params.id);

    const redis = await initRedis();
    await redis.del('enrollments:all*');

    res.status(200).json({ success: true, message: 'Enrollment deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateEnrollment = async (req, res) => {
  try {
    const updated = await enrollmentService.updateEnrollment(req.params.id, req.body);
    if (!updated) return res.status(404).json({ success: false, message: 'Enrollment not found' });

    const redis = await initRedis();
    await redis.del(`enrollment:${req.params.id}`);
    await redis.del('enrollments:all*');

    res.status(200).json({ success: true, message: 'Enrollment updated successfully', data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const adminEnrollStudent = async (req, res) => {
  try {
    const { userId, courseId, courseBundleId, accessExpiry, customPrice, addToRevenue } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required' });
    }

    const hasCourse = !!courseId;
    const hasBundle = !!courseBundleId;

    if (hasCourse && hasBundle) {
      return res.status(400).json({ success: false, message: 'Provide either courseId or courseBundleId, not both' });
    }

    if (!hasCourse && !hasBundle) {
      return res.status(400).json({ success: false, message: 'Either courseId or courseBundleId must be provided' });
    }

    const type = hasCourse ? 'course' : 'courseBundle';

    // Check if user is already enrolled
    const CourseEnrollment = (await import('../models/CourseEnrollment.js')).default;
    const existingEnrollment = await CourseEnrollment.findOne({
      userId,
      ...(hasCourse ? { courseId } : { courseBundleId })
    });

    if (existingEnrollment) {
      const now = new Date();
      const isExpired = existingEnrollment.accessExpiry && existingEnrollment.accessExpiry < now;
      
      if (existingEnrollment.status === 'active' && !isExpired) {
        return res.status(400).json({ 
          success: false, 
          message: 'User is already enrolled and access is active' 
        });
      }

      if (isExpired || existingEnrollment.status === 'expired') {
        // Update existing enrollment with new expiry date
        const updateData = {
          status: 'active',
          enrolledAt: new Date()
        };

        // Calculate new access expiry
        if (accessExpiry) {
          updateData.accessExpiry = new Date(accessExpiry);
        } else {
          // Recalculate based on course/bundle settings
          if (hasCourse) {
            const courseDoc = await Course.findById(courseId).lean();
            if (courseDoc && (courseDoc.accessType === 'limited' || courseDoc.accessType === 'subscription') && courseDoc.accessPeriod) {
              const periodStr = courseDoc.accessPeriod.trim().toLowerCase();
              let years = 0, months = 0, days = 0;
              const yearMatch = periodStr.match(/(\d+)\s*year/);
              const monthMatch = periodStr.match(/(\d+)\s*month/);
              const dayMatch = periodStr.match(/(\d+)\s*day/);
              if (yearMatch) years = parseInt(yearMatch[1], 10);
              if (monthMatch) months = parseInt(monthMatch[1], 10);
              if (dayMatch) days = parseInt(dayMatch[1], 10);
              let expiry = new Date();
              if (years > 0) expiry.setFullYear(expiry.getFullYear() + years);
              if (months > 0) expiry.setMonth(expiry.getMonth() + months);
              if (days > 0) expiry.setDate(expiry.getDate() + days);
              if (years > 0 || months > 0 || days > 0) {
                updateData.accessExpiry = expiry;
              }
            }
          } else if (hasBundle) {
            const bundleDoc = await CourseBundle.findById(courseBundleId).lean();
            if (bundleDoc && (bundleDoc.accessType === 'limited' || bundleDoc.accessType === 'subscription') && bundleDoc.accessPeriod) {
              const periodStr = bundleDoc.accessPeriod.trim().toLowerCase();
              let years = 0, months = 0, days = 0;
              const yearMatch = periodStr.match(/(\d+)\s*year/);
              const monthMatch = periodStr.match(/(\d+)\s*month/);
              const dayMatch = periodStr.match(/(\d+)\s*day/);
              if (yearMatch) years = parseInt(yearMatch[1], 10);
              if (monthMatch) months = parseInt(monthMatch[1], 10);
              if (dayMatch) days = parseInt(dayMatch[1], 10);
              let expiry = new Date();
              if (years > 0) expiry.setFullYear(expiry.getFullYear() + years);
              if (months > 0) expiry.setMonth(expiry.getMonth() + months);
              if (days > 0) expiry.setDate(expiry.getDate() + days);
              if (years > 0 || months > 0 || days > 0) {
                updateData.accessExpiry = expiry;
              }
            }
          }
        }

        if (customPrice !== undefined) {
          updateData.pricePaid = Number(customPrice);
        }

        const updatedEnrollment = await CourseEnrollment.findByIdAndUpdate(
          existingEnrollment._id,
          updateData,
          { new: true }
        );

        // Optionally add to revenue/salesCount
        if (addToRevenue && customPrice !== undefined && hasCourse) {
          await Course.findByIdAndUpdate(
            courseId,
            { $inc: { salesCount: 1, revenue: Number(customPrice) } }
          );
        }

        const redis = await initRedis();
        await redis.del('enrollments:all*');

        return res.status(200).json({
          success: true,
          message: 'Enrollment renewed successfully',
          data: updatedEnrollment,
        });
      }
    }

    // 1. Create new enrollment with custom accessExpiry and customPrice
    const enrollmentData = {
      userId,
      courseId,
      courseBundleId,
      type,
      enrollmentSource: 'admin',
      accessExpiry: accessExpiry ? new Date(accessExpiry) : undefined,
      customPrice: customPrice !== undefined ? Number(customPrice) : undefined,
      addToRevenue: addToRevenue === true || addToRevenue === 'true' ? true : false,
    };

    const enrollment = await enrollmentService.createEnrollment(enrollmentData, res);

    // 2. If courseId provided, update Course.enrolledStudents and optionally revenue/salesCount
    if (hasCourse) {
      await Course.findByIdAndUpdate(
        courseId,
        {
          $addToSet: { enrolledStudents: userId }, // avoids duplicates
          $inc: { enrolledStudentsCount: 1 }
        }
      );
      // Optionally add to revenue/salesCount
      if (addToRevenue && customPrice !== undefined) {
        await Course.findByIdAndUpdate(
          courseId,
          { $inc: { salesCount: 1, revenue: Number(customPrice) } }
        );
      }
    }

    const redis = await initRedis();
    await redis.del('enrollments:all*');

    return res.status(201).json({
      success: true,
      message: 'Student enrolled successfully by admin',
      data: enrollment,
    });
  } catch (error) {
    console.error('adminEnrollStudent Error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// New API: Remove enrollment and update course enrolledStudents/enrolledStudentsCount
export const removeEnrollmentAndUpdateCourse = async (req, res) => {
  try {
    const enrollmentId = req.params.id;
    const enrollment = await enrollmentService.getEnrollmentById(enrollmentId);
    if (!enrollment) {
      return res.status(404).json({ success: false, message: 'Enrollment not found' });
    }

    // Remove enrollment
    await enrollmentService.deleteEnrollment(enrollmentId);

    // If course enrollment, update course
    if (enrollment.courseId && enrollment.userId) {
      await Course.findByIdAndUpdate(
        enrollment.courseId._id || enrollment.courseId,
        {
          $pull: { enrolledStudents: enrollment.userId._id || enrollment.userId },
          $inc: { enrolledStudentsCount: -1 }
        }
      );
    }

    // Optionally, handle courseBundle similarly if needed

    const redis = await initRedis();
    await redis.del('enrollments:all*');

    return res.status(200).json({
      success: true,
      message: 'Enrollment deleted and course updated successfully'
    });
  } catch (error) {
    console.error('removeEnrollmentAndUpdateCourse Error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

//   Update access expiry for an enrollment

 
export const updateAccessExpiry = async (req, res) => {
  try {
    const { id } = req.params;
    const { accessExpiry, accessType } = req.body;

    // Validate enrollment ID
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Enrollment ID is required',
        data: {},
        err: { message: 'Missing enrollment ID parameter' },
      });
    }

    // Get enrollment
    const CourseEnrollment = (await import('../models/CourseEnrollment.js')).default;
    const enrollment = await CourseEnrollment.findById(id);

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: 'Enrollment not found',
        data: {},
        err: { message: 'Enrollment not found' },
      });
    }

    // Prepare update data
    const updateData = {};

    // Update access expiry if provided
    if (accessExpiry !== undefined) {
      if (accessExpiry === null || accessExpiry === '') {
        // Set to lifetime (null expiry)
        updateData.accessExpiry = null;
        updateData.accessType = 'lifetime';
      } else {
        // Validate and set expiry date
        const expiryDate = new Date(accessExpiry);
        if (isNaN(expiryDate.getTime())) {
          return res.status(400).json({
            success: false,
            message: 'Invalid access expiry date format',
            data: {},
            err: { message: 'Invalid date format' },
          });
        }
        updateData.accessExpiry = expiryDate;
        
        // Update access type if provided, otherwise set to 'limited' if expiry is set
        if (accessType) {
          updateData.accessType = accessType;
        } else if (!enrollment.accessType || enrollment.accessType === 'lifetime') {
          updateData.accessType = 'limited';
        }
      }
    }

    // Update access type if provided separately
    if (accessType && !updateData.accessType) {
      updateData.accessType = accessType;
      // If setting to lifetime, clear expiry
      if (accessType === 'lifetime') {
        updateData.accessExpiry = null;
      }
    }

    // Update enrollment status based on expiry
    const now = new Date();
    if (updateData.accessExpiry) {
      if (updateData.accessExpiry < now) {
        updateData.status = 'expired';
      } else if (enrollment.status === 'expired' && updateData.accessExpiry >= now) {
        updateData.status = 'active';
      }
    } else if (updateData.accessType === 'lifetime') {
      // If setting to lifetime, ensure status is active (unless manually set otherwise)
      if (enrollment.status === 'expired') {
        updateData.status = 'active';
      }
    }

    // Update the enrollment
    const updatedEnrollment = await CourseEnrollment.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).populate('userId', 'fullName email')
      .populate('courseId', 'title')
      .populate('courseBundleId', 'title');

    // Clear cache
    const redis = await initRedis();
    await redis.del(`enrollment:${id}`);
    await redis.del('enrollments:all*');

    return res.status(200).json({
      success: true,
      message: 'Access expiry updated successfully',
      data: {
        enrollment: updatedEnrollment,
        updatedFields: {
          accessExpiry: updatedEnrollment.accessExpiry,
          accessType: updatedEnrollment.accessType,
          status: updatedEnrollment.status,
        },
      },
      err: {},
    });
  } catch (error) {
    console.error('❌ Update Access Expiry Error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to update access expiry',
      data: {},
      err: { message: error.message },
    });
  }
};

