import faqService from "../service/faqService.js";
import { initRedis } from "../config/redisClient.js";

export const createFAQ = async (req, res) => {
  try {
    const faq = await faqService.createFAQ(req.body);

    const redis = await initRedis();
    await redis.del("faqs:all*");

    res.status(201).json({
      success: true,
      message: "FAQ created successfully",
      data: faq,
    });
  } catch (error) {
    console.error("createFAQ error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAllFAQs = async (req, res) => {
  try {
    const { globalOnly } = req.query;

    const filters = {};
    if (globalOnly === "true") filters.courseId = null;

    const redis = await initRedis();
    const cacheKey = `faqs:all:${JSON.stringify(filters)}`;

    const cached = await redis.get(cacheKey);
    // if (cached) {
    //   return res.status(200).json({
    //     success: true,
    //     message: 'FAQs fetched from cache',
    //     data: JSON.parse(cached),
    //     fromCache: true
    //   });
    // }

    const faqs = await faqService.getAllFAQs(filters);
    await redis.setEx(cacheKey, 300, JSON.stringify(faqs));

    res.status(200).json({
      success: true,
      message: "FAQs fetched successfully",
      data: faqs,
    });
  } catch (error) {
    console.error("getAllFAQs error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getFAQById = async (req, res) => {
  try {
    const faqId = req.params.id;
    const redis = await initRedis();
    const cacheKey = `faq:${faqId}`;

    const cached = await redis.get(cacheKey);
    if (cached) {
      return res.status(200).json({
        success: true,
        message: "FAQ fetched from cache",
        data: JSON.parse(cached),
        fromCache: true,
      });
    }

    const faq = await faqService.getFAQById(faqId);
    if (!faq) {
      return res.status(404).json({ success: false, message: "FAQ not found" });
    }

    await redis.setEx(cacheKey, 300, JSON.stringify(faq));

    res.status(200).json({
      success: true,
      message: "FAQ fetched successfully",
      data: faq,
    });
  } catch (error) {
    console.error("getFAQById error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getCourseFAQs = async (req, res) => {
  try {
    const { courseId } = req.params;
    const redis = await initRedis();
    const cacheKey = `faqs:course:${courseId}`;

    // const cached = await redis.get(cacheKey);
    // if (cached) {
    //   return res.status(200).json({
    //     success: true,
    //     message: 'Course FAQs fetched from cache',
    //     data: JSON.parse(cached),
    //     fromCache: true
    //   });
    // }

    const faqs = await faqService.getFAQsByCourseId(courseId);
    // await redis.setEx(cacheKey, 300, JSON.stringify(faqs));

    res.status(200).json({
      success: true,
      message: "Course FAQs fetched successfully",
      data: faqs,
    });
  } catch (error) {
    console.error("getCourseFAQs error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateFAQ = async (req, res) => {
  try {
    const updated = await faqService.updateFAQ(req.params.id, req.body);

    const redis = await initRedis();
    await redis.del("faqs:all*");
    await redis.del(`faq:${req.params.id}`);
    if (updated.courseId) {
      await redis.del(`faqs:course:${updated.courseId}`);
    }

    res.status(200).json({
      success: true,
      message: "FAQ updated successfully",
      data: updated,
    });
  } catch (error) {
    console.error("updateFAQ error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteFAQ = async (req, res) => {
  try {
    const deleted = await faqService.deleteFAQ(req.params.id);

    const redis = await initRedis();
    await redis.del("faqs:all*");
    await redis.del(`faq:${req.params.id}`);
    if (deleted?.courseId) {
      await redis.del(`faqs:course:${deleted.courseId}`);
    }

    res
      .status(200)
      .json({ success: true, message: "FAQ deleted successfully" });
  } catch (error) {
    console.error("deleteFAQ error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
