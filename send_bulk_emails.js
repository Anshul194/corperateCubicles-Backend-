import mongoose from 'mongoose';
import dotenv from 'dotenv';
import XLSX from 'xlsx';
import nodemailer from 'nodemailer';
import fs from 'fs';
import User from './models/user.js';

dotenv.config();

const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/lms_backend';

// SMTP Configuration
const smtpConfig = {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        // SECURITY: credentials must come from the environment — do not commit them.
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
};

const transporter = nodemailer.createTransport(smtpConfig);

const emailTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@700;800&family=Inter:wght@400;500;700&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Inter', sans-serif; background-color: #f4f7fa; margin: 0; padding: 0; color: #1e293b; }
        .wrapper { padding: 40px 10px; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.05); }
        
        .page-header { background: #0d1b2a; padding: 50px 30px; text-align: center; border-bottom: 5px solid #B1E346; }
        .logo-text { font-family: 'Outfit', sans-serif; font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #ffffff; margin: 0; text-transform: uppercase; }
        
        .greeting-area { padding: 40px 35px 10px; }
        .greeting { font-family: 'Outfit', sans-serif; font-size: 26px; font-weight: 800; color: #0d1b2a; }
        
        /* Highlighted Sections */
        .section { margin: 25px; overflow: hidden; border-radius: 12px; border: 1px solid #e2e8f0; }
        .section-header { padding: 15px 25px; font-family: 'Outfit', sans-serif; font-size: 16px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #ffffff; }
        .section-body { padding: 25px; line-height: 1.6; }

        .navy-theme { background: #1e3a8a; } .navy-body { background: #f0f7ff; }
        .amber-theme { background: #92400e; } .amber-body { background: #fffcf0; }
        .emerald-theme { background: #065f46; } .emerald-body { background: #f0fdf4; }
        .slate-theme { background: #475569; } .slate-body { background: #f8fafc; }

        .data-row { margin-bottom: 20px; }
        .data-label { color: #94a3b8; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 5px; }
        .data-value { color: #0d1b2a; font-weight: 600; font-size: 16px; display: block; }
        .pass-chip { display: inline-block; background: #B1E346; color: #000; padding: 5px 12px; border-radius: 6px; font-family: monospace; font-weight: 800; font-size: 18px; margin-top: 5px; }

        .btn-hub { text-align: center; padding: 40px 20px; background: #0d1b2a; margin: 40px 0; }
        .hub-btn { 
            display: inline-block; 
            padding: 14px 24px; 
            margin: 8px; 
            background: #ffffff; 
            border-radius: 10px; 
            text-decoration: none; 
            color: #0d1b2a; 
            font-size: 14px; 
            font-weight: 800; 
            text-transform: uppercase; 
            letter-spacing: 1px; 
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            min-width: 160px;
        }
        .hub-btn img { height: 20px; margin-right: 10px; vertical-align: middle; }

        .step-li { margin-bottom: 12px; display: flex; align-items: start; }
        .step-bubble { background: #000; color: #fff; width: 22px; height: 22px; border-radius: 50%; text-align: center; line-height: 22px; font-size: 11px; font-weight: 800; margin-right: 15px; flex-shrink: 0; margin-top: 2px; }

        .footer-brand { color: #ffffff; font-family: 'Outfit', sans-serif; font-size: 22px; font-weight: 800; letter-spacing: 5px; margin-bottom: 15px; }
    </style>
</head>
<body>
    <div class="wrapper">
        <div class="container">
            <header class="page-header">
                <h1 class="logo-text">EDRILLA</h1>
            </header>
            
            <div class="greeting-area">
                <div class="greeting">Dear {{Name}},</div>
                <p style="color: #475569; line-height: 1.7; margin-top: 20px; font-size: 16px;">
                    <strong>Welcome to the AI Live Cohort! 🎉</strong><br><br>
                    Thank you for enrolling. We are excited to have you join us on this journey to learn, build, and grow with AI.<br><br>
                    As part of your enrollment, you have also been enrolled in our <strong>MVP Engineering Program</strong>, giving you access to additional learning resources, practical projects, and our exclusive student community.
                </p>
            </div>

            <!-- Login Details -->
            <div class="section">
                <div class="section-header slate-theme">🔑 YOUR LOGIN DETAILS</div>
                <div class="section-body slate-body">
                    <div class="data-row"><span class="data-label">Platform</span><span class="data-value">Edrilla</span></div>
                    <div class="data-row"><span class="data-label">Email</span><span class="data-value">{{Email}}</span></div>
                    <div class="data-row">
                        <span class="data-label">Password</span>
                        <span class="data-value">
                            Set your own password to log in for the first time.<br>
                            <a href="https://edrilla.com/login" class="pass-chip" style="display: inline-block; margin-top: 8px; text-decoration: none;">Set Your Password →</a>
                        </span>
                    </div>
                    <p style="font-size: 13px; color: #94a3b8; margin-top: 15px; font-style: italic; border-top: 1px solid #e2e8f0; padding-top: 10px;">Go to <b>edrilla.com</b>, click <b>Log In → Forgot Password</b>, enter this email address, and choose a password. If you already have an Edrilla account, your existing password will continue to work.</p>
                </div>
            </div>

            <!-- Live Schedule -->
            <div class="section">
                <div class="section-header navy-theme">🕕 LIVE CLASSES SCHEDULE</div>
                <div class="section-body navy-body">
                
                <p style="margin-top: 0; font-weight: 700; color: #1e3a8a; font-size: 17px;">
    Your AI Live Classes are conducted every <strong>Monday to Thursday</strong> at <strong>6:00 PM IST</strong>.
</p>

<p style="color: #4b5563; font-size: 15px; margin-top: 10px;">
    Join live sessions to learn AI concepts, work on practical projects, and interact directly with mentors and fellow learners.
</p>

<p style="color: #ef4444; font-size: 14px; font-weight: 700; margin-top: 12px;">
    Please ensure you can log in before the session starts to avoid any last-minute issues.
</p>
                </div>
            </div>

            <!-- Joining Steps -->
            <div class="section">
                <div class="section-header navy-theme">🚀 HOW TO JOIN LIVE CLASSES</div>
                <div class="section-body navy-body">
                    <div class="step-li"><div class="step-bubble">1</div><div>Visit <b>Edrilla.com</b></div></div>
                    <div class="step-li"><div class="step-bubble">2</div><div>Log in with your registered email — first time? Click <b>Forgot Password</b> to set your password</div></div>
                    <div class="step-li"><div class="step-bubble">3</div><div>Go to the <b>"Live Classes"</b> tab</div></div>
                    <div class="step-li"><div class="step-bubble">4</div><div>Select the scheduled session</div></div>
                    <div class="step-li"><div class="step-bubble">5</div><div>Click <b>"Join"</b> to enter the live class</div></div>
                    <p style="font-size: 13px; color: #64748b; margin-top: 15px; font-style: italic;">We recommend joining 5–10 minutes before the session begins.</p>
                </div>
            </div>

            <!-- App Hub -->
            <div class="btn-hub">
                <div style="color: #ffffff; font-size: 11px; font-weight: 800; margin-bottom: 25px; text-transform: uppercase; letter-spacing: 2px;">Direct Access Portal</div>
                <a href="https://play.google.com/store/apps/details?id=com.edrilla.app" class="hub-btn">
                    <img src="https://img.icons8.com/color/48/000000/google-play.png">Android
                </a>
                <a href="https://apps.apple.com/in/app/edrilla-business-booster/id6751890495" class="hub-btn">
                    <img src="https://img.icons8.com/ios-filled/50/000000/mac-os.png">Apple iOS
                </a>
                <a href="https://edrilla.com" class="hub-btn">
                    <img src="https://img.icons8.com/ios-filled/50/000000/internet.png">Web Portal
                </a>
            </div>

            <!-- Recordings -->
            <div class="section">
                <div class="section-header amber-theme">🎥 HOW TO ACCESS CLASS RECORDINGS</div>
                <div class="section-body amber-body">
                    <p style="margin-top: 0;">Can't attend a session live? No problem. All recordings will be available <b>inside the Edrilla App</b>.</p>
                    <div class="step-li"><div class="step-bubble" style="background:#92400e">1</div><div>Download the Edrilla App</div></div>
                    <div class="step-li"><div class="step-bubble" style="background:#92400e">2</div><div>Log in using the same credentials</div></div>
                    <div class="step-li"><div class="step-bubble" style="background:#92400e">3</div><div>Go to <b>"My Courses"</b></div></div>
                    <div class="step-li"><div class="step-bubble" style="background:#92400e">4</div><div>Open your AI Cohort course and access recordings</div></div>
                    <p style="font-size: 13px; color: #94a3b8; margin-top: 15px;">Recordings are uploaded after the live session and can be viewed anytime.</p>
                </div>
            </div>

            <!-- Community -->
            <div class="section">
                <div class="section-header emerald-theme">👥 COMMUNITY ACCESS</div>
                <div class="section-body emerald-body">
                    <p style="margin: 0 0 15px;">You will also get access to our exclusive student community inside the platform.</p>
                    <div style="font-size: 14px; color: #065f46; font-weight: 600;">
                        ✓ Ask questions & get support<br>✓ Connect with fellow learners<br>✓ Share progress & projects<br>✓ Receive announcements
                    </div>
                    <p style="font-weight: 700; color: #065f46; margin-top: 20px;">Access: Login → Open Community/Chat → Join Group</p>
                </div>
            </div>

            <!-- Tagline -->
            <div style="text-align: center; padding: 40px; margin: 40px 25px; border: 2px dashed #B1E346; border-radius: 12px; background: #fafafa;">
                <h3 style="font-family: 'Outfit', sans-serif; font-size: 20px; color: #0d1b2a; margin: 0;">
                    "Help you move from learning AI to <span style="background: #B1E346; padding: 0 5px;">actually building</span> with AI."
                </h3>
            </div>

            <!-- Help -->
            <div class="section">
                <div class="section-header" style="background:#e11d48;">📞 NEED HELP?</div>
                <div class="section-body" style="background:#fff1f2;">
                    <p style="margin: 0; font-weight: 700;">WhatsApp: +91 95400 65704</p>
                    <p style="margin: 8px 0 0; font-size: 14px; color: #991b1b;">Or simply reply directly to this email, and our team will help you.</p>
                </div>
            </div>

            <footer style="background: #0d1b2a; padding: 50px 30px; text-align: center; color: #94a3b8;">
                <div class="footer-brand">EDRILLA</div>
                <p>See you in class! 🚀</p>
                <p style="margin-top: 30px; font-weight: 700; color: #fff;">Warm Regards,<br>Team Lapaas</p>
                <p style="font-size: 12px; margin-top: 15px;">Learn. Build. Launch. | 📞 +91 95400 65704</p>
                <p style="opacity: 0.5; font-size: 11px; margin-top: 20px;">© 2026 Edrilla / Lapaas Academy</p>
            </footer>
        </div>
    </div>
</body>
</html>
`;

function nameFromEmail(email) {
    const local = email.split('@')[0];
    return local.replace(/[._\-+]/g, ' ').replace(/\d+/g, '').trim().split(' ').filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ') || 'Student';
}

async function sendMail(to, name) {
    const html = emailTemplate.replace(/{{Name}}/g, name).replace(/{{Email}}/g, to);

    await transporter.sendMail({
        from: `"Team Lapaas" <${process.env.EMAIL_FROM || 'support@edrilla.com'}>`,
        to,
        subject: '🚀 Enrollment Confirmed: AI Live Cohort',
        html,
    });
}

async function run() {
    try {
        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB');

        const EXCEL_FILE = 'Final list of ai course students-2.xlsx';
        const wb = XLSX.readFile(EXCEL_FILE);
        const ws = wb.Sheets[wb.SheetNames[0]];
        const allRows = XLSX.utils.sheet_to_json(ws);

        const emailMap = new Map();
        for (const row of allRows) {
            const email = (row['email'] || row['Email'] || row['EMAIL'] || '').toString().trim().toLowerCase();
            if (email && email.includes('@')) {
                emailMap.set(email, row);
            }
        }

        const uniqueEmails = Array.from(emailMap.keys());
        console.log(`Found ${uniqueEmails.length} unique emails. Starting to send...`);

        let count = 0;
        let errors = 0;

        // Resume sending from student 361 (index 360)
        for (let i = 360; i < uniqueEmails.length; i++) {
            const email = uniqueEmails[i];
            try {
                const user = await User.findOne({ email });
                const name = user ? user.fullName : nameFromEmail(email);

                await sendMail(email, name);
                count++;
                console.log(`[${i + 1}/${uniqueEmails.length}] ✅ Email sent to ${email}`);

                // Wait 1.5 seconds between emails to prevent SMTP rate limiting
                await new Promise(resolve => setTimeout(resolve, 1500));
            } catch (err) {
                console.error(`[${i + 1}/${uniqueEmails.length}] ❌ Failed to send to ${email}:`, err.message);
                errors++;
            }
        }

        console.log(`\n🎉 Process completed! Sent: ${count}, Errors: ${errors}`);
        await mongoose.disconnect();
    } catch (err) {
        console.error('Fatal error:', err);
    }
}

run();
