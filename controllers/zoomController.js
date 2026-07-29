import axios from "axios";
import crypto from "crypto";
import ZoomMeeting from "../models/ZoomMeeting.js";
import CourseEnrollment from "../models/CourseEnrollment.js";
import CourseBundle from "../models/CourseBundle.js";
import User from "../models/user.js";
import { hasAdminRole } from "../middlewares/isAdmin.js";

// Helper function to generate Zoom Server-to-Server OAuth Token
const generateZoomToken = async () => {
    try {
        const accountId = process.env.ZOOM_ACCOUNT_ID;
        const clientId = process.env.ZOOM_CLIENT_ID;
        const clientSecret = process.env.ZOOM_CLIENT_SECRET;

        if (!accountId || !clientId || !clientSecret) {
            throw new Error("Zoom credentials are not configured in environment variables.");
        }

        const tokenUrl = `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${accountId}`;
        const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

        const response = await axios.post(
            tokenUrl,
            {},
            {
                headers: {
                    Authorization: `Basic ${credentials}`,
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            }
        );

        return response.data.access_token;
    } catch (error) {
        console.error("Error generating Zoom token:", error.response?.data || error.message);
        throw new Error("Failed to generate Zoom token");
    }
};

/**
 * @desc    Create a new Zoom Meeting
 * @route   POST /zoom/meetings
 * @access  Private
 */
export const createMeeting = async (req, res) => {
    try {
        const { topic, type, start_time, duration, timezone, password, agenda, courseId } = req.body;
        const token = await generateZoomToken();

        const meetingData = {
            topic: topic || "New Live Class",
            type: type || 2, // 2 for Scheduled meeting
            start_time,
            duration: duration || 60, // in minutes
            timezone: timezone || "Asia/Kolkata",
            password: password || "123456",
            agenda: agenda || "Live session",
            settings: {
                host_video: true,
                participant_video: true,
                join_before_host: true,
                mute_upon_entry: true,
                meeting_authentication: false,
                watermark: false,
                use_pmi: false,
                approval_type: 2,
                audio: "both",
                auto_recording: "cloud", // or "local", "none"
            },
        };

        const zoomHostId = process.env.ZOOM_ACCOUNT_EMAIL || process.env.ZOOM_ACCOUNT_ID;
        const response = await axios.post(
            `https://api.zoom.us/v2/users/${encodeURIComponent(zoomHostId)}/meetings`,
            meetingData,
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
            }
        );

        // Save data to database
        const newMeeting = new ZoomMeeting({
            topic: meetingData.topic,
            type: meetingData.type,
            start_time: meetingData.start_time,
            duration: meetingData.duration,
            timezone: meetingData.timezone,
            password: meetingData.password,
            agenda: meetingData.agenda,
            meeting_id: response.data.id,
            join_url: response.data.join_url,
            start_url: response.data.start_url,
            createdBy: req.user?._id, // assumes passport jwt binds user to req
            courseId: courseId || null
        });

        await newMeeting.save();

        res.status(201).json({
            success: true,
            message: "Zoom meeting created successfully",
            meeting: newMeeting, // returning mongodb object along with zoom id
        });
    } catch (error) {
        console.error("Error creating Zoom meeting:", error.response?.data || error.message);
        res.status(500).json({
            success: false,
            message: "Failed to create Zoom meeting",
            error: error.response?.data || error.message,
        });
    }
};

/**
 * @desc    Get List of Meetings
 * @route   GET /zoom/meetings
 * @access  Private
 */
export const getMeetings = async (req, res) => {
    try {
        const { role, _id: userId } = req.user;
        const { courseId, type } = req.query;

        let query = {};

        // If a specific courseId is requested, we filter by it regardless of role (but students can only see if enrolled)
        if (courseId) {
            query.courseId = courseId;
        }

        // Student restriction
        if (role === 'student') {
            // Get all enrollments
            const enrollments = await CourseEnrollment.find({
                userId: userId,
                status: 'active'
            }).populate('courseBundleId');

            let enrolledCourseIds = enrollments
                .filter(e => e.courseId)
                .map(e => e.courseId.toString());

            // Add courses from bundles
            for (const enrollment of enrollments) {
                if (enrollment.courseBundleId && enrollment.courseBundleId.courses) {
                    const bundleCourses = enrollment.courseBundleId.courses.map(id => id.toString());
                    enrolledCourseIds = [...new Set([...enrolledCourseIds, ...bundleCourses])];
                }
            }

            if (courseId) {
                // Check if student is actually enrolled in this course (directly or via bundle)
                const isEnrolled = enrolledCourseIds.includes(courseId.toString());
                if (!isEnrolled) {
                    return res.status(200).json({
                        success: true,
                        meetings: { meetings: [] }
                    });
                }
            } else {
                // Return all meetings for any of the enrolled courses
                query.courseId = { $in: enrolledCourseIds };
            }
        } else if (role === 'instructor') {
            // Instructors might only want to see their own meetings or meetings for courses they teach.
            // For now, let's allow them to see all or filter by course if they teach it.
            // Admin sees all.
        }

        let meetings = await ZoomMeeting.find(query).sort({ start_time: -1 });

        // If type is 'upcoming', filter out meetings that have already ended
        if (type === 'upcoming') {
            const now = new Date();
            meetings = meetings.filter(m => {
                const startTime = new Date(m.start_time);
                const endTime = new Date(startTime.getTime() + (m.duration * 60 * 1000));
                return now < endTime;
            });
        }

        res.status(200).json({
            success: true,
            meetings: {
                meetings: meetings.map(m => ({
                    id: m.meeting_id,
                    topic: m.topic,
                    start_time: m.start_time,
                    duration: m.duration,
                    password: m.password,
                    join_url: m.join_url,
                    courseId: m.courseId
                }))
            }
        });
    } catch (error) {
        console.error("Error fetching meetings:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch meetings",
            error: error.message
        });
    }
}

/**
 * @desc    Get Meeting Details by ID
 * @route   GET /zoom/meetings/:id
 * @access  Private
 */
export const getMeetingById = async (req, res) => {
    try {
        const { id } = req.params;
        const token = await generateZoomToken();

        const response = await axios.get(
            `https://api.zoom.us/v2/meetings/${id}`,
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            }
        );

        res.status(200).json({
            success: true,
            meeting: response.data,
        });
    } catch (error) {
        console.error("Error fetching Zoom meeting details:", error.response?.data || error.message);
        res.status(500).json({
            success: false,
            message: "Failed to fetch Zoom meeting details",
            error: error.response?.data || error.message,
        });
    }
};

/**
 * @desc    Delete a Zoom Meeting
 * @route   DELETE /zoom/meetings/:id
 * @access  Private
 */
export const deleteMeeting = async (req, res) => {
    try {
        const { id } = req.params;
        const token = await generateZoomToken();

        await axios.delete(
            `https://api.zoom.us/v2/meetings/${id}`,
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            }
        );
        // Also delete from MongoDB
        await ZoomMeeting.findOneAndDelete({ meeting_id: id });

        res.status(200).json({
            success: true,
            message: "Zoom meeting deleted successfully",
        });
    } catch (error) {
        console.error("Error deleting Zoom meeting:", error.response?.data || error.message);
        res.status(500).json({
            success: false,
            message: "Failed to delete Zoom meeting",
            error: error.response?.data || error.message,
        });
    }
};

/**
 * @desc    Get Meeting Participants (Reports)
 * @route   GET /zoom/meetings/:id/participants
 * @access  Private
 */
export const getMeetingParticipants = async (req, res) => {
    try {
        // Zoom requires the meeting UUID (not numeric ID) for /report/meetings/{uuid}/participants
        // to get ALL participants from a past meeting.
        // uuid must be double-encoded if it starts with '/' or contains '//'
        const uuid = req.query.uuid || req.params.id;

        let encodedUuid = encodeURIComponent(uuid);
        if (uuid.startsWith('/') || uuid.includes('//')) {
            encodedUuid = encodeURIComponent(encodedUuid); // double-encode
        }

        const token = await generateZoomToken();

        let allParticipants = [];
        let nextPageToken = "";
        const pageSize = 300; // Zoom's max per page

        do {
            const url = `https://api.zoom.us/v2/report/meetings/${encodedUuid}/participants?page_size=${pageSize}${nextPageToken ? `&next_page_token=${nextPageToken}` : ""}`;

            const response = await axios.get(url, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            const data = response.data;
            allParticipants = allParticipants.concat(data.participants || []);
            nextPageToken = data.next_page_token || "";

        } while (nextPageToken);

        res.status(200).json({
            success: true,
            participants: allParticipants,
            total_records: allParticipants.length,
        });
    } catch (error) {
        console.error("Error fetching Zoom participants:", error.response?.data || error.message);
        res.status(500).json({
            success: false,
            message: "Failed to fetch participants. Note: This only works for meetings that have ended.",
            error: error.response?.data || error.message,
        });
    }
};

/**
 * @desc    Get All Past Meetings Report
 * @route   GET /zoom/reports/meetings
 * @access  Private
 */
export const getPastMeetingsReport = async (req, res) => {
    try {
        const token = await generateZoomToken();
        const from = req.query.from || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // last 7 days
        const to = req.query.to || new Date().toISOString().split('T')[0];

        // With Server-to-Server OAuth, "me" is not a valid user identifier.
        // Use the Zoom host's email address (or account ID as fallback).
        const zoomUserId = process.env.ZOOM_ACCOUNT_EMAIL || process.env.ZOOM_ACCOUNT_ID;
        if (!zoomUserId) throw new Error("ZOOM_ACCOUNT_EMAIL or ZOOM_ACCOUNT_ID must be set in environment variables.");

        const response = await axios.get(
            `https://api.zoom.us/v2/report/users/${encodeURIComponent(zoomUserId)}/meetings?from=${from}&to=${to}`,
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            }
        );

        res.status(200).json({
            success: true,
            meetings: response.data.meetings,
        });
    } catch (error) {
        console.error("Error fetching Zoom report:", error.response?.data || error.message);
        res.status(500).json({
            success: false,
            message: "Failed to fetch past meetings report",
            error: error.response?.data || error.message,
        });
    }
};

/**
 * @desc    Generate Zoom SDK Signature for Web Embed
 * @route   POST /zoom/signature
 * @access  Private
 */
export const generateSignature = async (req, res) => {
    try {
        const { meetingNumber, role: requestedRole } = req.body;

        // SECURITY: role 1 in a Meeting SDK signature grants HOST privileges.
        // Students may only ever mint attendee (role 0) signatures to JOIN a
        // class; only admins/instructors may request a host signature.
        const role = hasAdminRole(req.user) && Number(requestedRole) === 1 ? 1 : 0;

        const iat = Math.round(new Date().getTime() / 1000) - 30;
        const exp = iat + 60 * 60 * 2;

        // MUST use the dedicated Meeting SDK credentials — NOT the Server-to-Server OAuth creds.
        // Using OAuth creds here causes Zoom to treat every attendee as the host account,
        // triggering "You are hosting another meeting" dialogs.
        const sdkKey = process.env.ZOOM_SDK_KEY;
        const sdkSecret = process.env.ZOOM_SDK_SECRET;

        if (!sdkKey || !sdkSecret) {
            throw new Error('ZOOM_SDK_KEY and ZOOM_SDK_SECRET must be set in environment variables. Do NOT use OAuth Client ID/Secret for SDK signatures.');
        }

        console.log(`[ZOOM DEBUG] Generating signature with SDK Key: ${sdkKey.substring(0, 8)}... | role: ${role ?? 0}`);

        // Ensure meetingNumber is a Number type as required by Zoom
        const mn = parseInt(meetingNumber);

        const oHeader = { alg: 'HS256', typ: 'JWT' };
        const oPayload = {
            sdkKey: sdkKey,
            appKey: sdkKey, // Added for compatibility
            mn: mn,
            role: role || 0,
            iat: iat,
            exp: exp,
            tokenExp: exp
        };

        const sHeader = JSON.stringify(oHeader);
        const sPayload = JSON.stringify(oPayload);

        const base64Header = Buffer.from(sHeader).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
        const base64Payload = Buffer.from(sPayload).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

        const signature = crypto
            .createHmac('sha256', sdkSecret)
            .update(`${base64Header}.${base64Payload}`)
            .digest('base64')
            .replace(/=/g, '')
            .replace(/\+/g, '-')
            .replace(/\//g, '_');

        const jwt = `${base64Header}.${base64Payload}.${signature}`;

        res.status(200).json({
            success: true,
            signature: jwt,
            sdkKey: sdkKey
        });
    } catch (error) {
        console.error("Error generating Zoom signature:", error.message);
        res.status(500).json({
            success: false,
            message: "Failed to generate Zoom signature",
            error: error.message,
        });
    }
};

// Base64url-encode a string (JWT segments must not contain =, + or /).
const base64UrlEncode = (str) =>
    Buffer.from(str)
        .toString("base64")
        .replace(/=/g, "")
        .replace(/\+/g, "-")
        .replace(/\//g, "_");

/**
 * @desc    Generate a Zoom VIDEO SDK JWT (NOT a Meeting SDK signature).
 *          The Video SDK uses a different payload (app_key/tpc/role_type/version)
 *          than the Meeting SDK (sdkKey/mn/role) — consumed by the Flutter app's
 *          flutter_zoom_videosdk joinSession flow.
 * @route   POST /zoom/video-sdk/token
 * @access  Private (any authenticated user; host role only for admin/instructor)
 */
export const generateVideoSdkToken = async (req, res) => {
    try {
        const sdkKey = process.env.ZOOM_SDK_KEY;
        const sdkSecret = process.env.ZOOM_SDK_SECRET;

        if (!sdkKey || !sdkSecret) {
            return res.status(503).json({
                success: false,
                message:
                    "Zoom Video SDK is not configured on the server: ZOOM_SDK_KEY and ZOOM_SDK_SECRET environment variables are missing.",
            });
        }

        const { sessionName, meetingNumber, roleType, role } = req.body || {};

        // tpc = session name. The Flutter client sends both sessionName and
        // meetingNumber (same value); accept either.
        const tpc = String(sessionName || meetingNumber || "").trim();
        if (!tpc || tpc.length > 200) {
            return res.status(400).json({
                success: false,
                message:
                    "sessionName is required (max 200 characters) to generate a Video SDK token",
            });
        }

        // SECURITY: role_type 1 grants HOST privileges in a Video SDK session.
        // Students may only ever mint participant (role_type 0) tokens.
        const requestedRole = Number(roleType ?? role ?? 0);
        const role_type = hasAdminRole(req.user) && requestedRole === 1 ? 1 : 0;

        // exp must be between 30 minutes and 48 hours after iat per Zoom docs.
        const iat = Math.round(Date.now() / 1000) - 30;
        const exp = iat + 60 * 60 * 2; // 2 hours, well within the 48h cap

        const header = base64UrlEncode(
            JSON.stringify({ alg: "HS256", typ: "JWT" })
        );
        const payload = base64UrlEncode(
            JSON.stringify({
                app_key: sdkKey,
                tpc,
                role_type,
                version: 1,
                iat,
                exp,
            })
        );

        const signature = crypto
            .createHmac("sha256", sdkSecret)
            .update(`${header}.${payload}`)
            .digest("base64")
            .replace(/=/g, "")
            .replace(/\+/g, "-")
            .replace(/\//g, "_");

        const token = `${header}.${payload}.${signature}`;

        return res.status(200).json({
            success: true,
            message: "Video SDK token generated",
            token,
            signature: token, // legacy key read by older clients
            sdkKey,
            sessionName: tpc,
            role: role_type,
        });
    } catch (error) {
        console.error("Error generating Zoom Video SDK token:", error.message);
        return res.status(500).json({
            success: false,
            message: "Failed to generate Zoom Video SDK token",
            error: error.message,
        });
    }
};
