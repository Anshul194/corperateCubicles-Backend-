import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Course from './models/Course.js';
import CoursePlan from './models/CoursePlan.js';

dotenv.config();

const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/lms_backend';

async function findCourse() {
    try {
        await mongoose.connect(mongoUri);
        const courses = await Course.find({ title: /AI/i });
        console.log('Courses:', JSON.stringify(courses.map(c => ({ id: c._id.toString(), title: c.title })), null, 2));

        for (const c of courses) {
            const plans = await CoursePlan.find({ courseId: c._id });
            console.log(`Plans for ${c.title}:`, JSON.stringify(plans.map(p => ({ id: p._id.toString(), name: p.name })), null, 2));
        }

        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

findCourse();
