import express from "express";
import passport from "passport";
import {
  createFile,
  getFiles,
  getFileById,
  updateFile,
  deleteFile,
} from "../controllers/fileController.js";
import { upload } from "../middlewares/upload-middleware.js";
import accessTokenAutoRefresh from "../middlewares/accessTokenAutoRefresh.js";
import { isAdmin } from "../middlewares/isAdmin.js";

const fileRouter = express.Router();

// All file routes require authentication
fileRouter.use(
  accessTokenAutoRefresh,
  passport.authenticate("jwt", { session: false })
);

// CRUD Routes
fileRouter.post("/", isAdmin, upload.single("file"), createFile); // Create
fileRouter.get("/", getFiles); // Read all
fileRouter.get("/:id", getFileById); // Read one
fileRouter.put("/:id", isAdmin, upload.any(), updateFile); // Update
fileRouter.delete("/:id", isAdmin, deleteFile); // Delete

export default fileRouter;
