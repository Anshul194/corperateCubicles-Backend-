/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║           BULK ENROLL SCRIPT  — payment_links xlsx          ║
 * ║  Reads ALL unique emails from the sheet (no status filter)  ║
 * ║  → finds/creates user                                       ║
 * ║  → enrolls into course with plan                            ║
 * ║  → adds to course community chat                            ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * Run:
 *   node scripts/bulk-enroll.mjs
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── CONFIG ────────────────────────────────────────────────────────────────────
const EXCEL_FILE = path.join(__dirname, '..', 'Final list of ai course students-2.xlsx');
const COURSE_ID = '6a1f02677a8d1f8e480a783a';
const PLAN_ID = '6a1f02677a8d1f8e480a7841';
const ACCESS_EXPIRY = new Date('2026-09-10T23:59:59.000Z');
// SECURITY: new accounts get a per-account random password (generated below), never a
// shared constant. Students set their own via "Forgot Password" on the login page.
// ─────────────────────────────────────────────────────────────────────────────

// ── MODELS (inline, no import chain) ─────────────────────────────────────────
const { Schema } = mongoose;

const userSchema = new Schema({
    fullName: { type: String, required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, default: 'student' },
    phone: { type: String },
    is_verify: { type: Boolean, default: true },
    emailVerified: { type: Boolean, default: true },
    status: { type: String, default: 'active' },
    isActive: { type: Boolean, default: true },
}, { timestamps: true });

const enrollmentSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, required: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course' },
    coursePlanId: { type: Schema.Types.ObjectId, ref: 'CoursePlan' },
    enrolledAt: { type: Date, default: Date.now },
    accessType: { type: String, default: 'limited' },
    accessExpiry: { type: Date },
    status: { type: String, default: 'active' },
    enrollmentSource: { type: String, default: 'import' },
    addToRevenue: { type: Boolean, default: false },
    pricePaid: { type: Number, default: 0 },
}, { timestamps: true });

const chatRoomSchema = new Schema({
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true, unique: true },
    participants: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

const courseSchema = new Schema({
    title: String,
    enrolledStudents: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    enrolledStudentsCount: { type: Number, default: 0 },
}, { timestamps: true });

const User = mongoose.models.User || mongoose.model('User', userSchema);
const CourseEnrollment = mongoose.models.CourseEnrollment || mongoose.model('CourseEnrollment', enrollmentSchema);
const CourseChatRoom = mongoose.models.CourseChatRoom || mongoose.model('CourseChatRoom', chatRoomSchema);
const Course = mongoose.models.Course || mongoose.model('Course', courseSchema);

// ── HELPERS ───────────────────────────────────────────────────────────────────
function nameFromEmail(email) {
    const local = email.split('@')[0];
    return local
        .replace(/[._\-+]/g, ' ')
        .replace(/\d+/g, '')
        .trim()
        .split(' ')
        .filter(Boolean)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ') || 'Student';
}

async function addToChat(userId, courseId) {
    try {
        const room = await CourseChatRoom.findOne({ courseId });
        if (room) {
            const alreadyIn = room.participants.map(String).includes(String(userId));
            if (!alreadyIn) {
                room.participants.push(userId);
                await room.save();
            }
        }
    } catch (e) {
        console.warn(`  ⚠️  Chat-room add failed: ${e.message}`);
    }
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
async function main() {
    // 1. Connect to MongoDB
    const MONGO_URI = process.env.MONGO_URI;
    if (!MONGO_URI) throw new Error('MONGO_URI not set in .env');

    console.log('🔌 Connecting to MongoDB…');
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 15000 });
    console.log('✅ Connected!\n');

    // 2. Read Excel — ALL rows, deduplicate by email
    const wb = XLSX.readFile(EXCEL_FILE);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const allRows = XLSX.utils.sheet_to_json(ws);

    // Deduplicate by email (keep last occurrence so latest payment info wins)
    const emailMap = new Map();
    for (const row of allRows) {
        const email = (row['email'] || row['Email'] || row['EMAIL'] || '').toString().trim().toLowerCase();
        if (email && email.includes('@')) {
            emailMap.set(email, row);
        }
    }

    const uniqueRows = [...emailMap.values()];
    console.log(`📊 Excel stats:`);
    console.log(`   Total rows    : ${allRows.length}`);
    console.log(`   Unique emails : ${uniqueRows.length}`);
    console.log(`   Target course : ${COURSE_ID}`);
    console.log(`   Target plan   : ${PLAN_ID}`);
    console.log(`   Access expiry : ${ACCESS_EXPIRY.toDateString()}\n`);

    // 3. Process each unique email
    const results = {
        enrolled: [],
        renewed: [],
        skipped: [],
        created: [],
        errors: [],
    };

    for (let i = 0; i < uniqueRows.length; i++) {
        const row = uniqueRows[i];
        const email = (row['email'] || row['Email'] || row['EMAIL'] || '').toString().trim().toLowerCase();
        const phone = (row['phone'] || row['Phone'] || row['mobile'] || '').toString().trim();
        const progress = `[${i + 1}/${uniqueRows.length}]`;

        try {
            // 3a. Find or create user
            let user = await User.findOne({ email });
            let isNew = false;

            if (!user) {
                // SECURITY: per-account unguessable password instead of a shared constant.
                const hashedPwd = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
                user = await User.create({
                    fullName: nameFromEmail(email),
                    email,
                    password: hashedPwd,
                    role: 'student',
                    phone: phone || undefined,
                    is_verify: true,
                    emailVerified: true,
                    status: 'active',
                    isActive: true,
                });
                isNew = true;
                results.created.push(email);
                console.log(`  ${progress} ✨ Created user  : ${email}`);
            } else {
                console.log(`  ${progress} 👤 Found user    : ${email}`);
            }

            const userId = user._id;

            // 3b. Check existing enrollment
            const existing = await CourseEnrollment.findOne({ userId, courseId: COURSE_ID });

            if (existing) {
                const now = new Date();
                const isExpired = existing.accessExpiry && existing.accessExpiry < now;
                const isActive = existing.status === 'active' && !isExpired;

                if (isActive) {
                    // Already active — just refresh expiry to Sep 10 and ensure chat
                    await CourseEnrollment.findByIdAndUpdate(existing._id, {
                        accessExpiry: ACCESS_EXPIRY,
                        coursePlanId: PLAN_ID,
                    });
                    await addToChat(userId, COURSE_ID);
                    results.skipped.push(email);
                    console.log(`         ⏭️  Already enrolled (expiry updated)`);
                    continue;
                }

                // Expired — renew
                await CourseEnrollment.findByIdAndUpdate(existing._id, {
                    status: 'active',
                    enrolledAt: new Date(),
                    accessExpiry: ACCESS_EXPIRY,
                    accessType: 'limited',
                    enrollmentSource: 'import',
                    coursePlanId: PLAN_ID,
                });
                await addToChat(userId, COURSE_ID);
                results.renewed.push(email);
                console.log(`         🔄 Renewed enrollment`);
                continue;
            }

            // 3c. Fresh enrollment
            await CourseEnrollment.create({
                userId,
                courseId: COURSE_ID,
                coursePlanId: PLAN_ID,
                type: 'coursePlan',
                status: 'active',
                accessType: 'limited',
                accessExpiry: ACCESS_EXPIRY,
                enrollmentSource: 'import',
                enrolledAt: new Date(),
            });

            // Update course enrolled list
            await Course.findByIdAndUpdate(COURSE_ID, {
                $addToSet: { enrolledStudents: userId },
                $inc: { enrolledStudentsCount: 1 },
            });

            await addToChat(userId, COURSE_ID);

            results.enrolled.push({ email, action: isNew ? 'created+enrolled' : 'enrolled' });
            console.log(`         ✅ Enrolled${isNew ? ' (new user)' : ''}`);

        } catch (err) {
            results.errors.push({ email, reason: err.message });
            console.error(`  ${progress} ❌ Error for ${email}: ${err.message}`);
        }
    }

    // 4. Summary
    console.log('\n' + '═'.repeat(60));
    console.log('📋  BULK ENROLLMENT COMPLETE');
    console.log('═'.repeat(60));
    console.log(`  Total processed : ${uniqueRows.length}`);
    console.log(`  ✅ Enrolled      : ${results.enrolled.length}`);
    console.log(`  🔄 Renewed       : ${results.renewed.length}`);
    console.log(`  ⏭️  Skipped (active): ${results.skipped.length}`);
    console.log(`  ✨ New users     : ${results.created.length}`);
    console.log(`  ❌ Errors        : ${results.errors.length}`);

    if (results.errors.length > 0) {
        console.log('\n⚠️  ERRORS:');
        results.errors.forEach(e => console.log(`   • ${e.email} → ${e.reason}`));
    }

    console.log('\n✅ Done! Disconnecting…');
    await mongoose.disconnect();
}

main().catch(err => {
    console.error('💥 Fatal error:', err.message);
    process.exit(1);
});
