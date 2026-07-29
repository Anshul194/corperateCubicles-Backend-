import mongoose from 'mongoose';
import dotenv from 'dotenv';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import XLSX from 'xlsx';
import fs from 'fs';
import User from './models/user.js';
import CourseEnrollment from './models/CourseEnrollment.js';
import Course from './models/Course.js';
import CourseChatRoom from './models/CourseChatRoom.js';
import CoursePlan from './models/CoursePlan.js';

dotenv.config();

const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/lms_backend';

// Settings
const filePath = './Final list of ai course students-2.xlsx';
const primaryCourseId = '69737746d685e498d79b09d9'; // AI course
const primaryPlanId = '69737746d685e498d79b09db';
const primaryExpiry = new Date('2026-09-10T23:59:59.000Z');

const secondaryCourseId = '69aebfc38e1d5253aca58f29'; // MVP Engineering
let secondaryPlanId = '69aebfc38e1d5253aca58f2b'; // Fallback
let secondaryEnrollmentType = 'coursePlan';

const secondaryExpiry = new Date('2026-09-08T23:59:59.000Z');

function nameFromEmail(email) {
    const local = email.split('@')[0];
    return local.replace(/[._\-+]/g, ' ').replace(/\d+/g, '').trim().split(' ').filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ') || 'Student';
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

async function run() {
    try {
        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB');

        if (!fs.existsSync(filePath)) {
            console.error('File not found:', filePath);
            return;
        }

        const workbook = XLSX.readFile(filePath);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet);

        // 1. Resolve Secondary Plan
        try {
            const foundPlan = await CoursePlan.findOne({ courseId: secondaryCourseId });
            if (foundPlan) {
                secondaryPlanId = foundPlan._id;
                secondaryEnrollmentType = 'coursePlan';
            } else {
                secondaryEnrollmentType = 'course';
            }
        } catch (e) {
            secondaryEnrollmentType = 'course';
        }

        console.log(`Processing ${rows.length} rows...`);

        const processedEmails = new Set();
        const finalResults = [];

        for (const row of rows) {
            const rawEmailField = (row['email'] || row['Email'] || row['EMAIL'] || '').toString().trim().toLowerCase();
            const phone = (row['phone'] || row['Phone'] || row['PHONE'] || row['mobile'] || row['Mobile'] || '').toString().trim();
            const rawStatus = (row['payment status'] || row['Payment Status'] || row['status'] || 'N/A').toString().trim();

            const extractedEmails = rawEmailField.split(/[\s,;]+/).filter(e => e.includes('@'));

            if (extractedEmails.length === 0) {
                const rowResult = { email: rawEmailField || 'MISSING', phone, primary: 'skipped', secondary: 'skipped', notes: `Status: ${rawStatus} | Error: Missing or invalid email` };
                finalResults.push(rowResult);
                continue;
            }

            for (const email of extractedEmails) {
                const rowResult = { email, phone, primary: 'skipped', secondary: 'skipped', notes: `Status: ${rawStatus}` };

                // ─── DUPLICATE CHECK (within this run) ───
                if (processedEmails.has(email)) {
                    rowResult.notes += ' | Info: Duplicate email in Excel';
                    finalResults.push(rowResult);
                    continue;
                }
                processedEmails.add(email);

                try {
                    // Find or create user
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
                        console.log(`Created user: ${email}`);
                    }

                    const userId = user._id;

                    // --- Primary Enrollment ---
                    const existing = await CourseEnrollment.findOne({ userId, courseId: primaryCourseId });
                    if (!existing) {
                        await CourseEnrollment.create({
                            userId,
                            courseId: primaryCourseId,
                            coursePlanId: primaryPlanId,
                            type: 'coursePlan',
                            status: 'active',
                            accessType: 'limited',
                            accessExpiry: primaryExpiry,
                            enrollmentSource: 'import',
                            enrolledAt: new Date(),
                        });
                        await Course.findByIdAndUpdate(primaryCourseId, {
                            $addToSet: { enrolledStudents: userId },
                            $inc: { enrolledStudentsCount: 1 }
                        });
                        console.log(`Enrolled ${email} in Primary`);
                        rowResult.primary = 'Enrolled';
                    } else {
                        if (existing.status !== 'active') {
                            existing.status = 'active';
                            existing.accessExpiry = primaryExpiry;
                            await existing.save();
                            rowResult.primary = 'Re-activated';
                        } else {
                            rowResult.primary = 'Already Enrolled';
                        }
                    }
                    await addUserToCourseChat(userId, primaryCourseId);

                    // --- Secondary Enrollment ---
                    const existingSec = await CourseEnrollment.findOne({ userId, courseId: secondaryCourseId });
                    if (!existingSec) {
                        await CourseEnrollment.create({
                            userId,
                            courseId: secondaryCourseId,
                            coursePlanId: secondaryEnrollmentType === 'coursePlan' ? secondaryPlanId : undefined,
                            type: secondaryEnrollmentType,
                            status: 'active',
                            accessType: 'limited',
                            accessExpiry: secondaryExpiry,
                            enrollmentSource: 'import',
                            enrolledAt: new Date(),
                        });
                        await Course.findByIdAndUpdate(secondaryCourseId, {
                            $addToSet: { enrolledStudents: userId },
                            $inc: { enrolledStudentsCount: 1 }
                        });
                        console.log(`Enrolled ${email} in Secondary`);
                        rowResult.secondary = 'Enrolled';
                    } else {
                        if (existingSec.status !== 'active') {
                            existingSec.status = 'active';
                            existingSec.accessExpiry = secondaryExpiry;
                            await existingSec.save();
                            rowResult.secondary = 'Re-activated';
                        } else {
                            rowResult.secondary = 'Already Enrolled';
                        }
                    }
                    await addUserToCourseChat(userId, secondaryCourseId);

                    finalResults.push(rowResult);

                } catch (err) {
                    console.error(`Error processing ${email}:`, err.message);
                    rowResult.notes += ` | Error: ${err.message}`;
                    finalResults.push(rowResult);
                }
            }
        }

        // ─── WRITE CSV ───
        const csvHeader = 'Email,Phone,Primary Course,Secondary Course,Notes\n';
        const csvRows = finalResults.map(r => `"${r.email || ''}","${r.phone || ''}","${r.primary}","${r.secondary}","${r.notes}"`).join('\n');
        fs.writeFileSync('enrollment_results_full.csv', csvHeader + csvRows);
        console.log(`CSV saved: enrollment_results_full.csv (Total rows: ${finalResults.length})`);

        await mongoose.disconnect();
    } catch (err) {
        console.error('Fatal error:', err);
    }
}

run();
