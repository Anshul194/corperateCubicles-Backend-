import mongoose from "mongoose";
import { connectToDatabase } from "../db/connect.js";
import AppModule from "../models/AppModule.js";
import Permission from "../models/Permission.js";
import Role from "../models/Role.js";
import RolePermission from "../models/RolePermission.js";

const MODULES = [
  { name: "Dashboard", description: "Admin dashboard & analytics overview", routePrefix: "/", icon: "grid", sortOrder: 1 },
  { name: "Courses", description: "Course creation and management", routePrefix: "/courses", icon: "book", sortOrder: 2 },
  { name: "Categories", description: "Course categories & subcategories", routePrefix: "/categories", icon: "folder", sortOrder: 3 },
  { name: "Banners", description: "Homepage banners management", routePrefix: "/banner", icon: "image", sortOrder: 4 },
  { name: "QuickLinks", description: "Quick links management", routePrefix: "/quick-links", icon: "link", sortOrder: 5 },
  { name: "Events", description: "Events management", routePrefix: "/events", icon: "calendar", sortOrder: 6 },
  { name: "Jobs", description: "Job posts management", routePrefix: "/jobs", icon: "briefcase", sortOrder: 7 },
  { name: "News", description: "News articles management", routePrefix: "/news", icon: "newspaper", sortOrder: 8 },
  { name: "Forums", description: "Forum threads management", routePrefix: "/forum", icon: "chat", sortOrder: 9 },
  { name: "Students", description: "Student management", routePrefix: "/students", icon: "users", sortOrder: 10 },
  { name: "Assignments", description: "Assignment management & submissions", routePrefix: "/assignments", icon: "task", sortOrder: 11 },
  { name: "Queries", description: "Student queries management", routePrefix: "/queries", icon: "question", sortOrder: 12 },
  { name: "Support", description: "Support requests management", routePrefix: "/requests", icon: "headset", sortOrder: 13 },
  { name: "Chat", description: "Chat management", routePrefix: "/chat", icon: "message", sortOrder: 14 },
  { name: "Coupons", description: "Coupon management", routePrefix: "/coupons", icon: "tag", sortOrder: 15 },
  { name: "DeviceApprovals", description: "Device approvals management", routePrefix: "/device-approvals", icon: "shield", sortOrder: 16 },
  { name: "Testimonials", description: "Testimonials management", routePrefix: "/testimonials", icon: "star", sortOrder: 17 },
  { name: "AITool", description: "AI tool", routePrefix: "/ai-tool", icon: "bot", sortOrder: 18 },
  { name: "Leaderboard", description: "Leaderboard settings", routePrefix: "/leaderboard-setting", icon: "chart", sortOrder: 19 },
  { name: "PersonalityTest", description: "Personality test management", routePrefix: "/personality-test", icon: "clipboard", sortOrder: 20 },
  { name: "Security", description: "Security incidents", routePrefix: "/security", icon: "shield", sortOrder: 21 },
  { name: "SalesAnalytics", description: "Sales analytics", routePrefix: "/sales", icon: "chart", sortOrder: 22 },
  { name: "Notifications", description: "Notifications management", routePrefix: "/notifications", icon: "bell", sortOrder: 23 },
  { name: "Certifications", description: "Certificate templates & issuance", routePrefix: "/certificates", icon: "award", sortOrder: 24 },
  { name: "LiveClasses", description: "Live classes & zoom meetings", routePrefix: "/live-classes", icon: "video", sortOrder: 25 },
  { name: "Files", description: "Files & sessions", routePrefix: "/files", icon: "file", sortOrder: 26 },
  { name: "Quizzes", description: "Quiz management", routePrefix: "/quiz", icon: "quiz", sortOrder: 27 },
  { name: "Bundles", description: "Course bundles", routePrefix: "/bundles", icon: "box", sortOrder: 28 },
  { name: "Roles", description: "Roles & permissions management", routePrefix: "/roles", icon: "shield", sortOrder: 29 },
];

const RESOURCES = ["course", "category", "banner", "quickLink", "event", "job", "news", "forum", "student", "assignment", "query", "support", "coupon", "testimonial", "certificate", "quiz", "bundle", "file", "notification", "role", "user", "chat", "deviceApproval", "security", "liveClass", "leaderboard", "personality", "aiTool"];

const ACTION_NAMES = {
  create: "Create",
  read: "View",
  update: "Edit",
  delete: "Delete",
  manage: "Manage",
};

const ACTION_BY_MODULE = {
  Courses: ["create", "read", "update", "delete"],
  Categories: ["create", "read", "update", "delete"],
  Banners: ["create", "read", "update", "delete"],
  QuickLinks: ["create", "read", "update", "delete"],
  Events: ["create", "read", "update", "delete"],
  Jobs: ["create", "read", "update", "delete"],
  News: ["create", "read", "update", "delete"],
  Forums: ["create", "read", "update", "delete"],
  Students: ["create", "read", "update", "delete"],
  Assignments: ["create", "read", "update", "delete"],
  Queries: ["read", "update", "delete"],
  Support: ["read", "update"],
  Chat: ["read", "delete"],
  Coupons: ["create", "read", "update", "delete"],
  DeviceApprovals: ["read", "update"],
  Testimonials: ["create", "read", "update", "delete"],
  AITool: ["manage"],
  Leaderboard: ["manage"],
  PersonalityTest: ["manage"],
  Security: ["read", "update"],
  SalesAnalytics: ["read"],
  Notifications: ["create", "read", "delete"],
  Certifications: ["create", "read", "update", "delete"],
  LiveClasses: ["create", "read", "update", "delete"],
  Files: ["create", "read", "update", "delete"],
  Quizzes: ["create", "read", "update", "delete"],
  Bundles: ["create", "read", "update", "delete"],
  Roles: ["manage"],
  Dashboard: ["read"],
};

// Define which modules each role can access
const ROLE_MODULES = {
  admin: MODULES.map((m) => m.name),
  instructor: ["Dashboard", "Courses", "Assignments", "Quizzes", "Files", "Forums", "Chat", "Students", "LiveClasses", "Certifications"],
  trainer: ["Dashboard", "Courses", "Assignments", "Quizzes", "Files", "Forums", "Chat", "Students", "LiveClasses", "Certifications"],
  student: ["Dashboard", "Courses", "Forums", "Chat", "Quizzes"],
  news_editor: ["News", "Dashboard"],
  moderator: ["Dashboard", "Forums", "Chat", "Queries", "Support", "Students", "News", "Events", "Security"],
};

async function seed() {
  try {
    await connectToDatabase();

    // Upsert modules
    const moduleMap = {};
    for (const mod of MODULES) {
      const existing = await AppModule.findOneAndUpdate(
        { name: mod.name },
        { ...mod, isActive: true },
        { upsert: true, new: true }
      );
      moduleMap[mod.name] = existing._id;
    }
    console.log(`✅ Seeded ${MODULES.length} modules`);

    // Upsert permissions
    const permissionMap = {};
    let permissionCount = 0;
    for (const mod of MODULES) {
      const actions = ACTION_BY_MODULE[mod.name] || ["read"];
      const resource = RESOURCES.find((r) => mod.name.toLowerCase().includes(r.toLowerCase())) || mod.name.toLowerCase().replace(/[^a-z]/g, "");
      for (const action of actions) {
        const permName = `${ACTION_NAMES[action]} ${mod.name}`;
        const existing = await Permission.findOneAndUpdate(
          { name: permName },
          { name: permName, description: `${ACTION_NAMES[action]} ${mod.name}`, module: moduleMap[mod.name], action, resource, isActive: true },
          { upsert: true, new: true }
        );
        permissionMap[permName] = existing._id;
        permissionCount++;
      }
    }
    console.log(`✅ Seeded ${permissionCount} permissions`);

    // Upsert roles
    for (const [roleName, mods] of Object.entries(ROLE_MODULES)) {
      const rolePerms = [];
      for (const modName of mods) {
        const actions = ACTION_BY_MODULE[modName] || ["read"];
        for (const action of actions) {
          const permName = `${ACTION_NAMES[action]} ${modName}`;
          if (permissionMap[permName]) rolePerms.push(permissionMap[permName]);
        }
      }
      const moduleIds = mods.map((m) => moduleMap[m]).filter(Boolean);

      const role = await Role.findOneAndUpdate(
        { name: roleName },
        {
          name: roleName,
          description: `${roleName} role for Corporate Cubicles LMS`,
          permissions: rolePerms,
          modules: moduleIds,
          isDefault: true,
          isActive: true,
        },
        { upsert: true, new: true }
      );
      console.log(`✅ Seeded role: ${roleName} (${rolePerms.length} permissions)`);
    }

    // Sync RolePermission records
    const roles = await Role.find();
    for (const role of roles) {
      for (const permId of role.permissions || []) {
        await RolePermission.findOneAndUpdate(
          { role: role._id, permission: permId },
          { role: role._id, permission: permId },
          { upsert: true, new: true }
        );
      }
    }

    console.log("🎉 Role & permission seeding completed!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Seeding failed:", err);
    process.exit(1);
  }
}

seed();