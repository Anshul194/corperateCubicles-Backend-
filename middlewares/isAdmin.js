// Roles permitted to access admin-only endpoints.
// SECURITY: `student` must never be here — students authenticate on the public
// frontend and must not reach admin actions. Previously this allowed `student`,
// which let any logged-in user perform admin operations (privilege escalation).
const ADMIN_ROLES = ['admin', 'instructor'];

// Exported so controllers can make inline admin checks (e.g. allowing an
// explicit ?userid override only for admins in checkoutController).
export const hasAdminRole = (user) => {
  if (!user) return false;
  const roles = Array.isArray(user.roles) ? user.roles : [user.role || user.roles];
  return roles.some((r) => ADMIN_ROLES.includes(r));
};

export const isAdmin = (req, res, next) => {
  if (hasAdminRole(req.user)) {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: 'Access denied: Admin or Instructor role required',
    data: {},
    err: {
      message: 'Unauthorized access',
      userRole: req.user?.role || 'not authenticated',
    },
  });
};