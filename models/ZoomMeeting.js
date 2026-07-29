import mongoose from "mongoose";

const zoomMeetingSchema = new mongoose.Schema(
    {
        topic: {
            type: String,
            required: true,
            trim: true,
        },
        type: {
            type: Number,
            default: 2, // 2 for scheduled
        },
        start_time: {
            type: Date,
            required: true,
        },
        duration: {
            type: Number, // in minutes
            required: true,
        },
        timezone: {
            type: String,
            default: "Asia/Kolkata",
        },
        password: {
            type: String,
            trim: true,
        },
        agenda: {
            type: String,
            trim: true,
        },
        meeting_id: {
            type: String, // Zoom generated meeting ID
            required: true,
        },
        join_url: {
            type: String, // Zoom join url
            required: true,
        },
        start_url: {
            type: String, // Zoom host start url
            required: true,
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        courseId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Course",
            required: false, // Optional for global meetings, but will be used for course-wise filtering
        },
    },
    { timestamps: true }
);

const ZoomMeeting = mongoose.models.ZoomMeeting || mongoose.model("ZoomMeeting", zoomMeetingSchema);

export default ZoomMeeting;
