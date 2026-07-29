import mongoose from 'mongoose';
import XLSX from 'xlsx';
import path from 'path';
import { connectToDatabase } from '../db/connect.js';
import LoginLog from '../models/LoginLog.js';
import User from '../models/User.js';

/**
 * Script to check the first login time for users provided in an Excel file.
 * Usage: node check_excel_users_login_status.js <path_to_excel_file>
 */

const args = process.argv.slice(2);
if (args.length === 0) {
    console.error('Please provide the path to the Excel file.');
    process.exit(1);
}

const excelPath = path.resolve(args[0]);

const main = async () => {
    try {
        await connectToDatabase();

        const workbook = XLSX.readFile(excelPath);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet);

        if (rows.length === 0) {
            console.log('The Excel file is empty.');
            process.exit(0);
        }

        // Identify all possible headers across all rows
        const allHeaders = new Set();
        rows.forEach(row => {
            Object.keys(row).forEach(key => allHeaders.add(key));
        });
        const headersList = Array.from(allHeaders);
        const emailKey = headersList.find(h => h.toLowerCase() === 'email');

        if (!emailKey) {
            console.error('Could not find an "Email" column in the Excel file.');
            console.log('Available columns:', headersList.join(', '));
            process.exit(1);
        }

        const emails = [...new Set(rows.map(r => r[emailKey]).filter(Boolean))];
        console.log(`Processing ${emails.length} unique emails from Excel...`);

        const results = [];

        for (const email of emails) {
            // Find the user ID for this email
            const user = await User.findOne({ email: email.toLowerCase() });
            
            if (!user) {
                results.push({ email, firstLogin: null, status: 'User not found in DB' });
                continue;
            }

            // Find the earliest successful login log for this user
            const firstLog = await LoginLog.findOne({ userId: user._id, loginStatus: 'success' })
                .sort({ loginTime: 1 });

            if (firstLog) {
                results.push({
                    email,
                    fullName: user.fullName,
                    firstLogin: firstLog.loginTime,
                    location: firstLog.location ? `${firstLog.location.city || ''}, ${firstLog.location.country || ''}` : 'N/A',
                    device: firstLog.deviceInfo ? `${firstLog.deviceInfo.platform} (${firstLog.deviceInfo.browserName})` : 'N/A',
                    status: 'Logged in'
                });
            } else {
                results.push({ email, fullName: user.fullName, firstLogin: null, status: 'No login logs found' });
            }
        }

        // Sort results by firstLogin time (nulls at the end)
        results.sort((a, b) => {
            if (!a.firstLogin) return 1;
            if (!b.firstLogin) return -1;
            return a.firstLogin - b.firstLogin;
        });

        console.log('\n--- User Login Order Details ---');
        results.forEach((res, index) => {
            console.log(`${index + 1}. ${res.fullName || 'N/A'} (${res.email})`);
            if (res.firstLogin) {
                console.log(`   First Login: ${res.firstLogin.toLocaleString()}`);
                console.log(`   Location: ${res.location}`);
                console.log(`   Device: ${res.device}`);
            } else {
                console.log(`   Status: ${res.status}`);
            }
            console.log('---------------------------');
        });

        process.exit(0);
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
};

main();
