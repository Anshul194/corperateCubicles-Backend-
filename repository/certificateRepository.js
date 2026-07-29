import Certificate from '../models/Certificate.js';

class CertificateRepository {
  async create(data) {
    try {
      return await Certificate.create(data);
    } catch (error) {
      throw new Error(`Error creating certificate: ${error.message}`);
    }
  }


  async getCertificateById (id){
  return await Certificate.findById(id)
    .populate("user_id", "name email")
    .populate("course_id", "title")
    .populate("quiz_submission_id", "score")
    .populate("bundle_id", "title")
    .populate("certification_template", "name")
    .populate("instructor_id", "name");
}

  //findByUserAndType
  async findByUserAndType(userId, causerId, type, templateId) {
    try {
      return await Certificate.findOne({ user_id: userId, course_id: causerId, type, certification_template: templateId }).populate(['user_id', 'course_id', 'quiz_submission_id', 'bundle_id', 'certification_template', 'instructor_id']);
    } catch (error) {
      throw new Error(`Error finding certificate by user and type: ${error.message}`);
    }
  }

  async findAll({ page = 1, limit = 10, search = '', sortBy = 'createdAt', sortOrder = 'desc', filters = {} }) {
    try {
      const query = { ...filters };

      if (search) {
        query.$or = [
          { instructor_name: { $regex: search, $options: 'i' } },
          { serial_number: { $regex: search, $options: 'i' } },
          { remarks: { $regex: search, $options: 'i' } }
        ];
      }

      const skip = (page - 1) * limit;

      const data = await Certificate.find(query)
        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limit)
        .populate('user_id', 'name email')
        .populate('course_id', 'title')
        // .populate('quiz_id', '_id quizTitle quizDescription totalMarks passMark')
        .populate('instructor_id','name email');

      const total = await Certificate.countDocuments(query);

      return {
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      throw new Error(`Error fetching certificates: ${error.message}`);
    }
  }

  async findById(id) {
    try {
      if (!id) {
        throw new Error('Certificate ID is required');
      }

      // Ensure id is a valid ObjectId
      const mongoose = await import('mongoose');
      const { Types } = mongoose.default || mongoose;
      if (!Types.ObjectId.isValid(id)) {
        throw new Error('Invalid certificate ID format');
      }

      return await Certificate.findById(id)
        .populate('user_id', 'fullName email')
        .populate('course_id', 'title')
        // .populate('quiz_id', 'title')
        .populate('instructor_id', 'name');
    } catch (error) {
      throw new Error(`Error finding certificate by ID: ${error.message}`);
    }
  }

  async update(id, data) {
    try {
      return await Certificate.findByIdAndUpdate(id, data, { new: true });
    } catch (error) {
      throw new Error(`Error updating certificate: ${error.message}`);
    }
  }

  async delete(id) {
    try {
      return await Certificate.findByIdAndDelete(id);
    } catch (error) {
      throw new Error(`Error deleting certificate: ${error.message}`);
    }
  }
}

export default new CertificateRepository();
