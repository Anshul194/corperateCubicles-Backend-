import certificateService from "../service/certificateService.js";
import { initRedis } from "../config/redisClient.js";
import courseProgressModel from "../models/Course.js";
import quizSubmissionModel from "../models/QuizSubmission.js";
import courseBundleModel from "../models/CourseBundle.js";
import User from "../models/user.js";
import CertificateTemplate from "../models/CertificateTemplate.js";
import { renderHtmlToPdf } from "../utils/pdfRenderer.js";
import fs from "fs";
import path from "path";
import CourseEnrollment from "../models/CourseEnrollment.js";
import courseCompletionService from "../service/CourseCompletionService.js";

export const createCertificate = async (req, res) => {
  try {

    let user_id;
    // Only admin/instructor may issue certificates on behalf of arbitrary users.
    const isPrivilegedIssuer =
      req.user && (req.user.role === "admin" || req.user.role === "instructor");
    //console.log("Request user:", req.user);
    if (isPrivilegedIssuer) {
      user_id = req.body.user_id;
    } else {
      user_id = req.user?._id;
    }

    //console.log("Creating certificate for user:", user_id);

    const {
      course_id,
      quiz_id,
      bundle_id,
      type,
      status,
      serial_number,
      instructor_id,
      instructor_name,
      certification_template,
      remarks,
      grade,
      score,
      max_score,
      completion_date,
      total_duration,
      user_time_spent,
      final_grade,
      // causer_Id
    } = req.body;

    const certificate_url = req.files?.certificate_url?.[0]?.path.replace(
      /\\/g,
      "/"
    );
    const instructor_signature =
      req.files?.instructor_signature?.[0]?.path.replace(/\\/g, "/");

    // ✅ Validate completion based on type
    if (type === "course") {
      // Check if user is enrolled in the course
      var course = await courseProgressModel.findOne({
        _id: course_id,
        enrolledStudents: { $in: [user_id] },
      });
      if (!course) {
        return res.status(400).json({
          success: false,
          message: "User is not enrolled in this course",
        });
      }

      // Enforce a real course-completion gate before issuing a certificate.
      // Privileged issuers (admin/instructor) may still issue manually, but a
      // non-admin self-issuing for their own account must have fully completed.
      if (!isPrivilegedIssuer) {
        const completion =
          await courseCompletionService.checkCourseCompletion(
            user_id,
            course_id
          );
        if (!completion?.isCompleted) {
          return res.status(400).json({
            success: false,
            message: "Course not completed by user",
          });
        }
      }
    }

    //console.log("Course found:", course);

    // Fetch instructor data
    const instructor = await User.findById(course.instructorId)
      .select("fullName")
      .lean();
    if (!instructor) {
      throw new Error("Instructor not found");
    }

    //console.log("Instructor found:", instructor.fullName);

    if (type === "quiz") {
      let quizSubmission = null;

      if (req.body.quiz_submission_id) {
        quizSubmission = await quizSubmissionModel.findById(
          req.body.quiz_submission_id
        );
      } else if (quiz_id && user_id) {
        quizSubmission = await quizSubmissionModel.findOne({
          user: user_id,
          quiz: quiz_id,
        });
      }

      if (!quizSubmission || !quizSubmission.passed) {
        return res
          .status(400)
          .json({ success: false, message: "Quiz not passed by user" });
      }

      // Use values from quiz submission
      req.body.quiz_submission_id = quizSubmission._id;
      req.body.score = quizSubmission.score;
      req.body.max_score = quizSubmission.totalMarks;
      req.body.quiz_id = quizSubmission.quiz;
    }

    if (type === "bundle") {
      const bundle = await courseBundleModel
        .findById(bundle_id)
        .populate("courses");
      if (!bundle) {
        return res
          .status(404)
          .json({ success: false, message: "Bundle not found" });
      }

      // Enforce a real completion gate for every course in the bundle before
      // issuing. Privileged issuers (admin/instructor) may issue manually.
      if (!isPrivilegedIssuer) {
        for (const bundledCourse of bundle.courses) {
          const bundledCourseId = bundledCourse?._id || bundledCourse;
          const completion =
            await courseCompletionService.checkCourseCompletion(
              user_id,
              bundledCourseId
            );
          if (!completion?.isCompleted) {
            return res.status(400).json({
              success: false,
              message: "User has not completed all courses in the bundle",
            });
          }
        }
      }
    }

    var certificate = null;

    //check if certificate already exists for this user and course/quiz/bundle
    const existingCertificate =
      await certificateService.getCertificateByUserAndType(
        user_id,
        course_id,
        type,
        certification_template
      );

    if (!existingCertificate) {
      // For non-privileged self-issuance, do NOT trust client-supplied
      // grade/score/status/serial_number/certificate_url. Derive grade-bearing
      // fields server-side (quiz fields are already taken from the verified
      // submission above) and generate status/serial_number on the server.
      const serverIssued = !isPrivilegedIssuer;
      const safeStatus = serverIssued ? "issued" : status;
      const safeSerialNumber = serverIssued
        ? `CERT-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
        : serial_number;
      const safeCertificateUrl = serverIssued ? undefined : certificate_url;
      const safeGrade = serverIssued ? undefined : grade;
      const safeFinalGrade = serverIssued ? undefined : final_grade;
      // For quiz certs the score/max_score come from the verified submission
      // (set on req.body above); for other self-issued types do not trust the
      // client-supplied score values.
      const safeScore = serverIssued ? req.body.score : req.body.score || score;
      const safeMaxScore = serverIssued
        ? req.body.max_score
        : req.body.max_score || max_score;

      // ✅ Create certificate
      certificate = await certificateService.createCertificate({
        user_id,
        course_id: course_id || null,
        quiz_id: req.body.quiz_id || quiz_id || null,
        quiz_submission_id: req.body.quiz_submission_id || null,
        bundle_id: bundle_id || null,
        certification_template: certification_template || null,
        type,
        status: safeStatus,
        certificate_url: safeCertificateUrl,
        serial_number: safeSerialNumber,
        instructor_id: course.instructorId || null,
        instructor_name: instructor.fullName || null,
        instructor_signature,
        remarks,
        grade: safeGrade,
        score: safeScore,
        max_score: safeMaxScore,
        completion_date,
        total_duration,
        user_time_spent,
        final_grade: safeFinalGrade,
      });

      // //console.log("Certificate created:", certificate);

      //console.log("Certificate created:", type, course);
      if (type == "course" && course_id) {
        //console.log("Updating CourseEnrollment for course:", course_id);
        await CourseEnrollment.findOneAndUpdate(
          { userId: user_id, courseId: course_id },
          { certificateIssued: true, certificateIssuedAt: new Date() }
        );
      } else if (type === "bundle" && bundle_id) {
        await CourseEnrollment.findOneAndUpdate(
          { userId: user_id, courseBundleId: bundle_id },
          { certificateIssued: true, certificateIssuedAt: new Date() }
        );
      }
    }

    certificate = existingCertificate || certificate;

    //generate certificate pdf base on template
    if (certificate.certification_template) {
      await generatePdfForCertificate(certificate);
    } else {
      //console.log("No template found for certificate, skipping PDF generation");
    }

    const redis = await initRedis();
    await redis.del("certificates:all*");

    res.status(201).json({
      success: true,
      message: "Certificate created successfully",
      data: certificate,
    });
  } catch (error) {
    console.error("Error creating certificate:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAllCertificates = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      sortBy = "createdAt",
      sortOrder = "desc",
      type,
      user_id,
    } = req.query;

    const filters = {};
    if (type) filters.type = type;
    if (user_id) filters.user_id = user_id;

    const options = { page, limit, search, sortBy, sortOrder, filters };

    const redis = await initRedis();
    const cacheKey = `certificates:all:${JSON.stringify(options)}`;
    const cached = await redis.get(cacheKey);

    if (cached) {
      return res.status(200).json({
        success: true,
        message: "Certificates fetched from cache",
        data: JSON.parse(cached),
        fromCache: true,
      });
    }

    const data = await certificateService.getAllCertificates(options);
    await redis.setEx(cacheKey, 300, JSON.stringify(data));

    res.status(200).json({
      success: true,
      message: "Certificates fetched successfully",
      data,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getCertificateById = async (req, res) => {
  try {
    const redis = await initRedis();
    // const cacheKey = `certificate:${req.params.id}`;
    // const cached = await redis.get(cacheKey);

    // if (cached) {
    //   return res.status(200).json({
    //     success: true,
    //     message: 'Certificate fetched from cache',
    //     data: JSON.parse(cached),
    //     fromCache: true
    //   });
    // }

    const certificate = await certificateService.getCertificateById(
      req.params.id
    );
    if (!certificate) {
      return res
        .status(404)
        .json({ success: false, message: "Certificate not found" });
    }

    // await redis.setEx(cacheKey, 300, JSON.stringify(certificate));
    res.status(200).json({
      success: true,
      message: "Certificate fetched successfully",
      data: certificate,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateCertificate = async (req, res) => {
  try {
    const updateData = { ...req.body };

    if (req.files?.certificateFile?.[0]) {
      updateData.certificate_url = req.files.certificateFile[0].path.replace(
        /\\/g,
        "/"
      );
    }

    if (req.files?.signatureFile?.[0]) {
      updateData.instructor_signature = req.files.signatureFile[0].path.replace(
        /\\/g,
        "/"
      );
    }

    const updated = await certificateService.updateCertificate(
      req.params.id,
      updateData
    );

    const redis = await initRedis();
    await redis.del("certificates:all*");
    await redis.del(`certificate:${req.params.id}`);

    res.status(200).json({
      success: true,
      message: "Certificate updated successfully",
      data: updated,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteCertificate = async (req, res) => {
  try {
    const certificate = await certificateService.getCertificateById(
      req.params.id
    );

    if (!certificate) {
      return res
        .status(404)
        .json({ success: false, message: "Certificate not found" });
    }

    await certificateService.deleteCertificate(req.params.id);

    const redis = await initRedis();
    await redis.del("certificates:all*");
    await redis.del(`certificate:${req.params.id}`);

    res.status(200).json({
      success: true,
      message: "Certificate deleted successfully",
      data: certificate,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Helper to render template HTML with dynamic data - COMPLETELY BORDER-FREE
// Updated renderTemplate function with proper spacing
// FIXED: Helper to render template HTML with dynamic data
// Helper to render template HTML with dynamic data
function renderTemplate(template, elements, data) {
  // Constants matching the frontend editor dimensions
  const FRONTEND_WIDTH = 800;
  const FRONTEND_HEIGHT = 600;

  // A4 Landscape dimensions mapping (approximate pixels for 96 DPI)
  // Logic: We maintain the relative %. 
  // Font scaling factor: PDF height (~794px) / Frontend Height (600px) ≈ 1.323
  const FONT_SCALE_FACTOR = 1.323;

  // Build HTML for each enabled element
  let elementsHtml = "";
  if (elements) {
    Object.entries(elements).forEach(([key, el]) => {
      // Logic for swapping content if it's dynamic
      if (!el || !el.enable) return;
      let value = data[key] !== undefined ? data[key] : el.content || "";

      // Special handling for specific placeholders if they are still raw
      if (typeof value === 'string') {
        value = value
          .replace("[student_name]", data.student_name || "")
          .replace("[instructor_name]", data.instructor_name || "")
          .replace("[platform_name]", "Anshul") // Hardcoded in old logic, keeping consistency
          .replace("[date]", data.date ? new Date(data.date).toLocaleDateString() : new Date().toLocaleDateString());
      }

      // Calculate positions as percentages to be resolution independent
      const leftPct = ((el.position?.x || el.position_x || 0) / FRONTEND_WIDTH) * 100;
      const topPct = ((el.position?.y || el.position_y || 0) / FRONTEND_HEIGHT) * 100;

      // Scale font size
      const rawFontSize = parseInt(el.font_size) || 16;
      const scaledFontSize = rawFontSize * FONT_SCALE_FACTOR;

      const style = `
        position: absolute;
        left: ${leftPct}%;
        top: ${topPct}%;
        color: ${el.font_color || "#000"};
        font-size: ${scaledFontSize}px;
        font-weight: ${el.font_weight_bold ? "bold" : "normal"};
        text-align: ${el.text_center ? "center" : "left"};
        transform: ${el.text_center ? "translateX(-50%)" : "none"};
        font-family: ${el.styles && el.styles.includes('font-family') ? el.styles.split('font-family:')[1].split(';')[0] : '"Times New Roman", serif'};
        white-space: nowrap;
        z-index: 10;
        ${el.styles || ""}
      `;

      // Render image elements
      if (el.image || key === 'platform_signature' || key === 'stamp' || key === 'qr_code') {
        // Determine source
        let imageSrc = "";
        let width = el.image_size || 128;

        if (data[key] && (key === 'platform_signature' || key === 'stamp')) {
          // If passed in data (like signature file path)
          if (data[key] && typeof data[key] === 'string' && data[key].includes('/')) {
            const imagePath = path.resolve(process.cwd(), data[key].startsWith('/') ? data[key].slice(1) : data[key]);
            imageSrc = `file://${imagePath}`;
          }
        } else if (el.image) {
          const imagePath = path.resolve(process.cwd(), el.image.replace(/\\/g, "/"));
          imageSrc = `file://${imagePath}`;
        }

        if (imageSrc) {
          elementsHtml += `<img src="${imageSrc}" style="${style} width:${width}px; height:auto;" onerror="this.style.display='none'" />`;
        }
      } else {
        elementsHtml += `<div style="${style}">${value}</div>`;
      }
    });
  }

  // Background Image Handling
  const backgroundImageUrl = template.image
    ? template.image.replace(/\\/g, "/")
    : null;

  let backgroundImgTag = "";
  if (backgroundImageUrl) {
    const bgPath = path.resolve(process.cwd(), backgroundImageUrl);
    // Use file protocol to avoid server round-trip/deadlock
    backgroundImgTag = `<img src="file://${bgPath}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; z-index: 0;" alt="Certificate Background" />`;
  } else {
    // Fallback gradient if no image
    backgroundImgTag = `<div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); z-index: 0;"></div>`;
  }

  const html = `
    <!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Certificate</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        width: 100%;
        height: 100%;
        margin: 0;
        padding: 0;
        -webkit-print-color-adjust: exact;
      }
      
      .certificate-container {
        position: relative;
        width: 297mm;
        height: 210mm;
        overflow: hidden;
      }

      /* Print styles */
      @media print {
        @page { size: A4 landscape; margin: 0; }
        body { margin: 0; }
        .certificate-container {
             width: 297mm;
             height: 210mm;
             page-break-after: always;
             -webkit-print-color-adjust: exact;
        }
      }
    </style>
  </head>
  <body>
    <div class="certificate-container">
      ${backgroundImgTag}
       ${elementsHtml}
    </div>
  </body>
</html>
  `;

  return html;
}

// FIXED: Generate PDF buffer from HTML using the shared, concurrency-gated
// renderer (utils/pdfRenderer.js). Previously this launched a brand-new
// Chromium per request, which a single authenticated user could abuse to
// OOM the server with concurrent /:id/view requests.
async function htmlToPdfBuffer(html) {
  try {
    return await renderHtmlToPdf(html, {
      viewport: { width: 1122, height: 794, deviceScaleFactor: 1 },
      // domcontentloaded avoids timeouts on network resources
      waitUntil: "domcontentloaded",
      // Allow a short time for images to resolve if they are local
      waitForImages: true,
      pdfOptions: {
        format: "A4",
        landscape: true,
        printBackground: true,
        margin: { top: 0, bottom: 0, left: 0, right: 0 },
      },
    });
  } catch (err) {
    console.error("Error generating PDF:", err);
    // Renderer saturated — preserve the 503/Retry-After signal for routes.
    if (err.statusCode === 503) throw err;
    // Explicitly include the error message
    throw new Error(`Failed to generate PDF: ${err.message}`);
  }
}

// Helper to generate PDF and update certificate record
async function generatePdfForCertificate(certificate) {
  if (!certificate.certification_template) return null;

  const template = await CertificateTemplate.findById(certificate.certification_template);
  if (!template) throw new Error("Certificate template not found");

  // Ensure we have user details
  let studentName = "Student";
  const userId = certificate.user_id?._id || certificate.user_id; // Handle populated or ID

  if (userId) {
    const student = await User.findById(userId).select("fullName").lean();
    studentName = student?.fullName || "Student";
  }

  // Render HTML
  const html = renderTemplate(template, template.elements, {
    ...(typeof certificate.toObject === 'function' ? certificate.toObject() : certificate),
    student_name: studentName,
    instructor_name: certificate.instructor_name,
    date: certificate.completion_date,
    platform_name: "Anshul",
    user_certificate_additional: certificate.user_certificate_additional || "",
    platform_signature: template.elements.platform_signature?.content || "",
    stamp: template.elements.stamp?.content || "",
    qr_code: certificate.qr_code || "",
  });

  const pdfBuffer = await htmlToPdfBuffer(html);
  const pdfFilePath = path.join('uploads', `certificate_${certificate._id}.pdf`);
  fs.writeFileSync(pdfFilePath, pdfBuffer);

  // Update certificate with PDF URL
  certificate.certificate_url = pdfFilePath.replace(/\\/g, "/");
  await certificate.save();

  return certificate.certificate_url;
}
// Download certificate as PDF
// Download certificate as PDF
export const downloadCertificatePdf = async (req, res, next) => {
  try {
    let filePath, fileName;
    try {
      const result = await certificateService.downloadCertificatePdf(req.params.id);
      filePath = result.filePath;
      fileName = result.fileName;
    } catch (error) {
      // If PDF not available or file not found, try to regenerate
      if (error.statusCode === 400 || error.message.includes("not available") || error.message.includes("file not found")) {
        console.log("Certificate PDF missing, attempting to regenerate...");
        const certificate = await certificateService.getCertificateById(req.params.id);
        if (!certificate) throw new Error("Certificate not found");

        const newUrl = await generatePdfForCertificate(certificate);
        if (!newUrl) throw new Error("Failed to regenerate certificate PDF");

        filePath = path.join(process.cwd(), newUrl);
        fileName = `certificate_${certificate.serial_number || certificate._id}.pdf`;
      } else {
        throw error;
      }
    }

    res.download(filePath, fileName, (err) => {
      if (err) {
        // If headers not sent, we can still try to send error, but usually response is committed
        if (!res.headersSent) next(err);
        else console.error("Error sending download:", err);
      }
    });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// LRU cache for rendered certificate-view PDFs.
// Keyed by certificate id + certificate.updatedAt + template.updatedAt so any
// edit to the certificate or its template invalidates the entry. Repeat views
// of the same certificate are served from memory instead of re-rendering in
// Chromium. Capped by entry count AND total bytes.
// ---------------------------------------------------------------------------
const pdfViewCache = new Map(); // key -> PDF buffer (Map preserves insertion order)
const PDF_VIEW_CACHE_MAX_ENTRIES = 50;
const PDF_VIEW_CACHE_MAX_BYTES = 64 * 1024 * 1024; // 64MB safety cap
let pdfViewCacheBytes = 0;

function pdfViewCacheGet(key) {
  const buffer = pdfViewCache.get(key);
  if (buffer) {
    // Refresh recency: move to the end of the Map's insertion order.
    pdfViewCache.delete(key);
    pdfViewCache.set(key, buffer);
  }
  return buffer;
}

function pdfViewCacheSet(key, buffer) {
  if (!buffer || buffer.byteLength > PDF_VIEW_CACHE_MAX_BYTES) return;
  const existing = pdfViewCache.get(key);
  if (existing) {
    pdfViewCache.delete(key);
    pdfViewCacheBytes -= existing.byteLength;
  }
  pdfViewCache.set(key, buffer);
  pdfViewCacheBytes += buffer.byteLength;
  // Evict least-recently-used entries until within both caps.
  while (
    pdfViewCache.size > PDF_VIEW_CACHE_MAX_ENTRIES ||
    pdfViewCacheBytes > PDF_VIEW_CACHE_MAX_BYTES
  ) {
    const oldestKey = pdfViewCache.keys().next().value;
    pdfViewCacheBytes -= pdfViewCache.get(oldestKey).byteLength;
    pdfViewCache.delete(oldestKey);
  }
}

// View certificate as PDF in browser
export const viewCertificatePdf = async (req, res) => {
  try {
    const certificate = await certificateService.getCertificateById(
      req.params.id
    );

    if (!certificate) {
      return res
        .status(404)
        .json({ success: false, message: "Certificate not found" });
    }
    const template = await CertificateTemplate.findById(
      certificate.certification_template || certificate.templateId
    );
    if (!template) {
      return res
        .status(404)
        .json({ success: false, message: "Certificate template not found" });
    }

    // Serve repeat views from the LRU cache — skips the Chromium render
    // entirely for the common "open the same certificate again" case.
    const cacheKey = `${certificate._id}:${
      certificate.updatedAt?.getTime?.() ?? certificate.updatedAt ?? ""
    }:${template.updatedAt?.getTime?.() ?? template.updatedAt ?? ""}`;
    const cachedPdf = pdfViewCacheGet(cacheKey);
    if (cachedPdf) {
      res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline; filename=certificate.pdf",
      });
      return res.send(cachedPdf);
    }
    //console.log("Rendering template with data:", certificate.user_id?.fullName);

    const html = renderTemplate(template, template.elements, {
      ...certificate,
      student_name: certificate.user_id?.fullName || certificate.student_name,
      instructor_name: certificate.instructor_name,
      date: certificate.completion_date,
      platform_name: "Your Platform Name",
      user_certificate_additional:
        certificate.user_certificate_additional || "",
      platform_signature: template.elements.platform_signature?.content || "",
      stamp: template.elements.stamp?.content || "",
      qr_code: certificate.qr_code || "",
    });
    const pdfBuffer = await htmlToPdfBuffer(html);
    pdfViewCacheSet(cacheKey, pdfBuffer);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline; filename=certificate.pdf",
    });
    res.send(pdfBuffer);
  } catch (error) {
    // Renderer saturated (semaphore queue full) — tell the client to retry.
    if (error.statusCode === 503) {
      res.set("Retry-After", String(error.retryAfter || 10));
      return res
        .status(503)
        .json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};
