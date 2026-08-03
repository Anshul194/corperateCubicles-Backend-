import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

await mongoose.connect(process.env.MONGO_URI, { dbName: "test" });

const User = mongoose.models.User || mongoose.model("User", new mongoose.Schema({}, { strict: false }));
const u = await User.findOne({ email: "trainer@gmail.com" }).lean();
if (u) {
  console.log("trainer doc keys:", Object.keys(u));
  console.log("role:", u.role, "roles:", JSON.stringify(u.roles), "status:", u.status, "is_verify:", u.is_verify);
  console.log("passwordHash length:", u.password ? u.password.length : 0);
  const ok = await bcrypt.compare("Trainer@123", u.password);
  console.log("bcrypt compare Trainer@123:", ok);
} else {
  console.log("not found");
}
await mongoose.disconnect();
