import XLSX from 'xlsx';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import User from '../models/user.js';
import CourseEnrollment from '../models/CourseEnrollment.js';
import Course from '../models/Course.js';
import CourseChatRoom from '../models/CourseChatRoom.js';
import CoursePlan from '../models/CoursePlan.js';
import { initRedis } from '../config/redisClient.js';

/**
 * Resolve a client-supplied filePath safely against a fixed staging directory.
 *
 * Prevents arbitrary server file reads: only the basename of the supplied value
 * is honoured (directory components and absolute paths are stripped), the value
 * must be a plain string free of path-traversal sequences / null bytes, and the
 * final resolved path is confined to UPLOAD_EXCEL_STAGING_DIR.
 *
 * @returns {string} absolute, confined path safe to pass to XLSX.readFile
 * @throws {Error} with `.statusCode = 400` if the path is invalid or escapes the base
 */
function resolveStagedExcelPath(filePath) {
    if (typeof filePath !== 'string' || !filePath.trim()) {
        const err = new Error('filePath must be a non-empty string.');
        err.statusCode = 400;
        throw err;
    }
    if (filePath.includes('\0') || filePath.includes('..')) {
        const err = new Error('Invalid filePath.');
        err.statusCode = 400;
        throw err;
    }

    const base = path.resolve(process.env.UPLOAD_EXCEL_STAGING_DIR || 'uploads/excel/tmp');
    // Strip any directory components / absolute path the client may have supplied.
    const candidate = path.resolve(base, path.basename(filePath));

    if (candidate !== base && !candidate.startsWith(base + path.sep)) {
        const err = new Error('Invalid filePath.');
        err.statusCode = 400;
        throw err;
    }
    return candidate;
}

/**
 * Derive a display name from an email address.
 * e.g. "john.doe123@gmail.com" → "John Doe"
 */
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

/**
 * Add a user to the course chat room (community access).
 */
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

// ─────────────────────────────────────────────────────────────────────────────
// Shared bulk-enroll helpers
//
// Both the general bulk-enroll flow and the legacy "special" promo flow run the
// same per-student logic, so it lives here once. The controllers below only
// differ in which course(s) they target.
// ─────────────────────────────────────────────────────────────────────────────

/** Read the uploaded/staged workbook and return its first sheet as JSON rows. */
function readRowsFromRequest(req) {
    let workbook;
    if (req.file) {
        // Uploaded via multipart
        workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    } else if (req.body.filePath) {
        // Confine to a fixed staging dir — never read an arbitrary server path.
        workbook = XLSX.readFile(resolveStagedExcelPath(req.body.filePath));
    } else {
        const err = new Error('No Excel file provided. Upload a file or supply a filePath.');
        err.statusCode = 400;
        throw err;
    }
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json(sheet); // uses first row as headers
}

/** Pull a normalised email from a sheet row (handles Email / EMAIL / email). */
function extractEmail(row) {
    return (row['email'] || row['Email'] || row['EMAIL'] || '')
        .toString().trim().toLowerCase();
}

/** Pull a phone number from a sheet row (handles phone / mobile variants). */
function extractPhone(row) {
    return (
        row['phone'] || row['Phone'] || row['PHONE'] ||
        row['mobile'] || row['Mobile'] || ''
    ).toString().trim();
}

/** Pull a normalised payment status from a sheet row. */
function extractPaymentStatus(row) {
    return (row['payment status'] || row['Payment Status'] || row['status'] || '')
        .toString().trim().toLowerCase();
}

/**
 * Find an existing user by email, or create a fresh student account.
 *
 * @returns {Promise<{ user: object, isNewUser: boolean }>}
 */
async function findOrCreateUser(email, phone) {
    const existing = await User.findOne({ email });
    if (existing) return { user: existing, isNewUser: false };

    // SECURITY: never create accounts with a shared hardcoded password
    // (e.g. 'Student@123') — anyone could log into every bulk-enrolled
    // account via POST /login with that constant. Generate a per-account
    // unguessable password; the student sets their own via "Forgot
    // Password" on the login page (no password is ever emailed).
    const hashedPwd = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
    const user = await User.create({
        fullName: nameFromEmail(email),
        email,
        password: hashedPwd,
        role: 'student',
        phone: phone || undefined,
        is_verify: true,
        emailVerified: true,
    });
    return { user, isNewUser: true };
}

/**
 * Enroll (or renew) a single user into one course.
 *
 * Encapsulates the create / renew / already-active logic shared by every bulk
 * flow, keeps Course.enrolledStudents in sync, and grants community chat access.
 *
 * @param {object}  opts
 * @param {string}  opts.userId
 * @param {string}  opts.courseId
 * @param {string} [opts.planId]          CoursePlan _id; omit for a direct course enrollment
 * @param {Date}    opts.accessExpiry
 * @param {string} [opts.enrollmentType]  'coursePlan' | 'course'; inferred from planId when absent
 * @returns {Promise<'enrolled'|'renewed'|'already_active'>}
 */
async function enrollUserInCourse({ userId, courseId, planId, accessExpiry, enrollmentType }) {
    const type = enrollmentType || (planId ? 'coursePlan' : 'course');
    const coursePlanId = type === 'coursePlan' ? planId : undefined;

    const existing = await CourseEnrollment.findOne({ userId, courseId });

    if (existing) {
        const isExpired = existing.accessExpiry && existing.accessExpiry < new Date();
        if (existing.status === 'active' && !isExpired) {
            // Already active — just make sure community chat access is in place.
            await addUserToCourseChat(userId, courseId);
            return 'already_active';
        }
        // Renew an expired / inactive enrollment.
        await CourseEnrollment.findByIdAndUpdate(existing._id, {
            status: 'active',
            enrolledAt: new Date(),
            accessExpiry,
            accessType: 'limited',
            enrollmentSource: 'import',
            coursePlanId,
        });
        await addUserToCourseChat(userId, courseId);
        return 'renewed';
    }

    // Fresh enrollment.
    await CourseEnrollment.create({
        userId,
        courseId,
        coursePlanId,
        type,
        status: 'active',
        accessType: 'limited',
        accessExpiry,
        enrollmentSource: 'import',
        enrolledAt: new Date(),
    });
    await Course.findByIdAndUpdate(courseId, {
        $addToSet: { enrolledStudents: userId },
        $inc: { enrolledStudentsCount: 1 },
    });
    await addUserToCourseChat(userId, courseId);
    return 'enrolled';
}

/**
 * POST /enrollment/bulk-enroll
 *
 * Upload an Excel sheet and enroll every listed student into a course/plan, and
 * — optionally — into a second course in the same pass (this subsumes the old
 * /bulk-enroll-special endpoint, with no hard-coded course IDs).
 *
 * Body (multipart/form-data) — or application/json with `filePath` for a staged file:
 *   file                  - Excel (.xlsx / .xls) with at least an "email" column ("phone" optional)
 *   courseId              - MongoDB ObjectId of the target course            (required)
 *   planId                - MongoDB ObjectId of the course plan              (required)
 *   accessExpiry          - ISO date string for course expiry (default: 2026-09-10)
 *   secondaryCourseId     - (optional) also enroll each student into this course
 *   secondaryPlanId       - (optional) CoursePlan _id for the secondary course; omit for a direct course enrollment
 *   secondaryAccessExpiry - (optional) ISO date string; defaults to accessExpiry
 */
export const bulkEnrollFromExcel = async (req, res) => {
    const results = { enrolled: [], created: [], skipped: [], errors: [], secondary: [], warnings: [] };

    try {
        const courseId = req.body.courseId;
        const planId = req.body.planId;
        const accessExpiry = req.body.accessExpiry
            ? new Date(req.body.accessExpiry)
            : new Date('2026-09-10T23:59:59.000Z');

        if (!courseId || !planId) {
            return res.status(400).json({
                success: false,
                message: 'courseId and planId are required in the request body.',
            });
        }

        // Optional secondary course — fully parameterised, no magic IDs.
        const secondaryCourseId = req.body.secondaryCourseId || null;
        const secondaryPlanId = req.body.secondaryPlanId || null;
        const secondaryEnrollmentType =
            req.body.secondaryEnrollmentType || (secondaryPlanId ? 'coursePlan' : 'course');
        const secondaryAccessExpiry = req.body.secondaryAccessExpiry
            ? new Date(req.body.secondaryAccessExpiry)
            : accessExpiry;

        // ── 1. Read the workbook ─────────────────────────────────────────────────
        const rows = readRowsFromRequest(req);
        if (!rows.length) {
            return res.status(400).json({ success: false, message: 'Excel sheet is empty.' });
        }

        // ── 2. Verify course(s) exist ────────────────────────────────────────────
        const course = await Course.findById(courseId).lean();
        if (!course) {
            return res.status(404).json({ success: false, message: 'Course not found.' });
        }
        // A missing secondary course is non-fatal: the primary enrollment is the
        // point of the request, so skip the secondary and report it rather than
        // failing the whole batch (which would also abandon the primary).
        let secondaryActive = false;
        if (secondaryCourseId) {
            const secondaryCourse = await Course.findById(secondaryCourseId).lean();
            if (secondaryCourse) {
                secondaryActive = true;
            } else {
                results.warnings.push(
                    `Secondary course ${secondaryCourseId} not found — secondary enrollment skipped.`
                );
            }
        }

        // ── 3. Process each row ──────────────────────────────────────────────────
        for (const row of rows) {
            const email = extractEmail(row);
            const phone = extractPhone(row);

            if (!email || !email.includes('@')) {
                results.errors.push({ row, reason: 'Invalid or missing email' });
                continue;
            }

            // Only skip if status is present and NOT 'captured' or 'success'
            const rawStatus = extractPaymentStatus(row);
            if (rawStatus && rawStatus !== 'captured' && rawStatus !== 'success') {
                results.skipped.push({ email, reason: `Payment status is '${rawStatus}', not 'captured' or 'success'.` });
                continue;
            }

            try {
                const { user, isNewUser } = await findOrCreateUser(email, phone);
                if (isNewUser) results.created.push(email);
                const userId = user._id;

                // ── 3a. Primary enrollment ───────────────────────────────────────
                const action = await enrollUserInCourse({
                    userId, courseId, planId, accessExpiry, enrollmentType: 'coursePlan',
                });
                if (action === 'already_active') {
                    results.skipped.push({ email, reason: 'Already enrolled and active' });
                } else {
                    results.enrolled.push({
                        email,
                        action: action === 'enrolled' && isNewUser ? 'created+enrolled' : action,
                        userId,
                    });
                }

                // ── 3b. Secondary enrollment (optional) ──────────────────────────
                if (secondaryActive) {
                    const secAction = await enrollUserInCourse({
                        userId,
                        courseId: secondaryCourseId,
                        planId: secondaryPlanId,
                        accessExpiry: secondaryAccessExpiry,
                        enrollmentType: secondaryEnrollmentType,
                    });
                    results.secondary.push({ email, action: secAction });
                }

            } catch (rowErr) {
                results.errors.push({ email, reason: rowErr.message });
            }
        }

        // ── 4. Invalidate enrollment cache ───────────────────────────────────────
        try {
            const redis = await initRedis();
            await redis.del('enrollments:all*');
        } catch (_) { /* cache clear is non-critical */ }

        const summary = {
            total: rows.length,
            enrolled: results.enrolled.length,
            created: results.created.length,
            skipped: results.skipped.length,
            errors: results.errors.length,
        };
        if (secondaryCourseId) summary.secondaryEnrolled = results.secondary.length;
        if (results.warnings.length) summary.warnings = results.warnings.length;

        return res.status(200).json({
            success: true,
            message: 'Bulk enrollment complete.',
            summary,
            details: results,
        });

    } catch (err) {
        console.error('❌ bulkEnrollFromExcel error:', err);
        return res.status(err.statusCode || 500).json({ success: false, message: err.message });
    }
};

/**
 * Migration enrollment controller
 */
export const enrollFromMigration = async (req, res) => {
    const results = { enrolled: [], skipped: [], errors: [] };

    try {
        const sourceCourseId = '68cd611b764a92c354346a4c';
        const sourcePlanId = '68d14ab6863c4aa13942389d';
        const targetCourseId = '6a1f02677a8d1f8e480a783a';
        const targetPlanId = '6a1f02677a8d1f8e480a7841';

        // Expiry fixed to Sep 10 2026
        const targetExpiry = new Date('2026-09-10T23:59:59.000Z');

        // Expiry filter: more than a month left (30 days)
        const oneMonthFromNow = new Date();
        oneMonthFromNow.setDate(oneMonthFromNow.getDate() + 30);

        // 1. Find source enrollments
        const sourceEnrollments = await CourseEnrollment.find({
            courseId: sourceCourseId,
            coursePlanId: sourcePlanId,
            status: 'active',
            accessExpiry: { $gt: oneMonthFromNow }
        }).populate('userId', 'email fullName');

        if (!sourceEnrollments.length) {
            return res.status(200).json({
                success: true,
                message: 'No students found matching the migration criteria.',
                summary: { totalSourceFound: 0 }
            });
        }

        // 2. Verify target course
        const targetCourse = await Course.findById(targetCourseId).lean();
        if (!targetCourse) {
            return res.status(404).json({ success: false, message: 'Target Course not found.' });
        }

        // 3. Process each student
        for (const enrollment of sourceEnrollments) {
            const user = enrollment.userId;
            if (!user) continue;

            const userId = user._id;
            const email = user.email || 'unknown';

            try {
                // Check if already enrolled in target
                const existingTarget = await CourseEnrollment.findOne({
                    userId,
                    courseId: targetCourseId
                });

                if (existingTarget) {
                    const isExpired = existingTarget.accessExpiry && existingTarget.accessExpiry < new Date();

                    if (existingTarget.status === 'active' && !isExpired) {
                        results.skipped.push({ email, reason: 'Already active in target course' });
                        await addUserToCourseChat(userId, targetCourseId);
                        continue;
                    }

                    // Renew/Update
                    await CourseEnrollment.findByIdAndUpdate(existingTarget._id, {
                        status: 'active',
                        enrolledAt: new Date(),
                        accessExpiry: targetExpiry,
                        coursePlanId: targetPlanId,
                        enrollmentSource: 'migration'
                    });
                } else {
                    // Fresh enrollment in target
                    await CourseEnrollment.create({
                        userId,
                        courseId: targetCourseId,
                        coursePlanId: targetPlanId,
                        type: 'coursePlan',
                        status: 'active',
                        accessType: 'limited',
                        accessExpiry: targetExpiry,
                        enrollmentSource: 'migration',
                        enrolledAt: new Date()
                    });

                    // Update Course total
                    await Course.findByIdAndUpdate(targetCourseId, {
                        $addToSet: { enrolledStudents: userId },
                        $inc: { enrolledStudentsCount: 1 },
                    });
                }

                // Community chat access
                await addUserToCourseChat(userId, targetCourseId);
                results.enrolled.push({ email, userId });

            } catch (err) {
                results.errors.push({ email, reason: err.message });
            }
        }

        // 4. Invalidate cache
        try {
            const redis = await initRedis();
            await redis.del('enrollments:all*');
        } catch (_) { }

        return res.status(200).json({
            success: true,
            message: 'Migration enrollment complete.',
            summary: {
                totalSourceFound: sourceEnrollments.length,
                successfullyEnrolled: results.enrolled.length,
                skipped: results.skipped.length,
                errors: results.errors.length
            },
            details: results
        });

    } catch (err) {
        console.error('❌ enrollFromMigration error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * POST /enrollment/bulk-enroll-special   (DEPRECATED)
 *
 * Thin backward-compatible wrapper retained for the legacy promo flow. It resolves
 * the historically hard-coded secondary course (MVP Engineering, expiry Sep 8 2026)
 * and delegates to the unified bulkEnrollFromExcel.
 *
 * Prefer calling POST /enrollment/bulk-enroll directly with secondaryCourseId /
 * secondaryPlanId / secondaryAccessExpiry — this wrapper exists only so existing
 * callers of /bulk-enroll-special keep working.
 */
export const bulkEnrollSpecial = async (req, res) => {
    const secondaryCourseId = '69aebfc38e1d5253aca58f29'; // MVP Engineering
    let secondaryPlanId = '69aebfc38e1d5253aca58f2b';     // Fallback
    let secondaryEnrollmentType = 'coursePlan';

    // Resolve a valid CoursePlan for the secondary course; fall back to a direct
    // course enrollment if none exists (mirrors the original behaviour).
    try {
        const foundPlan = await CoursePlan.findOne({ courseId: secondaryCourseId });
        if (foundPlan) {
            secondaryPlanId = foundPlan._id;
        } else {
            secondaryEnrollmentType = 'course';
        }
    } catch (err) {
        console.warn('⚠️ Could not fetch secondary course plan, falling back to direct course type:', err.message);
        secondaryEnrollmentType = 'course';
    }

    req.body.secondaryCourseId = secondaryCourseId;
    req.body.secondaryPlanId = secondaryEnrollmentType === 'coursePlan' ? secondaryPlanId : undefined;
    req.body.secondaryEnrollmentType = secondaryEnrollmentType;
    req.body.secondaryAccessExpiry = '2026-09-08T23:59:59.000Z';

    return bulkEnrollFromExcel(req, res);
};
