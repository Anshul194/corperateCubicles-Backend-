import PricingPlanDiscountService from '../service/pricingPlanDiscountService.js';
import { initRedis } from '../config/redisClient.js';

const pricingPlanDiscountService = new PricingPlanDiscountService();

export const createPricingPlanDiscount = async (req, res) => {
  try {
    const discountData = { ...req.body };

    // Validate discount type and value
    if (discountData.discountType === 'percentage' && discountData.discount > 100) {
      return res.status(400).json({ success: false, message: 'Percentage discount cannot exceed 100' });
    }
    if (discountData.discountType === 'amount' && discountData.discount < 0) {
      return res.status(400).json({ success: false, message: 'Amount discount cannot be negative' });
    }

    const discount = await pricingPlanDiscountService.createPricingPlanDiscount(discountData);

    const redis = await initRedis();
    await redis.del('pricingPlanDiscounts:all*');

    res.status(201).json({ success: true, message: 'Pricing Plan Discount created', data: discount });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getAllPricingPlanDiscounts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      sortBy = 'createdAt',
      sortOrder = 'asc',
      courseId
    } = req.query;

    const filters = {};
    if (courseId) filters.course = courseId;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      search,
      sortBy,
      sortOrder,
      filters
    };

    const cacheKey = `pricingPlanDiscounts:all:${JSON.stringify(options)}`;
    const redis = await initRedis();
    const cached = await redis.get(cacheKey);

    if (cached) {
      return res.status(200).json({ success: true, message: 'Pricing Plan Discounts from cache', ...JSON.parse(cached), fromCache: true });
    }

    const discounts = await pricingPlanDiscountService.getAllPricingPlanDiscounts(options);
    await redis.setEx(cacheKey, 300, JSON.stringify(discounts));

    res.status(200).json({ success: true, message: 'Pricing Plan Discounts fetched', ...discounts });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getPricingPlanDiscountById = async (req, res) => {
  try {
    const { discountId } = req.params;
    const redis = await initRedis();
    const cached = await redis.get(`pricingPlanDiscount:${discountId}`);

    if (cached) {
      return res.status(200).json({ success: true, data: JSON.parse(cached), fromCache: true });
    }

    const discount = await pricingPlanDiscountService.getPricingPlanDiscountById(discountId);
    if (!discount) return res.status(404).json({ success: false, message: 'Pricing Plan Discount not found' });

    await redis.setEx(`pricingPlanDiscount:${discountId}`, 300, JSON.stringify(discount));
    res.status(200).json({ success: true, data: discount });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updatePricingPlanDiscount = async (req, res) => {
  try {
    const { discountId } = req.params;
    const discountData = { ...req.body };

    // Validate discount type and value
    if (discountData.discountType === 'percentage' && discountData.discount > 100) {
      return res.status(400).json({ success: false, message: 'Percentage discount cannot exceed 100' });
    }
    if (discountData.discountType === 'amount' && discountData.discount < 0) {
      return res.status(400).json({ success: false, message: 'Amount discount cannot be negative' });
    }

    const updated = await pricingPlanDiscountService.updatePricingPlanDiscount(discountId, discountData);

    const redis = await initRedis();
    await redis.del('pricingPlanDiscounts:all*');
    await redis.del(`pricingPlanDiscount:${discountId}`);

    res.status(200).json({ success: true, message: 'Pricing Plan Discount updated', data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const deletePricingPlanDiscount = async (req, res) => {
  try {
    const { discountId } = req.params;
    const deleted = await pricingPlanDiscountService.deletePricingPlanDiscount(discountId);

    const redis = await initRedis();
    await redis.del('pricingPlanDiscounts:all*');
    await redis.del(`pricingPlanDiscount:${discountId}`);

    res.status(200).json({ success: true, message: 'Pricing Plan Discount deleted', data: deleted });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getDiscountsByCourseId = async (req, res) => {
  try {
    const { courseId } = req.params;
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'asc',
      search = ''
    } = req.query;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sortBy,
      sortOrder,
      search,
      filters: { course: courseId }
    };

    const cacheKey = `pricingPlanDiscounts:course:${courseId}:${JSON.stringify(options)}`;
    const redis = await initRedis();
    const cached = await redis.get(cacheKey);

    if (cached) {
      return res.status(200).json({
        success: true,
        message: 'Pricing Plan Discounts (by course) fetched from cache',
        ...JSON.parse(cached),
        fromCache: true
      });
    }

    const discounts = await pricingPlanDiscountService.getAllPricingPlanDiscounts(options);
    await redis.setEx(cacheKey, 300, JSON.stringify(discounts));

    res.status(200).json({
      success: true,
      message: 'Pricing Plan Discounts (by course) fetched successfully',
      ...discounts
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};