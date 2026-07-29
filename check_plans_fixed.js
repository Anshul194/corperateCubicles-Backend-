import mongoose from 'mongoose';
import dotenv from 'dotenv';
import CoursePlan from './models/CoursePlan.js';

dotenv.config();

async function checkPlans() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const plans = await CoursePlan.find({ courseId: '6a1f02677a8d1f8e480a783a' });
        console.log('Plans for course 6a1f02677a8d1f8e480a783a:');
        plans.forEach(p => {
            console.log(`- ${p.name} (ID: ${p._id})`);
        });
        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

checkPlans();
