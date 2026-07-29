import * as bannerService from '../services/bannerService.js';

export const createBanner = async (req, res) => {
  try {
    let data = req.body;
    // Handle image and mobileImage from req.files
    if (req.files && req.files['image'] && req.files['image'][0]) {
      data = { ...data, image: req.files['image'][0].filename };
    }
    if (req.files && req.files['mobileImage'] && req.files['mobileImage'][0]) {
      data = { ...data, mobileImage: req.files['mobileImage'][0].filename };
    }
    const banner = await bannerService.createBanner(data);
    res.status(201).json({
      success: true,
      message: '✅ Banner created successfully',
      data: { banner },
      err: {}
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message,
      data: {},
      err: { message: err.message }
    });
  }
};

export const getBanners = async (req, res) => {
  try {
    // Convert isActive to boolean if present
    const filter = { ...req.query };
    if (filter.isActive !== undefined) {
      filter.isActive = filter.isActive === 'true' || filter.isActive === true;
    }
    const banners = await bannerService.getBanners(filter);
    res.json({
      success: true,
      message: '✅ Banners retrieved successfully',
      data: { banners },
      err: {}
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
      data: {},
      err: { message: err.message }
    });
  }
};

export const getBanner = async (req, res) => {
  try {
    const banner = await bannerService.getBanner(req.params.id);
    if (!banner) return res.status(404).json({
      success: false,
      message: 'Banner not found',
      data: {},
      err: { message: 'Banner not found' }
    });
    res.json({
      success: true,
      message: '✅ Banner retrieved successfully',
      data: { banner },
      err: {}
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
      data: {},
      err: { message: err.message }
    });
  }
};

export const updateBanner = async (req, res) => {
  try {
    let data = req.body;
    if (req.files && req.files['image'] && req.files['image'][0]) {
      data = { ...data, image: req.files['image'][0].filename };
    }
    if (req.files && req.files['mobileImage'] && req.files['mobileImage'][0]) {
      data = { ...data, mobileImage: req.files['mobileImage'][0].filename };
    }
    const banner = await bannerService.updateBanner(req.params.id, data);
    if (!banner) return res.status(404).json({
      success: false,
      message: 'Banner not found',
      data: {},
      err: { message: 'Banner not found' }
    });
    res.json({
      success: true,
      message: '✅ Banner updated successfully',
      data: { banner },
      err: {}
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message,
      data: {},
      err: { message: err.message }
    });
  }
};

export const deleteBanner = async (req, res) => {
  try {
    const banner = await bannerService.deleteBanner(req.params.id);
    if (!banner) return res.status(404).json({
      success: false,
      message: 'Banner not found',
      data: {},
      err: { message: 'Banner not found' }
    });
    res.json({
      success: true,
      message: '✅ Banner deleted',
      data: { banner },
      err: {}
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
      data: {},
      err: { message: err.message }
    });
  }
};
