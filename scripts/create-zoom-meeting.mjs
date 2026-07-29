/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║           CREATE ZOOM MEETING STANDALONE                    ║
 * ║  Directly hits Zoom API and saves to MongoDB                 ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import 'dotenv/config';
import axios from 'axios';
import mongoose from 'mongoose';

// ── MODELS ────────────────────────────────────────────────────────────────────
const zoomMeetingSchema = new mongoose.Schema({
    topic: String,
    type: Number,
    start_time: Date,
    duration: Number,
    timezone: String,
    password: String,
    agenda: String,
    meeting_id: String,
    join_url: String,
    start_url: String,
    createdBy: mongoose.Schema.Types.ObjectId
}, { timestamps: true });

const ZoomMeeting = mongoose.models.ZoomMeeting || mongoose.model('ZoomMeeting', zoomMeetingSchema);

// ── TOKEN GENERATOR ───────────────────────────────────────────────────────────
const generateZoomToken = async () => {
    const { ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET } = process.env;
    const tokenUrl = `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${ZOOM_ACCOUNT_ID}`;
    const credentials = Buffer.from(`${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`).toString("base64");

    const response = await axios.post(tokenUrl, {}, {
        headers: {
            Authorization: `Basic ${credentials}`,
            "Content-Type": "application/x-www-form-urlencoded",
        },
    });
    return response.data.access_token;
};

// ── MAIN ──────────────────────────────────────────────────────────────────────
async function createMeeting() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('🔌 Connected to MongoDB');

        const token = await generateZoomToken();
        console.log('🔑 Zoom Token Generated');

        const meetingParams = {
            topic: "Live Class via Script",
            type: 2,
            start_time: new Date(Date.now() + 3600000).toISOString(), // Starts in 1 hour
            duration: 60,
            timezone: "Asia/Kolkata",
            password: "ed123",
            agenda: "Directly created via automation script",
            settings: {
                host_video: true,
                participant_video: true,
                join_before_host: true,
                mute_upon_entry: true,
                auto_recording: "cloud"
            }
        };

        console.log('🚀 Creating Zoom Meeting...');
        const response = await axios.post(
            "https://api.zoom.us/v2/users/me/meetings",
            meetingParams,
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
            }
        );

        const newMeeting = new ZoomMeeting({
            topic: meetingParams.topic,
            type: meetingParams.type,
            start_time: meetingParams.start_time,
            duration: meetingParams.duration,
            timezone: meetingParams.timezone,
            password: meetingParams.password,
            agenda: meetingParams.agenda,
            meeting_id: response.data.id,
            join_url: response.data.join_url,
            start_url: response.data.start_url
        });

        await newMeeting.save();

        console.log('\n✅ Zoom Meeting Created Successfully!');
        console.log('────────────────────────────────────');
        console.log(`Topic:    ${newMeeting.topic}`);
        console.log(`ID:       ${newMeeting.meeting_id}`);
        console.log(`Join URL: ${newMeeting.join_url}`);
        console.log('────────────────────────────────────');

    } catch (error) {
        console.error('❌ Error details:', error.response?.data || error.message);
    } finally {
        await mongoose.disconnect();
    }
}

createMeeting();
