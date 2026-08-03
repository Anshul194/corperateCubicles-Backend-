import CourseService from "../service/CourseService.js";
import { initRedis } from "../config/redisClient.js";
import Course from '../models/Course.js';
import Module from '../models/Module.js';
import Lesson from '../models/Lesson.js';
import mongoose from 'mongoose';
import VideoLesson from '../models/video.js';
import TextLesson from '../models/TextLesson.js';
import File from '../models/File.js';
import Quiz from '../models/Quiz.js';
import Assignment from '../models/Assignment.js';
import axios from 'axios';
import CourseEnrollment from "../models/CourseEnrollment.js";
import CoursePlan from "../models/CoursePlan.js";



const courseService = new CourseService();

// Helper to parse accessDuration string
function parseAccessDuration(durationStr) {
  // //console.log("Parsing access duration:", durationStr);
  if (!durationStr || typeof durationStr !== 'string') return { accessType: 'lifetime', accessExpiry: null };
  const lower = durationStr.trim().toLowerCase();
  if (lower === 'lifetime') return { accessType: 'lifetime', accessExpiry: null };

  const now = new Date();
  let accessExpiry = new Date(now);
  let accessType = 'limited';

  // Match patterns like "2 years", "3 months", "1 year 6 months"
  const yearMatch = lower.match(/(\d+)\s*year/);
  const monthMatch = lower.match(/(\d+)\s*month/);

  let years = yearMatch ? parseInt(yearMatch[1], 10) : 0;
  let months = monthMatch ? parseInt(monthMatch[1], 10) : 0;

  if (years > 0) accessExpiry.setFullYear(accessExpiry.getFullYear() + years);
  if (months > 0) accessExpiry.setMonth(accessExpiry.getMonth() + months);

  // If no valid duration, fallback to lifetime
  if (years === 0 && months === 0) return { accessType: 'lifetime', accessExpiry: null };

  return { accessType, accessExpiry };
}

// Parse tags: robustly handle deeply stringified, quoted, or malformed input
function parseTags(rawTags) {
  if (!rawTags) return [];
  let tags = rawTags;

  // If already array, flatten and clean
  if (Array.isArray(tags)) {
    tags = tags.flat(Infinity).map(String);
  } else if (typeof tags === "string") {
    // Try to parse multiple times if stringified multiple times
    let tries = 0;
    while (typeof tags === "string" && tries < 5) {
      try {
        tags = JSON.parse(tags);
      } catch {
        break;
      }
      tries++;
    }
    // If still not array, split by comma
    if (!Array.isArray(tags)) {
      tags = String(tags).split(",");
    }
  }

  // Clean up each tag: remove brackets, quotes, whitespace
  return (tags || [])
    .map(tag =>
      String(tag)
        .replace(/^[\s\[\]"]+|[\s\[\]"]+$/g, "") // trim brackets/quotes/space
        .replace(/\\+"/g, "") // remove escaped quotes
        .trim()
    )
    .filter(Boolean);
}

// Shared helper to parse boolean-like values from request body
function parseBoolean(val) {
  if (typeof val === "boolean") return val;
  if (Array.isArray(val)) return val.length > 0 ? val[0] === "true" : false;
  if (typeof val === "string") return val === "true";
  return false;
}

export const createCourse = async (req, res) => {
  try {
    // console.  log("📩 Request Body:", JSON.stringify(req.body, null, 2));
    // //console.log("📁 Uploaded Files:", JSON.stringify(req.files, null, 2));

    // Restrict content creators (instructor/trainer) to their own ID
    const isContentCreator =
      req.user.role === "instructor" ||
      req.user.role === "trainer" ||
      req.user.roles === "instructor" ||
      req.user.roles === "trainer";
    if (
      isContentCreator &&
      req.body.instructorId &&
      req.body.instructorId.trim() !== "" &&
      req.body.instructorId !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Instructors can only create courses for themselves",
        data: {},
        err: { message: "Unauthorized action" },
      });
    }

    // Prepare instructorId: fallback to req.user._id if not provided or empty
    let instructorId =
      req.body.instructorId && req.body.instructorId.trim() !== ""
        ? req.body.instructorId
        : req.user && req.user._id
          ? req.user._id.toString()
          : undefined;

    // Parse booleans safely (uses shared helper)

    // Parse tags: handle JSON string or comma-separated
    // let tags = [];
    // if (req.body.tags) {
    //   try {
    //     tags = JSON.parse(req.body.tags);
    //     if (!Array.isArray(tags)) tags = [tags];
    //   } catch {
    //     tags = req.body.tags.split(",").map((item) => item.trim());
    //   }
    // }

    let tags = parseTags(req.body.tags);

    // Dynamic accessType/accessExpiry logic for admin
    let accessType = 'lifetime';
    let accessExpiry = null;
    if (req.body.accessPeriod) {
      const parsed = parseAccessDuration(req.body.accessPeriod);
      // //console.log("Parsed accessDuration:", parsed);
      accessType = parsed.accessType;
      accessExpiry = parsed.accessExpiry;
    }

    // Parse dynamic content sections
    let contentSections = [];
    if (req.body.contentSections) {
      try {
        contentSections = typeof req.body.contentSections === 'string'
          ? JSON.parse(req.body.contentSections)
          : req.body.contentSections;
      } catch (err) {
        console.error('Error parsing contentSections:', err);
      }
    }

    // Parse brand colors
    let brandColors = { primary: '#000000', secondary: '#ffffff', accent: '#ff0000' };
    if (req.body.brandColors) {
      try {
        brandColors = typeof req.body.brandColors === 'string'
          ? JSON.parse(req.body.brandColors)
          : req.body.brandColors;
      } catch (err) {
        console.error('Error parsing brandColors:', err);
      }
    }

    // Parse featured in logos
    let featuredIn = [];
    if (req.body.featuredIn) {
      try {
        featuredIn = typeof req.body.featuredIn === 'string'
          ? JSON.parse(req.body.featuredIn)
          : req.body.featuredIn;
      } catch (err) {
        console.error('Error parsing featuredIn:', err);
      }
    }

    // Parse highlights
    let highlights = [];
    if (req.body.highlights) {
      try {
        highlights = Array.isArray(req.body.highlights)
          ? req.body.highlights
          : typeof req.body.highlights === 'string'
            ? req.body.highlights.split(',').map(h => h.trim())
            : [];
      } catch (err) {
        console.error('Error parsing highlights:', err);
      }
    }

    // Merge file paths into course data
    const courseData = {
      ...req.body,
      instructorId,
      // thumbnail: req.files?.thumbnail ? req.files.thumbnail[0].path : undefined,
      // coverImage: req.files?.coverImage ? req.files.coverImage[0].path : undefined,
      thumbnail: req.files?.thumbnail?.[0]?.path.replace(/\\/g, "/"),
      coverImage: req.files?.coverImage?.[0]?.path.replace(/\\/g, "/"),
      verticalCarouselImage: req.files?.verticalCarouselImage?.[0]?.path.replace(/\\/g, "/"),
      featuredImageBanner: req.files?.featuredImageBanner?.[0]?.path.replace(/\\/g, "/"),
      mentorImage: req.files?.mentorImage?.[0]?.path.replace(/\\/g, "/") || req.body.mentorImage,
      certificateImage: req.files?.certificateImage?.[0]?.path.replace(/\\/g, "/") || req.body.certificateImage,
      demoVideo: req.body.demoVideo,
      seoMetaDescription: req.body.seoMetaDescription,
      seoContent: req.body.seoContent,
      // Parse comma-separated arrays
      level: req.body.level
        ? Array.isArray(req.body.level)
          ? req.body.level
          : req.body.level.split(',').map(item => item.trim())
        : [],
      languages: req.body.languages
        ? Array.isArray(req.body.languages)
          ? req.body.languages
          : req.body.languages.split(',').map(item => item.trim())
        : [],
      topic: req.body.topic
        ? Array.isArray(req.body.topic)
          ? req.body.topic
          : req.body.topic.split(',').map(item => item.trim())
        : [],
      tags,
      // Parse booleans
      isPublished: parseBoolean(req.body.isPublished),
      // Featured flag
      isFeatured: parseBoolean(req.body.isFeatured),
      certificateTemplate: parseBoolean(req.body.certificateTemplate),
      isDownloadable: parseBoolean(req.body.isDownloadable),
      courseForum: parseBoolean(req.body.courseForum),
      isSubscription: parseBoolean(req.body.isSubscription),
      isPrivate: parseBoolean(req.body.isPrivate),
      enableWaitlist: parseBoolean(req.body.enableWaitlist),

      // Parse completion criteria
      // Handle prerequisites as a string
      prerequisites: req.body.prerequisites || "None",
      // Parse maxStudents as number or undefined
      maxStudents:
        req.body.maxStudents && req.body.maxStudents !== ""
          ? Number(req.body.maxStudents)
          : undefined,
      accessType,
      accessExpiry,
      salePrice: req.body.salePrice, // <-- Add salePrice to courseData

      // Dynamic content fields
      contentSections,
      brandColors,
      featuredIn,
      highlights,
      // Mentor fields
      mentorName: req.body.mentorName,
      mentorTitle: req.body.mentorTitle,
      mentorDescription: req.body.mentorDescription,
      mentorImage: req.files?.mentorImage?.[0]?.path.replace(/\\/g, "/") || req.body.mentorImage,
      mentorAchievements: req.body.mentorAchievements
        ? (typeof req.body.mentorAchievements === 'string'
          ? JSON.parse(req.body.mentorAchievements)
          : req.body.mentorAchievements)
        : [],
      mentorSocialLinks: req.body.mentorSocialLinks
        ? (typeof req.body.mentorSocialLinks === 'string'
          ? JSON.parse(req.body.mentorSocialLinks)
          : req.body.mentorSocialLinks)
        : {},

      // Learning outcomes and target audience
      learningOutcomes: req.body.learningOutcomes
        ? (typeof req.body.learningOutcomes === 'string'
          ? JSON.parse(req.body.learningOutcomes)
          : req.body.learningOutcomes)
        : [],
      targetAudience: req.body.targetAudience
        ? (typeof req.body.targetAudience === 'string'
          ? JSON.parse(req.body.targetAudience)
          : req.body.targetAudience)
        : [],

      // Certificate fields
      certificateTitle: req.body.certificateTitle,
      certificateSubtitle: req.body.certificateSubtitle,
      certificateRecipientName: req.body.certificateRecipientName,
      certificateIssuerName: req.body.certificateIssuerName,
      certificateIssuerTitle: req.body.certificateIssuerTitle,
      certificateOrganization: req.body.certificateOrganization,
      certificateDescription: req.body.certificateDescription,

      // Enhanced Landing Page Sections
      ...(() => {
        let overviewSection = req.body.overviewSection ? (typeof req.body.overviewSection === 'string' ? JSON.parse(req.body.overviewSection) : req.body.overviewSection) : undefined;
        let comparisonSection = req.body.comparisonSection ? (typeof req.body.comparisonSection === 'string' ? JSON.parse(req.body.comparisonSection) : req.body.comparisonSection) : undefined;
        let benefitsSection = req.body.benefitsSection ? (typeof req.body.benefitsSection === 'string' ? JSON.parse(req.body.benefitsSection) : req.body.benefitsSection) : undefined;
        let frameworkSection = req.body.frameworkSection ? (typeof req.body.frameworkSection === 'string' ? JSON.parse(req.body.frameworkSection) : req.body.frameworkSection) : undefined;
        let solutionSection = req.body.solutionSection ? (typeof req.body.solutionSection === 'string' ? JSON.parse(req.body.solutionSection) : req.body.solutionSection) : undefined;
        let landingPageSections = undefined;

        if (req.body.landingPageSections) {
          try {
            const landingSections = typeof req.body.landingPageSections === 'string' ? JSON.parse(req.body.landingPageSections) : req.body.landingPageSections;
            if (Array.isArray(landingSections)) {
              landingPageSections = landingSections.map((section, index) => ({
                ...section,
                sortOrder: index
              }));
              landingSections.forEach(section => {
                if (section.type === 'overview') overviewSection = section.data;
                if (section.type === 'comparison') comparisonSection = section.data;
                if (section.type === 'benefits') benefitsSection = section.data;
                if (section.type === 'framework') frameworkSection = section.data;
                if (section.type === 'solution') solutionSection = section.data;
              });
            }
          } catch (err) {
            console.error('Error parsing landingPageSections:', err);
          }
        }
        return { overviewSection, comparisonSection, benefitsSection, frameworkSection, solutionSection, landingPageSections };
      })(),
    };

    //console.log("📋 Course Data to Create:", JSON.stringify(courseData, null, 2));

    const course = await courseService.create(courseData);

    // --- BEGIN: Fix for flat plans fields and salePrice ---
    let plansArray = [];
    if (!Array.isArray(req.body.plans)) {
      // Look for fields like 'plans[0].name', 'plans[1].price', or 'plans[0][name]' etc.
      const planFieldRegex = /^plans\[(\d+)\](?:\[(.*?)\]|\.(.*?))$/;
      const planMap = {};
      for (const key in req.body) {
        const match = key.match(planFieldRegex);
        if (match) {
          const idx = parseInt(match[1], 10);
          const field = match[2] || match[3];
          if (!planMap[idx]) planMap[idx] = {};
          planMap[idx][field] = req.body[key];
        }
      }
      // Convert planMap to array sorted by index
      plansArray = Object.keys(planMap)
        .sort((a, b) => Number(a) - Number(b))
        .map(idx => planMap[idx]);
    }
    // --- END: Fix for flat plans fields ---

    const courseId = course._id.toString();
    if (
      (req.body.plans && Array.isArray(req.body.plans) && req.body.plans.length > 0) ||
      plansArray.length > 0
    ) {
      // Use plans from req.body.plans if present, otherwise use plansArray
      const rawPlans = Array.isArray(req.body.plans) ? req.body.plans : plansArray;
      const plans = rawPlans.map(plan => {
        const coursePlanData = {
          courseId,
          name: plan.name,
          price: plan.price !== undefined ? Number(plan.price) : 0,
          salePrice: plan.salePrice !== undefined ? Number(plan.salePrice) : 0, // <-- Add salePrice
          description: plan.description || '',
          durationType: plan.durationType,
          duration: plan.duration !== undefined ? Number(plan.duration) : 0,
          // discount: plan.discount ? Number(plan.discount) : 0, // <-- Remove discount
          status: plan.status || 'active'
        };
        return coursePlanData;
      });

      await CoursePlan.insertMany(plans);
      //console.log(`📦 Inserted ${plans.length} course plans for course ${courseId}`);
      //populate course with plans
      course.plans = await CoursePlan.find({ courseId });
    } else {
      //console.log("No valid course plans provided in request.");
    }





    // const courseCacheData = {
    //   _id: course._id,
    //   title: course.title,
    //   subtitle: course.subtitle,
    //   slug: course.slug,
    //   description: course.description,
    //   seoMetaDescription: course.seoMetaDescription,
    //   thumbnail: course.thumbnail,
    //   coverImage: course.coverImage,
    //   demoVideo: course.demoVideo,
    //   categoryId: course.categoryId,
    //   subCategoryId: course.subCategoryId,
    //   level: course.level,
    //   price: course.price.toString(),
    //   currency: course.currency,
    //   duration: course.duration,
    //   instructorId: course.instructorId,
    //   isPublished: course.isPublished,
    //   enrollmentType: course.enrollmentType,
    //   maxStudents: course.maxStudents,
    //   salesCount: course.salesCount,
    //   tags: course.tags,
    //   prerequisites: course.prerequisites,
    //   completionCriteria: course.completionCriteria,
    //   certificateTemplate: course.certificateTemplate,
    //   isDownloadable: course.isDownloadable,
    //   courseForum: course.courseForum,
    //   isSubscription: course.isSubscription,
    //   isPrivate: course.isPrivate,
    //   enableWaitlist: course.enableWaitlist,
    //   accessPeriod: course.accessPeriod,
    //   languages: course.languages,
    //   topic: course.topic,
    //   timeZone: course.timeZone,
    //   support: course.support,
    //   isDeleted: course.isDeleted,
    //   deletedAt: course.deletedAt,
    //   createdAt: course.createdAt,
    //   updatedAt: course.updatedAt,
    // };

    // await redis.setEx(`course:${courseId}`, 3600, JSON.stringify(courseCacheData));
    // //console.log('🗂️ Redis cache updated for course:', courseId);
    // //console.log("Created course:", course);
    return res.status(201).json({
      success: true,
      message: "✅ Course created successfully",
      data: { course },
      err: {},
    });
  } catch (err) {
    console.error("❌ Create Course Error:", err);
    if (
      err.message ===
      "Title, categoryId, subCategoryId, instructorId, and topic are required" ||
      err.message === "Invalid or non-existent category" ||
      err.message === "Invalid or non-existent subcategory" ||
      err.message === "Invalid or non-existent instructor"
    ) {
      return res.status(400).json({
        success: false,
        message: err.message,
        data: {},
        err: { message: err.message },
      });
    }
    return res.status(500).json({
      success: false,
      message: err.message,
      data: {},
      err: err.message,
    });
  }
};

// Enhanced getCourseById with VdoCipher OTP fetching - FIXED PLATFORM NAME
// Enhanced getCourseById with VdoCipher OTP fetching - FIXED PLATFORM NAME
export const getCourseById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Course ID is required",
        data: {},
        err: { message: "Missing course ID parameter" },
      });
    }

    const userId = req.user?.id;
    const userAgent = req.headers['user-agent'];
    const clientIP = req.ip || req.connection.remoteAddress;

    // //console.log(`🔄 Fetching course ${id} and processing VdoCipher videos...`);
    const course = await courseService.getById(id);
    // //console.log("Course details fetched:", course);
    // //console.log("User ID:", userId);
    // //console.log("user new:",req.user)

    if (course && course.modules) {



      let vdoCipherVideos = 0;
      let successfulOTPs = 0;
      let failedOTPs = 0;
      let totalVideoLessons = 0;
      let platformBreakdown = {};
      let vdoCipherVideoIds = [];
      const vdoCipherVideoLessons = [];

      // Helper function to check if platform is VdoCipher (handles spelling variations)
      const isVdoCipherPlatform = (platform) => {
        if (!platform) return false;
        const normalizedPlatform = platform.toLowerCase();
        return normalizedPlatform === 'vdocipher' ||
          normalizedPlatform === 'videocypher' ||
          normalizedPlatform === 'vdocypher';
      };

      // First pass: collect VdoCipher video lessons for parallel OTP fetching
      for (const module of course.modules) {
        // //console.log('Processing module:', module._id, 'Published:', module.isPublished);
        if (module.lessons && module.isPublished) {
          // //console.log('Processing module:', module._id, 'after check Published:', module.isPublished);

          for (const lesson of module.lessons) {
            if (lesson.videoLessons) {
              for (const videoLesson of lesson.videoLessons) {
                totalVideoLessons++;
                const platform = videoLesson.sourcePlatform || 'unknown';
                platformBreakdown[platform] = (platformBreakdown[platform] || 0) + 1;
                if (isVdoCipherPlatform(videoLesson.sourcePlatform) && videoLesson.videoId && videoLesson.videoId.trim() !== '') {
                  vdoCipherVideos++;
                  vdoCipherVideoIds.push({
                    videoId: videoLesson.videoId,
                    title: videoLesson.title,
                    moduleTitle: module.title,
                    lessonTitle: lesson.title,
                    originalPlatform: videoLesson.sourcePlatform
                  });
                  vdoCipherVideoLessons.push(videoLesson);
                }
              }
            }
          }
        }
      }

      // Parallel OTP fetching for VdoCipher videos
      if (vdoCipherVideos > 0) {
        await Promise.all(
          vdoCipherVideoLessons.map(async (videoLesson) => {
            try {
              const vdoCipherData = await getVdoCipherOTPModern(videoLesson.videoId);
              videoLesson.vdoCipherPlayback = {
                otp: vdoCipherData.otp,
                playbackInfo: vdoCipherData.playbackInfo,
                ttl: vdoCipherData.ttl || 300,
                fetchedAt: new Date().toISOString()
              };
              successfulOTPs++;
            } catch (error) {
              videoLesson.vdoCipherPlayback = {
                error: 'Failed to fetch playback info',
                errorMessage: error.message,
                errorDetails: error.response?.data || null,
                fetchedAt: new Date().toISOString()
              };
              failedOTPs++;
            }
          })
        );
      }

      course.videoProcessingInfo = {
        totalVideoLessons,
        totalVdoCipherVideos: vdoCipherVideos,
        successfulOTPs,
        failedOTPs,
        platformBreakdown,
        vdoCipherVideoIds,
        processedAt: new Date().toISOString()
      };

      // Log any issues
      if (failedOTPs > 0) {
        //console.log(`⚠️  ${failedOTPs} VdoCipher videos failed to get OTPs`);
      }
      if (successfulOTPs > 0) {
        //console.log(`🎉 Successfully fetched OTPs for ${successfulOTPs} VdoCipher videos`);
      }
    }

    // --- enrolled students count ---
    if (course && course._id) {
      const CourseEnrollment = (await import("../models/CourseEnrollment.js")).default;
      // Clients only consume the count, so avoid materializing the full id list.
      course.enrolledStudentsCount = await CourseEnrollment.countDocuments({
        courseId: course._id,
        status: 'active'
      });
    }

    // Filter out null reviews from the course data
    if (course && course.reviews) {
      course.reviews = course.reviews.filter(r => r != null);
    }

    return res.status(200).json({
      success: true,
      message: "✅ Course retrieved successfully with video playback info",
      data: { course },
      err: {},
    });
  } catch (err) {
    console.error("❌ Get Course By ID Error:", err);
    if (err.message === "Course not found") {
      return res.status(404).json({
        success: false,
        message: "Course not found",
        data: {},
        err: { message: err.message },
      });
    }
    return res.status(500).json({
      success: false,
      message: err.message,
      data: {},
      err: err.message,
    });
  }
};


export const getCourseBySlug = async (req, res) => {
  try {
    //console.log("📩 Request Params getCourseBySlug:", req.params);

    const { slug } = req.params;
    if (!slug) {
      return res.status(400).json({
        success: false,
        message: "Course slug is required",
        data: {},
        err: { message: "Missing course slug parameter" },
      });
    }

    const userId = req.user?.id;
    const userAgent = req.headers['user-agent'];
    const clientIP = req.ip || req.connection.remoteAddress;

    //console.log(`🔄 Fetching course with slug ${slug} and processing VdoCipher videos...`);
    const course = await courseService.getBySlug(slug);

    if (course && course.modules) {
      //console.log(`🔍 Processing ${course.modules.length} modules for VdoCipher videos...`);

      let vdoCipherVideos = 0;
      let successfulOTPs = 0;
      let failedOTPs = 0;
      let totalVideoLessons = 0;
      let platformBreakdown = {};
      let vdoCipherVideoIds = [];
      const vdoCipherVideoLessons = [];

      // Helper function to check if platform is VdoCipher
      const isVdoCipherPlatform = (platform) => {
        if (!platform) return false;
        const normalizedPlatform = platform.toLowerCase();
        return normalizedPlatform === 'vdocipher' ||
          normalizedPlatform === 'videocypher' ||
          normalizedPlatform === 'vdocypher';
      };

      // First pass: collect VdoCipher video lessons for parallel OTP fetching
      for (const module of course.modules) {
        if (module.lessons) {
          for (const lesson of module.lessons) {
            if (lesson.videoLessons) {
              for (const videoLesson of lesson.videoLessons) {
                totalVideoLessons++;
                const platform = videoLesson.sourcePlatform || 'unknown';
                platformBreakdown[platform] = (platformBreakdown[platform] || 0) + 1;
                if (isVdoCipherPlatform(videoLesson.sourcePlatform) && videoLesson.videoId && videoLesson.videoId.trim() !== '') {
                  vdoCipherVideos++;
                  vdoCipherVideoIds.push({
                    videoId: videoLesson.videoId,
                    title: videoLesson.title,
                    moduleTitle: module.title,
                    lessonTitle: lesson.title,
                    originalPlatform: videoLesson.sourcePlatform
                  });
                  vdoCipherVideoLessons.push(videoLesson);
                }
              }
            }
          }
        }
      }

      // Parallel OTP fetching for VdoCipher videos
      if (vdoCipherVideos > 0) {
        await Promise.all(
          vdoCipherVideoLessons.map(async (videoLesson) => {
            try {
              const vdoCipherData = await getVdoCipherOTPModern(videoLesson.videoId);
              videoLesson.vdoCipherPlayback = {
                otp: vdoCipherData.otp,
                playbackInfo: vdoCipherData.playbackInfo,
                ttl: vdoCipherData.ttl || 300,
                fetchedAt: new Date().toISOString()
              };
              successfulOTPs++;
            } catch (error) {
              videoLesson.vdoCipherPlayback = {
                error: 'Failed to fetch playback info',
                errorMessage: error.message,
                errorDetails: error.response?.data || null,
                fetchedAt: new Date().toISOString()
              };
              failedOTPs++;
            }
          })
        );
      }

      course.videoProcessingInfo = {
        totalVideoLessons,
        totalVdoCipherVideos: vdoCipherVideos,
        successfulOTPs,
        failedOTPs,
        platformBreakdown,
        vdoCipherVideoIds,
        processedAt: new Date().toISOString()
      };

      // Log any issues
      if (failedOTPs > 0) {
        //console.log(`⚠️  ${failedOTPs} VdoCipher videos failed to get OTPs`);
      }
      if (successfulOTPs > 0) {
        //console.log(`🎉 Successfully fetched OTPs for ${successfulOTPs} VdoCipher videos`);
      }
    }

    // Filter out null reviews from the course data
    if (course && course.reviews) {
      course.reviews = course.reviews.filter(r => r != null);
    }

    return res.status(200).json({
      success: true,
      message: "✅ Course retrieved successfully with video playback info",
      data: { course },
      err: {},
    });
  } catch (err) {
    console.error("❌ Get Course By Slug Error:", err);
    if (err.message === "Course not found") {
      return res.status(404).json({
        success: false,
        message: "Course not found",
        data: {},
        err: { message: err.message },
      });
    }
    return res.status(500).json({
      success: false,
      message: err.message,
      data: {},
      err: err.message,
    });
  }
};

// Updated refreshVideoOTP to handle platform name variations
export const refreshVideoOTP = async (req, res) => {
  try {
    const { courseId, videoId } = req.params;

    if (!courseId || !videoId) {
      return res.status(400).json({
        success: false,
        message: "Course ID and Video ID are required",
        data: {},
        err: { message: "Missing required parameters" },
      });
    }

    //console.log(`🔄 Refreshing OTP for video ${videoId} in course ${courseId}`);

    // Helper function to check if platform is VdoCipher
    const isVdoCipherPlatform = (platform) => {
      if (!platform) return false;
      const normalizedPlatform = platform.toLowerCase();
      return normalizedPlatform === 'vdocipher' ||
        normalizedPlatform === 'videocypher' ||
        normalizedPlatform === 'vdocypher';
    };

    // Verify the video exists and belongs to the course
    const course = await courseService.getById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
        data: {},
        err: { message: "Course not found" },
      });
    }

    // Find the video in the course structure
    let videoFound = false;
    let videoData = null;

    if (course.modules) {
      outerLoop: for (const module of course.modules) {
        if (module.lessons) {
          for (const lesson of module.lessons) {
            if (lesson.videoLessons) {
              for (const videoLesson of lesson.videoLessons) {
                if (videoLesson.videoId === videoId) {
                  videoFound = true;
                  videoData = videoLesson;
                  break outerLoop;
                }
              }
            }
          }
        }
      }
    }

    if (!videoFound) {
      //console.log(`⚠️  Video ${videoId} not found in course ${courseId}`);
      return res.status(404).json({
        success: false,
        message: "Video not found in this course",
        data: {},
        err: { message: "Video not found in this course" },
      });
    }

    // Check if this is actually a VdoCipher video
    if (!isVdoCipherPlatform(videoData.sourcePlatform)) {
      //console.log(`⚠️  Video ${videoId} is not a VdoCipher video (platform: ${videoData.sourcePlatform})`);
      return res.status(400).json({
        success: false,
        message: `This video is hosted on ${videoData.sourcePlatform}, not VdoCipher`,
        data: {},
        err: { message: "Not a VdoCipher video" },
      });
    }

    const vdoCipherData = await getVdoCipherOTPModern(videoId);

    return res.status(200).json({
      success: true,
      message: "✅ Video OTP refreshed successfully",
      data: {
        videoId,
        otp: vdoCipherData.otp,
        playbackInfo: vdoCipherData.playbackInfo,
        ttl: vdoCipherData.ttl || 300,
        fetchedAt: new Date().toISOString()
      },
      err: {},
    });
  } catch (err) {
    console.error("❌ Refresh Video OTP Error:", err);

    // Provide more specific error messages
    let errorMessage = "Failed to refresh video OTP";
    if (err.response?.status === 401) {
      errorMessage = "Invalid VdoCipher API key";
    } else if (err.response?.status === 404) {
      errorMessage = "Video not found on VdoCipher";
    } else if (err.response?.status === 403) {
      errorMessage = "Access denied to VdoCipher video";
    }

    return res.status(500).json({
      success: false,
      message: errorMessage,
      data: {},
      err: err.message,
    });
  }
};

// Updated testVdoCipherAPI to handle platform name variations
export const testVdoCipherAPI = async (req, res) => {
  try {
    //console.log("🧪 Testing VdoCipher API connection...");

    // Check API key format
    const apiKey = process.env.VDOCIPHER_API_KEY;
    //console.log("🔑 API Key exists:", !!apiKey);
    //console.log("🔑 API Key length:", apiKey?.length || 0);
    //console.log("🔑 API Key preview:", apiKey?.substring(0, 10) + '...');
    //console.log("🔑 API Key has whitespace:", apiKey ? /\s/.test(apiKey) : false);

    // Helper function to check if platform is VdoCipher
    const isVdoCipherPlatform = (platform) => {
      if (!platform) return false;
      const normalizedPlatform = platform.toLowerCase();
      return normalizedPlatform === 'vdocipher' ||
        normalizedPlatform === 'videocypher' ||
        normalizedPlatform === 'vdocypher';
    };

    // Get a sample video ID from the course
    const { courseId } = req.params;
    const course = await courseService.getById(courseId);

    if (!course || !course.modules) {
      return res.status(404).json({
        success: false,
        message: "Course not found or has no modules"
      });
    }

    // Find first VdoCipher video with valid videoId
    let testVideoId = null;
    let testVideoTitle = null;
    let detectedPlatform = null;

    outerLoop: for (const module of course.modules) {
      if (module.lessons) {
        for (const lesson of module.lessons) {
          if (lesson.videoLessons) {
            for (const videoLesson of lesson.videoLessons) {
              if (isVdoCipherPlatform(videoLesson.sourcePlatform) &&
                videoLesson.videoId &&
                videoLesson.videoId.trim() !== '') {
                testVideoId = videoLesson.videoId;
                testVideoTitle = videoLesson.title;
                detectedPlatform = videoLesson.sourcePlatform;
                break outerLoop;
              }
            }
          }
        }
      }
    }

    if (!testVideoId) {
      return res.status(404).json({
        success: false,
        message: "No VdoCipher videos with valid videoIds found in this course",
        debug: {
          note: "Some videos may have empty videoId fields"
        }
      });
    }

    //console.log(`🎯 Testing with video: ${testVideoTitle} (${testVideoId})`);
    //console.log(`🏷️  Platform detected as: ${detectedPlatform}`);

    // Test the API call
    const vdoCipherData = await getVdoCipherOTPModern(testVideoId);

    return res.json({
      success: true,
      message: "✅ VdoCipher API connection successful!",
      data: {
        testVideoId,
        testVideoTitle,
        detectedPlatform,
        hasOTP: !!vdoCipherData.otp,
        hasPlaybackInfo: !!vdoCipherData.playbackInfo,
        ttl: vdoCipherData.ttl,
        fetchedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error("❌ VdoCipher API Test Failed:", error.message);

    let errorDetails = {
      message: error.message,
      type: error.constructor.name
    };

    if (error.response) {
      errorDetails.status = error.response.status;
      errorDetails.statusText = error.response.statusText;
      errorDetails.responseData = error.response.data;
      errorDetails.requestHeaders = error.config?.headers;
    }

    return res.status(500).json({
      success: false,
      message: "VdoCipher API test failed",
      error: errorDetails
    });
  }
};

// Keep the existing helper functions unchanged
const getVdoCipherOTP = async (videoId) => {
  return new Promise((resolve, reject) => {


    const options = {
      method: 'POST',
      url: `https://dev.vdocipher.com/api/videos/${videoId}/otp`,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Apisecret ${process.env.VDOCIPHER_API_KEY}`,
      },
      data: { ttl: 300 },
    };

    axios(options)
      .then(response => {
        if (response.status === 200) {
          //console.log(`✅ VdoCipher OTP fetched successfully for video ${videoId}`);
          resolve(response.data);
        } else {
          console.error(`❌ VdoCipher API Error for video ${videoId}:`, response.status, response.data);
          reject(new Error(`API returned status ${response.status}`));
        }
      })
      .catch(error => {
        console.error(`❌ VdoCipher API Error for video ${videoId}:`, error.message);
        if (error.response) {
          console.error(`Response status: ${error.response.status}`);
          console.error(`Response data:`, error.response.data);
        }
        reject(error);
      });
  });
};

const getVdoCipherOTPModern = async (videoId) => {
  try {


    // Ensure the API key is properly formatted
    const apiKey = process.env.VDOCIPHER_API_KEY;
    if (!apiKey) {
      throw new Error('VDOCIPHER_API_KEY environment variable is not set');
    }

    // //console.log(`🔑 Using API key: ${apiKey.substring(0, 10)}...`);

    const response = await axios.post(
      `https://dev.vdocipher.com/api/videos/${videoId}/otp`,
      {
        ttl: 300,
        // Only send annotate for analytics, do NOT include type: 'rtext' unless you want watermark and provide interval
        annotate: JSON.stringify([
          // For analytics only:
          // { userId: 'someUserId', email: 'user@example.com', ... }
        ]),
      },
      {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Apisecret ${apiKey}`,
        },
      }
    );


    // //console.log(`✅ VdoCipher OTP fetched successfully for video ${videoId}`);
    return response.data;
  } catch (error) {
    // console.error(`❌ VdoCipher API Error for video ${videoId}:`, error.message);
    // if (error.response) {
    //   console.error(`Response status: ${error.response.status}`);
    //   console.error(`Response data:`, error.response.data);
    //   console.error(`Request headers:`, error.config?.headers);
    // }
    throw error;
  }
};

export const debugVideoData = async (req, res) => {
  try {
    const { id } = req.params;

    // Direct database query to check video structure
    const videos = await VideoLesson.find({}, {
      title: 1,
      sourcePlatform: 1,
      videoId: 1,
      lessonId: 1
    }).limit(10);

    // //console.log("📋 Sample video data from database:");
    // videos.forEach((video, index) => {
    //   //console.log(`${index + 1}. ${video.title || 'Unnamed'}`);
    //   //console.log(`   Platform: ${video.sourcePlatform || 'Not set'}`);
    //   //console.log(`   VideoId: ${video.videoId || 'Not set'}`);
    //   //console.log(`   LessonId: ${video.lessonId || 'Not set'}`);
    // });

    const platformCounts = await VideoLesson.aggregate([
      {
        $group: {
          _id: "$sourcePlatform",
          count: { $sum: 1 }
        }
      }
    ]);

    // //console.log("📊 Platform distribution:", platformCounts);

    return res.json({
      success: true,
      data: {
        sampleVideos: videos,
        platformCounts
      }
    });
  } catch (error) {
    // console.error("Debug error:", error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

export const getAllCourses = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
      search = "",
      coursePosition = "",
      ...filterParams
    } = req.query;

    const pageNum = parseInt(page, 10);
    // SECURITY: clamp limit to prevent unauthenticated deep-populate dumps of
    // the full catalog (DoS). Largest legitimate client request is 1000
    // (frontend courseSlice and admin EnrollStudentPopup both request
    // limit=1000). Negative/NaN values fall back to the default of 10.
    const parsedLimit = parseInt(limit, 10);
    const limitNum = Math.min(parsedLimit > 0 ? parsedLimit : 10, 1000);

    const filter = {};

    // Filters
    if (filterParams.categoryId) filter.categoryId = filterParams.categoryId;
    if (filterParams.subCategoryId) filter.subCategoryId = filterParams.subCategoryId;
    if (filterParams.instructorId) filter.instructorId = filterParams.instructorId;
    if (filterParams.topic) filter.topic = { $in: filterParams.topic.split(",") };
    if (filterParams.languages) filter.languages = { $in: filterParams.languages.split(",") };
    if (filterParams.level) filter.level = { $in: filterParams.level.split(",") };
    if (filterParams.popular) filter.popular = filterParams.popular === "true";
    if (filterParams.difficulty) filter.difficulty = filterParams.difficulty;
    // Featured filter (allow true/false via query string)
    if (Object.prototype.hasOwnProperty.call(filterParams, 'isFeatured')) {
      filter.isFeatured = String(filterParams.isFeatured).toLowerCase() === 'true';
    }

    // Role-based visibility for isPublished + ownership
    if (req.user?.role === "admin") {
      // Allow filter from query, or no filter (all courses)
      if (filterParams.hasOwnProperty("isPublished")) {
        filter.isPublished = filterParams.isPublished === "true";
      }
    } else if (req.user?.role === "trainer" || req.user?.role === "instructor") {
      // Content creators (trainer/instructor) only see courses they own —
      // both published and draft. Admins/moderators/students see the catalog.
      filter.instructorId = req.user._id;
      if (filterParams.hasOwnProperty("isPublished")) {
        filter.isPublished = filterParams.isPublished === "true";
      }
    } else {
      // Non-admins (student, moderator, guest): only see published courses
      filter.isPublished = true;
    }

    // Always exclude deleted
    filter.isDeleted = false;
    //console.log("🔍 Course filters applied:", filter);
    // Forward explicit courseposition flag from query to service (if present)
    const courseposition = req.query.courseposition || req.query.coursePosition;

    const courses = await courseService.getAll({
      page: pageNum,
      limit: limitNum,
      sortBy,
      sortOrder,
      filter,
      search,
      courseposition,
    });

    // --- Force populate plans for each course in response (even if already done in service) ---
    if (courses?.data && Array.isArray(courses.data)) {
      const CoursePlan = (await import('../models/CoursePlan.js')).default;
      const courseIds = courses.data.map(c => c._id);
      const plans = await CoursePlan.find({ courseId: { $in: courseIds } }).lean();
      const plansByCourse = {};
      plans.forEach(plan => {
        const cid = plan.courseId?.toString?.() || plan.courseId;
        if (!plansByCourse[cid]) plansByCourse[cid] = [];
        plansByCourse[cid].push(plan);
      });
      // Assign plans directly to the plain object (not Mongoose doc)
      courses.data = courses.data.map(course => {
        // Convert to plain object if not already
        const plain = course.toObject ? course.toObject() : { ...course };
        plain.plans = plansByCourse[plain._id.toString()] || [];
        return plain;
      });
    }
    // --- end populate plans ---

    return res.status(200).json({
      success: true,
      message: "✅ Courses retrieved successfully",
      data: courses,
      err: {},
    });
  } catch (err) {
    // console.error("❌ Get All Courses Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve courses",
      data: {},
      err: err.message,
    });
  }
};




// export const getAllCourses = async (req, res) => {
//   try {
//     const {
//       page = 1,
//       limit = 10,
//       sortBy = "createdAt",
//       sortOrder = "desc",
//       search = "",
//       ...filterParams
//     } = req.query;

//     const pageNum = parseInt(page, 10);
//     const limitNum = parseInt(limit, 10);

//     const filter = {};
//     if (filterParams.categoryId) filter.categoryId = filterParams.categoryId;
//     if (filterParams.instructorId)
//       filter.instructorId = filterParams.instructorId;
//     if (filterParams.topic)
//       filter.topic = { $in: filterParams.topic.split(",") };
//     if (filterParams.languages)
//       filter.languages = { $in: filterParams.languages.split(",") };
//     if (filterParams.level)
//       filter.level = { $in: filterParams.level.split(",") };

//     const courses = await courseService.getAll({
//       page: pageNum,
//       limit: limitNum,
//       sortBy,
//       sortOrder,
//       filter,
//       search,
//     });

//     return res.status(200).json({
//       success: true,
//       message: "✅ Courses retrieved successfully",
//       data: courses,
//       err: {},
//     });
//   } catch (err) {
//     console.error("❌ Get All Courses Error:", err);
//     return res.status(500).json({
//       success: false,
//       message: err.message,
//       data: {},
//       err: err.message,
//     });
//   }
// };

export const updateCourse = async (req, res) => {
  try {
    // //console.log("📩 Request Body updateCourse:", JSON.stringify(req.body, null, 2));
    // //console.log("📁 Uploaded Files:", JSON.stringify(req.files, null, 2));

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Course ID is required",
        data: {},
        err: { message: "Missing course ID parameter" },
      });
    }

    // Helper: parse array or string
    const parseArray = (val) => {
      if (!val) return [];
      if (Array.isArray(val)) return val;
      if (typeof val === "string") return val.split(",").map((v) => v.trim());
      return [];
    };

    // Helper: parse Decimal128-friendly value
    const parsePrice = (val) => {
      if (val === null || val === undefined) return undefined;

      if (typeof val === "number") {
        return mongoose.Types.Decimal128.fromString(val.toString());
      }

      if (val instanceof mongoose.Types.Decimal128) {
        return val;
      }

      if (typeof val === "object") {
        const price = val.value ?? val.amount ?? 0;
        return mongoose.Types.Decimal128.fromString(String(price));
      }

      if (typeof val === "string") {
        if (!isNaN(val)) return mongoose.Types.Decimal128.fromString(val);
        return mongoose.Types.Decimal128.fromString("0");
      }

      return mongoose.Types.Decimal128.fromString("0");
    };

    // Dynamic accessType/accessExpiry logic for admin
    let accessType = 'lifetime';
    let accessExpiry = null;
    let accessPeriod = req.body.accessPeriod;

    if (req.body.accessType) accessType = req.body.accessType;

    if (req.user.role === 'admin' && req.body.accessDuration) {
      const parsed = parseAccessDuration(req.body.accessDuration);
      accessType = parsed.accessType;
      accessExpiry = parsed.accessExpiry;
    }

    // Use robust parseTags function for update as well
    const tags = parseTags(req.body.tags);


    // Parse dynamic content sections for update
    let contentSections = undefined;
    if (req.body.contentSections) {
      try {
        contentSections = typeof req.body.contentSections === 'string'
          ? JSON.parse(req.body.contentSections)
          : req.body.contentSections;
      } catch (err) {
        console.error('Error parsing contentSections:', err);
      }
    }

    // Parse brand colors for update
    let brandColors = undefined;
    if (req.body.brandColors) {
      try {
        brandColors = typeof req.body.brandColors === 'string'
          ? JSON.parse(req.body.brandColors)
          : req.body.brandColors;
      } catch (err) {
        console.error('Error parsing brandColors:', err);
      }
    }

    // Parse featured in logos for update
    let featuredIn = undefined;
    if (req.body.featuredIn) {
      try {
        featuredIn = typeof req.body.featuredIn === 'string'
          ? JSON.parse(req.body.featuredIn)
          : req.body.featuredIn;
      } catch (err) {
        console.error('Error parsing featuredIn:', err);
      }
    }

    // Parse highlights for update
    let highlights = undefined;
    if (req.body.highlights) {
      try {
        highlights = Array.isArray(req.body.highlights)
          ? req.body.highlights
          : typeof req.body.highlights === 'string'
            ? req.body.highlights.split(',').map(h => h.trim())
            : undefined;
      } catch (err) {
        console.error('Error parsing highlights:', err);
      }
    }

    // Helper to parse JSON arrays
    const parseJSONArray = (val) => {
      if (!val) return [];
      if (Array.isArray(val)) return val;
      if (typeof val === 'string') {
        try {
          return JSON.parse(val);
        } catch {
          return val.split(',').map(v => v.trim()).filter(Boolean);
        }
      }
      return [];
    };

    // Helper to parse JSON object
    const parseJSONObject = (val) => {
      if (!val) return {};
      if (typeof val === 'object' && !Array.isArray(val)) return val;
      if (typeof val === 'string') {
        try {
          return JSON.parse(val);
        } catch {
          return {};
        }
      }
      return {};
    };


    const updateData = {
      ...req.body,
      thumbnail: req.files?.thumbnail?.[0]?.path.replace(/\\/g, "/"),
      coverImage: req.files?.coverImage?.[0]?.path.replace(/\\/g, "/"),
      verticalCarouselImage: req.files?.verticalCarouselImage?.[0]?.path.replace(/\\/g, "/"),
      featuredImageBanner: req.files?.featuredImageBanner?.[0]?.path.replace(/\\/g, "/"),
      mentorImage: req.files?.mentorImage?.[0]?.path.replace(/\\/g, "/") || req.body.mentorImage,
      certificateImage: req.files?.certificateImage?.[0]?.path.replace(/\\/g, "/") || req.body.certificateImage,

      level: parseArray(req.body.level),
      languages: parseArray(req.body.languages),
      topic: parseArray(req.body.topic),
      tags,

      // Only set isFeatured when provided in update payload
      ...(req.body.isFeatured !== undefined && { isFeatured: parseBoolean(req.body.isFeatured) }),

      price: parsePrice(req.body.price),
      salePrice: req.body.salePrice !== undefined && req.body.salePrice !== '' ? req.body.salePrice : undefined, // <-- always pass as string/number
      discountPrice: parsePrice(req.body.discountPrice),

      prerequisites: req.body.prerequisites || undefined,
      accessPeriod,
      accessType,
      accessExpiry,


      // Dynamic content fields
      ...(contentSections !== undefined && { contentSections }),
      ...(brandColors !== undefined && { brandColors }),
      ...(featuredIn !== undefined && { featuredIn }),
      ...(highlights !== undefined && { highlights }),

      // Mentor fields
      mentorName: req.body.mentorName,
      mentorTitle: req.body.mentorTitle,
      mentorDescription: req.body.mentorDescription,
      mentorAchievements: req.body.mentorAchievements ? parseJSONArray(req.body.mentorAchievements) : undefined,
      mentorSocialLinks: req.body.mentorSocialLinks ? parseJSONObject(req.body.mentorSocialLinks) : undefined,

      // Learning outcomes and target audience
      learningOutcomes: req.body.learningOutcomes ? parseJSONArray(req.body.learningOutcomes) : undefined,
      targetAudience: req.body.targetAudience ? parseJSONArray(req.body.targetAudience) : undefined,

      // Certificate fields
      certificateIssuerName: req.body.certificateIssuerName,
      certificateIssuerTitle: req.body.certificateIssuerTitle,
      certificateOrganization: req.body.certificateOrganization,
      certificateDescription: req.body.certificateDescription,

      // Enhanced Landing Page Sections
      ...(() => {
        let overviewSection = req.body.overviewSection ? (typeof req.body.overviewSection === 'string' ? JSON.parse(req.body.overviewSection) : req.body.overviewSection) : undefined;
        let comparisonSection = req.body.comparisonSection ? (typeof req.body.comparisonSection === 'string' ? JSON.parse(req.body.comparisonSection) : req.body.comparisonSection) : undefined;
        let benefitsSection = req.body.benefitsSection ? (typeof req.body.benefitsSection === 'string' ? JSON.parse(req.body.benefitsSection) : req.body.benefitsSection) : undefined;
        let frameworkSection = req.body.frameworkSection ? (typeof req.body.frameworkSection === 'string' ? JSON.parse(req.body.frameworkSection) : req.body.frameworkSection) : undefined;
        let solutionSection = req.body.solutionSection ? (typeof req.body.solutionSection === 'string' ? JSON.parse(req.body.solutionSection) : req.body.solutionSection) : undefined;

        let landingPageSections = undefined;

        if (req.body.landingPageSections) {
          try {
            const landingSections = typeof req.body.landingPageSections === 'string' ? JSON.parse(req.body.landingPageSections) : req.body.landingPageSections;
            if (Array.isArray(landingSections)) {
              landingPageSections = landingSections.map((section, index) => ({
                ...section,
                sortOrder: index
              }));
              landingSections.forEach(section => {
                if (section.type === 'overview') overviewSection = section.data;
                if (section.type === 'comparison') comparisonSection = section.data;
                if (section.type === 'benefits') benefitsSection = section.data;
                if (section.type === 'framework') frameworkSection = section.data;
                if (section.type === 'solution') solutionSection = section.data;
              });
            }
          } catch (err) {
            console.error('Error parsing landingPageSections:', err);
          }
        }
        return { overviewSection, comparisonSection, benefitsSection, frameworkSection, solutionSection, landingPageSections };
      })(),
    };

    const updatedCourse = await courseService.updateById(id, updateData, req.user);

    //update course plans
    let plansArray = [];
    if (Array.isArray(req.body.plans)) {
      plansArray = req.body.plans;
    } else {
      const planFieldRegex = /^plans\[(\d+)\](?:\[(.*?)\]|\.(.*?))$/;
      const planMap = {};
      for (const key in req.body) {
        const match = key.match(planFieldRegex);
        if (match) {
          const idx = parseInt(match[1], 10);
          const field = match[2] || match[3];
          if (!planMap[idx]) planMap[idx] = {};
          planMap[idx][field] = req.body[key];
        }
      }
      plansArray = Object.keys(planMap)
        .sort((a, b) => Number(a) - Number(b))
        .map(idx => planMap[idx]);
    }

    if (plansArray.length > 0) {
      const formattedPlans = plansArray.map(plan => ({
        _id: plan._id,
        name: plan.name,
        price: plan.price !== undefined ? Number(plan.price) : 0,
        salePrice: plan.salePrice !== undefined ? Number(plan.salePrice) : 0,
        description: plan.description || '',
        durationType: plan.durationType,
        duration: plan.duration !== undefined ? Number(plan.duration) : 0,
        status: plan.status || 'active'
      }));
      await courseService.updateCoursePlans(id, formattedPlans);
    }

    const redis = await initRedis();
    const courseId = updatedCourse._id.toString();
    await redis.setEx(`course:${courseId}`, 3600, JSON.stringify(updatedCourse));
    // //console.log("🗂️ Redis cache updated for course:", courseId);

    return res.status(200).json({
      success: true,
      message: "✅ Course updated successfully",
      data: { course: updatedCourse },
      err: {},
    });
  } catch (err) {
    // console.error("❌ Update Course Error:", err);
    if (
      err.message === "Course not found" ||
      err.message === "No valid fields to update" ||
      err.message === "Invalid or non-existent category" ||
      err.message === "Invalid or non-existent subcategory" ||
      err.message === "Invalid or non-existent instructor" ||
      err.message === "Instructors can only update their own courses"
    ) {
      return res.status(400).json({
        success: false,
        message: err.message,
        data: {},
        err: { message: err.message },
      });
    }

    return res.status(500).json({
      success: false,
      message: err.message,
      data: {},
      err: err.message,
    });
  }
};



export const deleteCourse = async (req, res) => {
  try {
    // //console.log("📩 Request Params deleteCourse:", req.params);

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Course ID is required",
        data: {},
        err: { message: "Missing course ID parameter" },
      });
    }

    const deletedCourse = await courseService.softDeleteById(id, req.user);

    const redis = await initRedis();
    await redis.del(`course:${id}`);
    // //console.log("🗑️ Course cache cleared:", id);

    return res.status(200).json({
      success: true,
      message: "✅ Course deleted successfully",
      data: { course: deletedCourse },
      err: {},
    });
  } catch (err) {
    // console.error("❌ Delete Course Error:", err);
    if (
      err.message === "Course not found" ||
      err.message === "Instructors can only delete their own courses"
    ) {
      return res.status(400).json({
        success: false,
        message: err.message,
        data: {},
        err: { message: err.message },
      });
    }
    return res.status(500).json({
      success: false,
      message: err.message,
      data: {},
      err: err.message,
    });
  }
};


export const getCourseContents = async (req, res) => {
  try {
    const { id: courseId } = req.params;

    let course = null;
    let courseFilter = {};

    // Validate and fetch course
    if (courseId && mongoose.Types.ObjectId.isValid(courseId)) {
      course = await Course.findById(courseId)
        .select('_id title')
        .setOptions({ strictPopulate: false });

      if (!course) {
        return res.status(404).json({
          success: false,
          message: 'Course not found'
        });
      }
      courseFilter.courseId = courseId;
    }

    // Fetch modules with strictPopulate disabled
    const modules = await Module.find({ ...courseFilter, isDeleted: false })
      .sort({ order: 1 })
      .select('_id title order courseId image')
      .setOptions({ strictPopulate: false }) // Add this option
      .populate({
        path: 'courseId',
        select: '_id title',
      });

    const moduleIds = modules.map((mod) => mod._id);

    // Fetch lessons with strictPopulate disabled
    const lessons = await Lesson.find({
      moduleId: { $in: moduleIds },
      isDeleted: false,
    })
      .sort({ order: 1 })
      .select('_id title order type moduleId')
      .setOptions({ strictPopulate: false }) // Add this option
      .populate([
        {
          path: 'moduleId',
          select: '_id title order',
        }

      ]);

    return res.status(200).json({
      success: true,
      message: 'Course contents fetched successfully',
      data: {
        ...(course && { course }),
        modules,
        lessons,
      },
    });
  } catch (error) {
    // console.error('❌ Error fetching course contents:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      data: {},
      err: error.message,
    });
  }
};


// export const getCourseAttachments = async (req, res) => {
//   const { courseId } = req.params;
//   const { type } = req.query;

//   //console.log("📩 Request Params getCourseAttachments:", courseId);
//   //console.log("📩 Request Query getCourseAttachments:", type);

//   if (!courseId || !type) {
//     return res.status(400).json({ message: "courseId and type are required" });
//   }

//   try {
//     let data = [];

//     switch (type) {
//       case 'video':
//         data = await VideoLesson.find({ isDeleted: false }).populate({
//           path: 'lessonId',
//           match: { courseId },
//         });
//         data = data.filter(item => item.lessonId);
//         break;

//       case 'text':
//         data = await TextLesson.find({ isDeleted: false }).populate({
//           path: 'lessonId',
//           match: { courseId },
//         });
//         data = data.filter(item => item.lessonId);
//         break;

//       case 'file':
//         data = await File.find({ courseId, active: true });
//         break;

//       case 'quiz':
//         data = await Quiz.find({ course: courseId });
//         break;

//       case 'assignment':
//         data = await Assignment.find({ courseId });
//         break;

//       case 'external_link':
//         data = await VideoLesson.find({
//           sourcePlatform: 'external_link',
//           isDeleted: false
//         }).populate({
//           path: 'lessonId',
//           match: { courseId },
//         });
//         data = data.filter(item => item.lessonId);
//         break;

//       default:
//         return res.status(400).json({ message: "Invalid lesson type" });
//     }

//     // ✅ Grouping by lessonId
//     const grouped = {};

//     for (const item of data) {
//       const key = item.lessonId?._id?.toString() || item.lessonId || 'ungrouped';

//       if (!grouped[key]) {
//         grouped[key] = {
//           lessonId: key,
//           attachments: [],
//         };
//       }

//       grouped[key].attachments.push(item);
//     }

//     const groupedArray = Object.values(grouped);

//     res.status(200).json({ success: true, data: groupedArray });
//   } catch (error) {
//     console.error("Attachment Fetch Error:", error);
//     res.status(500).json({ message: "Server error", error });
//   }
// };
export const getCourseAttachments = async (req, res) => {
  const { courseId } = req.params;
  const { type } = req.query;

  if (!courseId || !type) {
    return res.status(400).json({ message: "courseId and type are required" });
  }

  try {
    let data = [];

    switch (type) {
      case 'video':
        data = await VideoLesson.find({ isDeleted: false }).populate({
          path: 'lessonId',
          match: { courseId },
          populate: { path: 'moduleId' },
        });
        data = data.filter(item => item.lessonId);
        break;

      case 'text':
        data = await TextLesson.find({ isDeleted: false }).populate({
          path: 'lessonId',
          match: { courseId },
          populate: { path: 'moduleId' },
        });
        data = data.filter(item => item.lessonId);
        break;

      case 'file':
        data = await File.find({ courseId, active: true }).populate({
          path: 'lessonId',
          populate: { path: 'moduleId' },
        });
        break;


      case 'quiz':
        data = await Quiz.find({ course: courseId }).populate({
          path: 'lessonId',
          populate: { path: 'moduleId' },
        });
        break;


      case 'assignment':
        data = await Assignment.find({ courseId }).populate({
          path: 'lessonId',
          populate: { path: 'moduleId' },
        });
        break;


      case 'external_link':
        data = await VideoLesson.find({
          sourcePlatform: 'external_link',
          isDeleted: false,
        }).populate({
          path: 'lessonId',
          match: { courseId },
          populate: { path: 'moduleId' },
        });
        data = data.filter(item => item.lessonId);
        break;

      default:
        return res.status(400).json({ message: "Invalid lesson type" });
    }

    const moduleGrouped = {};

    for (const item of data) {
      const lesson = item.lessonId;
      const moduleId = lesson?.moduleId?._id?.toString() || 'ungrouped';
      const lessonId = lesson?._id?.toString() || item.lessonId || 'ungrouped';

      if (!moduleGrouped[moduleId]) {
        moduleGrouped[moduleId] = {
          moduleId,
          lessons: {},
        };
      }

      if (!moduleGrouped[moduleId].lessons[lessonId]) {
        moduleGrouped[moduleId].lessons[lessonId] = {
          lessonId,
          attachments: [],
        };
      }

      moduleGrouped[moduleId].lessons[lessonId].attachments.push(item);
    }

    const result = Object.values(moduleGrouped).map(module => ({
      moduleId: module.moduleId,
      lessons: Object.values(module.lessons),
    }));

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error("Attachment Fetch Error:", error);
    res.status(500).json({ message: "Server error", error });
  }
};

export const getMyCourses = async (req, res) => {
  try {
    // //console.log("📩 Get My Courses Request for user:", req.user._id);

    const userId = req.user._id;
    const userRole = req.user.roles || req.user.role;

    // Validate user ID format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format",
        data: {},
        err: { message: "Invalid user ID format" }
      });
    }

    // Extract query parameters for pagination and filtering
    const {
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
      status = "all", // all, published, draft, archived
      search = "",
      category = "",
      level = ""
    } = req.query;

    // Build filter object based on validated inputs
    const filter = {};

    // Role-based filtering
    if (userRole === "instructor" || userRole === "admin") {
      // For instructors, get courses they created
      filter.instructorId = new mongoose.Types.ObjectId(userId);
    } else {
      // For students, we'll need to check enrollments
      try {
        const enrollments = await courseService.getUserEnrollments(userId);
        const enrolledCourseIds = enrollments.map(enrollment =>
          new mongoose.Types.ObjectId(enrollment.courseId)
        );

        if (enrolledCourseIds.length === 0) {
          return res.status(200).json({
            success: true,
            message: "No enrolled courses found",
            data: {
              courses: [],
              total: 0,
              page: parseInt(page),
              limit: parseInt(limit),
              totalPages: 0,
              userRole,
              type: 'enrolled'
            },
            err: {}
          });
        }

        filter._id = { $in: enrolledCourseIds };
      } catch (enrollmentError) {
        // console.error("Error fetching enrollments:", enrollmentError);
        return res.status(200).json({
          success: true,
          message: "No enrolled courses found",
          data: {
            courses: [],
            total: 0,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: 0,
            userRole,
            type: 'enrolled'
          },
          err: {}
        });
      }
    }

    // Status filtering
    if (status !== "all") {
      switch (status) {
        case "published":
          filter.isPublished = true;
          break;
        case "draft":
          filter.isPublished = false;
          break;
        case "archived":
          filter.isDeleted = true;
          break;
      }
    }

    // Category filtering - validate ObjectId format
    if (category && mongoose.Types.ObjectId.isValid(category)) {
      filter.categoryId = new mongoose.Types.ObjectId(category);
    }

    // Level filtering
    if (level) {
      filter.level = { $in: [level] };
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sortBy,
      sortOrder,
      filter,
      search
    };

    const result = await courseService.getMyCourses(userId, userRole, options);

    return res.status(200).json({
      success: true,
      message: "My courses retrieved successfully",
      data: result,
      err: {}
    });

  } catch (err) {
    // console.error("❌ Get My Courses Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve courses",
      data: {},
      err: { message: err.message }
    });
  }
};

export const getPopularCourses = async (req, res) => {
  try {
    // //console.log("📩 Request for popular courses");

    const {
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc"
    } = req.query;

    // DEBUGGING: First, let's check what courses exist in database
    const allCoursesCount = await Course.countDocuments({ isDeleted: false });
    // //console.log(`📊 Total courses in database: ${allCoursesCount}`);

    const popularCoursesCount = await Course.countDocuments({
      popular: true,
      isDeleted: false
    });
    // //console.log(`🌟 Courses marked as popular: ${popularCoursesCount}`);

    // DEBUGGING: Let's see all courses and their popular status
    const sampleCourses = await Course.find({ isDeleted: false })
      .select('title popular')
      .limit(5)
      .lean();
    // //console.log("📝 Sample courses with popular status:", sampleCourses);

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sortBy,
      sortOrder,
      filter: { popular: true }
    };

    const popularCoursesData = await courseService.getPopularCourses(options);

    // DEBUGGING: Log the results
    // //console.log(`🔍 Popular courses found: ${popularCoursesData.total}`);

    return res.status(200).json({
      success: true,
      message: "✅ Popular courses retrieved successfully",
      data: {
        courses: popularCoursesData.courses,
        pagination: {
          total: popularCoursesData.total,
          page: popularCoursesData.page,
          limit: popularCoursesData.limit,
          totalPages: popularCoursesData.totalPages
        },
        // DEBUGGING: Add debug info
        debug: {
          totalCoursesInDB: allCoursesCount,
          popularCoursesInDB: popularCoursesCount,
          sampleCourses: sampleCourses
        }
      },
      err: {},
    });
  } catch (err) {
    // console.error("❌ Get Popular Courses Error:", err);
    return res.status(500).json({
      success: false,
      message: err.message,
      data: {},
      err: err.message,
    });
  }
};


export const getCoursesByCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const {
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
      search = "",
    } = req.query;

    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID format",
        data: {},
        err: { message: "Invalid category ID format" },
      });
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    const filter = { categoryId: new mongoose.Types.ObjectId(categoryId) };

    // Build search query
    let searchQuery = {};
    if (search) {
      searchQuery = {
        $or: [
          { title: { $regex: search, $options: "i" } },
          { description: { $regex: search, $options: "i" } },
          { seoMetaDescription: { $regex: search, $options: "i" } },
          { topic: { $regex: search, $options: "i" } },
          { languages: { $regex: search, $options: "i" } },
        ],
      };
    }

    const courses = await courseService.getAll({
      page: pageNum,
      limit: limitNum,
      sortBy,
      sortOrder,
      filter: { ...filter, ...searchQuery, isDeleted: false },
      search,
    });

    // Process VdoCipher videos for each course
    const isVdoCipherPlatform = (platform) => {
      if (!platform) return false;
      const normalizedPlatform = platform.toLowerCase();
      return normalizedPlatform === 'vdocipher' ||
        normalizedPlatform === 'videocypher' ||
        normalizedPlatform === 'vdocypher';
    };

    for (const course of courses.data) {
      if (course.modules) {
        let vdoCipherVideos = 0;
        let successfulOTPs = 0;
        let failedOTPs = 0;
        let totalVideoLessons = 0;
        let platformBreakdown = {};
        let vdoCipherVideoIds = [];

        for (const module of course.modules) {
          if (module.lessons) {
            for (const lesson of module.lessons) {
              if (lesson.videoLessons) {
                for (const videoLesson of lesson.videoLessons) {
                  totalVideoLessons++;
                  const platform = videoLesson.sourcePlatform || 'unknown';
                  platformBreakdown[platform] = (platformBreakdown[platform] || 0) + 1;

                  if (isVdoCipherPlatform(videoLesson.sourcePlatform) && videoLesson.videoId && videoLesson.videoId.trim() !== '') {
                    vdoCipherVideos++;
                    vdoCipherVideoIds.push({
                      videoId: videoLesson.videoId,
                      title: videoLesson.title,
                      moduleTitle: module.title,
                      lessonTitle: lesson.title,
                      originalPlatform: videoLesson.sourcePlatform
                    });
                  }
                }
              }
            }
          }
        }

        if (vdoCipherVideos > 0) {
          for (const module of course.modules) {
            if (module.lessons) {
              for (const lesson of module.lessons) {
                if (lesson.videoLessons) {
                  for (const videoLesson of lesson.videoLessons) {
                    if (isVdoCipherPlatform(videoLesson.sourcePlatform) && videoLesson.videoId && videoLesson.videoId.trim() !== '') {
                      try {
                        const vdoCipherData = await getVdoCipherOTPModern(videoLesson.videoId);
                        videoLesson.vdoCipherPlayback = {
                          otp: vdoCipherData.otp,
                          playbackInfo: vdoCipherData.playbackInfo,
                          ttl: vdoCipherData.ttl || 300,
                          fetchedAt: new Date().toISOString()
                        };
                        successfulOTPs++;
                      } catch (error) {
                        // console.error(`❌ Failed to fetch OTP for video ${videoLesson.videoId}:`, error.message);
                        videoLesson.vdoCipherPlayback = {
                          error: 'Failed to fetch playback info',
                          errorMessage: error.message,
                          errorDetails: error.response?.data || null,
                          fetchedAt: new Date().toISOString()
                        };
                        failedOTPs++;
                      }
                    }
                  }
                }
              }
            }
          }
        }

        course.videoProcessingInfo = {
          totalVideoLessons,
          totalVdoCipherVideos: vdoCipherVideos,
          successfulOTPs,
          failedOTPs,
          platformBreakdown,
          vdoCipherVideoIds,
          processedAt: new Date().toISOString()
        };
      }
    }

    return res.status(200).json({
      success: true,
      message: "✅ Courses retrieved successfully for category",
      data: courses,
      err: {},
    });
  } catch (err) {
    // console.error("❌ Get Courses By Category Error:", err);
    return res.status(500).json({
      success: false,
      message: err.message,
      data: {},
      err: err.message,
    });
  }
};


export const getAllCourseAttachments = async (req, res) => {
  const { courseId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(courseId)) {
    return res.status(400).json({ success: false, message: "Invalid courseId" });
  }

  try {
    // 🔍 Fetch course details
    const course = await Course.findById(courseId).select('title');
    if (!course) {
      return res.status(404).json({ success: false, message: "Course not found" });
    }

    // 🎥 Video Lessons
    const videoLessons = await VideoLesson.find({ isDeleted: false })
      .populate({
        path: 'lessonId',
        select: 'title moduleId section type',
        populate: { path: 'moduleId', select: 'title' },
        options: { strictPopulate: false }
      })
      .lean();

    const filteredVideos = videoLessons
      .filter(v =>
        v.lessonId?.section?.toString() === courseId &&
        v.lessonId?.type === 'video-lesson'
      )
      .map(v => ({
        ...v,
        moduleId: v.lessonId?.moduleId?._id || null,
        type: 'video-lesson',
      }));

    // 🧾 Text Lessons
    const textLessons = await TextLesson.find({ isActive: true })
      .populate({
        path: 'lesson',
        select: 'title moduleId section type',
        populate: { path: 'moduleId', select: 'title' },
        options: { strictPopulate: false }
      })
      .lean();

    const filteredTexts = textLessons
      .filter(t =>
        t.lesson?.section?.toString() === courseId &&
        t.lesson?.type === 'text'
      )
      .map(t => ({
        ...t,
        moduleId: t.lesson?.moduleId?._id || null,
        type: 'text',
      }));

    // 📁 Files
    const files = await File.find({ courseId, active: true })
      .populate({
        path: 'lessonId',
        populate: { path: 'moduleId' },
        options: { strictPopulate: false }
      })
      .lean();

    const fileResults = files
      .filter(f => f.lessonId && f.lessonId._id && f.lessonId.moduleId) // Filter only those with valid lesson + module
      .map(f => ({
        ...f,
        moduleId: f.lessonId?.moduleId?._id || null,
        type: 'file',
      }));


    // ❓ Quizzes
    const quizzes = await Quiz.find({ course: courseId })
      .populate({
        path: 'lessonId',
        populate: { path: 'moduleId' },
        options: { strictPopulate: false }
      })
      .lean();

    const quizResults = quizzes.map(q => ({
      ...q,
      moduleId: q.lessonId?.moduleId?._id || null,
      type: 'quiz',
    }));

    // 📝 Assignments
    const assignments = await Assignment.find({ courseId })
      .populate({
        path: 'lessonId',
        populate: { path: 'moduleId' },
        options: { strictPopulate: false }
      })
      .lean();

    const assignmentResults = assignments.map(a => ({
      ...a,
      moduleId: a.lessonId?.moduleId?._id || null,
      type: 'assignment',
    }));

    // 🔄 Combine all types
    const combined = [
      ...filteredVideos,
      ...fileResults,
      ...quizResults,
      ...assignmentResults,
      ...filteredTexts
    ];

    // 📦 Group structured results
    const structured = {
      quizzes: [],
      assignments: [],
      videos: [],
      files: [],
      texts: []
    };

    combined.forEach(item => {
      const base = {
        id: item._id,
        moduleId: item.lessonId?.moduleId?._id || 'no-module',
        moduleName: item.lessonId?.moduleId?.title || item.lesson?.moduleId?.title || 'No Module',
        lessonId: item.lessonId?._id || item.lesson?._id || item.lesson || 'no-lesson',
        lessonName: item.lessonId?.title || item.lesson?.title || 'No Lesson',
        date: new Date(item.createdAt).toISOString().split('T')[0]
      };

      switch (item.type) {
        case 'quiz':
          const totalQuestions = Array.isArray(item.sections)
            ? item.sections.reduce((sum, sec) => sum + (sec.questions?.length || 0), 0)
            : 0;
          structured.quizzes.push({
            ...base,
            name: item.quizTitle || 'Untitled Quiz',
            qsize: totalQuestions,
            size: `${totalQuestions} questions`,
            duration: `${item.timeLimit || 0} min`,
            difficulty: item.level || 'Medium',
            totalMarks: item.totalMarks || 0,
            passMark: item.passMark || 0,
            isTestSeries: item.isTestSeries || false,
          });
          break;

        case 'file':
          // ⛔️ Skip files with no lesson or module data
          if (base.lessonId === 'no-lesson' || base.moduleId === 'no-module') break;

          structured.files.push({
            ...base,
            name: item.fileName || item.title || 'Untitled File',
            size: item.fileSize || 'Unknown size',
            fileType: item.fileType || item.mimeType || 'Unknown',
          });
          break;


        case 'text':
          structured.texts.push({
            ...base,
            name: item.title || 'Untitled Text Lesson',
            summary: item.summary || '',
            language: item.language || 'English',
            attachments: item.attachments || [],
            content: item.content?.slice(0, 100) + '...',
          });
          break;

        case 'video-lesson':
          structured.videos.push({
            ...base,
            name: item.title || item.videoTitle || 'Untitled Video',
            size: item.duration || '0:00',
            quality: item.quality || '1080p',
            url: item.videoUrl || item.secureUrl || null
          });
          break;

        case 'assignment':
          structured.assignments.push({
            ...base,
            name: item.title || 'Untitled Assignment',
            subject: item.subject || 'General',
            language: item.language || 'English',
            description: item.description || '',
            score: item.score || 0,
            maxScore: item.maxScore || 0,
            duration: item.duration || 0,
            maxAttempts: item.maxAttempts || 1,
            attachmentFile: item.attachmentFile || null,
            documentFile: item.documentFile || null,
            remarks: item.remarks || '',
            materials: item.materials || ''
          });
          break;
      }
    });

    // ✅ Final response
    return res.status(200).json({
      success: true,
      message: "Course attachments fetched successfully",
      course: {
        id: course._id,
        title: course.title,
      },
      data: {
        quizzes: structured.quizzes,
        assignments: structured.assignments,
        videos: structured.videos,
        files: structured.files,
        texts: structured.texts
      }
    });

  } catch (error) {
    // console.error("📛 Error fetching all attachments:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};


// In CourseController.js
export const filterCourses = async (req, res) => {
  try {
    const {
      category,
      price,
      difficulty,
      duration,
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      search = '',
    } = req.query;

    // Validate difficulty
    const validDifficulties = ['beginner', 'intermediate', 'advanced'];
    if (difficulty && !validDifficulties.includes(difficulty)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid difficulty value. Must be one of: beginner, intermediate, advanced',
        data: {},
        err: {},
      });
    }

    // Specific filter values based on input
    const filters = {
      categoryId: category || undefined,
      price: price || undefined, // 'All', 'Free', 'Paid'
      difficulty: difficulty || undefined, // Single value: beginner, intermediate, or advanced
      duration: duration || undefined,
      isPublished: true
    };

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sortBy,
      sortOrder,
      search,
      filters,
    };

    const courses = await courseService.filterCourses(options);

    return res.status(200).json({
      success: true,
      message: '✅ Courses filtered successfully',
      data: courses,
      err: {},
    });
  } catch (err) {
    // console.error('❌ Filter Courses Error:', err);
    return res.status(500).json({
      success: false,
      message: err.message,
      data: {},
      err: err.message,
    });
  }
};

export const sortCourses = async (req, res) => {
  try {
    const {
      sortBy = 'newest',
      page = 1,
      limit = 10,
      search = '',
      filters = {},
    } = req.query;

    // Log the received parameters for debugging
    // //console.log('Received sortBy:', sortBy);
    // //console.log('Received filters:', filters);
    // //console.log('Received search:', search);

    // Validate sortBy
    const validSortOptions = ['priceAsc', 'priceDesc', 'newest', 'oldest', 'popular'];
    if (!validSortOptions.includes(sortBy)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid sortBy value. Must be one of: priceAsc, priceDesc, newest, oldest, popular',
        data: {},
        err: {},
      });
    }

    const options = {
      sortBy,
      page: parseInt(page),
      limit: parseInt(limit),
      search,
      filters: typeof filters === 'string' ? JSON.parse(filters) : filters,
    };

    const courses = await courseService.sortCourses(options);

    return res.status(200).json({
      success: true,
      message: '✅ Courses sorted successfully',
      data: courses,
      err: {},
    });
  } catch (err) {
    // console.error('❌ Sort Courses Error:', err);
    return res.status(500).json({
      success: false,
      message: err.message,
      data: {},
      err: err.message,
    });
  }
};

// export const getAllCourseAttachmentsNested = async (req, res) => {
//   const { courseId } = req.params;

//   if (!mongoose.Types.ObjectId.isValid(courseId)) {
//     return res.status(400).json({ success: false, message: "Invalid courseId" });
//   }

//   try {
//     const course = await Course.findById(courseId).select('title');
//     if (!course) {
//       return res.status(404).json({ success: false, message: "Course not found" });
//     }

//     const modules = await Module.find({ courseId }).select('_id title order').lean();
//     const moduleIds = modules.map(m => m._id);

//     const lessons = await Lesson.find({ module: { $in: moduleIds } })
//       .select('_id title type moduleId')
//       .lean();

//     const lessonIds = lessons.map(l => l._id);

//     const [videos, texts, quizzes, assignments, files] = await Promise.all([
//       VideoLesson.find({ lessonId: { $in: lessonIds }, isDeleted: false }).lean(),
//       TextLesson.find({ lesson: { $in: lessonIds }, isActive: true }).lean(),
//       Quiz.find({ lesson: { $in: lessonIds } }).lean(),
//       Assignment.find({ lessonId: { $in: lessonIds } }).lean(),
//       File.find({ lessonId: { $in: lessonIds }, active: true }).lean()
//     ]);

//     // Unified attachments builder with type tag
//     const buildAttachments = (lessonId) => {
//       const idStr = lessonId.toString();
//       const result = [];

//       videos.filter(v => v.lessonId?.toString() === idStr)
//          .forEach(v => result.push({ ...v, type: 'video' }));

//       texts.filter(t => t.lesson?.toString() === idStr)
//          .forEach(t => result.push({ ...t, type: 'text' }));

//       quizzes.filter(q => q.lesson?.toString() === idStr)
//          .forEach(q => result.push({ ...q, type: 'quiz' }));

//       assignments.filter(a => a.lessonId?.toString() === idStr)
//          .forEach(a => result.push({ ...a, type: 'assignment' }));

//       files.filter(f => f.lessonId?.toString() === idStr)
//          .forEach(f => result.push({ ...f, type: 'file' }));

//       return result;


//     const moduleData = modules.map(module => {
//       const moduleLessons = lessons
//         .filter(lesson => lesson.moduleId.toString() === module._id.toString())
//         .map(lesson => ({
//           id: lesson._id,
//           title: lesson.title,
//           type: lesson.type,
//           attachments: buildAttachments(lesson._id)
//         }));

//       return {
//         moduleId: module._id,
//         moduleTitle: module.title,
//         order: module.order,
//         lessons: moduleLessons
//       };
//     });

//     return res.status(200).json({
//       success: true,
//       message: "Course attachments with nested structure",
//       course: {
//         id: course._id,
//         title: course.title
//       },
//       data: moduleData
//     });

//   } catch (error) {
//     console.error("❌ Error:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Server error",
//       error: error.message
//     });
//   }
// };


/**
 * Disable drip setting for a particular user on a course.
 * Expects: req.params.courseId, req.body.userId
 */
export const disableDripForUser = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { userId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(courseId) || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid courseId or userId",
        data: {},
        err: { message: "Invalid ObjectId" }
      });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
        data: {},
        err: { message: "Course not found" }
      });
    }

    // Only add if not already present
    if (!course.dripSettingDisabledFor.some(id => id.equals(userId))) {
      course.dripSettingDisabledFor.push(userId);
      await course.save();
    }

    return res.status(200).json({
      success: true,
      message: "Drip setting disabled for user",
      data: { courseId, userId },
      err: {}
    });
  } catch (err) {
    // console.error("❌ Disable Drip For User Error:", err);
    return res.status(500).json({
      success: false,
      message: err.message,
      data: {},
      err: err.message
    });
  }
};


export const disableDripForModule = async (req, res) => {
  try {
    const { moduleId } = req.params;
    const { userId } = req.body;

    // Validate ObjectIds
    if (!mongoose.Types.ObjectId.isValid(moduleId) || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid moduleId or userId",
        data: {},
        err: { message: "Invalid ObjectId" }
      });
    }

    // Find the module
    const module = await Module.findById(moduleId);
    if (!module) {
      return res.status(404).json({
        success: false,
        message: "Module not found",
        data: {},
        err: { message: "Module not found" }
      });
    }

    // Only add userId to dripSettingDisabledFor if not already present
    if (!module.dripSettingDisabledFor.some(id => id.equals(userId))) {
      module.dripSettingDisabledFor.push(userId);
      await module.save();
    }

    return res.status(200).json({
      success: true,
      message: "Drip setting disabled for user in module",
      data: { moduleId, userId },
      err: {}
    });
  } catch (err) {
    // console.error("❌ Disable Drip For Module Error:", err);
    return res.status(500).json({
      success: false,
      message: err.message,
      data: {},
      err: err.message
    });
  }
};

// ========== DYNAMIC CONTENT SECTION MANAGEMENT ==========

// Add content section to course
export const addContentSection = async (req, res) => {
  try {
    const { courseId } = req.params;
    const sectionData = req.body;

    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid course ID"
      });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found"
      });
    }

    // Add new section
    course.contentSections.push(sectionData);
    await course.save();

    return res.status(200).json({
      success: true,
      message: "Content section added successfully",
      data: course.contentSections
    });
  } catch (error) {
    console.error("❌ Add Content Section Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Update content section
export const updateContentSection = async (req, res) => {
  try {
    const { courseId, sectionId } = req.params;
    const updateData = req.body;

    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid course ID"
      });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found"
      });
    }

    const section = course.contentSections.id(sectionId);
    if (!section) {
      return res.status(404).json({
        success: false,
        message: "Content section not found"
      });
    }

    // Update section fields
    Object.assign(section, updateData);
    await course.save();

    return res.status(200).json({
      success: true,
      message: "Content section updated successfully",
      data: section
    });
  } catch (error) {
    console.error("❌ Update Content Section Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Delete content section
export const deleteContentSection = async (req, res) => {
  try {
    const { courseId, sectionId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid course ID"
      });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found"
      });
    }

    course.contentSections.pull(sectionId);
    await course.save();

    return res.status(200).json({
      success: true,
      message: "Content section deleted successfully"
    });
  } catch (error) {
    console.error("❌ Delete Content Section Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Reorder content sections
export const reorderContentSections = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { sectionOrders } = req.body; // Array of { sectionId, order }

    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid course ID"
      });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found"
      });
    }

    // Update order for each section
    sectionOrders.forEach(({ sectionId, order }) => {
      const section = course.contentSections.id(sectionId);
      if (section) {
        section.order = order;
      }
    });

    await course.save();

    return res.status(200).json({
      success: true,
      message: "Content sections reordered successfully",
      data: course.contentSections.sort((a, b) => a.order - b.order)
    });
  } catch (error) {
    console.error("❌ Reorder Content Sections Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get all content sections for a course
export const getContentSections = async (req, res) => {
  try {
    const { courseId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid course ID"
      });
    }

    const course = await Course.findById(courseId).select('contentSections');
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found"
      });
    }

    // Sort by order
    const sortedSections = course.contentSections
      .filter(section => section.isVisible)
      .sort((a, b) => a.order - b.order);

    return res.status(200).json({
      success: true,
      message: "Content sections retrieved successfully",
      data: sortedSections
    });
  } catch (error) {
    console.error("❌ Get Content Sections Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Update course branding (colors, featured logos, highlights)
export const updateCourseBranding = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { brandColors, featuredIn, highlights } = req.body;

    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid course ID"
      });
    }

    const updateData = {};
    if (brandColors) updateData.brandColors = brandColors;
    if (featuredIn) updateData.featuredIn = featuredIn;
    if (highlights) updateData.highlights = highlights;

    const course = await Course.findByIdAndUpdate(
      courseId,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Course branding updated successfully",
      data: {
        brandColors: course.brandColors,
        featuredIn: course.featuredIn,
        highlights: course.highlights
      }
    });
  } catch (error) {
    console.error("❌ Update Course Branding Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get course landing page data (public endpoint)
export const getCourseLandingPage = async (req, res) => {
  try {
    const { slug } = req.params;

    const course = await Course.findOne({ slug, isDeleted: false })
      .select('title subtitle description shortDescription thumbnail coverImage demoVideo price salePrice currency enrolledStudentsCount averageRating totalReviews contentSections brandColors featuredIn highlights faq')
      .populate('categoryId', 'name')
      .populate('instructorId', 'name email profilePicture bio');

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found"
      });
    }

    // Sort content sections by order
    const sortedSections = course.contentSections
      .filter(section => section.isVisible)
      .sort((a, b) => a.order - b.order);

    return res.status(200).json({
      success: true,
      message: "Course landing page data retrieved successfully",
      data: {
        ...course.toObject(),
        contentSections: sortedSections
      }
    });
  } catch (error) {
    console.error("❌ Get Course Landing Page Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Upload image for course content editor (Editor.js)
export const uploadCourseEditorImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: 0,
        message: "No image file provided",
      });
    }

    // Extract relative path from uploads directory
    const filePath = req.file.path.replace(/\\/g, "/");

    // Find the 'uploads' directory in the path and extract everything after it
    const uploadsIndex = filePath.indexOf("uploads/");
    if (uploadsIndex !== -1) {
      const relativePath = filePath.substring(uploadsIndex);

      // Split path into directory and filename to encode filename separately
      const pathParts = relativePath.split("/");
      const filename = pathParts.pop();
      const directory = pathParts.join("/");

      // URL encode the filename to handle spaces and special characters
      const encodedFilename = encodeURIComponent(filename);
      const encodedPath = `${directory}/${encodedFilename}`;

      // Return relative path - Editor component will prepend API_BASE_URL
      // This ensures the URL works regardless of proxy/port configuration
      const imageUrl = `/${encodedPath}`;

      // Return EditorJS expected format
      return res.status(200).json({
        success: 1,
        file: {
          url: imageUrl,
          name: filename || req.file.originalname,
        },
      });
    } else {
      return res.status(500).json({
        success: 0,
        message: "Failed to process uploaded file",
      });
    }
  } catch (error) {
    console.error("Upload Course Editor Image Error:", error);
    return res.status(500).json({
      success: 0,
      message: error.message || "Failed to upload image",
    });
  }
};

// Upload video for course content editor (Editor.js)
export const uploadCourseEditorVideo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No video file provided",
      });
    }

    // Extract relative path from uploads directory
    const filePath = req.file.path.replace(/\\/g, "/");

    // Find the 'uploads' directory in the path and extract everything after it
    const uploadsIndex = filePath.indexOf("uploads/");
    if (uploadsIndex !== -1) {
      const relativePath = filePath.substring(uploadsIndex);

      // Split path into directory and filename to encode filename separately
      const pathParts = relativePath.split("/");
      const filename = pathParts.pop();
      const directory = pathParts.join("/");

      // URL encode the filename to handle spaces and special characters
      const encodedFilename = encodeURIComponent(filename);
      const encodedPath = `${directory}/${encodedFilename}`;

      // Return relative path - SimpleVideo component will prepend API_BASE_URL
      const videoUrl = `/${encodedPath}`;

      return res.status(200).json({
        success: true,
        message: "Course content video uploaded successfully",
        data: {
          url: videoUrl,
          path: `/${encodedPath}`,
          filename: filename || req.file.originalname,
        },
      });
    } else {
      return res.status(500).json({
        success: false,
        message: "Failed to process uploaded file",
      });
    }
  } catch (error) {
    console.error("Upload Course Editor Video Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to upload video",
    });
  }
};

// Add review to a course
export const addReview = async (req, res) => {
  try {
    const { courseId } = req.params;
    
    // Handle both single objects and multipart form data
    let reviewData;
    if (req.file || req.body.name) {
      // Multipart form data (with optional image)
      reviewData = {
        name: req.body.name,
        designation: req.body.designation,
        rating: Number(req.body.rating || 5),
        reviewText: req.body.reviewText,
        sequence: Number(req.body.sequence || 0),
        image: req.file ? req.file.path.replace(/\\/g, "/") : ""
      };
    } else {
      // Raw JSON body
      reviewData = req.body;
    }

    const course = await Course.findById(courseId);

    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    if (Array.isArray(reviewData)) {
      const validReviews = reviewData.filter(r => r != null && (r.name || r.reviewText));
      course.reviews.push(...validReviews);
    } else if (reviewData && (reviewData.name || reviewData.reviewText)) {
      course.reviews.push(reviewData);
    } else {
      return res.status(400).json({ message: 'Invalid review data' });
    }

    await course.save();

    // Filter reviews in the response as well
    course.reviews = course.reviews.filter(r => r != null);

    res.status(201).json({
      message: 'Review added successfully',
      course
    });
  } catch (error) {
    console.error("Add Review Error:", error);
    res.status(500).json({ message: 'Error adding review', error: error.message });
  }
};

// Delete a review from a course
export const deleteReview = async (req, res) => {
  try {
    const { courseId, reviewId } = req.params;
    const course = await Course.findById(courseId);

    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    course.reviews = course.reviews.filter(r => r._id.toString() !== reviewId);
    await course.save();

    res.status(200).json({ message: 'Review deleted successfully', course });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting review', error: error.message });
  }
};

// Update a review in a course
export const updateReview = async (req, res) => {
  try {
    const { courseId, reviewId } = req.params;
    const updateData = req.body;

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    const reviewIndex = course.reviews.findIndex(r => r._id.toString() === reviewId);
    if (reviewIndex === -1) {
      return res.status(404).json({ message: 'Review not found' });
    }

    // Update review fields
    course.reviews[reviewIndex] = { ...course.reviews[reviewIndex].toObject(), ...updateData };
    await course.save();

    res.status(200).json({ message: 'Review updated successfully', course });
  } catch (error) {
    res.status(500).json({ message: 'Error updating review', error: error.message });
  }
};