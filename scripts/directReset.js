import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

await mongoose.connect(process.env.MONGO_URI, { dbName: "test" });

const hash = bcrypt.hashSync("Trainer@123", 10);
const db = mongoose.connection.db;
const res = await db.collection("users").updateOne(
  { email: "trainer@gmail.com" },
  { $set: { password: hash } }
);
console.log("matched:", res.matchedCount, "modified:", res.modifiedCount);

const doc = await db.collection("users").findOne({ email: "trainer@gmail.com" });
console.log("stored hash:", doc.password);
console.log("compare:", bcrypt.compareSync("Trainer@123", doc.password));
console.log("role:", doc.role, "roles:", JSON.stringify(doc.roles));

await mongoose.disconnect();
