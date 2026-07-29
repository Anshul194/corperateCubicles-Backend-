/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║      REMEDIATE LEGACY SHARED-PASSWORD ACCOUNTS               ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * Bulk-enrollment flows used to create student accounts with a shared,
 * publicly-known password ('Student@123') + is_verify:true. Anyone could log
 * into ANY such account via POST /login with that constant (mass takeover).
 *
 * The creation sites are now fixed (per-account random passwords), but accounts
 * created BEFORE the fix still carry the bcrypt('Student@123') hash and remain
 * takeover-able until remediated.
 *
 * This script INVALIDATES those passwords: every account whose current password
 * matches one of the known shared constants gets a fresh, unguessable random
 * password (which is never stored in plaintext or emailed). Affected students
 * simply use "Forgot Password" on the login page to set a new password — the same
 * onboarding path new students now use.
 *
 * SAFE BY DEFAULT: runs as a DRY RUN (reports what it would do, changes nothing).
 * Pass --apply to actually write the changes.
 *
 * Usage:
 *   node scripts/remediate-bulk-passwords.mjs            # dry run (no writes)
 *   node scripts/remediate-bulk-passwords.mjs --apply    # perform invalidation
 *
 * Requires MONGO_URI in the environment (.env).
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// ── CONFIG ────────────────────────────────────────────────────────────────────
// Known shared/seeded constants to invalidate. Default matches the approved scope
// ('Student@123'). The earlier OAuth/guest constant 'student' is the same vuln
// class — uncomment it below to invalidate those legacy accounts too.
const SHARED_PASSWORDS = [
    'Student@123',
    // 'student',
];

const APPLY = process.argv.includes('--apply');
const PROGRESS_EVERY = 250; // log a heartbeat every N scanned users
// ─────────────────────────────────────────────────────────────────────────────

// Minimal, schema-less user accessor — avoids the app's model import chain
// (Redis/etc.) while still letting us read `password` and update the few fields
// we touch. strict:false lets us write password-reset fields regardless of schema.
const User = mongoose.models.User
    || mongoose.model('User', new mongoose.Schema({}, { strict: false, timestamps: true }));

async function main() {
    const MONGO_URI = process.env.MONGO_URI;
    if (!MONGO_URI) throw new Error('MONGO_URI not set in environment (.env).');

    console.log(`\n🔐 Legacy shared-password remediation`);
    console.log(`   Mode            : ${APPLY ? '🟢 APPLY (writes enabled)' : '🟡 DRY RUN (no writes)'}`);
    console.log(`   Constants checked: ${SHARED_PASSWORDS.map(p => JSON.stringify(p)).join(', ')}\n`);

    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 15000 });
    console.log('✅ Connected to MongoDB\n');

    let scanned = 0;
    let matched = 0;
    let updated = 0;
    let skippedNoPassword = 0;
    const matchedEmails = [];

    // Stream users so we never load the whole collection into memory.
    const cursor = User.find({ password: { $exists: true, $ne: null } })
        .select('email password')
        .lean()
        .cursor();

    for (let user = await cursor.next(); user != null; user = await cursor.next()) {
        scanned++;
        if (scanned % PROGRESS_EVERY === 0) {
            console.log(`   …scanned ${scanned} (matched so far: ${matched})`);
        }

        if (!user.password || typeof user.password !== 'string') {
            skippedNoPassword++;
            continue;
        }

        // Does the stored hash match ANY known shared constant?
        let isShared = false;
        for (const candidate of SHARED_PASSWORDS) {
            try {
                if (await bcrypt.compare(candidate, user.password)) {
                    isShared = true;
                    break;
                }
            } catch (_) {
                // Malformed/non-bcrypt hash — not one of our seeded accounts; ignore.
            }
        }
        if (!isShared) continue;

        matched++;
        matchedEmails.push(user.email);

        if (!APPLY) {
            console.log(`   [would invalidate] ${user.email}`);
            continue;
        }

        const randomHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
        await User.updateOne(
            { _id: user._id },
            {
                $set: {
                    password: randomHash,
                    passwordChangedAt: new Date(),
                    passwordResetToken: null,
                    passwordResetExpiry: null,
                },
            }
        );
        updated++;
        console.log(`   [invalidated] ${user.email}`);
    }

    console.log('\n' + '═'.repeat(60));
    console.log('📋  REMEDIATION SUMMARY');
    console.log('═'.repeat(60));
    console.log(`   Scanned (with password) : ${scanned}`);
    console.log(`   Skipped (no password)   : ${skippedNoPassword}`);
    console.log(`   Matched shared constant : ${matched}`);
    if (APPLY) {
        console.log(`   ✅ Invalidated          : ${updated}`);
        console.log(`\n   Affected students must use "Forgot Password" on the login`);
        console.log(`   page to set a new password. No emails were sent by this script.`);
    } else {
        console.log(`\n   DRY RUN — nothing was changed. Re-run with --apply to invalidate.`);
    }
    console.log('═'.repeat(60) + '\n');

    await mongoose.disconnect();
}

main().catch(err => {
    console.error('💥 Fatal error:', err.message);
    process.exit(1);
});
