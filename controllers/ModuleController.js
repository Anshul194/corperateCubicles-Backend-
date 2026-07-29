import ModuleService from '../service/ModuleService.js';
import { initRedis } from '../config/redisClient.js';
import mongoose from 'mongoose';
import Module from '../models/Module.js';
import NotificationService from "../service/notificationService.js";

const moduleService = new ModuleService();

export const createModule = async (req, res) => {
  try {
    // Attach uploaded image path (if any) to payload and normalize to '/uploads/...' URL
    const payload = { ...req.body };
    if (req.file && req.file.path) {
      const rawPath = req.file.path.replace(/\\/g, '/');
      const uploadsIndex = rawPath.indexOf('uploads/');
      if (uploadsIndex !== -1) {
        const relativePath = rawPath.substring(uploadsIndex);
        const pathParts = relativePath.split('/');
        const filename = pathParts.pop();
        const directory = pathParts.join('/');
        const encodedFilename = encodeURIComponent(filename);
        const encodedPath = `${directory}/${encodedFilename}`;
        payload.image = `/${encodedPath}`; // store as '/uploads/...'
      } else {
        payload.image = rawPath.replace(/^\//, '');
      }
    }

    const module = await moduleService.create(payload);

    // Notify enrolled users about the new module
    const notificationData = {
      title: "New Module Added",
      description: `A new module titled "${module.title}" has been added to your course.`,
      type: "new_module",
    };
    await NotificationService.notifyEnrolledUsers(module.courseId, notificationData);

    const redis = await initRedis();
    await redis.setEx(`module:${module._id}`, 3600, JSON.stringify(module));
    return res.status(201).json({ success: true, message: 'Module created', data: { module } });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

export const getModuleById = async (req, res) => {
  try {
    const { id } = req.params;
    const redis = await initRedis();
    const cached = await redis.get(`module:${id}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      // If courseId.modules exist but are plain IDs (strings), consider cache stale and fetch fresh
      const courseModules = parsed?.courseId?.modules;
      const firstIsId = Array.isArray(courseModules) && courseModules.length > 0 && typeof courseModules[0] === 'string';
      if (!firstIsId) {
        return res.status(200).json({ success: true, message: 'Module from cache', data: { module: parsed } });
      }
      // else fall through to fetch fresh populated module
    }

    const module = await moduleService.getById(id);
    await redis.setEx(`module:${id}`, 3600, JSON.stringify(module));
    return res.status(200).json({ success: true, message: 'Module retrieved', data: { module } });
  } catch (err) {
    return res.status(404).json({ success: false, message: err.message });
  }
};

export const getAllModules = async (req, res) => {
  try {
    const result = await moduleService.getAll(req.query);
    return res.status(200).json({
      success: true,
      message: 'Modules fetched',
      data: result
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};


export const updateModule = async (req, res) => {
  try {
    const { id } = req.params;
    const payload = { ...req.body };
    if (req.file && req.file.path) {
      const rawPath = req.file.path.replace(/\\/g, '/');
      const uploadsIndex = rawPath.indexOf('uploads/');
      if (uploadsIndex !== -1) {
        const relativePath = rawPath.substring(uploadsIndex);
        const pathParts = relativePath.split('/');
        const filename = pathParts.pop();
        const directory = pathParts.join('/');
        const encodedFilename = encodeURIComponent(filename);
        const encodedPath = `${directory}/${encodedFilename}`;
        payload.image = `/${encodedPath}`; // store as '/uploads/...'
      } else {
        payload.image = rawPath.replace(/^\//, '');
      }
    }

    const updated = await moduleService.updateById(id, payload);
    const redis = await initRedis();
    await redis.setEx(`module:${id}`, 3600, JSON.stringify(updated));
    return res.status(200).json({ success: true, message: 'Module updated', data: { module: updated } });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

export const deleteModule = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await moduleService.softDeleteById(id);
    const redis = await initRedis();
    await redis.del(`module:${id}`);
    return res.status(200).json({ success: true, message: 'Module deleted (soft)', data: { module: deleted } });
  } catch (err) {
    return res.status(404).json({ success: false, message: err.message });
  }
};

export const disableDripForModule = async (req, res) => {
  try {
    const { moduleId } = req.params;
    const { userId } = req.body;

    // Validate ObjectIds
    if (!mongoose.Types.ObjectId.isValid(moduleId) || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid moduleId or userId",
        data: {},
        err: { message: "Invalid ObjectId" }
      });
    }

    // Find the module
    const module = await Module.findById(moduleId);
    if (!module) {
      return res.status(404).json({
        success: false,
        message: "Module not found",
        data: {},
        err: { message: "Module not found" }
      });
    }

    // Ensure dripSettingDisabledFor is an array and push userId if not present
    if (!Array.isArray(module.dripSettingDisabledFor)) {
      module.dripSettingDisabledFor = [];
    }
    // Convert userId to ObjectId for comparison/push
    const userObjId = new mongoose.Types.ObjectId(userId);
    if (!module.dripSettingDisabledFor.some(id => id.equals(userObjId))) {
      module.dripSettingDisabledFor.push(userObjId);
      await module.save();
    }

    return res.status(200).json({
      success: true,
      message: "Drip setting disabled for user in module",
      data: { moduleId, userId },
      err: {}
    });
  } catch (err) {
    console.error("❌ Disable Drip For Module Error:", err);
    return res.status(500).json({
      success: false,
      message: err.message,
      data: {},
      err: err.message
    });
  }
};
