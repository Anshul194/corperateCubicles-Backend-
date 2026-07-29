import SiteContent from '../models/SiteContent.js';
import { initRedis } from '../config/redisClient.js';

export const getSiteContent = async (req, res) => {
  try {
    const { section } = req.params;
    if (!section) {
      return res.status(400).json({
        success: false,
        message: 'Section name is required',
        data: {},
        err: { message: 'Missing section parameter' }
      });
    }
    const content = await SiteContent.findOne({ section, isActive: true }).lean();
    if (!content) {
      return res.status(404).json({
        success: false,
        message: `Content not found for section: ${section}`,
        data: {},
        err: { message: 'Section not found' }
      });
    }
    return res.status(200).json({
      success: true,
      message: 'Site content retrieved successfully',
      data: content,
      err: {}
    });
  } catch (err) {
    console.error('getSiteContent error:', err);
    return res.status(500).json({
      success: false,
      message: err.message,
      data: {},
      err: err.message
    });
  }
};

export const getAllSiteContent = async (req, res) => {
  try {
    const contents = await SiteContent.find({ isActive: true }).lean();
    const result = {};
    contents.forEach(c => { result[c.section] = c.data; });
    return res.status(200).json({
      success: true,
      message: 'All site content retrieved successfully',
      data: result,
      err: {}
    });
  } catch (err) {
    console.error('getAllSiteContent error:', err);
    return res.status(500).json({
      success: false,
      message: err.message,
      data: {},
      err: err.message
    });
  }
};

export const createSiteContent = async (req, res) => {
  try {
    const { section, data, isActive } = req.body;
    if (!section || !data) {
      return res.status(400).json({
        success: false,
        message: 'Section and data are required',
        data: {},
        err: { message: 'Missing required fields' }
      });
    }
    const existing = await SiteContent.findOne({ section });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `Content already exists for section: ${section}. Use PUT to update.`,
        data: {},
        err: { message: 'Duplicate section' }
      });
    }
    const content = await SiteContent.create({ section, data, isActive });
    const redis = await initRedis();
    await redis.del('sitecontent:all');
    return res.status(201).json({
      success: true,
      message: 'Site content created successfully',
      data: content,
      err: {}
    });
  } catch (err) {
    console.error('createSiteContent error:', err);
    return res.status(500).json({
      success: false,
      message: err.message,
      data: {},
      err: err.message
    });
  }
};

export const updateSiteContent = async (req, res) => {
  try {
    const { section } = req.params;
    const { data, isActive } = req.body;
    if (!data) {
      return res.status(400).json({
        success: false,
        message: 'Data is required',
        data: {},
        err: { message: 'Missing data field' }
      });
    }
    const update = {};
    if (data) update.data = data;
    if (isActive !== undefined) update.isActive = isActive;
    const content = await SiteContent.findOneAndUpdate(
      { section },
      update,
      { new: true, upsert: true }
    );
    const redis = await initRedis();
    await redis.del('sitecontent:all');
    return res.status(200).json({
      success: true,
      message: 'Site content updated successfully',
      data: content,
      err: {}
    });
  } catch (err) {
    console.error('updateSiteContent error:', err);
    return res.status(500).json({
      success: false,
      message: err.message,
      data: {},
      err: err.message
    });
  }
};

export const deleteSiteContent = async (req, res) => {
  try {
    const { section } = req.params;
    const content = await SiteContent.findOneAndDelete({ section });
    if (!content) {
      return res.status(404).json({
        success: false,
        message: 'Section not found',
        data: {},
        err: { message: 'Section not found' }
      });
    }
    const redis = await initRedis();
    await redis.del('sitecontent:all');
    return res.status(200).json({
      success: true,
      message: 'Site content deleted successfully',
      data: {},
      err: {}
    });
  } catch (err) {
    console.error('deleteSiteContent error:', err);
    return res.status(500).json({
      success: false,
      message: err.message,
      data: {},
      err: err.message
    });
  }
};
