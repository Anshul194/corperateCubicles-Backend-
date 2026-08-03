import express from "express";
import Role from "../models/Role.js";
import Permission from "../models/Permission.js";
import AppModule from "../models/AppModule.js";
import RolePermission from "../models/RolePermission.js";
import User from "../models/user.js";
import { isAdmin } from "../middlewares/isAdmin.js";
import accessTokenAutoRefresh from "../middlewares/accessTokenAutoRefresh.js";
import passport from "passport";
import { getPermissionsForUser } from "../middlewares/roleMiddleware.js";
import roleMiddleware from "../middlewares/roleMiddleware.js";

const router = express.Router();

// ============ MODULES ============

router.get("/modules", accessTokenAutoRefresh, passport.authenticate("jwt", { session: false }), isAdmin, async (req, res) => {
  try {
    const modules = await AppModule.find({ isActive: true }).sort({ sortOrder: 1, name: 1 });
    res.json({ success: true, data: modules });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/modules", accessTokenAutoRefresh, passport.authenticate("jwt", { session: false }), isAdmin, async (req, res) => {
  try {
    const { name, description, routePrefix, icon, parentModule, sortOrder } = req.body;
    const module = await AppModule.create({ name, description, routePrefix, icon, parentModule, sortOrder });
    res.status(201).json({ success: true, data: module });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put("/modules/:id", accessTokenAutoRefresh, passport.authenticate("jwt", { session: false }), isAdmin, async (req, res) => {
  try {
    const module = await AppModule.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!module) return res.status(404).json({ success: false, message: "Module not found" });
    res.json({ success: true, data: module });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete("/modules/:id", accessTokenAutoRefresh, passport.authenticate("jwt", { session: false }), isAdmin, async (req, res) => {
  try {
    const module = await AppModule.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!module) return res.status(404).json({ success: false, message: "Module not found" });
    res.json({ success: true, message: "Module deactivated" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ PERMISSIONS ============

router.get("/permissions", accessTokenAutoRefresh, passport.authenticate("jwt", { session: false }), isAdmin, async (req, res) => {
  try {
    const { module, action, resource } = req.query;
    const filter = { isActive: true };
    if (module) filter.module = module;
    if (action) filter.action = action;
    if (resource) filter.resource = resource;
    const permissions = await Permission.find(filter).populate("module").sort({ name: 1 });
    res.json({ success: true, data: permissions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/permissions", accessTokenAutoRefresh, passport.authenticate("jwt", { session: false }), isAdmin, async (req, res) => {
  try {
    const { name, description, module, action, resource } = req.body;
    const permission = await Permission.create({ name, description, module, action, resource });
    res.status(201).json({ success: true, data: permission });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put("/permissions/:id", accessTokenAutoRefresh, passport.authenticate("jwt", { session: false }), isAdmin, async (req, res) => {
  try {
    const permission = await Permission.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!permission) return res.status(404).json({ success: false, message: "Permission not found" });
    res.json({ success: true, data: permission });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete("/permissions/:id", accessTokenAutoRefresh, passport.authenticate("jwt", { session: false }), isAdmin, async (req, res) => {
  try {
    const permission = await Permission.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!permission) return res.status(404).json({ success: false, message: "Permission not found" });
    res.json({ success: true, message: "Permission deactivated" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ ROLES ============
// Note: this router is mounted at /roles, so these paths resolve as:
//   GET  /roles        -> list roles
//   POST /roles        -> create role
//   PUT  /roles/:id    -> update role
//   etc.

router.get("/", accessTokenAutoRefresh, passport.authenticate("jwt", { session: false }), isAdmin, async (req, res) => {
  try {
    const roles = await Role.find({ isActive: true }).populate("permissions").populate("modules").sort({ name: 1 });
    res.json({ success: true, data: roles });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/", accessTokenAutoRefresh, passport.authenticate("jwt", { session: false }), isAdmin, async (req, res) => {
  try {
    const { name, description, permissions, modules, isDefault } = req.body;
    const role = await Role.create({ name, description, permissions, modules, isDefault, createdBy: req.user._id });
    res.status(201).json({ success: true, data: role });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put("/:id", accessTokenAutoRefresh, passport.authenticate("jwt", { session: false }), isAdmin, async (req, res) => {
  try {
    const role = await Role.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }).populate("permissions").populate("modules");
    if (!role) return res.status(404).json({ success: false, message: "Role not found" });
    res.json({ success: true, data: role });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete("/:id", accessTokenAutoRefresh, passport.authenticate("jwt", { session: false }), isAdmin, async (req, res) => {
  try {
    const role = await Role.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!role) return res.status(404).json({ success: false, message: "Role not found" });
    res.json({ success: true, message: "Role deactivated" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ ROLE PERMISSIONS ============

router.post("/:roleId/permissions", accessTokenAutoRefresh, passport.authenticate("jwt", { session: false }), isAdmin, async (req, res) => {
  try {
    const { roleId } = req.params;
    const { permissionIds } = req.body;
    const role = await Role.findById(roleId);
    if (!role) return res.status(404).json({ success: false, message: "Role not found" });
    const existing = await RolePermission.find({ role: roleId });
    const existingPermIds = existing.map((e) => String(e.permission));
    const newPerms = permissionIds.filter((id) => !existingPermIds.includes(String(id)));
    if (newPerms.length > 0) {
      await RolePermission.insertMany(newPerms.map((pid) => ({ role: roleId, permission: pid, grantedBy: req.user._id })));
    }
    const updatedRole = await Role.findById(roleId).populate("permissions");
    res.json({ success: true, data: updatedRole });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete("/:roleId/permissions/:permId", accessTokenAutoRefresh, passport.authenticate("jwt", { session: false }), isAdmin, async (req, res) => {
  try {
    const { roleId, permId } = req.params;
    await RolePermission.findOneAndDelete({ role: roleId, permission: permId });
    const updatedRole = await Role.findById(roleId).populate("permissions");
    res.json({ success: true, data: updatedRole });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ ROLE MODULES ============

router.post("/:roleId/modules", accessTokenAutoRefresh, passport.authenticate("jwt", { session: false }), isAdmin, async (req, res) => {
  try {
    const { roleId } = req.params;
    const { moduleIds } = req.body;
    const role = await Role.findById(roleId);
    if (!role) return res.status(404).json({ success: false, message: "Role not found" });
    const existingModules = role.modules.map((m) => String(m));
    const newModules = moduleIds.filter((id) => !existingModules.includes(String(id)));
    if (newModules.length > 0) {
      role.modules = [...role.modules, ...newModules];
      await role.save();
    }
    const updatedRole = await Role.findById(roleId).populate("modules").populate("permissions");
    res.json({ success: true, data: updatedRole });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete("/:roleId/modules/:moduleId", accessTokenAutoRefresh, passport.authenticate("jwt", { session: false }), isAdmin, async (req, res) => {
  try {
    const { roleId, moduleId } = req.params;
    const role = await Role.findById(roleId);
    if (!role) return res.status(404).json({ success: false, message: "Role not found" });
    role.modules = role.modules.filter((m) => String(m) !== String(moduleId));
    await role.save();
    const updatedRole = await Role.findById(roleId).populate("modules").populate("permissions");
    res.json({ success: true, data: updatedRole });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ USER ROLES ============

// List users with their assigned roles (for the admin "Users & Roles" page)
router.get("/users", accessTokenAutoRefresh, passport.authenticate("jwt", { session: false }), isAdmin, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const search = (req.query.search || "").toString().trim();
    const filter = { isDeleted: { $ne: true } };
    if (search) {
      const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ email: re }, { fullName: re }, { name: re }];
    }
    const total = await User.countDocuments(filter);
    const users = await User.find(filter)
      .populate("roles", "name description isActive")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select("email fullName name role roles profilePicture createdAt");
    res.json({ success: true, data: { users, total, page, limit } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put("/users/:userId/roles", accessTokenAutoRefresh, passport.authenticate("jwt", { session: false }), isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { roles } = req.body;
    if (!Array.isArray(roles)) {
      return res.status(400).json({ success: false, message: "roles must be an array of role IDs" });
    }
    const roleDocs = await Role.find({ _id: { $in: roles }, isActive: true });
    const validIds = roleDocs.map((r) => String(r._id));
    const user = await User.findByIdAndUpdate(userId, { roles: validIds }, { new: true }).populate("roles");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put("/users/:userId/permissions", accessTokenAutoRefresh, passport.authenticate("jwt", { session: false }), isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { permissions } = req.body;
    const user = await User.findByIdAndUpdate(userId, { permissions }, { new: true }).populate("permissions");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ MY PERMISSIONS ============

router.get("/me/permissions", accessTokenAutoRefresh, passport.authenticate("jwt", { session: false }), async (req, res) => {
  try {
    const permissions = await getPermissionsForUser(req.user);
    const roles = roleMiddleware.getRoleNames(req.user);
    res.json({ success: true, data: { permissions: Array.from(permissions), roles } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;