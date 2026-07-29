import CoursePricingPlanService from '../service/CoursePricingPlanService.js';
import { initRedis } from '../config/redisClient.js';

const pricingPlanService = new CoursePricingPlanService();

export const createPricingPlan = async (req, res) => {
  try {
    //console.log('📩 Request Body createPricingPlan:', JSON.stringify(req.body, null, 2));

    const pricingPlanData = {
      ...req.body,
      features: req.body.features ? req.body.features.split(',').map(item => item.trim()) : [],
    };

    const pricingPlan = await pricingPlanService.create(pricingPlanData);

    const redis = await initRedis();
    const planId = pricingPlan._id.toString();
    const planCacheData = {
      _id: pricingPlan._id,
      course: pricingPlan.course,
      type: pricingPlan.type,
      price: pricingPlan.price.toString(),
      discount: pricingPlan.discount,
      durationInDays: pricingPlan.durationInDays,
      currency: pricingPlan.currency,
      isActive: pricingPlan.isActive,
      features: pricingPlan.features,
      createdAt: pricingPlan.createdAt,
      updatedAt: pricingPlan.updatedAt,
    };

    await redis.setEx(`pricingPlan:${planId}`, 3600, JSON.stringify(planCacheData));
    //console.log('🗂️ Redis cache updated for pricing plan:', planId);

    return res.status(201).json({
      success: true,
      message: '✅ Pricing plan created successfully',
      data: { pricingPlan },
      err: {},
    });
  } catch (err) {
    console.error('❌ Create Pricing Plan Error:', err);
    if (
      err.message === 'Course and type are required' ||
      err.message === 'Invalid or non-existent course' ||
      err.message === 'A pricing plan with this course and type already exists' ||
      err.message === 'Features must be an array' ||
      err.message === 'Maximum 10 features allowed'
    ) {
      return res.status(400).json({
        success: false,
        message: err.message,
        data: {},
        err: { message: err.message },
      });
    }
    return res.status(500).json({
      success: false,
      message: err.message,
      data: {},
      err: err.message,
    });
  }
};

export const getPricingPlanById = async (req, res) => {
  try {
    //console.log('📩 Request Params getPricingPlanById:', req.params);

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Pricing plan ID is required',
        data: {},
        err: { message: 'Missing pricing plan ID parameter' },
      });
    }

    const redis = await initRedis();
    const cachedPlan = await redis.get(`pricingPlan:${id}`);
    if (cachedPlan) {
      //console.log('🚀 Pricing plan data retrieved from Redis cache');
      const planData = JSON.parse(cachedPlan);
      return res.status(200).json({
        success: true,
        message: '✅ Pricing plan retrieved successfully',
        data: { pricingPlan: planData },
        err: {},
      });
    }

    const pricingPlan = await pricingPlanService.getById(id);
    const planCacheData = {
      _id: pricingPlan._id,
      course: pricingPlan.course,
      type: pricingPlan.type,
      price: pricingPlan.price.toString(),
      discount: pricingPlan.discount,
      durationInDays: pricingPlan.durationInDays,
      currency: pricingPlan.currency,
      isActive: pricingPlan.isActive,
      features: pricingPlan.features,
      createdAt: pricingPlan.createdAt,
      updatedAt: pricingPlan.updatedAt,
    };

    await redis.setEx(`pricingPlan:${id}`, 3600, JSON.stringify(planCacheData));
    //console.log('🗂️ Pricing plan data cached in Redis:', id);

    return res.status(200).json({
      success: true,
      message: '✅ Pricing plan retrieved successfully',
      data: { pricingPlan },
      err: {},
    });
  } catch (err) {
    console.error('❌ Get Pricing Plan By ID Error:', err);
    if (err.message === 'Pricing plan not found' || err.message === 'Invalid pricing plan ID') {
      return res.status(404).json({
        success: false,
        message: err.message,
        data: {},
        err: { message: err.message },
      });
    }
    return res.status(500).json({
      success: false,
      message: err.message,
      data: {},
      err: err.message,
    });
  }
};

export const getAllPricingPlans = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      search = '',
      ...filterParams
    } = req.query;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    const filter = {};
    if (filterParams.course) filter.course = filterParams.course;
    if (filterParams.type) filter.type = filterParams.type;
    if (filterParams.currency) filter.currency = filterParams.currency;

    const pricingPlans = await pricingPlanService.getAll({
      page: pageNum,
      limit: limitNum,
      sortBy,
      sortOrder,
      filter,
      search,
    });

    return res.status(200).json({
      success: true,
      message: '✅ Pricing plans retrieved successfully',
      data: pricingPlans,
      err: {},
    });
  } catch (err) {
    console.error('❌ Get All Pricing Plans Error:', err);
    return res.status(500).json({
      success: false,
      message: err.message,
      data: {},
      err: err.message,
    });
  }
};

export const getPricingPlansByCourseId = async (req, res) => {
  try {
    //console.log('📩 Request Params getPricingPlansByCourseId:', req.params);

    const { courseId } = req.params;
    if (!courseId) {
      return res.status(400).json({
        success: false,
        message: 'Course ID is required',
        data: {},
        err: { message: 'Missing course ID parameter' },
      });
    }

    const redis = await initRedis();
    const cachedPlans = await redis.get(`pricingPlans:course:${courseId}`);
    if (cachedPlans) {
      //console.log('🚀 Pricing plans data retrieved from Redis cache for course:', courseId);
      const plansData = JSON.parse(cachedPlans);
      return res.status(200).json({
        success: true,
        message: '✅ Pricing plans retrieved successfully',
        data: { pricingPlans: plansData },
        err: {},
      });
    }

    const pricingPlans = await pricingPlanService.getByCourseId(courseId);
    const plansCacheData = pricingPlans.map(plan => ({
      _id: plan._id,
      course: plan.course,
      type: plan.type,
      price: plan.price.toString(),
      discount: plan.discount,
      durationInDays: plan.durationInDays,
      currency: plan.currency,
      isActive: plan.isActive,
      features: plan.features,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
    }));

    await redis.setEx(`pricingPlans:course:${courseId}`, 3600, JSON.stringify(plansCacheData));
    //console.log('🗂️ Pricing plans data cached in Redis for course:', courseId);

    return res.status(200).json({
      success: true,
      message: '✅ Pricing plans retrieved successfully',
      data: { pricingPlans },
      err: {},
    });
  } catch (err) {
    console.error('❌ Get Pricing Plans By Course ID Error:', err);
    if (err.message === 'Invalid course ID' || err.message === 'No pricing plans found for this course') {
      return res.status(404).json({
        success: false,
        message: err.message,
        data: {},
        err: { message: err.message },
      });
    }
    return res.status(500).json({
      success: false,
      message: err.message,
      data: {},
      err: err.message,
    });
  }
};

export const updatePricingPlan = async (req, res) => {
  try {
    //console.log('📩 Request Body updatePricingPlan:', JSON.stringify(req.body, null, 2));

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Pricing plan ID is required',
        data: {},
        err: { message: 'Missing pricing plan ID parameter' },
      });
    }

    const updateData = {
      ...req.body,
      features: req.body.features ? req.body.features.split(',').map(item => item.trim()) : undefined,
    };

    const updatedPlan = await pricingPlanService.updateById(id, updateData);

    const redis = await initRedis();
    const planId = updatedPlan._id.toString();
    const planCacheData = {
      _id: updatedPlan._id,
      course: updatedPlan.course,
      type: updatedPlan.type,
      price: updatedPlan.price.toString(),
      discount: updatedPlan.discount,
      durationInDays: updatedPlan.durationInDays,
      currency: updatedPlan.currency,
      isActive: updatedPlan.isActive,
      features: updatedPlan.features,
      createdAt: updatedPlan.createdAt,
      updatedAt: updatedPlan.updatedAt,
    };

    await redis.setEx(`pricingPlan:${planId}`, 3600, JSON.stringify(planCacheData));
    //console.log('🗂️ Redis cache updated for pricing plan:', planId);

    return res.status(200).json({
      success: true,
      message: '✅ Pricing plan updated successfully',
      data: { pricingPlan: updatedPlan },
      err: {},
    });
  } catch (err) {
    console.error('❌ Update Pricing Plan Error:', err);
    if (
      err.message === 'Pricing plan not found' ||
      err.message === 'Invalid pricing plan ID' ||
      err.message === 'Invalid or non-existent course' ||
      err.message === 'A pricing plan with this course and type already exists' ||
      err.message === 'No valid fields to update' ||
      err.message === 'Features must be an array' ||
      err.message === 'Maximum 10 features allowed'
    ) {
      return res.status(400).json({
        success: false,
        message: err.message,
        data: {},
        err: { message: err.message },
      });
    }
    return res.status(500).json({
      success: false,
      message: err.message,
      data: {},
      err: err.message,
    });
  }
};

export const deletePricingPlan = async (req, res) => {
  try {
    //console.log('📩 Request Params deletePricingPlan:', req.params);

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Pricing plan ID is required',
        data: {},
        err: { message: 'Missing pricing plan ID parameter' },
      });
    }

    const deletedPlan = await pricingPlanService.softDeleteById(id);

    const redis = await initRedis();
    await redis.del(`pricingPlan:${id}`);
    //console.log('🗑️ Pricing plan cache cleared:', id);

    return res.status(200).json({
      success: true,
      message: '✅ Pricing plan deleted successfully',
      data: { pricingPlan: deletedPlan },
      err: {},
    });
  } catch (err) {
    console.error('❌ Delete Pricing Plan Error:', err);
    if (err.message === 'Pricing plan not found' || err.message === 'Invalid pricing plan ID') {
      return res.status(400).json({
        success: false,
        message: err.message,
        data: {},
        err: { message: err.message },
      });
    }
    return res.status(500).json({
      success: false,
      message: err.message,
      data: {},
      err: err.message,
    });
  }
};