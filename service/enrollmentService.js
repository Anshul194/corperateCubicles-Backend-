import enrollmentRepo from '../repository/enrollmentRepository.js';


class EnrollmentService {
  async createEnrollment(data, res) {
    try {
      // If plan, set type
      if (data.coursePlanId) {
        data.type = 'coursePlan';
      }
      // Allow admin to set custom accessExpiry, customPrice, addToRevenue
      if (data.accessExpiry) {
        data.accessExpiry = new Date(data.accessExpiry);
      }
      if (data.customPrice !== undefined) {
        data.customPrice = Number(data.customPrice);
      }
      if (data.addToRevenue !== undefined) {
        data.addToRevenue = data.addToRevenue === true || data.addToRevenue === 'true';
      }
      return await enrollmentRepo.create(data, res);
    } catch (error) {
      throw new Error(`Failed to create enrollment: ${error.message}`);
    }
  }


    async createFreeEnrollment(data, req, res) {
    try {
      return await enrollmentRepo.createFree(data, req, res);
    } catch (error) {
      throw new Error(`Failed to create free enrollment: ${error.message}`);
    }
  }

  async getAllEnrollments(filters) {
    try {
      return await enrollmentRepo.findAll(filters);
    } catch (error) {
      throw new Error(`Failed to fetch enrollments: ${error.message}`);
    }
  }

  async getEnrollmentById(id) {
    try {
      const enrollment = await enrollmentRepo.findById(id);
      if (!enrollment) throw new Error('Enrollment not found');
      return enrollment;
    } catch (error) {
      throw new Error(`Failed to fetch enrollment by ID: ${error.message}`);
    }
  }

  async updateEnrollment(id, data) {
    try {
      const updated = await enrollmentRepo.update(id, data);
      if (!updated) throw new Error('Enrollment not found or could not be updated');
      return updated;
    } catch (error) {
      throw new Error(`Failed to update enrollment: ${error.message}`);
    }
  }

  async deleteEnrollment(id) {
    try {
      const deleted = await enrollmentRepo.delete(id);
      if (!deleted) throw new Error('Enrollment not found or already deleted');
      return deleted;
    } catch (error) {
      throw new Error(`Failed to delete enrollment: ${error.message}`);
    }
  }
}

export default new EnrollmentService();
