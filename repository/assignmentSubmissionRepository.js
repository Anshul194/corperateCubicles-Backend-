
import AssignmentSubmission from "../models/assignmentSubmission.js";

class AssignmentSubmissionRepository {
  async create(data) {
    try {
      const submission = new AssignmentSubmission(data);
      return await submission.save();
    } catch (error) {
      throw new Error(
        `Repository: Failed to create submission - ${error.message}`
      );
    }
  }

  //countByUserAndAssignment
  async countByUserAndAssignment(userId, assignmentId) {
    try {
      return await AssignmentSubmission.countDocuments({
        submittedBy: userId,
        assignmentId,
      });
    } catch (error) {
      throw new Error(
        `Repository: Failed to count submissions for user and assignment - ${error.message}`
      );
    }
  }

  async findAllByUser(userId) {
    try {
      return await AssignmentSubmission.find({ submittedBy: userId })
        .populate("assignmentId")
        .populate("courseId")
        .populate("lessonId");
    } catch (error) {
      throw new Error(
        `Repository: Failed to fetch user submissions - ${error.message}`
      );
    }
  }

  async findByUserAndAssignment(userId, assignmentId) {
    try {
      return await AssignmentSubmission.findOne({
        submittedBy: userId,
        assignmentId,
      })
        .populate("assignmentId")
        .populate("courseId")
        .populate("lessonId");
    } catch (error) {
      throw new Error(
        `Repository: Failed to fetch submission for assignment - ${error.message}`
      );
    }
  }

  async findAllByAssignment(assignmentId) {
    try {
      return await AssignmentSubmission.find({ assignmentId })
        .populate("submittedBy")
        .populate("courseId")
        .populate("lessonId");
    } catch (error) {
      throw new Error(
        `Repository: Failed to fetch all submissions for assignment - ${error.message}`
      );
    }
  }

  async update(id, data) {
    try {
      return await AssignmentSubmission.findByIdAndUpdate(id, data, {
        new: true,
      });
    } catch (error) {
      throw new Error(
        `Repository: Failed to update submission - ${error.message}`
      );
    }
  }

  async destroy(id) {
    try {
      return await AssignmentSubmission.findByIdAndDelete(id);
    } catch (error) {
      throw new Error(
        `Repository: Failed to delete submission - ${error.message}`
      );
    }
  }

  async findAll() {
    try {
      return await AssignmentSubmission.find({})
        .limit(1000)
        .populate("submittedBy")
        .populate("assignmentId")
        .populate("courseId")
        .populate("lessonId");
    } catch (error) {
      throw new Error(
        `Repository: Failed to fetch all submissions - ${error.message}`
      );
    }
  }

 async findAllPaginated(skip = 0, limit = 10, search = "", filters = {}) {
  try {
    const { status, is_complete } = filters;

    // Cap the page limit to avoid unbounded result sets from the caller.
    const safeLimit = Math.min(Number(limit) || 10, 100);

    // Conditions that reference fields on the base collection are indexable and
    // can run before the $lookup stages so MongoDB can use indexes.
    const preLookupConditions = [];
    // Conditions that reference joined fields can only run after $lookup/$unwind.
    const postLookupConditions = [];

    if (search && search.trim()) {
      // Escape regex metacharacters and anchor to avoid ReDoS / unintended matches.
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`^${escaped}`, "i");

      postLookupConditions.push({
        $or: [
          { "assignmentId.title": regex },
          { "courseId.title": regex },
          { "lessonId.title": regex },
          { "submittedBy.fullName": regex },
          { "submittedBy.email": regex },
        ],
      });
    }

    if (status) {
      preLookupConditions.push({ status });
    }

    if (typeof is_complete !== "undefined") {
      preLookupConditions.push({ is_complete: is_complete === "true" });
    }

    const pipeline = [
      ...(preLookupConditions.length
        ? [{ $match: { $and: preLookupConditions } }]
        : []),

      {
        $lookup: {
          from: "users",
          localField: "submittedBy",
          foreignField: "_id",
          as: "submittedBy",
        },
      },
      { $unwind: "$submittedBy" },

      {
        $lookup: {
          from: "assignments",
          localField: "assignmentId",
          foreignField: "_id",
          as: "assignmentId",
        },
      },
      { $unwind: "$assignmentId" },

      {
        $lookup: {
          from: "courses",
          localField: "courseId",
          foreignField: "_id",
          as: "courseId",
        },
      },
      { $unwind: "$courseId" },

      {
        $lookup: {
          from: "lessons",
          localField: "lessonId",
          foreignField: "_id",
          as: "lessonId",
        },
      },
      { $unwind: "$lessonId" },

      ...(postLookupConditions.length
        ? [{ $match: { $and: postLookupConditions } }]
        : []),

      { $sort: { createdAt: -1 } },

      {
        $facet: {
          submissions: [{ $skip: skip }, { $limit: safeLimit }],
          totalCount: [{ $count: "count" }],
        },
      },
    ];

    const result = await AssignmentSubmission.aggregate(pipeline);

    const submissions = result[0]?.submissions || [];
    const total = result[0]?.totalCount[0]?.count || 0;

    return { submissions, total };
  } catch (error) {
    throw new Error(
      `Repository: Failed to fetch paginated submissions - ${error.message}`
    );
  }
}


  async findById(id) {
    try {
      return await AssignmentSubmission.findById(id)
        .populate("submittedBy")
        .populate("assignmentId")
        .populate("courseId")
        .populate("lessonId");
    } catch (error) {
      throw new Error(
        `Repository: Failed to fetch submission by ID - ${error.message}`
      );
    }
  }
}

export default AssignmentSubmissionRepository;
