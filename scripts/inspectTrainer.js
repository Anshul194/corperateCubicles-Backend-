import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

await mongoose.connect(process.env.MONGO_URI, { dbName: "test" });
console.log("DB:", mongoose.connection.db.databaseName);

const Role = mongoose.models.Role || mongoose.model("Role", new mongoose.Schema({}, { strict: false }));
const AppModule = mongoose.models.AppModule || mongoose.model("AppModule", new mongoose.Schema({}, { strict: false }));
const Permission = mongoose.models.Permission || mongoose.model("Permission", new mongoose.Schema({}, { strict: false }));

const trainer = await Role.findOne({ name: "trainer" }).lean();
console.log("\nTRAINER role:", JSON.stringify({ id: trainer._id, name: trainer.name, perms: trainer.permissions, modules: trainer.modules }, null, 2));

const mods = await AppModule.find({ _id: { $in: trainer.modules || [] } }).select("name").lean();
console.log("\nTrainer modules:", mods.map((m) => m.name));

const perms = await Permission.find({ _id: { $in: trainer.permissions || [] } }).select("name resource action").lean();
console.log("\nTrainer permission names:", perms.map((p) => p.name).join(", "));

await mongoose.disconnect();
