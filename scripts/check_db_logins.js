import mongoose from 'mongoose';
import { connectToDatabase } from '../db/connect.js';
import LoginLog from '../models/LoginLog.js';
import User from '../models/User.js';

const checkLogins = async () => {
    try {
        await connectToDatabase();
        console.log('Fetching login logs...');

        const logs = await LoginLog.find({ loginStatus: 'success' })
            .populate('userId', 'fullName email')
            .sort({ loginTime: 1 }) // Sort by time ascending (first to last)
            .limit(100); // Limit to top 100 for display

        if (logs.length === 0) {
            console.log('No login logs found.');
            process.exit(0);
        }

        console.log('\n--- First 100 Logins From Database ---');
        logs.forEach((log, index) => {
            const user = log.userId || {};
            const time = log.loginTime ? log.loginTime.toLocaleString() : 'N/A';
            const location = log.location ? `${log.location.city || 'Unknown'}, ${log.location.country || 'Unknown'}` : 'Unknown';
            const device = log.deviceInfo ? `${log.deviceInfo.platform || 'N/A'} - ${log.deviceInfo.browserName || 'N/A'}` : 'N/A';

            console.log(`${index + 1}. User: ${user.fullName || 'Unknown'} (${user.email || 'No Email'})`);
            console.log(`   Time: ${time}`);
            console.log(`   Location: ${location}`);
            console.log(`   Device: ${device}`);
            console.log(`   Status: ${log.loginStatus}`);
            console.log('---------------------------');
        });

        const totalCount = await LoginLog.countDocuments({ loginStatus: 'success' });
        console.log(`\nTotal successful logins in database: ${totalCount}`);

        process.exit(0);
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
};

checkLogins();
