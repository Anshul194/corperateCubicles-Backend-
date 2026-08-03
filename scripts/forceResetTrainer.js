import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

await mongoose.connect(process.env.MONGO_URI, { dbName: "test" });

const User = mongoose.models.User || mongoose.model("User", new mongoose.Schema({}, { strict: false }));
const u = await User.findOne({ email: "trainer@gmail.com" });
if (u) {
  const hash = await bcrypt.hash("Trainer@123", 10);
  u.password = hash;
  await u.save();
  const again = await User.findOne({ email: "trainer@gmail.com" }).lean();
  const ok = await bcrypt.compare("Trainer@123", again.password);
  console.log("stored hash:", again.password);
  console.log("compare right after save:", ok);
} else {
  console.log("not found");
}
await mongoose.disconnect();
