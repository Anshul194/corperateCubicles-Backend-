import 'dotenv/config';
import mongoose from 'mongoose';

async function main() {
    await mongoose.connect(process.env.MONGO_URI);
    const oneMonthFromNow = new Date();
    oneMonthFromNow.setDate(oneMonthFromNow.getDate() + 30);

    const enrollments = await mongoose.connection.db.collection('courseenrollments').aggregate([
        {
            $match: {
                courseId: new mongoose.Types.ObjectId('68cd611b764a92c354346a4c'),
                coursePlanId: new mongoose.Types.ObjectId('68d14ab6863c4aa13942389d'),
                status: 'active',
                accessExpiry: { $gt: oneMonthFromNow }
            }
        },
        {
            $lookup: {
                from: 'users',
                localField: 'userId',
                foreignField: '_id',
                as: 'user'
            }
        },
        { $unwind: '$user' },
        { $project: { email: '$user.email' } }
    ]).toArray();

    const emails = enrollments.map(e => e.email).filter(Boolean);
    console.log('---START---');
    emails.forEach(email => console.log(email));
    console.log('---END---');
    console.log(`Total: ${emails.length}`);

    await mongoose.disconnect();
}

main().catch(console.error);
