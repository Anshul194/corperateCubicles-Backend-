/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║           TEST BULK EMAIL SCRIPT (v3)                       ║
 * ║  Sends a test email to lapaasindia@gmail.com                ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import 'dotenv/config';
import emailService from '../utils/emailService.js';

const TEST_EMAIL = 'lapaasindia@gmail.com';
const TEST_NAME = 'Lapaas India';

const HTML_TEMPLATE = (name, email) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Edrilla</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7f6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); border: 1px solid #e0e0e0; }
        .header { background-color: #000000; color: #ffffff; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 28px; letter-spacing: 2px; }
        .content { padding: 40px; line-height: 1.6; }
        .greeting { font-size: 20px; font-weight: bold; margin-bottom: 20px; color: #000; }
        .credentials { background-color: #f9f9f9; border-left: 4px solid #93bb3d; padding: 20px; margin: 20px 0; border-radius: 4px; }
        .credentials p { margin: 5px 0; font-family: monospace; font-size: 15px; }
        .info-box { background-color: #f1f8e9; border: 1px solid #93bb3d; padding: 20px; border-radius: 8px; margin: 30px 0; }
        .info-box h3 { margin-top: 0; color: #2e7d32; font-size: 18px; }
        .download-box { background-color: #000; color: #fff; padding: 25px; border-radius: 8px; text-align: center; margin: 30px 0; }
        .download-box h3 { margin-top: 0; color: #93bb3d; }
        .badge-container { margin-top: 20px; }
        .badge { display: inline-block; margin: 10px; }
        .footer { padding: 20px; text-align: center; font-size: 13px; color: #888; background-color: #f9f9f9; border-top: 1px solid #eee; }
        .support-link { color: #93bb3d; text-decoration: none; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>EDRILLA</h1>
            <p>Empowering Your Learning Journey</p>
        </div>
        <div class="content">
            <div class="greeting">Hi ${name},</div>
            <p>Congratulations! You have been successfully enrolled in the <strong>AI Live Classes</strong>.</p>
            
            <p>We are excited to have you on board. Below are your access details to get started:</p>

            <div class="credentials">
                <p><strong>Login Email:</strong> ${email}</p>
                <p style="margin-top: 10px; font-family: 'Segoe UI', sans-serif;"><strong>Set your password:</strong> Go to <a href="https://edrilla.com/login" class="support-link">edrilla.com</a> &rarr; <strong>Log In</strong> &rarr; <strong>Forgot Password</strong>, enter this email, and choose your own password. Already registered on Edrilla? Use your existing password.</p>
            </div>

            <div class="info-box">
                <h3>📢 Live Class Access</h3>
                <p>To attend the live sessions, please join the <strong>Chat Community</strong> inside the app. You will find all the <strong>Zoom links</strong> and schedules posted there directly.</p>
            </div>

            <div class="download-box">
                <h3>Download the Edrilla App</h3>
                <p>Get the app to access your course and join the community chat.</p>
                <div class="badge-container">
                    <a href="https://play.google.com/store/apps/details?id=com.edrilla.app" class="badge">
                        <img src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png" alt="Get it on Google Play" height="60">
                    </a>
                    <a href="https://apps.apple.com/in/app/edrilla-business-booster/id6751890495" class="badge">
                        <img src="https://developer.apple.com/app-store/marketing/guidelines/images/badge-download-on-the-app-store.svg" alt="Download on the App Store" height="40" style="margin-bottom: 9px;">
                    </a>
                </div>
            </div>
            
            <p>For any queries, simply reply to this email or contact us at <a href="mailto:support@edrilla.com" class="support-link">support@edrilla.com</a>. You can also raise a support query directly from the mobile app help section.</p>

            <p>Happy Learning!<br>Team Edrilla</p>
        </div>
        <div class="footer">
            &copy; 2026 Edrilla. All rights reserved.<br>
            This is an automated email. Please do not reply directly to this address.
        </div>
    </div>
</body>
</html>
`;

async function sendTest() {
    console.log(`✉️ Sending test email to ${TEST_EMAIL}...`);

    try {
        const mailOptions = {
            from: emailService.getFrom("transactional"),
            to: TEST_EMAIL,
            subject: 'Welcome to Edrilla – AI Live Classes Access',
            html: HTML_TEMPLATE(TEST_NAME, TEST_EMAIL)
        };

        const info = await emailService.getTransporter("transactional").sendMail(mailOptions);
        console.log(`✅ Test email sent! Message ID: ${info.messageId}`);
    } catch (error) {
        console.error(`❌ Failed to send test email: ${error.message}`);
    }
}

sendTest();
