import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const generateZoomToken = async () => {
    try {
        const accountId = process.env.ZOOM_ACCOUNT_ID;
        const clientId = process.env.ZOOM_CLIENT_ID;
        const clientSecret = process.env.ZOOM_CLIENT_SECRET;

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

const testCreateMeeting = async () => {
    try {
        const token = await generateZoomToken();
        console.log("Token generated successfully:", token.substring(0, 15) + "...");

        const meetingData = {
            topic: "Test Live Class from Script",
            type: 2,
            start_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            duration: 60,
            timezone: "Asia/Kolkata",
            password: "test",
            agenda: "Testing automation",
            settings: {
                host_video: true,
                participant_video: true,
                join_before_host: true,
                mute_upon_entry: true,
                watermark: false,
                use_pmi: false,
                approval_type: 0,
                audio: "both",
                auto_recording: "cloud",
            },
        };

        const response = await axios.post(
            "https://api.zoom.us/v2/users/me/meetings",
            meetingData,
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
            }
        );

        console.log("MEETING_CREATED_SUCCESSFULLY");
        console.log("Join URL:", response.data.join_url);
        console.log("Start URL:", response.data.start_url);
        console.log("Meeting ID:", response.data.id);
        console.log("Password:", response.data.password);
    } catch (error) {
        console.error("Failed to create meeting:", error.response?.data || error.message);
    }
};

testCreateMeeting();
