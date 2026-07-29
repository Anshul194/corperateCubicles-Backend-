import Testimonial from '../models/Testimonial.js';
import Course from '../models/Course.js';
import mongoose from 'mongoose';

const updateCourseStats = async (courseId) => {
  if (!courseId) return;

  const stats = await Testimonial.aggregate([
    { $match: { courseId: new mongoose.Types.ObjectId(courseId), status: 'approved', rating: { $exists: true, $ne: null } } },
    {
      $group: {
        _id: '$courseId',
        averageRating: { $avg: '$rating' },
        totalReviews: { $sum: 1 }
      }
    }
  ]);

  if (stats.length > 0) {
    await Course.findByIdAndUpdate(courseId, {
      averageRating: Math.round(stats[0].averageRating * 10) / 10,
      totalReviews: stats[0].totalReviews
    });
  } else {
    await Course.findByIdAndUpdate(courseId, {
      averageRating: 0,
      totalReviews: 0
    });
  }
};

const createTestimonial = async (data, isAdmin = false) => {
  if (isAdmin) {
    data.status = 'approved';
  } else {
    data.status = 'pending';
  }
  const testimonial = new Testimonial(data);
  const saved = await testimonial.save();
  if (saved.status === 'approved' && saved.courseId) {
    await updateCourseStats(saved.courseId);
  }
  return saved;
};

const getTestimonials = async (filter = {}, options = {}) => {
  return await Testimonial.find(filter, null, options)
    .populate('userId', 'fullName email profilePicture')
    .lean();
};

const getTestimonialById = async (id) => {
  return await Testimonial.findById(id);
};

const updateTestimonial = async (id, update) => {
  const testimonial = await Testimonial.findByIdAndUpdate(id, update, { new: true });
  if (testimonial && testimonial.courseId) {
    await updateCourseStats(testimonial.courseId);
  }
  return testimonial;
};

const deleteTestimonial = async (id) => {
  const testimonial = await Testimonial.findByIdAndDelete(id);
  if (testimonial && testimonial.courseId && testimonial.status === 'approved') {
    await updateCourseStats(testimonial.courseId);
  }
  return testimonial;
};

export default {
  createTestimonial,
  getTestimonials,
  getTestimonialById,
  updateTestimonial,
  deleteTestimonial
};