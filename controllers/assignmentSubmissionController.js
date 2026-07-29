
import AssignmentSubmissionService from "../service/assignmentSubmissionService.js";
import { initRedis } from "../config/redisClient.js";

const service = new AssignmentSubmissionService();

export const submitAssignment = async (req, res) => {
  try {
    const submissionFile = req.file?.path?.replace(/\\/g, "/");
    const payload = {
      ...req.body,
      submittedBy: req.user._id,
      submissionFile,
    };

    const submission = await service.submit(payload); // Fixed: Call submit on service instance

    const redis = await initRedis();
    await redis.del(`submissions:user:${req.user._id}`);
    await redis.del(`submissions:assignment:${payload.assignmentId}`);

    res.status(201).json({
      success: true,
      message: "Assignment submitted successfully",
      data: submission,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getMySubmissions = async (req, res) => {
  try {
    const submissions = await service.getMySubmissions(req.user._id);

    res.status(200).json({
      success: true,
      message: "Submissions fetched successfully",
      data: submissions,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getMySubmissionByAssignment = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    // const cacheKey = `submission:${req.user._id}:${assignmentId}`;
    // const redis = await initRedis();
    // const cached = await redis.get(cacheKey);

    // if (cached) {
    //   return res.status(200).json({
    //     success: true,
    //     message: "Submission fetched from cache",
    //     data: JSON.parse(cached),
    //     fromCache: true,
    //   });
    // }

    const submission = await service.getSubmission(req.user._id, assignmentId);
    if (!submission) {
      return res.status(404).json({
        success: false,
        message: "Submission not found for this user and assignment",
      });
    }

    // await redis.setEx(cacheKey, 300, JSON.stringify(submission));

    res.status(200).json({
      success: true,
      message: "Submission fetched successfully",
      data: submission,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getAllSubmissionsForAssignment = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const cacheKey = `submissions:assignment:${assignmentId}`;
    const redis = await initRedis();
    const cached = await redis.get(cacheKey);

    if (cached) {
      return res.status(200).json({
        success: true,
        message: "Submissions fetched from cache",
        data: JSON.parse(cached),
        fromCache: true,
      });
    }

    const submissions = await service.getAllByAssignment(assignmentId);
    await redis.setEx(cacheKey, 300, JSON.stringify(submissions));

    res.status(200).json({
      success: true,
      message: "Submissions fetched successfully",
      data: submissions,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const gradeSubmission = async (req, res) => {
  try {
    const updated = await service.gradeSubmission(req.params.id, req.body);

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Submission not found",
      });
    }

    const redis = await initRedis();
    await redis.del("submissions:*");

    res.status(200).json({
      success: true,
      message: "Submission graded successfully",
      data: updated,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteSubmission = async (req, res) => {
  try {
    const deleted = await service.deleteSubmission(req.params.id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Submission not found",
      });
    }

    const redis = await initRedis();
    await redis.del("submissions:*");

    res.status(200).json({
      success: true,
      message: "Submission deleted successfully",
      data: deleted,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getAllSubmissions = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const search = req.query.search || "";
    const status = req.query.status;
    const is_complete = req.query.is_complete;

    const { submissions, total } = await service.getAllSubmissions({
      skip,
      limit,
      search,
      filters: { status, is_complete },
    });

    const response = {
      submissions,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };

    res.status(200).json({
      success: true,
      message: "All submissions fetched successfully",
      data: response,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


export const getSubmissionById = async (req, res) => {
  try {
    const { id } = req.params;
    const cacheKey = `submission:${id}`;
    const redis = await initRedis();
    const cached = await redis.get(cacheKey);

    if (cached) {
      return res.status(200).json({
        success: true,
        message: "Submission fetched from cache",
        data: JSON.parse(cached),
        fromCache: true,
      });
    }

    const submission = await service.findById(id);

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: "Submission not found",
      });
    }

    await redis.setEx(cacheKey, 300, JSON.stringify(submission));
    res.status(200).json({
      success: true,
      message: "Submission fetched successfully",
      data: submission,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
