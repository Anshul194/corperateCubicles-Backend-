import dotenv from "dotenv";
import emailService from "./emailService.js";
import xlsx from "xlsx";
import path from "path";
import fs from "fs";

dotenv.config();

const XLSX_PATH = path.resolve("./students.xlsx"); // Place your students.xlsx in project root

if (!fs.existsSync(XLSX_PATH)) {
  console.error(
    `❌ XLSX file not found at ${XLSX_PATH}. Please export your students list to students.xlsx and place it here.`
  );
  process.exit(1);
}

function getStudentsFromXlsx() {
  const workbook = xlsx.readFile(XLSX_PATH);
  // Use the second sheet (tab 2)
  const sheetNames = workbook.SheetNames;
  if (sheetNames.length < 2) return [];
  const sheetName = sheetNames[1]; // index 1 is the second sheet
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  // Expect columns: Name, Email (case-insensitive)
  return xlsx.utils
    .sheet_to_json(sheet)
    .map((row) => ({
      name: row["Name"] || row["Full Name"] || "Student",
      email: row["Email"],
    }))
    .filter((s) => s.email);
}

function getWelcomeEmailHTML(name, email) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Edrilla Solopreneur</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Arial', sans-serif;
            background-color: #ffffff;
            color: #000000;
            line-height: 1.6;
        }
        
        .email-container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border: 2px solid #000000;
        }
        
        .header {
            background-color: #000000;
            color: #ffffff;
            padding: 30px 40px;
            text-align: center;
        }
        
        .logo {
            font-size: 32px;
            font-weight: bold;
            letter-spacing: 2px;
            margin-bottom: 10px;
        }
        
        .tagline {
            font-size: 14px;
            font-weight: normal;
            opacity: 0.9;
        }
        
        .content {
            padding: 40px;
            background-color: #ffffff;
        }
        
        .greeting {
            font-size: 20px;
            font-weight: bold;
            margin-bottom: 25px;
            color: #000000;
        }
        
        .message-text {
            font-size: 16px;
            margin-bottom: 20px;
            color: #333333;
        }
        
        .highlight-box {
            background-color: #f8f8f8;
            border-left: 4px solid #000000;
            padding: 20px;
            margin: 30px 0;
        }
        
        .highlight-text {
            font-size: 16px;
            font-style: italic;
            color: #000000;
        }
        
        .download-section {
            text-align: center;
            margin: 40px 0;
            padding: 30px 20px;
            background-color: #000000;
            color: #ffffff;
        }
        .download-title {
            font-size: 22px;
            font-weight: bold;
            margin-bottom: 15px;
            color: #ffffff;
        }
        .download-subtitle {
            font-size: 16px;
            margin-bottom: 25px;
            opacity: 0.9;
            color: #ffffff;
        }
        .download-buttons {
          
            justify-content: center;
            gap: 20px;
        }
        .download-btn {
            display: inline-block;
            padding: 12px 25px;
            background-color: #ffffff;
            color: #000000;
            text-decoration: none;
            font-weight: bold;
            font-size: 16px;
            border: 2px solid #ffffff;
            transition: all 0.3s ease;
        }
        .download-btn:hover {
            background-color: transparent;
            color: #ffffff;
        }
        
        .signature {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e0e0e0;
        }
        
        .signature-text {
            font-size: 16px;
            margin-bottom: 5px;
        }
        
        .signature-name {
            font-weight: bold;
            color: #000000;
        }
        
        .footer {
            background-color: #000000;
            color: #ffffff;
            padding: 20px 40px;
            text-align: center;
        }
        
        .support-info {
            font-size: 14px;
            margin-bottom: 10px;
        }
        
        .support-email {
            color: #ffffff;
            text-decoration: none;
            font-weight: bold;
        }
        
        .support-email:hover {
            text-decoration: underline;
        }
        
        @media (max-width: 640px) {
            .email-container {
                margin: 0;
                border: none;
            }
            
            .header, .content, .footer {
                padding: 20px;
            }
            
            .logo {
                font-size: 28px;
            }
            
            .download-buttons {
                flex-direction: column;
                align-items: flex-start;
            }
            .download-btn {
                width: 200px;
                text-align: left;
            }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <div class="logo">EDRILLA</div>
            <div class="tagline">Solopreneur Course</div>
        </div>
        
        <div class="content">
            <div class="greeting">Hi ${name},</div>
            
            <p class="message-text">Thank you so much for joining us and purchasing the Solopreneur course! I'm really excited to have you on board, and I just wanted to share a few tips to get the best out of it.</p>
            
            <div class="highlight-box">
                <p class="highlight-text">We've designed this course so that you can practice live as you go. Think of it less like a Netflix binge and more like a hands-on journey: watch a bit, understand it, practice, and if you run into any problems, our community is right there to help you out.</p>
            </div>
            
            <p class="message-text">You'll get real skills this way, not just a movie-like experience. Inside our app, you'll find lots of features like the ability to hire or be hired, ask questions in the community, and get answers from experts.</p>
            
            <p class="message-text">Plus, whenever we have live events, you'll get a notification so you never miss out.</p>

            <div class="highlight-box" style="background-color: #f1f5f9; border-left: 4px solid #000; margin: 30px 0;">
                <p class="highlight-text" style="font-weight:bold;">Your Login Credentials:</p>
                <p class="highlight-text">Email: <b>${email}</b></p>
                <p class="highlight-text">Password: <b>student</b></p>
                <p class="highlight-text" style="font-size:13px; color:#666;">(You can change your password after login.)</p>
            </div>
            
            <div class="download-section">
                <div class="download-title">Ready to Start Learning?</div>
                <div class="download-subtitle">Download the Edrilla app and access your course anywhere</div>
               <div class="download-buttons">
  <a href="https://play.google.com/store/apps/details?id=com.edrilla.app" class="download-btn" target="_blank">📱 Play Store</a>
  <a href="https://apps.apple.com/in/app/edrilla-business-booster/id6751890495" class="download-btn" target="_blank">
    <img src="https://img.icons8.com/ios-filled/50/000000/mac-os.png" alt="App Store" width="20" style="vertical-align:middle; margin-right:5px;">
    App Store
  </a>
  <a href="https://edrilla.com/login" class="download-btn" target="_blank">🌐 Web App</a>
</div>

            </div>
            
            <p class="message-text">I hope this course not only meets but exceeds your expectations. Thanks again for supporting us, and if you need anything, just let me know!</p>
            
            <div class="signature">
                <p class="signature-text">Happy learning!</p>
                <p class="signature-name">Sahil Khanna</p>
            </div>
        </div>
        
        <div class="footer">
            <p class="support-info">Need help? Contact us at</p>
            <a href="mailto:support@edrilla.com" class="support-email">support@edrilla.com</a>
        </div>
    </div>
</body>
</html>
  `;
}

async function sendWelcomeEmail({ name, email }) {
  const subject = "Welcome to Edrilla Solopreneur - Let's Start Your Journey!";
  const html = getWelcomeEmailHTML(name, email);
  
  await emailService.getTransporter("transactional").sendMail({
    from: emailService.getFrom("transactional"),
    to: email,
    subject,
    html,
  });
}

(async () => {
  const students = getStudentsFromXlsx();
  //console.log(`📧 Starting to send welcome emails to ${students.length} students...`);
  
  for (const student of students) {
    try {
      await sendWelcomeEmail(student);
      //console.log(`✅ Sent to ${student.email}`);
    } catch (err) {
      console.error(`❌ Failed for ${student.email}:`, err.message);
    }
  }
  
  //console.log('🎉 Email sending process completed!');
})();