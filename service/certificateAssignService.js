import CertificateAssignRepository from '../repository/certificateAssignRepository.js';
import { generateCertificatePDF } from '../utils/certificateGenerator.js';
import User from '../models/user.js';
import Course from '../models/Course.js'; // Updated to lowercase
import path from 'path';
import fs from 'fs';
import mongoose from 'mongoose';

class CertificateAssignService {
  constructor() {
    this.certificateAssignRepository = new CertificateAssignRepository();
  }

  // Helper function to validate hex color
  validateHexColor(hex) {
    if (!hex || typeof hex !== 'string') return false;
    return /^#[0-9A-Fa-f]{3,6}$/.test(hex); // Allow 3 or 6 digit hex codes
  }

  async assignCertificate(data, userId) {
    try {
      // Validate data object
      if (!data || typeof data !== 'object') {
        throw new Error('Request body is missing or invalid');
      }

      const { studentId, courseId, templateId, completionDate } = data;

      // Validate required fields
      if (!studentId || !courseId || !templateId || !completionDate) {
        throw new Error('Missing required fields: studentId, courseId, templateId, or completionDate');
      }

      // Validate ObjectIds
      if (!mongoose.isValidObjectId(studentId)) {
        throw new Error('Invalid student ID');
      }
      if (!mongoose.isValidObjectId(courseId)) {
        throw new Error('Invalid course ID');
      }
      if (!mongoose.isValidObjectId(templateId)) {
        throw new Error('Invalid template ID');
      }
      if (!mongoose.isValidObjectId(userId)) {
        throw new Error('Invalid user ID');
      }

      // Check if certificate already exists
      const existingAssignment = await this.certificateAssignRepository.findByStudentAndCourse(studentId, courseId);
      if (existingAssignment) {
        throw new Error('Certificate already assigned for this student and course');
      }

      // Get template
      const template = await this.certificateAssignRepository.getTemplateById(templateId);
      if (!template) {
        throw new Error('Certificate template not found');
      }

      // Log template for debugging
      //console.log('Template Data:', JSON.stringify(template, null, 2));

      // Validate and normalize color fields in template
      const elements = template.elements || {};
      const colorFields = [
        elements.student_name?.font_color,
        elements.title?.font_color,
        elements.subtitle?.font_color,
        elements.body?.font_color,
        elements.date?.font_color,
        elements.instructor_name?.font_color,
        elements.platform_name?.font_color,
        elements.hint?.font_color,
        elements.platform_signature?.font_color,
        elements.stamp?.font_color,
      ].filter(Boolean);

      for (const color of colorFields) {
        if (!this.validateHexColor(color)) {
          console.warn(`Invalid color found: ${color}, defaulting to #000000`);
          if (elements.student_name?.font_color === color) elements.student_name.font_color = '#000000';
          if (elements.title?.font_color === color) elements.title.font_color = '#000000';
          if (elements.subtitle?.font_color === color) elements.subtitle.font_color = '#000000';
          if (elements.body?.font_color === color) elements.body.font_color = '#000000';
          if (elements.date?.font_color === color) elements.date.font_color = '#000000';
          if (elements.instructor_name?.font_color === color) elements.instructor_name.font_color = '#000000';
          if (elements.platform_name?.font_color === color) elements.platform_name.font_color = '#000000';
          if (elements.hint?.font_color === color) elements.hint.font_color = '#000000';
          if (elements.platform_signature?.font_color === color) elements.platform_signature.font_color = '#000000';
          if (elements.stamp?.font_color === color) elements.stamp.font_color = '#000000';
        }
      }

      // Fetch student data
      const student = await User.findById(studentId).select('fullName').lean();
      if (!student) {
        throw new Error('Student not found');
      }


      //console.log('courseId:', courseId);

      
      const course = await Course.findById(courseId).select('title instructorId').lean();

      //console.log('Course Data:', JSON.stringify(course, null, 2));
      if (!course) {
        throw new Error('Course not found');
      }

      // Fetch instructor data
      const instructor = await User.findById(course.instructorId).select('fullName').lean();
      if (!instructor) {
        throw new Error('Instructor not found');
      }

      // Prepare certificate data
      const certificateData = {
        student_name: student.fullName,
        course_name: course.title,
        completion_date: new Date(completionDate),
        instructor_name: instructor.fullName,
        platform_name: elements.platform_name?.content?.replace('[platform_name]', 'Your Platform') || 'Your Platform',
      };

      // Log certificate data for debugging
      //console.log('Certificate Data:', JSON.stringify(certificateData, null, 2));

      // Generate certificate PDF
      const certificateUrl = await generateCertificatePDF({
        template,
        certificateData,
      });

      // Create assignment
      const assignmentData = {
        student: studentId,
        course: courseId,
        template: templateId,
        status: 'issued',
        issued_date: new Date(),
        certificate_data: {
          completion_date: new Date(completionDate),
          platform_name: certificateData.platform_name,
        },
        certificate_url: certificateUrl,
        created_by: userId,
      };

      //console.log('Assignment Data:', JSON.stringify(assignmentData, null, 2));

      const assignment = await this.certificateAssignRepository.create(assignmentData);
      return assignment;
    } catch (error) {
      console.error('Detailed Assign Certificate Error:', error);
      throw new Error(`Error assigning certificate: ${error.message || 'Unknown error'}`);
    }
  }

  async getCertificate(id) {
    try {
      if (!mongoose.isValidObjectId(id)) {
        throw new Error('Invalid certificate ID');
      }
      const assignment = await this.certificateAssignRepository.findById(id);
      if (!assignment) {
        throw new Error('Certificate assignment not found');
      }
      return assignment;
    } catch (error) {
      throw new Error(`Error fetching certificate: ${error.message}`);
    }
  }

  async getAllCertificates(page = 1, limit = 10) {
    try {
      const [templates, totalCount] = await Promise.all([
        this.certificateAssignRepository.findAll(page, limit),
        this.certificateAssignRepository.countAll(),
      ]);
      return { templates, totalCount };
    } catch (error) {
      throw new Error(`Error fetching certificates: ${error.message}`);
    }
  }

  async updateCertificate(id, data, userId) {
    try {
      if (!mongoose.isValidObjectId(id)) {
        throw new Error('Invalid certificate ID');
      }
      if (!mongoose.isValidObjectId(userId)) {
        throw new Error('Invalid user ID');
      }
      if (data.templateId && !mongoose.isValidObjectId(data.templateId)) {
        throw new Error('Invalid template ID');
      }

      const existingAssignment = await this.certificateAssignRepository.findById(id);
      if (!existingAssignment) {
        throw new Error('Certificate assignment not found');
      }

      // Prepare update data
      const updateData = { ...data, updated_by: userId };

      // If completion_date or templateId is updated, regenerate the PDF
      if (data.completion_date || data.templateId) {
        const template = data.templateId
          ? await this.certificateAssignRepository.getTemplateById(data.templateId)
          : await this.certificateAssignRepository.getTemplateById(existingAssignment.template);
        if (!template) {
          throw new Error('Certificate template not found');
        }

        // Validate and normalize color fields in template
        const elements = template.elements || {};
        const colorFields = [
          elements.student_name?.font_color,
          elements.title?.font_color,
          elements.subtitle?.font_color,
          elements.body?.font_color,
          elements.date?.font_color,
          elements.instructor_name?.font_color,
          elements.platform_name?.font_color,
          elements.hint?.font_color,
          elements.platform_signature?.font_color,
          elements.stamp?.font_color,
        ].filter(Boolean);

        for (const color of colorFields) {
          if (!this.validateHexColor(color)) {
            console.warn(`Invalid color found: ${color}, defaulting to #000000`);
            if (elements.student_name?.font_color === color) elements.student_name.font_color = '#000000';
            if (elements.title?.font_color === color) elements.title.font_color = '#000000';
            if (elements.subtitle?.font_color === color) elements.subtitle.font_color = '#000000';
            if (elements.body?.font_color === color) elements.body.font_color = '#000000';
            if (elements.date?.font_color === color) elements.date.font_color = '#000000';
            if (elements.instructor_name?.font_color === color) elements.instructor_name.font_color = '#000000';
            if (elements.platform_name?.font_color === color) elements.platform_name.font_color = '#000000';
            if (elements.hint?.font_color === color) elements.hint.font_color = '#000000';
            if (elements.platform_signature?.font_color === color) elements.platform_signature.font_color = '#000000';
            if (elements.stamp?.font_color === color) elements.stamp.font_color = '#000000';
          }
        }

        // Fetch student data
        const student = await User.findById(existingAssignment.student).select('fullName').lean();
        if (!student) {
          throw new Error('Student not found');
        }

        // Fetch course data and instructor
        const course = await Course.findById(existingAssignment.course).select('title instructorId').lean();
        if (!course) {
          throw new Error('Course not found');
        }

        // Fetch instructor data
        const instructor = await User.findById(course.instructorId).select('fullName').lean();
        if (!instructor) {
          throw new Error('Instructor not found');
        }

        // Prepare certificate data for PDF
        const certificateData = {
          student_name: student.fullName,
          course_name: course.title,
          completion_date: data.completion_date ? new Date(data.completion_date) : existingAssignment.certificate_data.completion_date,
          instructor_name: instructor.fullName,
          platform_name: elements.platform_name?.content?.replace('[platform_name]', 'Your Platform') || 'Your Platform',
        };

        updateData.certificate_url = await generateCertificatePDF({
          template,
          certificateData,
        });

        updateData.certificate_data = {
          completion_date: certificateData.completion_date,
          platform_name: certificateData.platform_name,
        };
      }

      const assignment = await this.certificateAssignRepository.update(id, updateData);
      return assignment;
    } catch (error) {
      console.error('Detailed Update Certificate Error:', error);
      throw new Error(`Error updating certificate: ${error.message}`);
    }
  }

  async deleteCertificate(id) {
    try {
      if (!mongoose.isValidObjectId(id)) {
        throw new Error('Invalid certificate ID');
      }
      const assignment = await this.certificateAssignRepository.findById(id);
      if (!assignment) {
        throw new Error('Certificate assignment not found');
      }

      // Delete associated certificate PDF
      const filesToDelete = [assignment.certificate_url].filter(Boolean);
      filesToDelete.forEach((file) => {
        const filePath = path.join(process.cwd(), file);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          //console.log(`Deleted file: ${filePath}`);
        }
      });

      await this.certificateAssignRepository.destroy(id);
      return true;
    } catch (error) {
      console.error('Detailed Delete Certificate Error:', error);
      throw new Error(`Error deleting certificate: ${error.message}`);
    }
  }

  async downloadCertificate(id) {
    try {
      if (!mongoose.isValidObjectId(id)) {
        throw new Error('Invalid certificate ID');
      }
      const assignment = await this.certificateAssignRepository.findById(id);
      if (!assignment) {
        throw new Error('Certificate assignment not found');
      }
      if (!assignment.certificate_url) {
        throw new Error('Certificate PDF not found');
      }

      const filePath = path.join(process.cwd(), assignment.certificate_url);
      //console.log('Downloading certificate from:', filePath);

      if (!fs.existsSync(filePath)) {
        throw new Error(`Certificate PDF file not found at: ${filePath}`);
      }

      return filePath;
    } catch (error) {
      console.error('Detailed Download Certificate Error:', error);
      throw new Error(`Error downloading certificate: ${error.message}`);
    }
  }
}

export default CertificateAssignService;