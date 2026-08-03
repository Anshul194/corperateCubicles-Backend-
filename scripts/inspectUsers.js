import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const mongoURI = process.env.MONGO_URI;
console.log("URI host:", (mongoURI || "").split("@")[1]?.split("/")[0]);

try {
  await mongoose.connect(mongoURI, { dbName: "test" });
  console.log("DB:", mongoose.connection.db.databaseName);

  const User = mongoose.models.User || mongoose.model("User", new mongoose.Schema({}, { strict: false }));
  const Role = mongoose.models.Role || mongoose.model("Role", new mongoose.Schema({}, { strict: false }));

  const roles = await Role.find({}).select("name isActive permissions modules").lean();
  console.log("\n=== ROLES ===");
  roles.forEach((r) => {
    console.log(`- ${r.name} (${r.isActive}) perms:${(r.permissions || []).length} modules:${(r.modules || []).length} id:${r._id}`);
  });

  const users = await User.find({}).select("fullName email role roles is_verify").lean();
  console.log("\n=== USERS ===");
  users.forEach((u) => {
    console.log(`- ${u.email} | role:${u.role} | roles:${JSON.stringify(u.roles)} | verify:${u.is_verify}`);
  });

  await mongoose.disconnect();
} catch (e) {
  console.error("ERR:", e.message);
  process.exit(1);
}
