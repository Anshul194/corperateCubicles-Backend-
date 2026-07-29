import assignmentRepo from '../repository/assignmentRepository.js';

class AssignmentService {
    async createAssignment(data) {
        try {
            // UPDATED: Pass maxAttempts from data to repository
            return await assignmentRepo.create(data);
        } catch (error) {
            throw new Error(`Failed to create assignment: ${error.message}`);
        }
    }

    async getAllAssignments(query) {
        try {
            return await assignmentRepo.findAll(query);
        } catch (error) {
            throw new Error(`Failed to fetch assignments: ${error.message}`);
        }
    }

    async getAssignmentById(id) {
        try {
            const assignment = await assignmentRepo.findById(id);
            if (!assignment) throw new Error('Assignment not found');
            return assignment;
        } catch (error) {
            throw new Error(`Failed to get assignment: ${error.message}`);
        }
    }

    async updateAssignment(id, data) {
        try {
            // UPDATED: Pass maxAttempts from data to repository
            const updated = await assignmentRepo.update(id, data);
            if (!updated) throw new Error('Assignment not found');
            return updated;
        } catch (error) {
            throw new Error(`Failed to update assignment: ${error.message}`);
        }
    }

    async deleteAssignment(id) {
        try {
            const deleted = await assignmentRepo.delete(id);
            if (!deleted) throw new Error('Assignment not found or already deleted');
            return deleted;
        } catch (error) {
            throw new Error(`Failed to delete assignment: ${error.message}`);
        }
    }
}

export default new AssignmentService();