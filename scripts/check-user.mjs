import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const EMAIL_TO_CHECK = 'gourabnandi01@gmail.com';
const TEST_PASSWORD = 'Student@123';

await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
console.log('✅ Connected to MongoDB\n');

const User = mongoose.models.User || mongoose.model('User', new mongoose.Schema({}, { strict: false, timestamps: true }));

const user = await User.findOne({ email: EMAIL_TO_CHECK });

if (!user) {
    console.log(`❌ User NOT found: ${EMAIL_TO_CHECK}`);
    console.log('   → This email was not in the Excel sheet, so no account was created.');
} else {
    console.log(`✅ User FOUND`);
    console.log(`   ID        : ${user._id}`);
    console.log(`   Email     : ${user.email}`);
    console.log(`   Name      : ${user.fullName || user.name}`);
    console.log(`   Role      : ${user.role}`);
    console.log(`   Status    : ${user.status}`);
    console.log(`   CreatedAt : ${user.createdAt}`);
    console.log(`   is_verify : ${user.is_verify}`);
    console.log(`   isBanned  : ${user.isBanned}`);

    const match = await bcrypt.compare(TEST_PASSWORD, user.password);
    console.log(`\n🔑 Password "${TEST_PASSWORD}" matches: ${match ? '✅ YES' : '❌ NO (user has a different password)'}`);

    if (!match) {
        console.log('\n💡 This user existed before the script ran. Their original password was kept.');
        console.log('   → Use "Forgot Password" on the login page, or run reset-password.mjs');
    }
}

await mongoose.disconnect();
