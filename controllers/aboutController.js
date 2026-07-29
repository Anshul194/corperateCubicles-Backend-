import aboutService from '../service/aboutService.js';
import { initRedis } from '../config/redisClient.js';

export const getAboutContent = async (req, res) => {
  try {
    const redis = await initRedis();
    const cacheKey = 'about:content';
    const cached = await redis.get(cacheKey);

    if (cached) {
      return res.status(200).json({
        success: true,
        message: 'About content fetched from cache',
        fromCache: true,
        data: JSON.parse(cached),
      });
    }

    const content = await aboutService.getAboutContent();
    await redis.setEx(cacheKey, 600, JSON.stringify(content));

    res.status(200).json({
      success: true,
      message: 'About content fetched successfully',
      data: content,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updateAboutContent = async (req, res) => {
  try {
    const content = await aboutService.updateAboutContent(req.body);
    const redis = await initRedis();
    await redis.del('about:content');

    res.status(200).json({
      success: true,
      message: 'About content updated successfully',
      data: content,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getTeamMembers = async (req, res) => {
  try {
    const members = await aboutService.getTeamMembers();
    res.status(200).json({
      success: true,
      message: 'Team members fetched successfully',
      data: members,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getAllTeamMembers = async (req, res) => {
  try {
    const members = await aboutService.getAllTeamMembers();
    res.status(200).json({
      success: true,
      message: 'All team members fetched successfully',
      data: members,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const createTeamMember = async (req, res) => {
  try {
    const member = await aboutService.createTeamMember(req.body);
    res.status(201).json({
      success: true,
      message: 'Team member created successfully',
      data: member,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updateTeamMember = async (req, res) => {
  try {
    const member = await aboutService.updateTeamMember(req.params.id, req.body);
    if (!member) {
      return res.status(404).json({ success: false, message: 'Team member not found' });
    }
    res.status(200).json({
      success: true,
      message: 'Team member updated successfully',
      data: member,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteTeamMember = async (req, res) => {
  try {
    const member = await aboutService.deleteTeamMember(req.params.id);
    if (!member) {
      return res.status(404).json({ success: false, message: 'Team member not found' });
    }
    res.status(200).json({
      success: true,
      message: 'Team member deleted successfully',
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
