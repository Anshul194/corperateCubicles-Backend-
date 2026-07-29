import mongoose from 'mongoose';
import Course from './models/Course.js';
import dotenv from 'dotenv';
dotenv.config();

async function checkPlan() {
    await mongoose.connect(process.env.MONGO_URI);
    const course = await Course.findById('6a1f02677a8d1f8e480a783a');
    console.log('Course Plans:', JSON.stringify(course.coursePlans, null, 2));
    await mongoose.disconnect();
}

checkPlan();
