/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║           MIGRATION ENROLLMENT SCRIPT                       ║
 * ║  Source: 68cd611b764a92c354346a4c (Plan: ...389d)            ║
 * ║  Filter: AccessExpiry > 30 days from now                    ║
 * ║  Target: 6a1f02677a8d1f8e480a783a (Plan: ...7841)            ║
 * ║  Set Expiry: Sep 10, 2026                                   ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import 'dotenv/config';
import mongoose from 'mongoose';

// ── CONFIG ────────────────────────────────────────────────────────────────────
const SOURCE_COURSE_ID = '68cd611b764a92c354346a4c';
const SOURCE_PLAN_ID = '68d14ab6863c4aa13942389d';
const TARGET_COURSE_ID = '6a1f02677a8d1f8e480a783a';
const TARGET_PLAN_ID = '6a1f02677a8d1f8e480a7841';

const TARGET_EXPIRY = new Date('2026-09-10T23:59:59.000Z');
// ─────────────────────────────────────────────────────────────────────────────

const { Schema } = mongoose;

const userSchema = new Schema({ email: String }, { strict: false });
const enrollmentSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    courseId: Schema.Types.ObjectId,
    coursePlanId: Schema.Types.ObjectId,
    accessExpiry: Date,
    status: String
}, { strict: false });

const chatRoomSchema = new Schema({
    courseId: Schema.Types.ObjectId,
    participants: [{ type: Schema.Types.ObjectId, ref: 'User' }]
}, { strict: false });

const User = mongoose.models.User || mongoose.model('User', userSchema);
const CourseEnrollment = mongoose.models.CourseEnrollment || mongoose.model('CourseEnrollment', enrollmentSchema);
const CourseChatRoom = mongoose.models.CourseChatRoom || mongoose.model('CourseChatRoom', chatRoomSchema);
const Course = mongoose.models.Course || mongoose.model('Course', new Schema({}, { strict: false }));

async function main() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('🔌 Connected to MongoDB\n');

    const oneMonthFromNow = new Date();
    oneMonthFromNow.setDate(oneMonthFromNow.getDate() + 30);

    console.log(`🔍 Finding students in Source Course with > 30 days left...`);
    const enrollments = await CourseEnrollment.find({
        courseId: SOURCE_COURSE_ID,
        coursePlanId: SOURCE_PLAN_ID,
        status: 'active',
        accessExpiry: { $gt: oneMonthFromNow }
    }).populate('userId');

    console.log(`📊 Found ${enrollments.length} matching students.\n`);

    for (let i = 0; i < enrollments.length; i++) {
        const enr = enrollments[i];
        const user = enr.userId;
        if (!user) continue;

        const userId = user._id;
        const email = user.email || 'unknown';
        const progress = `[${i + 1}/${enrollments.length}]`;

        try {
            // 1. Target enrollment
            const existing = await CourseEnrollment.findOne({ userId, courseId: TARGET_COURSE_ID });
            if (existing) {
                await CourseEnrollment.findByIdAndUpdate(existing._id, {
                    status: 'active',
                    accessExpiry: TARGET_EXPIRY,
                    coursePlanId: TARGET_PLAN_ID,
                    enrollmentSource: 'migration'
                });
                console.log(`${progress} 🔄 Updated: ${email}`);
            } else {
                await CourseEnrollment.create({
                    userId,
                    courseId: TARGET_COURSE_ID,
                    coursePlanId: TARGET_PLAN_ID,
                    type: 'coursePlan',
                    status: 'active',
                    accessType: 'limited',
                    accessExpiry: TARGET_EXPIRY,
                    enrollmentSource: 'migration',
                    enrolledAt: new Date()
                });
                await Course.findByIdAndUpdate(TARGET_COURSE_ID, {
                    $addToSet: { enrolledStudents: userId },
                    $inc: { enrolledStudentsCount: 1 }
                });
                console.log(`${progress} ✅ Created: ${email}`);
            }

            // 2. Chat access
            const room = await CourseChatRoom.findOne({ courseId: TARGET_COURSE_ID });
            if (room && !room.participants.map(String).includes(String(userId))) {
                room.participants.push(userId);
                await room.save();
            }

        } catch (err) {
            console.error(`${progress} ❌ Error for ${email}: ${err.message}`);
        }
    }

    console.log('\n✅ Migration complete!');
    await mongoose.disconnect();
}

main().catch(console.error);
