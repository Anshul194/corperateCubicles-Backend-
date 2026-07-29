import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { bulkEnrollFromExcel } from './controllers/bulkEnrollmentController.js';

dotenv.config();

async function runEnrollment() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const req = {
            body: {
                courseId: '6a1f02677a8d1f8e480a783a', // Become an AI Builder in 30 Days.
                planId: '6a1f02677a8d1f8e480a7841',   // Basic Plan
                filePath: 'd:\\nexprism\\lms_backend\\new_student_entries_all_data.xlsx',
                accessExpiry: '2026-09-10T23:59:59.000Z'
            }
        };

        const res = {
            status: (code) => {
                console.log('Status Code:', code);
                return res;
            },
            json: (data) => {
                console.log('Response JSON:', JSON.stringify(data, null, 2));
                return res;
            }
        };

        await bulkEnrollFromExcel(req, res);

        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    } catch (err) {
        console.error('Error in runEnrollment:', err);
    }
}

runEnrollment();
