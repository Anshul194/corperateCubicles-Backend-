import QuickLinkService from '../service/QuickLinkService.js';

const quickLinkService = new QuickLinkService();

export const createQuickLink = async (req, res) => {
  try {
    const linkData = { ...req.body };
    const quickLink = await quickLinkService.create(linkData);
    res.status(201).json({
      success: true,
      message: 'Quick link created successfully',
      data: { quickLink },
      err: {},
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message,
      data: {},
      err: { message: err.message },
    });
  }
};

export const getQuickLinks = async (req, res) => {
  try {
    const result = await quickLinkService.getAll(req.query);
    res.json({
      success: true,
      message: 'Quick links retrieved successfully',
      data: { ...result },
      err: {},
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
      data: {},
      err: { message: err.message },
    });
  }
};

export const getQuickLink = async (req, res) => {
  try {
    const quickLink = await quickLinkService.getById(req.params.id);
    res.json({
      success: true,
      message: 'Quick link retrieved successfully',
      data: { quickLink },
      err: {},
    });
  } catch (err) {
    const status = err.message === 'Quick link not found' ? 404 : 500;
    res.status(status).json({
      success: false,
      message: err.message,
      data: {},
      err: { message: err.message },
    });
  }
};

export const updateQuickLink = async (req, res) => {
  try {
    const quickLink = await quickLinkService.updateById(req.params.id, req.body);
    res.json({
      success: true,
      message: 'Quick link updated successfully',
      data: { quickLink },
      err: {},
    });
  } catch (err) {
    const status = err.message === 'Quick link not found' ? 404 : 400;
    res.status(status).json({
      success: false,
      message: err.message,
      data: {},
      err: { message: err.message },
    });
  }
};

export const deleteQuickLink = async (req, res) => {
  try {
    const quickLink = await quickLinkService.softDeleteById(req.params.id);
    res.json({
      success: true,
      message: 'Quick link deleted successfully',
      data: { quickLink },
      err: {},
    });
  } catch (err) {
    const status = err.message === 'Quick link not found' ? 404 : 500;
    res.status(status).json({
      success: false,
      message: err.message,
      data: {},
      err: { message: err.message },
    });
  }
};
