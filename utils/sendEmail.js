import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: Number(process.env.MAIL_PORT),
  secure: false,
  auth: {
    user: process.env.MAIL_USERNAME,
    pass: process.env.MAIL_PASSWORD,
  },
});

const sendEmail = async (to, text, subject) => {
  try {
    await transporter.sendMail({
      from: `"${process.env.MAIL_FROM_NAME}" <${process.env.MAIL_FROM_ADDRESS}>`,
      to,
      subject,
      text,
    });
    //console.log(`✅ Email sent to ${to}`);
  } catch (error) {
    console.error('❌ Email send failed:', error);  // This shows the actual issue
    throw new Error(error.message);  // <-- CHANGE THIS
  }
};



export default sendEmail;
