import assignmentService from "../service/assignmentService.js";
import { initRedis } from "../config/redisClient.js";
import NotificationService from "../service/notificationService.js";

export const createAssignment = async (req, res) => {
  try {
    const {
      lessonId,
      courseId,
      title,
      subject,
      language,
      description,
      score,
      maxScore,
      duration,
      remarks,
      maxAttempts,
      materials
    } = req.body;

    const attachmentFile = req.files?.attachmentFile?.[0]?.path || "";
    const documentFile = req.files?.documentFile?.[0]?.path || "";

    const assignment = await assignmentService.createAssignment({
      lessonId,
      courseId,
      title,
      subject,
      language,
      description,
      score,
      maxScore,
      duration,
      remarks,
      attachmentFile,
      documentFile,
      maxAttempts,
      materials
    });

    // Notify enrolled users about the new assignment
    const notificationData = {
      title: "New Assignment Added",
      description: `A new assignment titled "${assignment.title}" has been added to your course.`,
      type: "new_assignment",
    };
    await NotificationService.notifyEnrolledUsers(assignment.courseId, notificationData);

    const redis = await initRedis();
    await redis.del("assignments:all*");

    res
      .status(201)
      .json({
        success: true,
        message: "Assignment created successfully",
        data: assignment,
      });
  } catch (error) {
    // //console.log("createAssignment: Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAllAssignments = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      sortBy = "createdAt",
      sortOrder = "asc",
      courseId,
      sectionId,
    } = req.query;

    const filters = {};
    if (courseId) filters.course = courseId;
    if (sectionId) filters.sectionId = sectionId;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      search,
      sortBy,
      sortOrder,
      filters,
    };

    const assignments = await assignmentService.getAllAssignments(options);

    res
      .status(200)
      .json({
        success: true,
        message: "Assignments fetched successfully",
        ...assignments,
      });
  } catch (err) {
    // console.error("getAllAssignments: Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getAssignmentById = async (req, res) => {
  try {
    const redis = await initRedis();
    const cacheKey = `assignment:${req.params.id}`;

    const cached = await redis.get(cacheKey);
    if (cached) {
      return res
        .status(200)
        .json({
          success: true,
          message: "Assignment fetched from cache",
          data: JSON.parse(cached),
          fromCache: true,
        });
    }

    const assignment = await assignmentService.getAssignmentById(req.params.id);
    if (!assignment) {
      return res
        .status(404)
        .json({ success: false, message: "Assignment not found" });
    }

    await redis.setEx(cacheKey, 300, JSON.stringify(assignment));
    res
      .status(200)
      .json({
        success: true,
        message: "Assignment fetched successfully",
        data: assignment,
      });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateAssignment = async (req, res) => {
  try {
    const updateData = { ...req.body };

    if (req.files?.attachmentFile?.[0]) {
      updateData.attachmentFile = req.files.attachmentFile[0].path;
    }

    if (req.files?.documentFile?.[0]) {
      updateData.documentFile = req.files.documentFile[0].path;
    }

    const updated = await assignmentService.updateAssignment(
      req.params.id,
      updateData
    );

    const redis = await initRedis();
    await redis.del("assignments:all*");
    await redis.del(`assignment:${req.params.id}`);
    // //console.log("Redis updated successfully for assignment update");

    res
      .status(200)
      .json({
        success: true,
        message: "Assignment updated successfully",
        data: updated,
      });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteAssignment = async (req, res) => {
  try {
    await assignmentService.deleteAssignment(req.params.id);

    const redis = await initRedis();
    await redis.del("assignments:all*");
    await redis.del(`assignment:${req.params.id}`);
    // //console.log("Redis updated successfully for assignment deletion");

    res
      .status(200)
      .json({ success: true, message: "Assignment deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};