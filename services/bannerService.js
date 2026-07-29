import Banner from '../models/Banner.js';

export const createBanner = async (data) => {
  const banner = new Banner(data);
  return await banner.save();
};

export const getBanners = async (filter = {}) => {
  return await Banner.find(filter);
};

export const getBanner = async (id) => {
  return await Banner.findById(id);
};

export const updateBanner = async (id, data) => {
  return await Banner.findByIdAndUpdate(id, data, { new: true });
};

export const deleteBanner = async (id) => {
  return await Banner.findByIdAndDelete(id);
};
