import JobPostService from '../service/jobPostService.js';
import { initRedis } from '../config/redisClient.js';
import emailService from '../utils/emailService.js';
import notificationService from '../service/notificationService.js';
import User from '../models/user.js';
import { escapeRegExp } from '../utils/escapeRegExp.js';


const jobPostService = JobPostService;

export const createJobPost = async (req, res) => {
  try {
    // Parse and validate skillsRequired
    let skillsRequired = [];
    try {
      if (typeof req.body.skillsRequired === 'string') {
        skillsRequired = JSON.parse(req.body.skillsRequired);
      } else if (Array.isArray(req.body.skillsRequired)) {
        skillsRequired = req.body.skillsRequired;
      }
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid skillsRequired format. Must be an array or JSON string array'
      });
    }

    // Handle location object
    const location = {
      type: req.body.location?.type || req.body.locationType || 'remote',
      address: typeof req.body.location?.address === 'string' 
        ? { street: req.body.location.address }
        : req.body.location?.address || {
            street: req.body['address.street'],
            city: req.body['address.city'],
            state: req.body['address.state'],
            country: req.body['address.country'],
            zipCode: req.body['address.zipCode']
          }
    };

    const parseNumber = (val) => {
      if (val === undefined || val === null || val === '') return undefined;
      const n = Number(val);
      return Number.isNaN(n) ? NaN : n;
    };

    const jobPostData = {
      title: req.body.title,
      description: req.body.description,
      status: req.body.status === 'true' || req.body.status === true,
      createdBy: req.user._id,
      budget: {
        min: parseNumber(req.body.budget?.min ?? req.body.budgetMin),
        max: parseNumber(req.body.budget?.max ?? req.body.budgetMax),
        currency: req.body.budget?.currency || req.body.currency || 'USD'
      },
      isAdminApproved: req.user.role === 'admin' || req.user.roles?.includes('admin') ? (req.body.isAdminApproved === 'true' || req.body.isAdminApproved === true) : false,
      category: req.body.category,
      skillsRequired,
      experienceLevel: req.body.experienceLevel,
      estimatedDuration: {
        value: Number(req.body.estimatedDuration?.value || req.body.durationValue || 0),
        unit: req.body.estimatedDuration?.unit || req.body.durationUnit || 'hours'
      },
      mode: req.body.mode,
      location
    };

    // Validate required fields and types
    const validationErrors = validateJobPostData(jobPostData);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors
      });
    }

    // Handle thumbnail file
    if (req.file) {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(req.file.mimetype)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid file type. Only JPEG, PNG and WebP are allowed'
        });
      }

      // Validate file size (5MB limit)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (req.file.size > maxSize) {
        return res.status(400).json({
          success: false,
          message: 'File too large. Maximum size is 5MB'
        });
      }

      jobPostData.thumbnail = req.file.path.replace(/\\/g, '/');
    }

    const jobPost = await jobPostService.create(jobPostData);

    const redis = await initRedis();
    // Invalidate all jobposts cache and user's jobposts cache
    await redis.del('jobposts:all*');
    await redis.del(`jobposts:user:${req.user._id}*`);

    return res.status(201).json({
      success: true,
      message: 'Job post created successfully',
      data: jobPost
    });
  } catch (error) {
    console.error('JobPost creation error:', error);
    return res.status(500).json({
      success: false,
      message: error.message,
      details: error.errors
    });
  }
};

// Helper function to validate job post data
function validateJobPostData(data) {
  const errors = [];
  
  const requiredFields = [
    'title', 'description', 'budget', 'category', 
    'experienceLevel', 'estimatedDuration', 'mode'
  ];

  requiredFields.forEach(field => {
    if (!data[field]) errors.push(`${field} is required`);
  });

  if (data.budget) {
    const min = data.budget.min;
    const max = data.budget.max;
    if (min === undefined || min === null) {
      errors.push('Minimum budget is required');
    } else if (isNaN(min) || min < 0) {
      errors.push('Minimum budget must be a non-negative number');
    }

    if (max === undefined || max === null) {
      errors.push('Maximum budget is required');
    } else if (isNaN(max) || max <= min) {
      errors.push('Maximum budget must be greater than minimum budget');
    }
  }


  return errors;
}

export const getAllJobPosts = async (req, res) => {
  try {
    const { 
      page, 
      limit, 
      sortBy, 
      sortOrder, 
      search, 
      status,
      category,
      minBudget,
      maxBudget,
      experienceLevel,
      mode,
      locationType,
      city,
      state,
      country,
      isAdminApproved // <-- add this
    } = req.query;

    const filter = {};
    if (status) filter.status = status === 'true';
    if (category) filter.category = category;
    if (experienceLevel) filter.experienceLevel = experienceLevel;
    if (mode) filter.mode = mode;
    if (locationType) filter['location.type'] = locationType;
    if (city) filter['location.address.city'] = { $regex: escapeRegExp(city), $options: 'i' };
    if (state) filter['location.address.state'] = { $regex: escapeRegExp(state), $options: 'i' };
    if (country) filter['location.address.country'] = { $regex: escapeRegExp(country), $options: 'i' };
    if (minBudget || maxBudget) {
      filter.budget = {};
      if (minBudget) filter.budget.min = { $gte: parseFloat(minBudget) };
      if (maxBudget) filter.budget.max = { $lte: parseFloat(maxBudget) };
    }
    if (search) {
      const safeSearch = escapeRegExp(search);
      filter.$or = [
        { title: { $regex: safeSearch, $options: 'i' } },
        { description: { $regex: safeSearch, $options: 'i' } },
        { skillsRequired: { $in: [new RegExp(safeSearch, 'i')] } },
        { 'location.address.city': { $regex: safeSearch, $options: 'i' } }
      ];
    }
    // --- Add isAdminApproved filter ---
    if (typeof isAdminApproved !== 'undefined') {
      if (isAdminApproved === 'true' || isAdminApproved === true) {
        filter.isAdminApproved = true;
      }
      // If isAdminApproved is not true, do not filter (return all)
    }

    const jobPosts = await jobPostService.getAll(filter, {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10,
      sort: {
      [sortBy || 'createdAt']: -1 // Always sort by descending order
      }
    });

    // Add baseUrl to thumbnail paths if they exist
    const baseUrl = `${req.protocol}://${req.get('host')}/`;
    const processedJobPosts = jobPosts.data.map(post => ({
      ...post,
      thumbnail: post.thumbnail ? baseUrl + post.thumbnail : null,
      isAdminApproved: typeof post.isAdminApproved !== 'undefined' ? post.isAdminApproved : false
    }));

    return res.status(200).json({
      success: true,
      data: {
        ...jobPosts,
        data: processedJobPosts
      }
    });
  } catch (error) {
    console.error('getAllJobPosts error:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const submitProposal = async (req, res) => {
  try {
    const { jobId } = req.params;
    const proposal = {
      userId: req.user._id,
      coverLetter: req.body.coverLetter,
      proposedAmount: parseFloat(req.body.proposedAmount),
      submittedAt: new Date(),
      status: "pending"
    };

    // Handle CV file
    if (req.file) {
      // Validate file type
      const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (!allowedTypes.includes(req.file.mimetype)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid file type. Only PDF and DOC/DOCX are allowed'
        });
      }

      // Validate file size (5MB limit)
      const maxSize = 5 * 1024 * 1024;
      if (req.file.size > maxSize) {
        return res.status(400).json({
          success: false,
          message: 'File too large. Maximum size is 5MB'
        });
      }

      proposal.cv = req.file.path.replace(/\\/g, '/');
    }

    const updatedJob = await jobPostService.submitProposal(jobId, proposal);

    // --- Send email and notification to job creator ---
    if (updatedJob && updatedJob.createdBy) {
      const jobCreator = updatedJob.createdBy;
      const jobCreatorEmail=await User.findById(jobCreator);
      //console.log("Job Creator:", jobCreatorEmail);
      const applicant = {
        name: req.user.fullName || req.user.name || "Applicant",
        email: req.user.email
      };

      //console.log("Job Creator:", jobCreator);
      // Send email only if jobCreator.email exists
      if (jobCreatorEmail.email) {
        try {
          await emailService.sendJobProposalEmail(
            jobCreatorEmail.email,
            jobCreatorEmail.fullName || jobCreatorEmail.name || "Job Creator",
            updatedJob.title,
            proposal,
            applicant
          );
        } catch (e) {
          console.error("Failed to send job proposal email:", e);
        }
      } else {
        console.error("Job creator email is missing, cannot send proposal email.");
      }
    
    }

    // Invalidate job cache for this job and all jobposts lists
    const redis = await initRedis();
    await redis.del(`jobpost:${jobId}`);
    await redis.del('jobposts:all*');
    if (updatedJob && updatedJob.createdBy) {
      await redis.del(`jobposts:user:${updatedJob.createdBy}*`);
    }

    return res.status(200).json({
      success: true,
      message: 'Proposal submitted successfully',
      data: updatedJob
    });
  } catch (error) {
    console.error('submitProposal error:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const updateJobPost = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Handle skillsRequired parsing
    let skillsRequired;
    try {
      if (req.body.skillsRequired) {
        skillsRequired = typeof req.body.skillsRequired === 'string' 
          ? JSON.parse(req.body.skillsRequired)
          : Array.isArray(req.body.skillsRequired) 
            ? req.body.skillsRequired 
            : undefined;
      }
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid skillsRequired format. Must be an array or JSON string array'
      });
    }

    const updateData = {
      title: req.body.title,
      description: req.body.description,
      status: req.body.status === 'true' || req.body.status === true,
      budget: req.body.budgetMin || req.body.budget?.min ? {
        min: Number(req.body.budgetMin || req.body.budget?.min),
        max: Number(req.body.budgetMax || req.body.budget?.max),
        currency: req.body.currency || req.body.budget?.currency
      } : undefined,
      category: req.body.category,
      skillsRequired,
      experienceLevel: req.body.experienceLevel,
      estimatedDuration: req.body.durationValue || req.body.estimatedDuration?.value ? {
        value: Number(req.body.durationValue || req.body.estimatedDuration?.value),
        unit: req.body.durationUnit || req.body.estimatedDuration?.unit
      } : undefined,
      mode: req.body.mode,
      location: req.body.locationType || req.body.location?.type ? {
        type: req.body.locationType || req.body.location?.type,
        address: {
          street: req.body['address.street'] || req.body.location?.address?.street,
          city: req.body['address.city'] || req.body.location?.address?.city,
          state: req.body['address.state'] || req.body.location?.address?.state,
          country: req.body['address.country'] || req.body.location?.address?.country,
          zipCode: req.body['address.zipCode'] || req.body.location?.address?.zipCode
        }
      } : undefined
    };

    // Handle thumbnail update
    if (req.file) {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(req.file.mimetype)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid file type. Only JPEG, PNG and WebP are allowed'
        });
      }

      // Validate file size
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (req.file.size > maxSize) {
        return res.status(400).json({
          success: false,
          message: 'File too large. Maximum size is 5MB'
        });
      }

      updateData.thumbnail = req.file.path.replace(/\\/g, '/');
    }

    // Remove undefined values and empty objects
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      } else if (typeof updateData[key] === 'object' && !Array.isArray(updateData[key])) {
        if (Object.keys(updateData[key]).every(k => updateData[key][k] === undefined)) {
          delete updateData[key];
        }
      }
    });

    const jobPost = await jobPostService.update(id, updateData);

    // Update Redis cache
    const redis = await initRedis();
    await redis.del(`jobpost:${id}`);
    await redis.del('jobposts:all*');
    if (jobPost && jobPost.createdBy) {
      await redis.del(`jobposts:user:${jobPost.createdBy}*`);
    }
    await redis.setEx(`jobpost:${id}`, 300, JSON.stringify(jobPost));

    return res.status(200).json({
      success: true,
      message: 'Job post updated successfully',
      data: jobPost
    });
  } catch (error) {
    console.error('updateJobPost error:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const deleteJobPost = async (req, res) => {
  try {
    const { id } = req.params;
    // Get job before delete to know createdBy
    const job = await jobPostService.getById(id);
    await jobPostService.delete(id);

    const redis = await initRedis();
    await redis.del('jobposts:all*');
    await redis.del(`jobpost:${id}`);
    if (job && job.createdBy) {
      await redis.del(`jobposts:user:${job.createdBy}*`);
    }

    return res.status(200).json({
      success: true,
      message: 'Job post deleted successfully'
    });
  } catch (error) {
    console.error('deleteJobPost error:', error);
    return res.status(error.message === 'Job post not found' ? 404 : 500).json({
      success: false,
      message: error.message
    });
  }
};

export const getJobPostById = async (req, res) => {
  try {
    const { id } = req.params;
    const redis = await initRedis();
    const cacheKey = `jobpost:${id}`;
    const cached = await redis.get(cacheKey);

    if (cached) {
      return res.status(200).json({
        success: true,
        message: 'Job post fetched from cache',
        data: JSON.parse(cached),
        fromCache: true
      });
    }

    const jobPost = await jobPostService.getById(id);
    await redis.setEx(cacheKey, 300, JSON.stringify(jobPost));

    return res.status(200).json({
      success: true,
      message: 'Job post retrieved successfully',
      data: jobPost
    });
  } catch (error) {
    console.error('getJobPostById error:', error);
    return res.status(error.message === 'Job post not found' ? 404 : 500).json({
      success: false,
      message: error.message
    });
  }
};

export const getMyJobPosts = async (req, res) => {
  try {
    // Ensure user is authenticated
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Invalid or missing token'
      });
    }

    const { 
      page, 
      limit, 
      sortBy, 
      sortOrder, 
      search, 
      status,
      category,
      minBudget,
      maxBudget,
      experienceLevel,
      mode,
      locationType,
      city,
      state,
      country 
    } = req.query;

    // Filter job posts by the authenticated user's ID from the JWT token
    const filter = {
      createdBy: req.user._id
    };

    if (status) filter.status = status === 'true';
    if (category) filter.category = category;
    if (experienceLevel) filter.experienceLevel = experienceLevel;
    if (mode) filter.mode = mode;
    if (locationType) filter['location.type'] = locationType;
    if (city) filter['location.address.city'] = { $regex: escapeRegExp(city), $options: 'i' };
    if (state) filter['location.address.state'] = { $regex: escapeRegExp(state), $options: 'i' };
    if (country) filter['location.address.country'] = { $regex: escapeRegExp(country), $options: 'i' };
    if (minBudget || maxBudget) {
      filter.budget = {};
      if (minBudget) filter.budget.min = { $gte: parseFloat(minBudget) };
      if (maxBudget) filter.budget.max = { $lte: parseFloat(maxBudget) };
    }
    if (search) {
      const safeSearch = escapeRegExp(search);
      filter.$or = [
        { title: { $regex: safeSearch, $options: 'i' } },
        { description: { $regex: safeSearch, $options: 'i' } },
        { skillsRequired: { $in: [new RegExp(safeSearch, 'i')] } },
        { 'location.address.city': { $regex: safeSearch, $options: 'i' } }
      ];
    }

    const jobPosts = await jobPostService.getAll(filter, {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10,
      sort: {
        [sortBy || 'createdAt']: sortOrder === 'desc' ? -1 : 1
      }
    });

    // Add baseUrl to thumbnail paths if they exist
    const baseUrl = `${req.protocol}://${req.get('host')}/`;
    const processedJobPosts = jobPosts.data.map(post => ({
      ...post,
      thumbnail: post.thumbnail ? baseUrl + post.thumbnail : null,
      isAdminApproved: typeof post.isAdminApproved !== 'undefined' ? post.isAdminApproved : false
    }));

    return res.status(200).json({
      success: true,
      message: 'My job posts retrieved successfully',
      data: {
        ...jobPosts,
        data: processedJobPosts
      }
    });
  } catch (error) {
    console.error('getMyJobPosts error:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const setAdminApprovalStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isAdminApproved } = req.body;

    if (typeof isAdminApproved !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'isAdminApproved must be a boolean'
      });
    }

    // Get the job post before updating to access creator info
    const existingJob = await jobPostService.getById(id);
    if (!existingJob) {
      return res.status(404).json({
        success: false,
        message: 'Job post not found'
      });
    }

    const updated = await jobPostService.update(id, { isAdminApproved });

    // Send notifications based on approval status
    try {
      if (isAdminApproved) {
        // Job approved - notify creator and all users
        await notificationService.notifyJobApproved(updated, req.user);
      } else {
        // Job rejected - notify only creator
        await notificationService.notifyJobRejected(updated, req.user);
      }
    } catch (notificationError) {
      console.error('Failed to send job approval/rejection notifications:', notificationError);
      // Don't fail the request if notification fails
    }

    // Invalidate cache
    const redis = await initRedis();
    await redis.del(`jobpost:${id}`);
    await redis.del('jobposts:all*');
    if (updated && updated.createdBy) {
      await redis.del(`jobposts:user:${updated.createdBy._id || updated.createdBy}*`);
    }

    return res.status(200).json({
      success: true,
      message: `Job post ${isAdminApproved ? 'approved' : 'rejected'} successfully`,
      data: updated
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
