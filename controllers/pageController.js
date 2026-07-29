import pageService from "../service/pageService.js";
import { initRedis } from "../config/redisClient.js";

export const createPage = async (req, res) => {
  try {
    const page = await pageService.createPage(req.body);
    const redis = await initRedis();
    await redis.del("pages:all*");

    res.status(201).json({
      success: true,
      message: "✅ Page created successfully",
      data: page,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAllPages = async (req, res) => {
  try {
    const redis = await initRedis();
    const cacheKey = `pages:all`;
    const cached = await redis.get(cacheKey);

    if (cached) {
      return res.status(200).json({
        success: true,
        message: "📦 Pages fetched from cache",
        fromCache: true,
        data: JSON.parse(cached),
      });
    }

    const pages = await pageService.getAllPages();
    await redis.setEx(cacheKey, 300, JSON.stringify(pages));

    res.status(200).json({
      success: true,
      message: "📄 All pages fetched successfully",
      data: pages,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getPageById = async (req, res) => {
  try {
    const page = await pageService.getPageById(req.params.id);
    if (!page) {
      return res.status(404).json({
        success: false,
        message: "❌ Page not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "📄 Page fetched successfully",
      data: page,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updatePage = async (req, res) => {
  try {
    const page = await pageService.updatePage(req.params.id, req.body);
    if (!page) {
      return res.status(404).json({
        success: false,
        message: "❌ Page not found for update",
      });
    }

    const redis = await initRedis();
    await redis.del("pages:all*");
    await redis.del(`page:${req.params.id}`);

    res.status(200).json({
      success: true,
      message: "✅ Page updated successfully",
      data: page,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deletePage = async (req, res) => {
  try {
    await pageService.deletePage(req.params.id);

    const redis = await initRedis();
    await redis.del("pages:all*");
    await redis.del(`page:${req.params.id}`);

    res.status(200).json({
      success: true,
      message: "🗑️ Page deleted successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
