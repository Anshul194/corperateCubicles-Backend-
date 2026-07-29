import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

/**
 * EmailService handles sending different types of emails from different sender addresses.
 * 
 * Transactional: noreply@edrilla.com (process.env.TransactionalEmail / process.env.TransactionalEmailPass)
 * Founder/Casual: sahil@edrilla.com (process.env.FounderEmail / process.env.FounderEmailPass)
 * Support: support@edrilla.com (process.env.SupportEmail / process.env.SupportEmailPass)
 */
class EmailService {
  constructor() {
    // Log environment variables for debugging (avoid logging passwords in production)
    //console.log("SMTP Configuration:", {
    //   host: process.env.SMTP_HOST,
    //   port: process.env.SMTP_PORT,
    //   secure: process.env.SMTP_SECURE,
    //   TransactionalEmail: process.env.TransactionalEmail,
    //   FounderEmail: process.env.FounderEmail,
    //   SupportEmail: process.env.SupportEmail,
    // });

    // Prepare transporters for each sender
    this.transporters = {
      transactional: nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT),
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: process.env.TransactionalEmail,
          pass: process.env.TransactionalEmailPass,
        },
        tls: {
          rejectUnauthorized: false,
        },
      }),
      founder: nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT),
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: process.env.FounderEmail,
          pass: process.env.FounderEmailPass,
        },
        tls: {
          rejectUnauthorized: false,
        },
      }),
      support: nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT),
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: process.env.SupportEmail,
          pass: process.env.SupportEmailPass,
        },
        tls: {
          rejectUnauthorized: false,
        },
      }),
    };
  }

  /**
   * Helper to get the correct "from" field for each type of email.
   */
  getFrom(type = "transactional") {
    switch (type) {
      case "transactional":
        return `"Edrilla" <${process.env.TransactionalEmail || "noreply@edrilla.com"}>`;
      case "founder":
        return `"Sahil (Edrilla)" <${process.env.FounderEmail || "sahil@edrilla.com"}>`;
      case "support":
        return `"Edrilla Support" <${process.env.SupportEmail || "support@edrilla.com"}>`;
      default:
        return `"Edrilla" <${process.env.TransactionalEmail || "noreply@edrilla.com"}>`;
    }
  }

  /**
   * Helper to get the correct transporter for each type of email.
   */
  getTransporter(type = "transactional") {
    if (type === "transactional") return this.transporters.transactional;
    if (type === "founder") return this.transporters.founder;
    if (type === "support") return this.transporters.support;
    return this.transporters.transactional;
  }

  /**
   * Send OTP/verification email (Transactional)
   */
  async sendOtpEmail(email, otp, userName = 'User') {
    const mailOptions = {
      from: this.getFrom("transactional"),
      to: email,
      subject: 'Your OTP for Verification',
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.5;">
          <h2>OTP Verification</h2>
          <p>Hello <strong>${userName}</strong>,</p>
          <p>Your One-Time Password (OTP) for verification is:</p>
          <h3 style="color: #007bff;">${otp}</h3>
          <p>This OTP is valid for 10 minutes. Please use it to complete your verification.</p>
          <p>If you didn’t request this OTP, please ignore this email or contact our support team.</p>
          <hr />
          <p style="font-size: 12px; color: #777;">This is an automated email, please do not reply.</p>
        </div>
      `,
    };

    try {
      const info = await this.getTransporter("transactional").sendMail(mailOptions);
      //console.log('✅ OTP email sent:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ Error sending OTP email:', error);
      throw new Error(`Failed to send OTP email: ${error.message}`);
    }
  }

  /**
   * Send password reset email (Transactional)
   */
  async sendPasswordResetEmail(email, resetToken, userName) {
    const resetUrl = `${process.env.FRONTEND_URL || "https://edrilla.com"
      }/reset-password?token=${resetToken}`;

    const mailOptions = {
      from: this.getFrom("transactional"),
      to: email,
      subject: "Password Reset Request",
      html: `
       <!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Password Reset - Edrilla</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: Arial, sans-serif;">
    <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
            <td style="padding: 20px 0;">
                <table role="presentation" style="width: 100%; max-width: 600px; margin: 0 auto; background-color: #191a17; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
                    
                    <!-- Header with Logo -->
                    <tr>
                        <td style="background-color: #93bb3d; padding: 30px 40px; text-align: center;">
                            <img src="https://edrilla.com/logo.svg" alt="Edrilla Logo" style="height: 40px; width: auto; display: block; margin: 0 auto 15px auto;">
                            <h1 style="color: #191a17; margin: 0; font-size: 24px; font-weight: bold;">Password Reset Request</h1>
                        </td>
                    </tr>
                    
                    <!-- Main Content -->
                    <tr>
                        <td style="padding: 40px; color: #ffffff;">
                            <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.5;">
                                Hello <strong style="color: #93bb3d;">${userName}</strong>,
                            </p>
                            
                            <p style="margin: 0 0 25px 0; font-size: 16px; line-height: 1.5;">
                                We received a request to reset your password for your Edrilla account. If you made this request, click the button below to create a new password.
                            </p>
                            
                            <!-- Reset Button -->
                            <table role="presentation" style="margin: 30px 0;">
                                <tr>
                                    <td style="text-align: center;">
                                        <a href="${resetUrl}" style="display: inline-block; padding: 15px 30px; background-color: #93bb3d; color: #191a17; text-decoration: none; border-radius: 25px; font-weight: bold; font-size: 16px; text-align: center; transition: background-color 0.3s ease;">
                                            Reset My Password
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Alternative Link -->
                            <div style="background-color: #2a2b28; padding: 20px; border-radius: 8px; margin: 25px 0;">
                                <p style="margin: 0 0 10px 0; font-size: 14px; color: #cccccc;">
                                    If the button doesn't work, copy and paste this link into your browser:
                                </p>
                                <p style="margin: 0; word-break: break-all; font-size: 14px;">
                                    <a href="${resetUrl}" style="color: #93bb3d; text-decoration: underline;">${resetUrl}</a>
                                </p>
                            </div>
                            
                            <!-- Security Notice -->
                            <div style="border-left: 4px solid #93bb3d; padding-left: 20px; margin: 25px 0;">
                                <p style="margin: 0 0 10px 0; font-size: 14px; color: #ff9999; font-weight: bold;">
                                    ⏰ Important Security Notice
                                </p>
                                <p style="margin: 0; font-size: 14px; line-height: 1.4; color: #cccccc;">
                                    This reset link will expire in <strong>1 hour</strong> for your security.
                                </p>
                            </div>
                            
                            <p style="margin: 25px 0 0 0; font-size: 16px; line-height: 1.5;">
                                If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #0f100e; padding: 30px 40px; text-align: center; border-top: 2px solid #93bb3d;">
                            <p style="margin: 0 0 15px 0; color: #93bb3d; font-size: 18px; font-weight: bold;">
                                Edrilla
                            </p>
                            <p style="margin: 0; font-size: 12px; color: #888888; line-height: 1.4;">
                                This is an automated email, please do not reply.<br>
                                If you need help, contact our support team.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
      `,
    };

    try {
      const info = await this.getTransporter("transactional").sendMail(mailOptions);
      //console.log("✅ Password reset email sent:", info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error("❌ Error sending email:", error);
      throw new Error(`Failed to send reset email: ${error.message}`);
    }
  }

  /**
   * Send order confirmation email (Transactional)
   */
  async sendOrderConfirmationEmail(email, name, password) {
    console?.log("Sending order confirmation email to:", email);
    const mailOptions = {
      from: this.getFrom("transactional"),
      to: email,
      subject: "Course Enrollment Confirmation",
      html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <h2>Course Enrollment Confirmation</h2>
        <p>Hello <strong>${name}</strong>,</p>
        <p>Thank you for enrolling in our course(s)! Your enrollment is now confirmed and you can start learning right away.</p>
        ${
        password !== null && password !== undefined && password !== ''
          ? `
          <p>Your login details are as follows:</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Password:</strong> ${password}</p>
          <a href="${process.env.FRONTEND_URL || 'https://edrilla.com'}/login" style="padding: 10px 15px; background-color: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer;">
            Login to your account
          </a>
          `
          : ''
        }
        <p>Once logged in, you can access your enrolled courses from your dashboard and begin your learning journey.</p>
        <p>If you have any questions or need assistance, feel free to contact our support team.</p>
        <hr />
        <p style="font-size: 12px; color: #777;">This is an automated email, please do not reply.</p>
      </div>
      `,
    };

    try {
      const info = await this.getTransporter("transactional").sendMail(mailOptions);
      //console.log("✅ Order confirmation email sent:", info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error("❌ Error sending email:", error);
      throw new Error(
        `Failed to send order confirmation email: ${error.message}`
      );
    }
  }

  /**
   * Send enrollment mail (not order confirmation, just enrollment info)
   * Uses the same design as the welcome mail (with login info if needed).
   */
  async sendEnrollmentMail(email, name, courseTitle) {
    const mailOptions = {
      from: this.getFrom("transactional"),
      to: email,
      subject: "Welcome to Edrilla – Enrollment Successful!",
      html: `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Enrollment Successful - Edrilla</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Arial', sans-serif; background-color: #ffffff; color: #000000; line-height: 1.6; }
        .email-container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 2px solid #000000; }
        .header { background-color: #000000; color: #ffffff; padding: 30px 40px; text-align: center; }
        .logo { font-size: 32px; font-weight: bold; letter-spacing: 2px; margin-bottom: 10px; }
        .tagline { font-size: 14px; font-weight: normal; opacity: 0.9; }
        .content { padding: 40px; background-color: #ffffff; }
        .greeting { font-size: 20px; font-weight: bold; margin-bottom: 25px; color: #000000; }
        .message-text { font-size: 16px; margin-bottom: 20px; color: #333333; }
        .highlight-box { background-color: #f8f8f8; border-left: 4px solid #000000; padding: 20px; margin: 30px 0; }
        .highlight-text { font-size: 16px; font-style: italic; color: #000000; }
        .course-title { font-size: 18px; font-weight: bold; color: #000000; margin-bottom: 10px; }
        .login-info { background-color: #f1f5f9; border-left: 4px solid #000; margin: 30px 0; padding: 20px; }
        .download-section { text-align: center; margin: 40px 0; padding: 30px 20px; background-color: #000000; color: #ffffff; }
        .download-title { font-size: 22px; font-weight: bold; margin-bottom: 15px; color: #ffffff; }
        .download-subtitle { font-size: 16px; margin-bottom: 25px; opacity: 0.9; color: #ffffff; }
        .download-buttons { justify-content: center; gap: 20px; }
        .download-btn { display: inline-block; padding: 12px 25px; background-color: #ffffff; color: #000000; text-decoration: none; font-weight: bold; font-size: 16px; border: 2px solid #ffffff; transition: all 0.3s ease; }
        .download-btn:hover { background-color: transparent; color: #ffffff; }
        .signature { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; }
        .signature-text { font-size: 16px; margin-bottom: 5px; }
        .signature-name { font-weight: bold; color: #000000; }
        .footer { background-color: #000000; color: #ffffff; padding: 20px 40px; text-align: center; }
        .support-info { font-size: 14px; margin-bottom: 10px; }
        .support-email { color: #ffffff; text-decoration: none; font-weight: bold; }
        .support-email:hover { text-decoration: underline; }
        @media (max-width: 640px) {
            .email-container { margin: 0; border: none; }
            .header, .content, .footer { padding: 20px; }
            .logo { font-size: 28px; }
            .download-buttons { flex-direction: column; align-items: flex-start; }
            .download-btn { width: 200px; text-align: left; }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <div class="logo">EDRILLA</div>
            <div class="tagline">Course</div>
        </div>
        <div class="content">
            <div class="greeting">Hi ${name},</div>
            <p class="message-text">Congratulations! You have been successfully enrolled in:</p>
            <div class="course-title">${courseTitle || "Your Course"}</div>
            <div class="highlight-box">
                <p class="highlight-text">We're thrilled to have you join us. This course is designed to be hands-on: watch, practice, and connect with our community if you need help. Your learning journey starts now!</p>
            </div>
          
            <div class="download-section">
                <div class="download-title">Start Learning Now</div>
                <div class="download-subtitle">Download the Edrilla app or use the web platform</div>
                <div class="download-buttons">
                    <a href="https://play.google.com/store/apps/details?id=com.edrilla.app" class="download-btn" target="_blank">📱 Play Store</a>
                    <a href="https://apps.apple.com/in/app/edrilla-business-booster/id6751890495" class="download-btn" target="_blank">
                        <img src="https://img.icons8.com/ios-filled/50/000000/mac-os.png" alt="App Store" width="20" style="vertical-align:middle; margin-right:5px;">
                        App Store
                    </a>
                    <a href="https://edrilla.com/login" class="download-btn" target="_blank">🌐 Web App</a>
                </div>
            </div>
            <p class="message-text">If you have any questions or need assistance, our support team is here for you.</p>
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
      `,
    };

    try {
      const info = await this.getTransporter("transactional").sendMail(mailOptions);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error("❌ Error sending enrollment mail:", error);
      throw new Error(`Failed to send enrollment mail: ${error.message}`);
    }
  }

  /**
   * Send event registration email (Founder for event/casual, Transactional if login details)
   * If password is provided, it's a new user, so use transactional. Otherwise, use founder.
   */
  async sendEventRegistrationEmail(email, name, eventDetails, password = null) {
    // If password is present, it's a transactional email (new user), else it's a founder/casual info email
    const fromType = password ? "transactional" : "founder";
    const mailOptions = {
      from: this.getFrom(fromType),
      to: email,
      subject: `Registration Confirmation for ${eventDetails.title}`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.5;">
          <h2>Event Registration Confirmation</h2>
          <p>Hello <strong>${name}</strong>,</p>
          <p>Thank you for registering for the event: <strong>${eventDetails.title
        }</strong>.</p>
          <p>Event Details:</p>
          <ul>
            <li><strong>Date:</strong> ${eventDetails.startDate}</li>
            <li><strong>Location:</strong> ${eventDetails.venue.address}, ${eventDetails.venue.city
        }, ${eventDetails.venue.country}</li>
          ${eventDetails.onlineLink
          ? `
            <li><strong>Platform:</strong> ${eventDetails.onlineLink.platform
          }</li>
            <li><strong>Meeting URL:</strong> <a href="${eventDetails.onlineLink.url
          }" target="_blank">Join</a></li>
            ${eventDetails.onlineLink.meetingId
            ? `<li><strong>Meeting ID:</strong> ${eventDetails.onlineLink.meetingId}</li>`
            : ""
          }
            ${eventDetails.onlineLink.password
            ? `<li><strong>Password:</strong> ${eventDetails.onlineLink.password}</li>`
            : ""
          }
          `
          : ""
        }
          ${password
          ? `
          <p>Your login details are as follows:</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Password:</strong> ${password}</p>
          `
          : ""
        }
          <p>If you have any questions or need assistance, feel free to contact our support team.</p>
          <hr />
          <p style="font-size: 12px; color: #777;">This is an automated email, please do not reply.</p>
        </div>
      `,
    };

    try {
      const info = await this.getTransporter(fromType).sendMail(mailOptions);
      //console.log("✅ Event registration email sent:", info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error("❌ Error sending email:", error);
      throw new Error(
        `Failed to send event registration email: ${error.message}`
      );
    }
  }

  /**
   * Send job proposal email to job creator (job feature is user-to-user, not from Edrilla)
   * This email is sent from the applicant to the job creator, using the applicant's email as the "from" address.
   * Edrilla only relays the email, it is not a proposal to Edrilla.
   */
  async sendJobProposalEmail(jobCreatorEmail, jobCreatorName, jobTitle, proposalDetails, applicant) {
    // applicant: { name, email }
    // SECURITY: escape all user-controlled values before interpolating into HTML,
    // and do NOT put the applicant's address in the From header (that spoofs our
    // domain — failing SPF/DKIM and enabling header injection). The applicant is
    // reachable via Reply-To instead, and From uses our authenticated support box.
    const esc = (v) =>
      String(v ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    const attachments = [];
    if (proposalDetails.cv) {
      attachments.push({
        filename: "CV.pdf",
        path: proposalDetails.cv, // Should be a file path or URL accessible to the server
      });
    }

    const mailOptions = {
      from: this.getFrom("support"),
      to: jobCreatorEmail,
      subject: `New Proposal for Your Job: "${esc(jobTitle)}"`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.5;">
          <h2>New Proposal for Your Job</h2>
          <p>Hello <strong>${esc(jobCreatorName)}</strong>,</p>
          <p><strong>${esc(applicant.name)}</strong> has submitted a proposal for your job post: <strong>${esc(jobTitle)}</strong>.</p>
          <p><strong>Proposal Details:</strong></p>
          <ul>
            <li><strong>Cover Letter:</strong> ${esc(proposalDetails.coverLetter) || "N/A"}</li>
            <li><strong>Proposed Amount:</strong> ${proposalDetails.proposedAmount ? esc(proposalDetails.proposedAmount) : "N/A"}</li>
            <li><strong>Status:</strong> ${esc(proposalDetails.status) || "pending"}</li>
            <li><strong>Submitted At:</strong> ${proposalDetails.submittedAt ? new Date(proposalDetails.submittedAt).toLocaleString() : "N/A"}</li>
            <li><strong>Applicant Email:</strong> ${esc(applicant.email)}</li>
          </ul>
          ${proposalDetails.cv
          ? `<p><strong>CV is attached to this email.</strong></p>`
          : ""
        }
          <p>You can reply directly to this email to contact the applicant.</p>
          <hr />
          <p style="font-size: 12px; color: #777;">This is an automated email, please do not reply.</p>
        </div>
      `,
      attachments,
      replyTo: applicant.email,
    };

    try {
      const info = await this.getTransporter("support").sendMail(mailOptions);
      //console.log("✅ Job proposal email relayed to job creator:", info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error("❌ Error relaying job proposal email:", error);
      throw new Error(`Failed to relay job proposal email: ${error.message}`);
    }
  }
}

export default new EmailService();
