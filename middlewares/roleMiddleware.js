import Role from "../models/Role.js";
import Permission from "../models/Permission.js";
import AppModule from "../models/AppModule.js";

const SUPER_ADMIN_ROLES = ["admin", "superadmin", "ADMIN"];

const getRoleNames = (user) => {
  if (!user) return [];
  const roles = [];
  if (user.role) roles.push(String(user.role));
  if (user.roles && Array.isArray(user.roles)) {
    user.roles.forEach((r) => {
      if (typeof r === "string") roles.push(r);
      else if (r.name) roles.push(r.name);
      else if (r._id) roles.push(String(r._id));
    });
  }
  return roles;
};

const getUserPermissions = async (user) => {
  if (!user) return new Set();
  const permissionSet = new Set();

  // Admins/superadmins always have every permission (wildcard).
  const roleNames = getRoleNames(user).map((r) => String(r).toLowerCase());
  if (roleNames.some((r) => SUPER_ADMIN_ROLES.includes(r))) {
    permissionSet.add("*");
    return permissionSet;
  }

  if (user.permissions && Array.isArray(user.permissions)) {
    user.permissions.forEach((p) => {
      if (typeof p === "string") permissionSet.add(p);
      else if (p.name) permissionSet.add(p.name);
      else if (p._id) permissionSet.add(String(p._id));
    });
  }

  const roleIds = [];
  if (user.roles && Array.isArray(user.roles)) {
    user.roles.forEach((r) => {
      if (typeof r !== "string" && r._id) roleIds.push(r._id);
    });
  }

  if (roleIds.length > 0) {
    const roles = await Role.find({ _id: { $in: roleIds }, isActive: true }).populate("permissions");
    roles.forEach((role) => {
      role.permissions.forEach((perm) => {
        permissionSet.add(String(perm._id));
        permissionSet.add(perm.name);
        permissionSet.add(`${perm.resource}:${perm.action}`);
      });
    });
  }

  if (user.role) {
    const roleDoc = await Role.findOne({ name: user.role, isActive: true }).populate("permissions");
    if (roleDoc) {
      roleDoc.permissions.forEach((perm) => {
        permissionSet.add(String(perm._id));
        permissionSet.add(perm.name);
        permissionSet.add(`${perm.resource}:${perm.action}`);
      });
    }
  }

  return permissionSet;
};

export const hasRole = (requiredRoles) => {
  const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }
    const userRoles = getRoleNames(req.user);
    const hasRequiredRole = roles.some((r) => userRoles.includes(r));
    if (hasRequiredRole) return next();
    return res.status(403).json({
      success: false,
      message: "Access denied: Insufficient role",
      data: {},
      err: { message: "Unauthorized access" },
    });
  };
};

export const hasPermission = (requiredPermission) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }
    const permissions = await getUserPermissions(req.user);
    if (permissions.has(requiredPermission) || permissions.has("*")) {
      return next();
    }
    return res.status(403).json({
      success: false,
      message: "Access denied: Insufficient permissions",
      data: {},
      err: { message: "Unauthorized access" },
    });
  };
};

export const hasModuleAccess = (moduleName) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }
    const permissions = await getUserPermissions(req.user);
    const module = await AppModule.findOne({ name: moduleName, isActive: true });
    if (!module) {
      return res.status(404).json({ success: false, message: "Module not found" });
    }
    const modulePerms = await Permission.find({ module: module._id, isActive: true });
    const hasAccess = modulePerms.some((p) => permissions.has(String(p._id)) || permissions.has(p.name) || permissions.has(`${p.resource}:${p.action}`));
    if (hasAccess || permissions.has("*")) {
      return next();
    }
    return res.status(403).json({
      success: false,
      message: "Access denied: No access to this module",
      data: {},
      err: { message: "Unauthorized access" },
    });
  };
};

export const canCreate = (resource) => {
  return hasPermission(`${resource}:create`);
};

export const canRead = (resource) => {
  return hasPermission(`${resource}:read`);
};

export const canUpdate = (resource) => {
  return hasPermission(`${resource}:update`);
};

export const canDelete = (resource) => {
  return hasPermission(`${resource}:delete`);
};

export const canManage = (resource) => {
  return hasPermission(`${resource}:manage`);
};

export const getPermissionsForUser = async (user) => {
  return await getUserPermissions(user);
};

export default {
  hasRole,
  hasPermission,
  hasModuleAccess,
  canCreate,
  canRead,
  canUpdate,
  canDelete,
  canManage,
  getPermissionsForUser,
  getRoleNames,
};