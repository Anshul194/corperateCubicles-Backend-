import mongoose from 'mongoose';
import XLSX from 'xlsx';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import User from './models/user.js';
import CourseEnrollment from './models/CourseEnrollment.js';
import Course from './models/Course.js';
import CourseChatRoom from './models/CourseChatRoom.js';

dotenv.config();

const config = {
    courseId: '6a1f02677a8d1f8e480a783a', // Become an AI Builder in 30 Days.
    planId: '6a1f02677a8d1f8e480a7841',
    excelPath: 'd:/nexprism/lms_backend/new_entries_only(2) (1).xlsx'
};

function nameFromEmail(email) {
    const local = email.split('@')[0];
    return local
        .replace(/[._\-+]/g, ' ')
        .replace(/\d+/g, '')
        .trim()
        .split(' ')
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ') || 'Student';
}

async function addUserToCourseChat(userId, courseId) {
    try {
        const room = await CourseChatRoom.findOne({ courseId });
        if (room && !room.participants.map(String).includes(String(userId))) {
            room.participants.push(userId);
            await room.save();
        }
    } catch (err) {
        console.error(`❌ Chat-room add failed for user ${userId}:`, err.message);
    }
}

async function runEnrollment() {
    console.log('🚀 Starting enrollment process...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB.');

    const workbook = XLSX.readFile(config.excelPath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);
    console.log(`📊 Found ${rows.length} rows in Excel.`);

    const results = { enrolled: 0, created: 0, skipped: 0, errors: 0 };
    const accessExpiry = new Date('2026-09-10T23:59:59.000Z');

    for (const row of rows) {
        const email = (row['email'] || row['Email'] || '').toString().trim().toLowerCase();
        const phone = (row['phone'] || row['Phone'] || '').toString().trim();
        const status = (row['payment status'] || row['Payment Status'] || '').toString().trim().toLowerCase();

        if (!email || !email.includes('@')) continue;

        // "captured one only" logic
        if (status && status !== 'captured' && status !== 'success') {
            results.skipped++;
            continue;
        }

        try {
            let user = await User.findOne({ email });
            if (!user) {
                // SECURITY: per-account unguessable password instead of the shared
                // 'Student@123' constant (mass takeover via POST /login). Students set
                // their own via "Forgot Password" on the login page.
                const hashedPwd = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
                user = await User.create({
                    fullName: nameFromEmail(email),
                    email,
                    password: hashedPwd,
                    role: 'student',
                    phone: phone || undefined,
                    is_verify: true,
                    emailVerified: true,
                });
                results.created++;
            }

            const existing = await CourseEnrollment.findOne({ userId: user._id, courseId: config.courseId });
            if (existing && existing.status === 'active') {
                results.skipped++;
                console.log(`⏩ Skipped ${email} (already active)`);
                await addUserToCourseChat(user._id, config.courseId);
                continue;
            }

            if (existing) {
                await CourseEnrollment.findByIdAndUpdate(existing._id, {
                    status: 'active',
                    enrolledAt: new Date(),
                    accessExpiry,
                    coursePlanId: config.planId,
                });
                console.log(`✅ Renewed ${email}`);
            } else {
                await CourseEnrollment.create({
                    userId: user._id,
                    courseId: config.courseId,
                    coursePlanId: config.planId,
                    type: 'coursePlan',
                    status: 'active',
                    accessType: 'limited',
                    accessExpiry,
                    enrollmentSource: 'import',
                    enrolledAt: new Date(),
                });

                await Course.findByIdAndUpdate(config.courseId, {
                    $addToSet: { enrolledStudents: user._id },
                    $inc: { enrolledStudentsCount: 1 },
                });
                console.log(`✅ Enrolled ${email}`);
            }

            await addUserToCourseChat(user._id, config.courseId);
            results.enrolled++;

        } catch (err) {
            console.error(`❌ Error with ${email}:`, err.message);
            results.errors++;
        }
    }

    console.log('-----------------------------------');
    console.log('Final Summary:');
    console.log('Total Enrolled/Updated:', results.enrolled);
    console.log('Users Created:', results.created);
    console.log('Skipped/Already Enrolled:', results.skipped);
    console.log('Errors:', results.errors);
    console.log('-----------------------------------');

    await mongoose.disconnect();
    process.exit(0);
}

runEnrollment();
