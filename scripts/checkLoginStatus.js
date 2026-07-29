import mongoose from "mongoose";
import XLSX from "xlsx";
import dotenv from "dotenv";
import { connectToDatabase } from "../db/connect.js";
import User from "../models/User.js";
import LoginLog from "../models/LoginLog.js";

dotenv.config();

const filePath = 'd:\\nexprism\\lms_backend\\payment_links - 30 May 26-5.xlsx';

async function checkLogins() {
  try {
    await connectToDatabase();

    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);

    console.log(`Processing ${data.length} records from Excel...`);

    const results = [];

    for (const row of data) {
      const email = row.email?.toString().toLowerCase().trim();
      const phone = row.phone?.toString().trim();

      if (!email && !phone) {
        results.push({
          ...row,
          systemStatus: "Skipped (No email/phone)",
          hasLoggedIn: "No",
        });
        continue;
      }

      // Find user by email or phone
      const user = await User.findOne({
        $or: [
          email ? { email } : null,
          phone ? { phone } : null,
        ].filter(Boolean),
      });

      if (!user) {
        results.push({
          ...row,
          systemStatus: "User not found in DB",
          hasLoggedIn: "No",
        });
        continue;
      }

      // Check if user has any successful login logs
      const lastLogin = await LoginLog.findOne({ 
        userId: user._id, 
        loginStatus: "success" 
      }).sort({ loginTime: -1 });

      results.push({
        ...row,
        systemStatus: "User found",
        hasLoggedIn: lastLogin ? "Yes" : "No",
        lastLoginTime: lastLogin ? lastLogin.loginTime.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : "Never Logged In",
        userFullName: user.fullName,
        userEmail: user.email,
        userPhone: user.phone
      });
    }

    // Create a new Excel file with results
    const newSheet = XLSX.utils.json_to_sheet(results);
    const newWorkbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(newWorkbook, newSheet, "Login Status");
    
    // Use a timestamped filename to avoid "resource busy" errors if the user has the file open
    const timestamp = Date.now();
    const outputPath = `d:\\nexprism\\lms_backend\\login_status_check_${timestamp}.xlsx`;
    XLSX.writeFile(newWorkbook, outputPath);

    console.log(`\nCheck complete!`);
    console.log(`Total processed: ${data.length}`);
    console.log(`Results saved to: ${outputPath}`);
    
    // Quick summary in console
    const loggedInCount = results.filter(r => r.hasLoggedIn === "Yes").length;
    console.log(`Users logged in: ${loggedInCount}`);
    console.log(`Users NOT logged in: ${results.length - loggedInCount}`);

    process.exit(0);
  } catch (error) {
    console.error('Error during processing:', error);
    process.exit(1);
  }
}

checkLogins();
