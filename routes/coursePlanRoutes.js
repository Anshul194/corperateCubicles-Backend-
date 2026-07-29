import express from "express";
import {
  createCoursePlan,
  getAllCoursePlans,
  getCoursePlanById,
  updateCoursePlan,
  deleteCoursePlan
} from "../controllers/CoursePlanController.js";
import accessTokenAutoRefresh from "../middlewares/accessTokenAutoRefresh.js";
import passport from "passport";
import { isAdmin } from "../middlewares/isAdmin.js";

const router = express.Router();

router.post(
  "/",
  accessTokenAutoRefresh,
  passport.authenticate("jwt", { session: false }),
  isAdmin,
  createCoursePlan
);

router.get("/", getAllCoursePlans);
router.get("/:id", getCoursePlanById);

router.put(
  "/:id",
  accessTokenAutoRefresh,
  passport.authenticate("jwt", { session: false }),
  isAdmin,
  updateCoursePlan
);

router.delete(
  "/:id",
  accessTokenAutoRefresh,
  passport.authenticate("jwt", { session: false }),
  isAdmin,
  deleteCoursePlan
);

export default router;