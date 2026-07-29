//utils/notification.js 
import admin from "../config/firebase.js";


class NotificationService {
  async sendPushNotification(fcmTokens, data, webPushLink = null) {
    try {
        if (!fcmTokens || (Array.isArray(fcmTokens) && fcmTokens.length === 0)) {
            return { success: false, message: "No FCM token(s) provided" };
        }

        // Ensure tokens are in array form
        const tokens = Array.isArray(fcmTokens) ? fcmTokens : [fcmTokens];

        const message = {
            data: {
                title: String(data?.title || ""),
                body: String(data?.description || ""),
                image: String(data?.image || ""),
                order_id: String(data?.order_id || ""),
                type: String(data?.type || ""),
                data_id: String(data?.data_id || ""),
                advertisement_id: String(data?.advertisement_id || ""),
                conversation_id: String(data?.conversation_id || ""),
                referenceId: String(data?.referenceId || ""),
                module_id: String(data?.module_id || ""),
                sender_type: String(data?.sender_type || ""),
                order_type: String(data?.order_type || ""),
                courseId: String(data?.courseId || ""), // Add course support
                jobId: String(data?.jobId || ""), // Add job support
                jobTitle: String(data?.jobTitle || ""), // Add job title
                category: String(data?.category || ""), // Add category
                adminName: String(data?.adminName || ""), // Add admin name for rejections
                click_action: webPushLink ? String(webPushLink) : "",
                sound: "notification.wav",
            },
            notification: {
                title: String(data?.title || ""),
                body: String(data?.description || ""),
                image: String(data?.image || ""),
            },
            android: {
                notification: {
                    channelId: "6ammart", // same as Laravel
                },
            },
            apns: {
                payload: {
                    aps: {
                        sound: "notification.wav",
                    },
                },
            },
            tokens: tokens, // sending to multiple tokens
        };

        // Send notification
        const response = await admin.messaging().sendEachForMulticast(message);
        //console.log("FCM Response:", response);

        return {
            success: true,
            sent: response.successCount,
            failed: response.failureCount,
            responses: response.responses,
        };
    } catch (error) {
        console.error("FCM Error:", error);
        return { success: false, error: error.message };
    }
}
}

export default new NotificationService();