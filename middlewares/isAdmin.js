// Staff content-creator roles permitted to reach admin-backend endpoints.
// SECURITY: `student` / `guest` are intentionally NOT here — they authenticate
// on the public frontend and must not reach admin actions. The set below mirrors
// ALLOWED_ROLES from the frontend (src/utils/permissions.ts) but is kept to the
// content-creator/staff roles (admin, superadmin, instructor, trainer) so that a
// trainer — who is a content creator with the same permissions as an instructor
// — can create/edit/delete courses and own them. Narrow staff roles such as
// `moderator` / `news_editor` are deliberately excluded from the broad backend
// gate so their existing, more limited, behavior is unchanged. Per-route action
// scoping (e.g. role management) still requires stricter checks in the relevant
// controllers.
const ADMIN_ROLES = ["admin", "ADMIN", "superadmin", "instructor", "trainer"];

// Exported so controllers can make inline admin checks (e.g. allowing an
// explicit ?userid override only for admins in checkoutController).
export const hasAdminRole = (user) => {
  if (!user) return false;
  const roles = new Set();

  // String role field
  if (user.role) roles.add(String(user.role).toLowerCase());

  // roles array may contain role-name strings or populated/raw role docs/IDs.
  const rawRoles = Array.isArray(user.roles) ? user.roles : [user.roles];
  rawRoles.forEach((r) => {
    if (typeof r === "string") {
      roles.add(r.toLowerCase());
    } else if (r && typeof r === "object") {
      if (r.name) roles.add(String(r.name).toLowerCase());
      // role docs often carry a `code`/`slug` too
      if (r.code) roles.add(String(r.code).toLowerCase());
      if (r.slug) roles.add(String(r.slug).toLowerCase());
    }
  });

  return Array.from(roles).some((r) => ADMIN_ROLES.includes(r));
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
