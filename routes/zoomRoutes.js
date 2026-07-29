import express from "express";
import {
    createMeeting,
    getMeetings,
    getMeetingById,
    deleteMeeting,
    getMeetingParticipants,
    getPastMeetingsReport,
    generateSignature,
    generateVideoSdkToken,
} from "../controllers/zoomController.js";
import passport from "passport";
import accessTokenAutoRefresh from "../middlewares/accessTokenAutoRefresh.js";
import { isAdmin } from "../middlewares/isAdmin.js";

const router = express.Router();

// Middleware to ensure user is authenticated
// Using passport JWT as per standard in this app
const auth = passport.authenticate("jwt", { session: false });
// Admin/instructor-only stack (matches sibling admin routes). Only the admin
// panel (cookie auth) consumes these endpoints — students must not be able to
// create/delete meetings or read participant lists / host start URLs / reports.
const adminOnly = [accessTokenAutoRefresh, auth, isAdmin];

// Admin/instructor only: meeting lifecycle + reporting (admin panel zoomSlice.ts)
router.post("/meetings", ...adminOnly, createMeeting);
router.delete("/meetings/:id", ...adminOnly, deleteMeeting);
// getMeetingById proxies the Zoom API response, which includes the host
// start_url — admin/instructor only (only the admin panel calls it).
router.get("/meetings/:id", ...adminOnly, getMeetingById);
router.get("/meetings/:id/participants", ...adminOnly, getMeetingParticipants);
router.get("/reports/meetings", ...adminOnly, getPastMeetingsReport);

// Any authenticated user: students list upcoming classes (controller scopes
// students to their enrollments) and mint a JOIN (attendee) SDK signature.
// generateSignature clamps role to 0 for non-admin/instructor callers.
router.get("/meetings", auth, getMeetings);
router.post("/signature", auth, generateSignature);
// Video SDK JWT (app_key/tpc/role_type payload) for the mobile app's embedded
// live-class player. generateVideoSdkToken clamps role_type to 0 (participant)
// for non-admin/instructor callers and 503s when SDK creds are not configured.
router.post("/video-sdk/token", auth, generateVideoSdkToken);

export default router;
