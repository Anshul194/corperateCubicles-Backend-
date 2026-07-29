import bundleService from '../service/course-bundle-service.js';
import { initRedis } from '../config/redisClient.js';

export const create = async (req, res) => {
  try {
    // Parse accessType and accessPeriod for bundle
    let accessType = req.body.accessType || 'lifetime';
    let accessPeriod = req.body.accessPeriod || '';
    let accessExpiry = null;
    if ((accessType === 'limited' || accessType === 'subscription') && accessPeriod) {
      const periodStr = accessPeriod.trim().toLowerCase();
      let years = 0, months = 0, days = 0;
      const yearMatch = periodStr.match(/(\d+)\s*year/);
      const monthMatch = periodStr.match(/(\d+)\s*month/);
      const dayMatch = periodStr.match(/(\d+)\s*day/);
      if (yearMatch) years = parseInt(yearMatch[1], 10);
      if (monthMatch) months = parseInt(monthMatch[1], 10);
      if (dayMatch) days = parseInt(dayMatch[1], 10);
      let expiry = new Date();
      if (years > 0) expiry.setFullYear(expiry.getFullYear() + years);
      if (months > 0) expiry.setMonth(expiry.getMonth() + months);
      if (days > 0) expiry.setDate(expiry.getDate() + days);
      if (years > 0 || months > 0 || days > 0) {
        accessExpiry = expiry;
      }
    }
    // Merge into bundle data
    const bundleData = {
      ...req.body,
      accessType,
      accessPeriod,
      accessExpiry,
    };
    const result = await bundleService.create(bundleData, req.files);

    const redis = await initRedis();
    await redis.del('bundles:all*');

    res.status(201).json({
      success: true,
      message: 'Course bundle created successfully',
      data: result
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getAll = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      sortBy = 'createdAt',
      sortOrder = 'asc',
      ...filterParams
    } = req.query;

    const filter = {};

    // Filters
    if (filterParams.categoryId) filter.categoryId = filterParams.categoryId;
    if (filterParams.subCategoryId) filter.subCategoryId = filterParams.subCategoryId;
    if (filterParams.instructorId) filter.instructorId = filterParams.instructorId;
    if (filterParams.topic) filter.topic = { $in: filterParams.topic.split(",") };
    if (filterParams.languages) filter.languages = { $in: filterParams.languages.split(",") };
    if (filterParams.level) filter.level = { $in: filterParams.level.split(",") };
    if (filterParams.popular) filter.popular = filterParams.popular === "true";
    if (filterParams.difficulty) filter.difficulty = filterParams.difficulty;
    //duration=0-2
    
    //price =paid/free
    const priceFiter = {};
    if (filterParams.price) {
      if (filterParams.price === 'paid') {
        priceFiter.$gt = 0; // Paid courses
      } else if (filterParams.price === 'free') {
        priceFiter.$eq = 0; // Free courses
      }
    }
      
    

    const options = {
      page: 1, // fetch all for filtering
      limit: 0, // fetch all for filtering
      search,
      sortBy,
      sortOrder,
      priceFiter
    };

    const redis = await initRedis();

    // Fetch all bundles (no pagination)
    const result = await bundleService.getAll(options);

    // Apply filters to all bundles
    let filteredBundles = result.data.filter(bundle => {
      if (bundle.courses && bundle.courses.length > 0) {
        return bundle.courses.some(course => {
          let match = true;
          if (filter.categoryId && course.categoryId.toString() !== filter.categoryId) match = false;
          if (filter.subCategoryId && course.subCategoryId.toString() !== filter.subCategoryId) match = false;
          if (filter.instructorId && course.instructorId.toString() !== filter.instructorId) match = false;
          if (filter.topic && !filter.topic.includes(course.topic)) match = false;  
          if (filter.languages && !filter.languages.includes(course.languages)) match = false;
          if (filter.level && !filter.level.includes(course.level)) match = false;  
          if (filter.popular && course.popular !== filter.popular) match = false;
          if (filter.difficulty && course.difficulty !== filter.difficulty) match = false;
          if (filterParams.duration) {
            const [min, max] = filterParams.duration.split('-').map(Number);
            if (course.duration < min || course.duration > max) match = false;
          }
          if (filter.price) {
            if (filter.price === 'paid' && course.price <= 0) match = false;
            if (filter.price === 'free' && course.price > 0) match = false;
          }
          return match;
        });
      }
      return false;
    });

    // Paginate filtered bundles
    const total = filteredBundles.length;
    const pageInt = parseInt(page);
    const limitInt = parseInt(limit);
    const startIdx = (pageInt - 1) * limitInt;
    const endIdx = startIdx + limitInt;
    const paginatedBundles = filteredBundles.slice(startIdx, endIdx);

    res.status(200).json({
      success: true,
      message: 'Course bundles fetched successfully',
      data: paginatedBundles,
      total,
      page: pageInt,
      limit: limitInt,
      totalPages: limitInt > 0 ? Math.ceil(total / limitInt) : 1
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getOne = async (req, res) => {
  try {
    const redis = await initRedis();
    const cacheKey = `bundle:${req.params.id}`;
    const cached = await redis.get(cacheKey);

    if (cached) {
      return res.status(200).json({
        success: true,
        message: 'Course bundle fetched from cache',
        data: JSON.parse(cached),
        fromCache: true
      });
    }

    const bundle = await bundleService.getById(req.params.id);
    if (!bundle) {
      return res.status(404).json({ success: false, message: 'Course bundle not found' });
    }

    await redis.setEx(cacheKey, 300, JSON.stringify(bundle));
    res.status(200).json({
      success: true,
      message: 'Course bundle fetched successfully',
      data: bundle
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const update = async (req, res) => {
  try {
    // Parse accessType and accessPeriod for bundle update
    let accessType = req.body.accessType || 'lifetime';
    let accessPeriod = req.body.accessPeriod || '';
    let accessExpiry = null;
    if ((accessType === 'limited' || accessType === 'subscription') && accessPeriod) {
      const periodStr = accessPeriod.trim().toLowerCase();
      let years = 0, months = 0, days = 0;
      const yearMatch = periodStr.match(/(\d+)\s*year/);
      const monthMatch = periodStr.match(/(\d+)\s*month/);
      const dayMatch = periodStr.match(/(\d+)\s*day/);
      if (yearMatch) years = parseInt(yearMatch[1], 10);
      if (monthMatch) months = parseInt(monthMatch[1], 10);
      if (dayMatch) days = parseInt(dayMatch[1], 10);
      let expiry = new Date();
      if (years > 0) expiry.setFullYear(expiry.getFullYear() + years);
      if (months > 0) expiry.setMonth(expiry.getMonth() + months);
      if (days > 0) expiry.setDate(expiry.getDate() + days);
      if (years > 0 || months > 0 || days > 0) {
        accessExpiry = expiry;
      }
    }
    // Merge into bundle data
    const bundleData = {
      ...req.body,
      accessType,
      accessPeriod,
      accessExpiry,
    };
    const updated = await bundleService.update(req.params.id, bundleData, req.files);

    const redis = await initRedis();
    await redis.del('bundles:all*');
    await redis.del(`bundle:${req.params.id}`);

    res.status(200).json({
      success: true,
      message: 'Course bundle updated successfully',
      data: updated
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteBundle = async (req, res) => {
  try {
    const deletedBundle = await bundleService.delete(req.params.id);

    const redis = await initRedis();
    await redis.del('bundles:all*');
    await redis.del(`bundle:${req.params.id}`);

    res.status(200).json({
      success: true,
      message: 'Course bundle deleted successfully',
      data: deletedBundle
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
   