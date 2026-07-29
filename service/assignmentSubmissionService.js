
import AssignmentSubmissionRepository from "../repository/assignmentSubmissionRepository.js";
import Assignment from "../models/Assignment.js";

class AssignmentSubmissionService {
  constructor() {
    this.repo = new AssignmentSubmissionRepository();
  }

  async submit(data) {
    try {
      const assignment = await Assignment.findById(data.assignmentId);
      if (!assignment) {
        throw new Error('Assignment not found');
      }

      //check maxAttempts = submition count
      const existingSubmissions = await this.repo.countByUserAndAssignment(data.submittedBy, data.assignmentId);
      // if (existingSubmissions) {
      //   //console.log(`Existing submissions for user ${data.submittedBy} and assignment ${data.assignmentId}: ${existingSubmissions}`);
      //   if (existingSubmissions >= assignment.maxAttempts) {
      //     throw new Error(`Maximum attempts reached for this assignment. You can only submit ${assignment.maxAttempts} times.`);
      //   }
      // }
        

      const submission = await this.repo.create(data);

      // Compare scoreGiven with assignment.score
      if (submission.scoreGiven !== null && submission.scoreGiven >= assignment.score) {
        submission.is_complete = true;
      } else {
        submission.is_complete = false;
      }

      await submission.save();
      return submission;
    } catch (error) {
      throw new Error(`Failed to submit assignment: ${error.message}`);
    }
  }

  async getMySubmissions(userId) {
    try {
      return await this.repo.findAllByUser(userId);
    } catch (error) {
      throw new Error(`Failed to fetch submissions for user: ${error.message}`);
    }
  }

  async getSubmission(userId, assignmentId) {
    try {
      return await this.repo.findByUserAndAssignment(userId, assignmentId);
    } catch (error) {
      throw new Error(`Failed to fetch submission: ${error.message}`);
    }
  }

  async getAllByAssignment(assignmentId) {
    try {
      return await this.repo.findAllByAssignment(assignmentId);
    } catch (error) {
      throw new Error(
        `Failed to fetch all submissions for assignment: ${error.message}`
      );
    }
  }

  async gradeSubmission(id, data) {
  try {
    const submission = await this.repo.findById(id);
    if (!submission) {
      throw new Error('Submission not found');
    }

    const assignment = await Assignment.findById(submission.assignmentId);
    if (!assignment) {
      throw new Error('Assignment not found');
    }

    const updated = await this.repo.update(id, {
      ...data,
      gradedAt: new Date(),
      status: "graded",
      is_complete: data.scoreGiven !== null && data.scoreGiven >= assignment.score,
    });

    return updated;
  } catch (error) {
    throw new Error(`Failed to grade submission: ${error.message}`);
  }
}


  async deleteSubmission(id) {
    try {
      const deleted = await this.repo.destroy(id);
      if (!deleted) {
        throw new Error('Submission not found');
      }
      return deleted;
    } catch (error) {
      throw new Error(`Failed to delete submission: ${error.message}`);
    }
  }

async getAllSubmissions({ skip, limit, search, filters }) {
  try {
    return await this.repo.findAllPaginated(skip, limit, search, filters);
  } catch (error) {
    throw new Error(`Failed to fetch all submissions: ${error.message}`);
  }
}


  async findById(id) {
    try {
      return await this.repo.findById(id);
    } catch (error) {
      throw new Error(`Failed to fetch submission by ID: ${error.message}`);
    }
  }
}

export default AssignmentSubmissionService;
