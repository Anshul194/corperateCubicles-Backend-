import mongoose from 'mongoose';
import Course from './models/Course.js';
import Module from './models/Module.js';
import Lesson from './models/Lesson.js';
import Quiz from './models/Quiz.js';
import VideoLesson from './models/video.js';
import Assignment from './models/Assignment.js';
import TextLesson from './models/TextLesson.js';

// Utility to deep clone and remove _id and timestamps
function cloneDoc(doc) {
  const clone = JSON.parse(JSON.stringify(doc));
  delete clone._id;
  delete clone.createdAt;
  delete clone.updatedAt;
  delete clone.__v;
  return clone;
}

export async function duplicateCourse(courseId) {
  // 1. Fetch original course
  const origCourse = await Course.findById(courseId).lean();
  if (!origCourse) throw new Error('Course not found');

  // 2. Fetch all modules for the course
  const origModules = await Module.find({ courseId: origCourse._id }).lean();

  // 3. Fetch all lessons for these modules
  const origLessons = await Lesson.find({ moduleId: { $in: origModules.map(m => m._id) } }).lean();

  // 4. Fetch all quizzes, assignments, video-lessons, text-lessons for these lessons
  const origLessonIds = origLessons.map(l => l._id);
  const origQuizzes = await Quiz.find({ lesson: { $in: origLessonIds } }).lean();
  const origAssignments = await Assignment.find({ lessonId: { $in: origLessonIds } }).lean();
  const origVideoLessons = await VideoLesson.find({ lessonId: { $in: origLessonIds } }).lean();
  const origTextLessons = await TextLesson.find({ lesson: { $in: origLessonIds } }).lean();

  // 5. Duplicate course
  const newCourseData = cloneDoc(origCourse);
  // Optionally change title/slug here if needed
  newCourseData.title = `${newCourseData.title} (Copy)`;
  newCourseData.slug = `${newCourseData.slug}-new`;
  newCourseData.modules = [];
  newCourseData.verticalCarouselImage = origCourse.verticalCarouselImage;
  newCourseData.featuredImageBanner = origCourse.featuredImageBanner;
  const newCourse = await Course.create(newCourseData);
  //console.log('New course slug:', newCourse.slug);

  // 6. Duplicate modules
  const moduleIdMap = {};
  for (const origModule of origModules) {
    const newModuleData = cloneDoc(origModule);
    newModuleData.courseId = newCourse._id;
    newModuleData.lessons = [];
    const newModule = await Module.create(newModuleData);
    moduleIdMap[origModule._id] = newModule._id;
    newCourse.modules.push(newModule._id);
  }
  await newCourse.save();

  // 7. Duplicate lessons
  const lessonIdMap = {};
  for (const origLesson of origLessons) {
    const newLessonData = cloneDoc(origLesson);
    newLessonData.moduleId = moduleIdMap[origLesson.moduleId];
    // Remove references to Quiz/Assignment for now, will update after creating them
    newLessonData.Quiz = undefined;
    newLessonData.Assignment = undefined;
    const newLesson = await Lesson.create(newLessonData);
    lessonIdMap[origLesson._id] = newLesson._id;
    // Add lesson to module.lessons array
    await Module.findByIdAndUpdate(newLesson.moduleId, { $push: { lessons: newLesson._id } });
  }

  // 8. Duplicate quizzes and assign to lessons
  const quizIdMap = {};
  for (const origQuiz of origQuizzes) {
    const newQuizData = cloneDoc(origQuiz);
    newQuizData.course = newCourse._id;
    newQuizData.lesson = lessonIdMap[origQuiz.lesson];
    const newQuiz = await Quiz.create(newQuizData);
    quizIdMap[origQuiz._id] = newQuiz._id;
    // Update lesson with new quiz reference
    await Lesson.findByIdAndUpdate(newQuiz.lesson, { Quiz: newQuiz._id });
  }

  // 9. Duplicate assignments and assign to lessons
  for (const origAssignment of origAssignments) {
    const newAssignmentData = cloneDoc(origAssignment);
    newAssignmentData.courseId = newCourse._id;
    newAssignmentData.lessonId = lessonIdMap[origAssignment.lessonId];
    const newAssignment = await Assignment.create(newAssignmentData);
    // Update lesson with new assignment reference
    await Lesson.findByIdAndUpdate(newAssignment.lessonId, { Assignment: newAssignment._id });
  }

  // 10. Duplicate video-lessons
  for (const origVideo of origVideoLessons) {
    const newVideoData = cloneDoc(origVideo);
    newVideoData.lessonId = lessonIdMap[origVideo.lessonId];
    await VideoLesson.create(newVideoData);
  }

  // 11. Duplicate text-lessons
  for (const origText of origTextLessons) {
    const newTextData = cloneDoc(origText);
    newTextData.course = newCourse._id;
    newTextData.lesson = lessonIdMap[origText.lesson];
    await TextLesson.create(newTextData);
  }

  return newCourse;
}

// --- Script runner section for ES modules ---

if (process.argv[1] === process.argv[1] && process.argv[1].endsWith('duplicateCourse.js')) {
  // SECURITY: never hardcode production DB credentials. Read from the environment.
  const MONGODB_URI = process.env.MONGO_URI;
  if (!MONGODB_URI) {
    console.error('MONGO_URI is not set. Refusing to run without a database connection string.');
    process.exit(1);
  }

  // Allow passing course ID as a command-line argument
  const COURSE_ID = process.argv[2];

  if (!COURSE_ID) {
    //console.log('Usage: node duplicateCourse.js <courseId>');
    process.exit(1);
  }

  (async () => {
    try {
      await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
      //console.log('Connected to MongoDB');
      const newCourse = await duplicateCourse(COURSE_ID);
      //console.log('Duplicated course:', newCourse);
    } catch (err) {
      console.error('Error duplicating course:', err);
    } finally {
      await mongoose.disconnect();
      process.exit();
    }
  })();
}

// Example usage (in an async context):
// await duplicateCourse('yourCourseIdHere');
