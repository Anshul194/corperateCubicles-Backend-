import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

await mongoose.connect(process.env.MONGO_URI, { dbName: "test" });
console.log("DB:", mongoose.connection.db.databaseName);

const User = mongoose.models.User || mongoose.model("User", new mongoose.Schema({}, { strict: false }));

// Reset trainer password so we can log in and test
const trainer = await User.findOne({ email: "trainer@gmail.com" });
if (trainer) {
  const salt = await bcrypt.genSalt(10);
  trainer.password = await bcrypt.hash("Trainer@123", salt);
  await trainer.save();
  console.log("Trainer password reset to Trainer@123 for testing");
} else {
  console.log("Trainer not found");
}

await mongoose.disconnect();
