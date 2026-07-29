import mongoose from 'mongoose';
import dotenv from 'dotenv';
import XLSX from 'xlsx';
import nodemailer from 'nodemailer';
import fs from 'fs';
import User from './models/user.js';
import path from 'path';

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
        body { font-family: 'Inter', sans-serif; background-color: #f8fafc; margin: 0; padding: 0; color: #1e293b; }
        .wrapper { padding: 40px 10px; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.08); border: 1px solid #e2e8f0; }
        
        .page-header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 60px 30px; text-align: center; border-bottom: 6px solid #B1E346; position: relative; }
        .logo-text { font-family: 'Outfit', sans-serif; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #ffffff; margin: 0; text-transform: uppercase; }
        .header-badge { display: inline-block; background: #B1E346; color: #000; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 800; text-transform: uppercase; margin-top: 15px; letter-spacing: 1px; }
        
        .content-area { padding: 40px 35px; }
        .greeting { font-family: 'Outfit', sans-serif; font-size: 28px; font-weight: 800; color: #0f172a; margin-bottom: 20px; }
        
        .intro-text { color: #475569; line-height: 1.8; font-size: 16px; margin-bottom: 30px; }

        /* Important Alert Box */
        .alert-box { background: #fff7ed; border: 2px solid #fdba74; border-radius: 12px; padding: 25px; margin: 30px 0; }
        .alert-title { color: #9a3412; font-family: 'Outfit', sans-serif; font-size: 18px; font-weight: 800; display: flex; align-items: center; margin-bottom: 15px; text-transform: uppercase; }
        .alert-content { color: #c2410c; font-size: 15px; line-height: 1.6; font-weight: 500; }

        /* Feature Sections */
        .section { margin-bottom: 35px; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; }
        .section-header { padding: 18px 25px; font-family: 'Outfit', sans-serif; font-size: 15px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: #ffffff; }
        .section-body { padding: 30px 25px; }

        .blue-gradient { background: linear-gradient(90deg, #1e3a8a 0%, #3b82f6 100%); }
        .amber-gradient { background: linear-gradient(90deg, #92400e 0%, #f59e0b 100%); }
        .emerald-gradient { background: linear-gradient(90deg, #065f46 0%, #10b981 100%); }

        .step-item { display: flex; margin-bottom: 18px; }
        .step-number { background: #0f172a; color: #ffffff; width: 28px; height: 28px; border-radius: 50%; text-align: center; line-height: 28px; font-size: 13px; font-weight: 800; margin-right: 15px; flex-shrink: 0; }
        .step-text { font-size: 15px; color: #334155; line-height: 1.5; font-weight: 500; }
        .step-text b { color: #0f172a; }

        .btn-container { text-align: center; padding: 30px 0; }
        .main-btn { 
            display: inline-block; 
            padding: 18px 36px; 
            background: #0f172a; 
            color: #ffffff; 
            text-decoration: none; 
            border-radius: 12px; 
            font-family: 'Outfit', sans-serif;
            font-size: 16px; 
            font-weight: 800; 
            text-transform: uppercase; 
            letter-spacing: 2px;
            box-shadow: 0 10px 20px rgba(15, 23, 42, 0.2);
            transition: transform 0.2s;
        }

        .social-hub { background: #f1f5f9; padding: 30px; text-align: center; border-radius: 0 0 20px 20px; border-top: 1px solid #e2e8f0; }
        .social-link { display: inline-block; margin: 0 10px; color: #64748b; text-decoration: none; font-size: 13px; font-weight: 600; }
        
        .footer { background: #0f172a; padding: 60px 40px; text-align: center; color: #94a3b8; }
        .footer-logo { font-family: 'Outfit', sans-serif; font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: 4px; margin-bottom: 20px; }
        .footer-text { font-size: 14px; line-height: 1.6; margin-bottom: 20px; }
        .contact-info { font-weight: 700; color: #ffffff; font-size: 15px; }
    </style>
</head>
<body>
    <div class="wrapper">
        <div class="container">
            <header class="page-header">
                <h1 class="logo-text">EDRILLA</h1>
                <div class="header-badge">Class Joining Guide</div>
            </header>
            
            <div class="content-area">
                <div class="greeting">Hello {{Name}},</div>
                <p class="intro-text">
                    Congratulations on taking the first step towards mastering AI! To ensure you have a seamless experience, we've put together this guide on how to join your live classes and access recordings.
                </p>

                <!-- CRITICAL ZOOM NOTIFICATION -->
                <div class="alert-box">
                    <div class="alert-title">⚠️ CRITICAL: ACCEPT ZOOM INVITATION</div>
                    <div class="alert-content">
                        You will receive (or have already received) an email invitation <b>directly from Zoom</b>. <br><br>
                        <b>You MUST click "Accept Invitation" in that email.</b> If you do not accept the invitation, you will <b>NOT</b> be able to join the live sessions. This is a mandatory step for security and attendance tracking.
                    </div>
                </div>

                <!-- JOINING LIVE CLASSES -->
                <div class="section">
                    <div class="section-header blue-gradient">🚀 HOW TO JOIN LIVE CLASSES</div>
                    <div class="section-body">
                        <div class="step-item">
                            <div class="step-number">1</div>
                            <div class="step-text">Visit <b>Edrilla.com</b>.</div>
                        </div>
                        <div class="step-item">
                            <div class="step-number">2</div>
                            <div class="step-number" style="display:none"></div>
                            <div class="step-text">Log in with your registered email: <b>{{Email}}</b></div>
                        </div>
                        <div class="step-item">
                            <div class="step-number">3</div>
                            <div class="step-text">Go to the <b>"Live Classes"</b> tab on your dashboard.</div>
                        </div>
                        <div class="step-item">
                            <div class="step-number">4</div>
                            <div class="step-text">Find your scheduled session and click the <b>"Join Now"</b> button.</div>
                        </div>
                        <p style="margin-top:20px; font-size:14px; color:#64748b; font-style:italic;">Note: Sessions usually go live 10 minutes before the scheduled time.</p>
                    </div>
                </div>

                <!-- ACCESSING RECORDINGS -->
                <div class="section">
                    <div class="section-header amber-gradient">🎥 HOW TO ACCESS RECORDINGS</div>
                    <div class="section-body" style="background:#fffcf5">
                        <p style="margin-top:0; margin-bottom:20px; font-weight:600; color:#92400e;">Missed a session? We've got you covered!</p>
                        <div class="step-item">
                            <div class="step-number" style="background:#92400e">1</div>
                            <div class="step-text">Log in to the <b>Edrilla App</b>.</div>
                        </div>
                        <div class="step-item">
                            <div class="step-number" style="background:#92400e">2</div>
                            <div class="step-text">Navigate to <b>"My Courses"</b>.</div>
                        </div>
                        <div class="step-item">
                            <div class="step-number" style="background:#92400e">3</div>
                            <div class="step-text">Open the <b>AI Cohort</b> course.</div>
                        </div>
                        <div class="step-item">
                            <div class="step-number" style="background:#92400e">4</div>
                            <div class="step-text">Go to the <b>Curriculum/Content</b> section to find all past recordings organized by date.</div>
                        </div>
                    </div>
                </div>

                <div class="btn-container">
                    <a href="https://edrilla.com" class="main-btn">Go to Dashboard</a>
                </div>

                <!-- HELP SECTION -->
                <div class="section" style="border-color:#fee2e2">
                    <div class="section-header" style="background:#ef4444">🆘 NEED SUPPORT?</div>
                    <div class="section-body" style="background:#fff1f2">
                        <p style="margin:0; font-size:15px; color:#991b1b;">
                            If you face any issues logging in or accessing the classes, please reach out to us immediately:
                        </p>
                        <p style="margin:15px 0 0; font-weight:700; color:#000;">
                            WhatsApp Support: +91 95400 65704<br>
                            Email: lapaasindia@gmail.com
                        </p>
                    </div>
                </div>
            </div>

            <div class="social-hub">
                <a href="https://play.google.com/store/apps/details?id=com.edrilla.app" class="social-link">Android App</a> |
                <a href="https://apps.apple.com/in/app/edrilla-business-booster/id6751890495" class="social-link">iOS App</a> |
                <a href="https://edrilla.com" class="social-link">Web Portal</a>
            </div>

            <footer class="footer">
                <div class="footer-logo">EDRILLA</div>
                <p class="footer-text">
                    Lapaas Academy, New Delhi, India<br>
                    Empowering the next generation of AI Builders.
                </p>
                <div class="contact-info">📞 +91 95400 65704</div>
                <p style="font-size:11px; opacity:0.6; margin-top:30px;">© 2026 Edrilla. All rights reserved.</p>
            </footer>
        </div>
    </div>
</body>
</html>
`;

function nameFromEmail(email) {
    const local = email.split('@')[0];
    return local.replace(/[._\-+]/g, ' ').replace(/\d+/g, '').trim().split(' ').filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ') || 'Learner';
}

async function sendMail(to, name) {
    const html = emailTemplate.replace(/{{Name}}/g, name).replace(/{{Email}}/g, to);

    await transporter.sendMail({
        from: `"Sahil Khanna | Edrilla" <${process.env.EMAIL_FROM || 'support@edrilla.com'}>`,
        to,
        subject: '⚠️ ACTION REQUIRED: How to Join Your Live Classes & Access Recordings',
        html,
    });
}

async function run() {
    try {
        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB');

        // Check if we are in test mode
        const args = process.argv.slice(2);
        const testEmails = args.filter(arg => arg.includes('@'));

        if (testEmails.length > 0) {
            console.log(`🚀 Sending test emails to ${testEmails.length} recipients...`);
            for (const email of testEmails) {
                await sendMail(email, 'Team');
                console.log(`✅ Test email sent to ${email}`);
            }
            process.exit(0);
        }

        const EXCEL_FILE = 'Final list of ai course students-3.xlsx';
        if (!fs.existsSync(EXCEL_FILE)) {
            console.error(`❌ File not found: ${EXCEL_FILE}`);
            process.exit(1);
        }

        const wb = XLSX.readFile(EXCEL_FILE);
        const ws = wb.Sheets[wb.SheetNames[0]];
        const allRows = XLSX.utils.sheet_to_json(ws);

        const emailDetailsMap = new Map();
        for (const row of allRows) {
            const rawEmailStr = (row['email'] || row['Email'] || row['EMAIL'] || '').toString().trim();
            if (!rawEmailStr) continue;

            // Split by comma, semicolon, newline, or multiple spaces
            const emails = rawEmailStr.split(/[,;\n\r]+|\s{2,}/).map(e => e.trim().toLowerCase()).filter(e => e.includes('@'));

            for (const email of emails) {
                if (email && !emailDetailsMap.has(email)) {
                    emailDetailsMap.set(email, {
                        email,
                        rowRef: row
                    });
                }
            }
        }

        const uniqueEmails = Array.from(emailDetailsMap.keys());
        console.log(`Found ${uniqueEmails.length} unique emails from Excel (including multi-student rows).`);

        let count = 0;
        let errors = 0;

        const START_INDEX = 0;
        console.log(`Starting process from index ${START_INDEX}...`);
        fs.appendFileSync('send_log.txt', `\n--- New Session Started at ${new Date().toLocaleString()} ---\n`);

        for (let i = START_INDEX; i < uniqueEmails.length; i++) {
            const email = uniqueEmails[i];
            try {
                const details = emailDetailsMap.get(email);
                const user = await User.findOne({ email });

                // Use Name from DB if exists, otherwise try to get from row, else derive from email
                let name = user ? user.fullName : (details.rowRef['Name'] || details.rowRef['name'] || nameFromEmail(email));

                await sendMail(email, name);
                count++;
                const msg = `[${i + 1}/${uniqueEmails.length}] ✅ Guide email sent to ${email} (${name})`;
                console.log(msg);
                fs.appendFileSync('send_log.txt', msg + '\n');

                // Throttle to avoid SMTP limits
                await new Promise(resolve => setTimeout(resolve, 1400));
            } catch (err) {
                const errMsg = `[${i + 1}/${uniqueEmails.length}] ❌ Failed to send to ${email}: ${err.message}`;
                console.error(errMsg);
                fs.appendFileSync('send_log.txt', errMsg + '\n');
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
