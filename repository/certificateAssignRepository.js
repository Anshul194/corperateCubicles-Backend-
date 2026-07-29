import CertificateAssign from '../models/certificateAssign.js';
import CertificateTemplate from '../models/CertificateTemplate.js';

class CertificateAssignRepository {
  async create(data) {
    try {
      return await CertificateAssign.create(data);
    } catch (error) {
      throw new Error(`Error creating certificate assignment: ${error.message}`);
    }
  }

  async findById(id) {
    try {
      return await CertificateAssign.findById(id)
        .populate('student')
        .populate('course')
        .populate('template')
        .lean();
    } catch (error) {
      throw new Error(`Error fetching certificate assignment: ${error.message}`);
    }
  }

  async findByStudentAndCourse(studentId, courseId) {
    try {
      return await CertificateAssign.findOne({
        student: studentId,
        course: courseId
      }).lean();
    } catch (error) {
      throw new Error(`Error checking certificate assignment: ${error.message}`);
    }
  }

  async findAll(page = 1, limit = 10) {
    try {
      const skip = (page - 1) * limit;
      return await CertificateAssign.find()
        .populate('student')
        .populate('course')
        .populate('template')
        .skip(skip)
        .limit(limit)
        .lean();
    } catch (error) {
      throw new Error(`Error fetching certificate assignments: ${error.message}`);
    }
  }

  async countAll() {
    try {
      return await CertificateAssign.countDocuments();
    } catch (error) {
      throw new Error(`Error counting certificate assignments: ${error.message}`);
    }
  }

  async update(id, updateData) {
    try {
      return await CertificateAssign.findByIdAndUpdate(id, updateData, { new: true }).lean();
    } catch (error) {
      throw new Error(`Error updating certificate assignment: ${error.message}`);
    }
  }

  async destroy(id) {
    try {
      return await CertificateAssign.findByIdAndDelete(id).lean();
    } catch (error) {
      throw new Error(`Error deleting certificate assignment: ${error.message}`);
    }
  }

  async getTemplateById(templateId) {
    try {
      return await CertificateTemplate.findById(templateId).lean();
    } catch (error) {
      throw new Error(`Error fetching certificate template: ${error.message}`);
    }
  }
}

export default CertificateAssignRepository;