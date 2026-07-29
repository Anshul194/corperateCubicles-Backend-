import testimonialService from '../service/testimonialService.js';
import Testimonial from '../models/Testimonial.js';

// Admin: Add testimonial manually
export const addTestimonialAdmin = async (req, res) => {
  try {
    const { name, role, message, rating, courseId } = req.body;
    if (!message || !name) {
      return res.status(400).json({ success: false, message: 'Name and message are required.' });
    }

    const image = req.files?.image?.[0]?.path?.replace(/\\/g, '/');
    const video = req.files?.video?.[0]?.path?.replace(/\\/g, '/');

    const testimonial = await testimonialService.createTestimonial({ name, role, message, rating, courseId, image, video }, true);
    res.json({ success: true, message: 'Testimonial added and approved.', data: testimonial });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Admin: List all testimonials with filters
export const listTestimonialsAdmin = async (req, res) => {
  try {
    const { status, search, courseId } = req.query;
    let filter = {};
    if (status) filter.status = status;
    if (search) filter.message = { $regex: search, $options: 'i' };
    if (courseId) filter.courseId = courseId;
    const testimonials = await testimonialService.getTestimonials(filter, { sort: '-createdAt' });
    res.json({ success: true, message: 'Testimonials fetched.', data: testimonials });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Admin: Update testimonial
export const updateTestimonialAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { message, status, rating } = req.body;
    const update = {};
    if (message) update.message = message;
    if (status) update.status = status;
    if (rating) update.rating = rating;

    if (req.files?.image?.[0]) {
      update.image = req.files.image[0].path.replace(/\\/g, '/');
    }
    if (req.files?.video?.[0]) {
      update.video = req.files.video[0].path.replace(/\\/g, '/');
    }

    const testimonial = await testimonialService.updateTestimonial(id, update);
    if (!testimonial) return res.status(404).json({ success: false, message: 'Testimonial not found.' });
    res.json({ success: true, message: 'Testimonial updated.', data: testimonial });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Admin: Delete testimonial
export const deleteTestimonialAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const testimonial = await testimonialService.deleteTestimonial(id);
    if (!testimonial) return res.status(404).json({ success: false, message: 'Testimonial not found.' });
    res.json({ success: true, message: 'Testimonial deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// User: Submit own testimonial
export const submitTestimonial = async (req, res) => {
  try {
    let { message, rating, role, courseId, name, userId } = req.body;
    
    // Clean up escaped quotes from multipart form data
    const cleanString = (str) => {
      if (typeof str === 'string') {
        // Remove escaped quotes and extra quotes
        return str.replace(/^["']|["']$/g, '').replace(/\\"/g, '"').replace(/\\'/g, "'").trim();
      }
      return str;
    };
    
    message = cleanString(message);
    role = cleanString(role);
    name = cleanString(name);
    userId = cleanString(userId);
    
    if (!message) {
      return res.status(400).json({ success: false, message: 'Message is required.' });
    }
    
    // Get userId from authenticated user if available, otherwise from request body (cleaned)
    const finalUserId = req.user?._id || req.user?.id || (userId && userId !== '' ? userId : null) || null;

    // Optional: Check if user is enrolled in the course (only if userId and courseId provided)
    if (finalUserId && courseId) {
      const CourseEnrollment = (await import('../models/CourseEnrollment.js')).default;
      const isEnrolled = await CourseEnrollment.findOne({
        userId: finalUserId,
        courseId,
        status: { $in: ['active', 'completed'] }
      });

      if (!isEnrolled) {
        return res.status(403).json({
          success: false,
          message: 'You must be enrolled in this course to leave a testimonial.'
        });
      }
    }

    const image = req.files?.image?.[0]?.path?.replace(/\\/g, '/');
    const video = req.files?.video?.[0]?.path?.replace(/\\/g, '/');

    // Include name and userId in testimonial data if provided
    const testimonialData = { message, rating, role, courseId, image, video };
    if (finalUserId) {
      testimonialData.userId = finalUserId;
    }
    if (name) {
      testimonialData.name = name;
    }

    const testimonial = await testimonialService.createTestimonial(testimonialData, false);
    
    // Get user information to populate name if userId is available
    let userName = null;
    if (finalUserId) {
      try {
        const User = (await import('../models/user.js')).default;
        const user = await User.findById(finalUserId).select('fullName');
        userName = user?.fullName || null;
      } catch (userErr) {
        console.error('Error fetching user:', userErr);
        // Fallback to req.user if available
        userName = req.user?.fullName || req.user?.name || null;
      }
    }
    
    // Convert testimonial to plain object
    const testimonialObj = testimonial.toObject ? testimonial.toObject() : testimonial;
    
    // Ensure userId is included as string - prioritize from request body, then from saved testimonial
    let userIdString = null;
    if (finalUserId) {
      userIdString = finalUserId.toString ? finalUserId.toString() : String(finalUserId);
    } else if (testimonialObj.userId) {
      userIdString = testimonialObj.userId.toString ? testimonialObj.userId.toString() : String(testimonialObj.userId);
    }
    
    // Use name from body if provided, otherwise use user's fullName, otherwise use saved name
    const finalName = name || userName || testimonialObj.name || null;
    
    // Prepare response data with userId and name
    const responseData = {
      ...testimonialObj,
      userId: userIdString,
      name: finalName
    };
    
    res.json({ success: true, message: 'Testimonial submitted for approval.', data: responseData });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// User: Get own testimonials
export const getMyTestimonials = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const testimonials = await testimonialService.getTestimonials({ userId }, { sort: '-createdAt' });
    res.json({ success: true, message: 'Your testimonials fetched.', data: testimonials });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// User: Get all approved testimonials
export const getApprovedTestimonials = async (req, res) => {
  try {
    const { courseId } = req.query;
    const filter = { status: 'approved' };

    // Add courseId filter if provided
    if (courseId) {
      filter.courseId = courseId;
    }

    const testimonials = await testimonialService.getTestimonials(filter, { sort: '-createdAt' });
    res.json({ success: true, message: 'Approved testimonials fetched.', data: testimonials });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// User: Get single testimonial (if approved or belongs to user)
export const getTestimonial = async (req, res) => {
  try {
    const { id } = req.params;
    const testimonial = await testimonialService.getTestimonialById(id);
    if (!testimonial) return res.status(404).json({ success: false, message: 'Testimonial not found.' });
    if (testimonial.status === 'approved' || (req.user && testimonial.userId?.toString() === req.user._id.toString())) {
      return res.json({ success: true, message: 'Testimonial fetched.', data: testimonial });
    }
    res.status(403).json({ success: false, message: 'Not authorized to view this testimonial.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};