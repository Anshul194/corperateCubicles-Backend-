import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Course from './models/Course.js';

dotenv.config();

async function findCourse() {
    try {
        await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
        const course = await Course.findById('6a1f02677a8d1f8e480a783a', 'title _id coursePlan');
        if (course) {
            console.log(`Course: ${course.title} (ID: ${course._id})`);
            if (course.coursePlan && course.coursePlan.length > 0) {
                course.coursePlan.forEach(p => {
                    console.log(`  Plan: ${p.title || p.name || 'Unnamed'} (ID: ${p._id})`);
                });
            }
        } else {
            console.log('Course not found');
        }
        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

findCourse();
