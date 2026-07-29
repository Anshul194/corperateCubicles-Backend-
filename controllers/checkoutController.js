import Cart from "../models/Cart.js";
import Order from "../models/Order.js";
import CourseEnrollment from "../models/CourseEnrollment.js";
import Course from "../models/Course.js";
import CourseBundle from "../models/CourseBundle.js";
import Coupon from "../models/Coupon.js";
import { generateOrderNumber } from "../utils/generateOrderNo.js";
import LessonProgress from "../models/LessonProgress.js";
import Certificate from "../models/Certificate.js";
import UserService from "../service/userService.js";
import User from "../models/user.js";
import { Token } from "../utils/index.js"; // contains generateToken, setTokensCookies, etc.
import { initRedis } from "../config/redisClient.js";
import emailService from '../utils/emailService.js';
import notificationService from '../utils/notificationService.js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import Setting from "../models/setting.js";
import { hasAdminRole } from "../middlewares/isAdmin.js";
import fcmTokenss from "../models/fcmTokens.js";
import Notification from "../models/Notifications.js";
import user from "../models/user.js";
import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import { renderHtmlToPdf } from "../utils/pdfRenderer.js";
import getRazorpayInstance from "../config/razorpay.js";
import axios from 'axios';
import VideoLesson from '../models/video.js';
import xlsx from "xlsx";
import mongoose from "mongoose";
import QuizSubmission from "../models/QuizSubmission.js";
import AssignmentSubmission from "../models/assignmentSubmission.js";
import CourseChatRoom from "../models/CourseChatRoom.js"; // Added import for CourseChatRoom
import { runInTransaction } from "../utils/db/runInTransaction.js";


const userService = new UserService();

// Helper to render invoice HTML
function renderInvoiceHtml(order, guestUser, company) {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8" />
    <title>Lapaas Invoice</title>
    <style>
      * { 
        box-sizing: border-box; 
        margin: 0;
        padding: 0;
      }
      
      body { 
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background: white;
        color: #1e293b;
        line-height: 1.5;
        font-size: 14px;
        min-height: 100vh;
        display: flex;
        flex-direction: column;
      }
      
      .invoice-wrapper {
        width: 100%;
        max-width: 210mm;
        margin: 0 auto;
        background: white;
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        padding: 0;
      }
      
      .invoice-header {
        background: #B1E346;
        color: #1e293b;
        padding: 20px 40px;
        border-bottom: 3px solid #9DD333;
      }
      
      .header-content {
        display: flex;
        justify-content: space-between;
        align-items: center;
        width: 100%;
      }
      
      .company-info h1 {
        font-size: 1.8rem;
        font-weight: 800;
        margin-bottom: 2px;
        letter-spacing: -0.02em;
        color: #1e293b;
      }
      
      .company-tagline {
        font-size: 0.85rem;
        font-weight: 500;
        color: #374151;
      }
      
      .invoice-details {
        text-align: right;
      }
      
      .invoice-number {
        font-size: 1.1rem;
        font-weight: 700;
        margin-bottom: 2px;
        color: #1e293b;
      }
      
      .invoice-date {
        font-size: 0.9rem;
        color: #374151;
        font-weight: 500;
      }
      
      .invoice-body {
        padding: 40px;
        flex: 1;
        width: 100%;
      }
      
      .billing-section {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 40px;
        margin-bottom: 20px;
        width: 100%;
      }
      
      .billing-card {
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        padding: 24px;
        background: #fafafa;
      }
      
      .billing-card h3 {
        color: #1e293b;
        font-size: 1rem;
        font-weight: 700;
        margin-bottom: 16px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        border-bottom: 2px solid #B1E346;
        padding-bottom: 8px;
        display: inline-block;
      }
      
      .billing-item {
        margin-bottom: 10px;
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
      }
      
      .billing-label {
        font-size: 0.85rem;
        font-weight: 600;
        color: #6b7280;
        text-transform: uppercase;
        letter-spacing: 0.3px;
        min-width: 80px;
      }
      
      .billing-value {
        color: #1e293b;
        font-weight: 500;
        text-align: right;
        flex: 1;
        word-break: break-all;
      }
      
      .items-section {
        margin-bottom: 20px;
        width: 100%;
      }
      
      .items-title {
        font-size: 1.2rem;
        font-weight: 700;
        color: #1e293b;
        margin-bottom: 20px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      
      .items-table {
        width: 100%;
        border-collapse: collapse;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        overflow: hidden;
      }
      
      .items-table th {
        background: #f3f4f6;
        color: #1e293b;
        padding: 14px 16px;
        text-align: left;
        font-weight: 700;
        font-size: 0.85rem;
        text-transform: uppercase;
        letter-spacing: 0.3px;
        border-bottom: 2px solid #B1E346;
      }
      
      .items-table td {
        padding: 14px 16px;
        border-bottom: 1px solid #f3f4f6;
        vertical-align: middle;
        font-size: 0.9rem;
      }
      
      .items-table tbody tr:last-child td {
        border-bottom: none;
      }
      
      .items-table tbody tr:hover {
        background: #f9fafb;
      }
      
      .item-badge {
        display: inline-flex;
        align-items: center;
        padding: 3px 10px;
        border-radius: 4px;
        font-size: 0.7rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      
      .badge-course {
        background: #dcfce7;
        color: #16a34a;
        border: 1px solid #bbf7d0;
      }
      
      .badge-bundle {
        background: rgba(177, 227, 70, 0.15);
        color: #65a30d;
        border: 1px solid #B1E346;
      }
      
      .item-code {
        font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
        background: #f1f5f9;
        padding: 3px 6px;
        border-radius: 3px;
        font-size: 0.8rem;
        color: #475569;
        font-weight: 600;
      }
      
      .price-cell {
        font-weight: 700;
        color: #1e293b;
        font-size: 0.95rem;
      }
      
      .summary-section {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        align-items: flex-start;
        width: 100%;
        margin-top: auto;
        padding-top: 20px;
        gap: 15px;
      }
      
      .payment-info {
        flex: 1;
        width: 100%;
      }
      
      .payment-info h4 {
        font-size: 1rem;
        font-weight: 700;
        color: #1e293b;
        margin-bottom: 12px;
        text-transform: uppercase;
        letter-spacing: 0.3px;
      }
      
      .payment-detail {
        margin-bottom: 8px;
        display: flex;
        justify-content: space-between;
        font-size: 0.9rem;
      }
      
      .payment-label {
        color: #6b7280;
        font-weight: 600;
      }
      
      .payment-value {
        color: #1e293b;
        font-weight: 500;
      }
      
      .summary-card {
        background: #fafafa;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        padding: 14px;
        min-width: 100%;
      }
      
      .summary-title {
        font-size: 1rem;
        font-weight: 700;
        color: #1e293b;
        margin-bottom: 16px;
        text-transform: uppercase;
        letter-spacing: 0.3px;
        text-align: center;
        border-bottom: 2px solid #B1E346;
        padding-bottom: 8px;
      }
      
      .summary-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 0;
        font-size: 0.9rem;
      }
      
      .summary-row:not(:last-child) {
        border-bottom: 1px solid #f3f4f6;
      }
      
      .summary-row:last-child {
        border-top: 2px solid #B1E346;
        margin-top: 12px;
        padding-top: 16px;
        font-weight: 700;
        font-size: 1.1rem;
        color: #16a34a;
        /* background: rgba(177, 227, 70, 0.1); */
        margin-left: -24px;
        margin-right: -24px;
        padding-left: 24px;
        padding-right: 24px;
        border-radius: 0 0 4px 4px;
      }
      
      .summary-label {
        color: #6b7280;
        font-weight: 600;
      }
      
      .summary-value {
        font-weight: 700;
        color: #1e293b;
      }
      
      .invoice-footer {
        background: #1e293b;
        color: white;
        padding: 16px 40px;
        text-align: center;
        margin-top: auto;
        width: 100%;
      }
      
      .footer-content {
        display: flex;
        justify-content: space-between;
        align-items: center;
        max-width: 100%;
      }
      
      .footer-left {
        text-align: left;
      }
      
      .footer-right {
        text-align: right;
      }
      
      .footer-text {
        font-size: 0.95rem;
        font-weight: 600;
        margin-bottom: 4px;
      }
      
      .support-info {
        font-size: 0.85rem;
        opacity: 0.9;
      }
      
      .support-email {
        color: #B1E346;
        text-decoration: none;
        font-weight: 600;
      }
      
      .support-email:hover {
        text-decoration: underline;
      }
      
      /* Print optimizations */
      @media print {
        body {
          background: white;
          font-size: 12px;
          margin: 0;
          padding: 0;
        }
        
        .invoice-wrapper {
          max-width: none;
          margin: 0;
          padding: 0;
          box-shadow: none;
          min-height: 100vh;
        }
        
        .invoice-header {
          background: #B1E346 !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        
        .invoice-footer {
          position: absolute;
          bottom: 0;
          width: 100%;
          margin-top: 0;
        }
        
        .invoice-body {
          padding-bottom: 80px;
        }
      }
      
      @media (max-width: 768px) {
        .invoice-header,
        .invoice-body,
        .invoice-footer {
          padding-left: 20px;
          padding-right: 20px;
        }
        
        .billing-section {
          grid-template-columns: 1fr;
          gap: 20px;
        }
        
        .summary-section {
          flex-direction: column;
        }
        
        .summary-card {
          margin-left: 0;
          margin-top: 20px;
          min-width: auto;
        }
        
        .footer-content {
          flex-direction: column;
          gap: 10px;
        }
        
        .footer-left,
        .footer-right {
          text-align: center;
        }
      }
    </style>
  </head>
  <body>
    <div class="invoice-wrapper">
      <header class="invoice-header">
        <div class="header-content">
          <div class="company-info">
            <h1>Lapaas</h1>
            <p class="company-tagline">Educational Excellence Platform</p>
          </div>
          <div class="invoice-details">
            <div class="invoice-number">Invoice #${order.orderNo}</div>
            <div class="invoice-date">${order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }) : ""}</div>
          </div>
        </div>
      </header>
      
      <main class="invoice-body">
        <div class="billing-section">
          <div class="billing-card">
            <h3>Student Details</h3>
            <div class="billing-item">
              <span class="billing-label">Name:</span>
              <div class="billing-value">${guestUser.fullName}</div>
            </div>
            <div class="billing-item">
              <span class="billing-label">Email:</span>
              <div class="billing-value">${guestUser.email}</div>
            </div>
          </div>
          
          ${company && (company.name || company.gstNumber) ? `
          <div class="billing-card">
            <h3>Company Details</h3>
            ${company.name ? `
            <div class="billing-item">
              <span class="billing-label">Company:</span>
              <div class="billing-value">${company.name}</div>
            </div>
            ` : ""}
            ${company.gstNumber ? `
            <div class="billing-item">
              <span class="billing-label">GST No:</span>
              <div class="billing-value">${company.gstNumber}</div>
            </div>
            ` : ""}
          </div>
          ` : `
          <div class="billing-card">
            <h3>Payment Status</h3>
            <div class="billing-item">
              <span class="billing-label">Status:</span>
              <div class="billing-value">✅ Completed</div>
            </div>
            <div class="billing-item">
              <span class="billing-label">Method:</span>
              <div class="billing-value">Online Payment</div>
            </div>
          </div>
          `}
        </div>
        
        <div class="items-section">
          <h3 class="items-title">Learning Items</h3>
          <table class="items-table">
            <thead>
              <tr>
                <th style="width: 50px;">#</th>
                <th>Item Type</th>
                <th style="width: 160px;">Item ID</th>
                <th style="width: 120px;">Price</th>
                <th style="width: 100px;">Currency</th>
              </tr>
            </thead>
            <tbody>
              ${order.items.map((item, idx) => `
                <tr>
                  <td><strong>${idx + 1}</strong></td>
                  <td>
                    <span class="item-badge ${item.type === "course" ? "badge-course" : "badge-bundle"}">
                      ${item.type === "course" ? "Course" : "Bundle"}
                    </span>
                  </td>
                  <td><span class="item-code">${item.courseId || item.courseBundleId}</span></td>
                  <td class="price-cell">₹${parseFloat(item.pricePaid).toFixed(2)}</td>
                  <td>${item.currency}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
        
        <div class="summary-section">
          <div class="payment-info">
            <h4>Payment Information</h4>
            <div class="payment-detail">
              <span class="payment-label">Payment Method:</span>
              <span class="payment-value">Online Payment</span>
            </div>
            <div class="payment-detail">
              <span class="payment-label">Transaction Status:</span>
              <span class="payment-value">Completed</span>
            </div>
            <div class="payment-detail">
              <span class="payment-label">Invoice Date:</span>
              <span class="payment-value">${order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-US') : ""}</span>
            </div>
          </div>
          
          <div class="summary-card">
            <h3 class="summary-title">Payment Summary</h3>
            <div class="summary-row">
              <span class="summary-label">Subtotal</span>
              <span class="summary-value">₹${parseFloat(order.subTotal).toFixed(2)}</span>
            </div>
            <div class="summary-row">
              <span class="summary-label">Discount</span>
              <span class="summary-value">-₹${parseFloat(order.discount).toFixed(2)}</span>
            </div>
            <div class="summary-row">
              <span class="summary-label">GST (${parseFloat(order.gstRate) * 100}%)</span>
              <span class="summary-value">₹${parseFloat(order.tax).toFixed(2)}</span>
            </div>
            <div class="summary-row">
              <span class="summary-label">Total Amount</span>
              <span class="summary-value">₹${parseFloat(order.grandTotal).toFixed(2)}</span>
            </div>
          </div>
        </div>
      </main>
      
      <footer class="invoice-footer">
        <div class="footer-content">
          <div class="footer-left">
            <div class="footer-text">Thank you for choosing Lapaas! 🎓</div>
            <div class="support-info">Your trusted learning partner</div>
          </div>
          <div class="footer-right">
            <div class="footer-text">Need Support?</div>
            <div class="support-info">
              Contact us at <a href="mailto:support@lapaas.com" class="support-email">support@lapaas.com</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  </body>
  </html>
  `;
}

// Helper to generate PDF buffer from HTML using the shared, concurrency-gated
// renderer (utils/pdfRenderer.js — single long-lived Chromium, bundled-first
// with /usr/bin/google-chrome fallback, max 2 concurrent renders).
async function htmlToPdfBuffer(html) {
  try {
    const buffer = await renderHtmlToPdf(html, {
      viewport: { width: 1122, height: 794, deviceScaleFactor: 1 },
      waitUntil: "networkidle0",
      pdfOptions: {
        format: "A4",
        printBackground: true,
        margin: { top: 0, bottom: 0, left: 0, right: 0 },
      },
    });
    //console.log("Invoice PDF buffer generated successfully.");
    return buffer;
  } catch (err) {
    console.error("Error generating invoice PDF:", err?.message);
    throw new Error("Failed to generate invoice PDF");
  }
}

export const checkout = async (req, res) => {
  const userId = req.user._id;
  const { couponCode, paymentProvider = "razorpay" } = req.body;

  try {
    // Validate Content-Type
    if (!req.is('application/json')) {
      return res.status(400).json({ message: "Content-Type must be application/json" });
    }

    // Step 1: Get cart
    const cart = await Cart.findOne({ userId })
      .populate("items.courseId")
      .populate("items.courseBundleId");
    if (!cart || !cart.items.length) {
      return res.status(400).json({ message: "Your cart is empty." });
    }

    // Step 2: Build order items and calculate subtotal
    let subTotal = 0;
    const items = [];
    const courseIdsToEnroll = new Set();

    for (const item of cart.items) {
      // SECURITY: recompute price authoritatively from the server document — never
      // from the client-influenced `priceSnapshot`. salePrice/discountPrice are used
      // only when they are a POSITIVE override (a Decimal128 0 is truthy, so the old
      // `if (salePrice)` check let a 0 sale price make paid courses free).
      let price = 0;

      if (item.type === "course" && item.courseId) {
        const c = item.courseId;
        const sale = c.salePrice != null ? parseFloat(c.salePrice.toString()) : 0;
        const disc = c.discountPrice != null ? parseFloat(c.discountPrice.toString()) : 0;
        const base = c.price != null ? parseFloat(c.price.toString()) : 0;
        price = sale > 0 ? sale : (disc > 0 ? disc : base);
        if (!Number.isFinite(price) || price < 0) price = 0;

        items.push({
          courseId: c._id,
          type: "course",
          pricePaid: price,
          currency: item.currency || "INR",
        });
        courseIdsToEnroll.add(c._id.toString());
      } else if (item.type === "courseBundle" && item.courseBundleId) {
        const bundleDoc = item.courseBundleId;
        const base = bundleDoc.price != null ? parseFloat(bundleDoc.price.toString()) : 0;
        price = Number.isFinite(base) && base >= 0 ? base : 0;

        items.push({
          courseBundleId: bundleDoc._id,
          type: "courseBundle",
          pricePaid: price,
          currency: item.currency || "INR",
        });
        const bundle = await CourseBundle.findById(item.courseBundleId).populate("courses");
        if (!bundle || !bundle.courses) {
          throw new Error(`Course bundle ${item.courseBundleId} or its courses not found`);
        }
        bundle.courses.forEach((course) => courseIdsToEnroll.add(course._id.toString()));
      } else {
        throw new Error(`Invalid cart item: type=${item.type}, courseId=${item.courseId}, courseBundleId=${item.courseBundleId}`);
      }

      subTotal += price;
    }

    // Step 3: Apply coupon — validate and compute the discount only. The usage
    // is recorded atomically AFTER the payment is verified (Step 4.6 below):
    // burning it here meant a failed payment verification still consumed the
    // redemption, blocking the user's retry with single-use coupons.
    let discount = 0;
    let couponToRedeem = null;
    if (couponCode) {
      const validationResult = await validateCoupon(couponCode, subTotal, userId);
      discount = validationResult.discountAmount;
      couponToRedeem = validationResult.coupon._id;
    }

    // Step 4: Fetch GST rate
    let GST_RATE;
    try {
      GST_RATE = await Setting.getGstRate(); // Get GST rate (defaults to 0.18)
    } catch (err) {
      console.error("Error fetching GST rate:", err);
      return res.status(500).json({ message: "Failed to fetch GST rate", error: err.message });
    }
    const taxableAmount = subTotal - discount;
    const tax = parseFloat((taxableAmount * GST_RATE).toFixed(2)); // Calculate GST
    const grandTotal = parseFloat((taxableAmount + tax).toFixed(2)); // Add GST to grand total

    // Step 4.5: SECURITY — verify the Razorpay payment server-side BEFORE creating
    // the order or granting any enrollment. Previously this handler hard-coded
    // payment.status = 'paid' for razorpay with NO gateway verification, so anyone
    // could POST /checkout and be enrolled in their whole cart for free.
    const paymentId = req.body.paymentId;
    if (paymentProvider === "razorpay" && grandTotal > 0) {
      if (!paymentId) {
        return res.status(400).json({ message: "Payment ID is required for Razorpay" });
      }
      const keySetting = await Setting.findOne({ key: "RAZORPAY_KEY_ID" });
      const secretSetting = await Setting.findOne({ key: "RAZORPAY_KEY_SECRET" });
      const apiKey = keySetting?.value;
      const apiSecret = secretSetting?.value;
      if (!apiKey || !apiSecret) {
        return res.status(500).json({ message: "Razorpay credentials not found in settings" });
      }
      const expectedPaise = Math.round(grandTotal * 100);
      const url = `https://api.razorpay.com/v1/payments/${paymentId}`;
      const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
      const headers = { "Content-Type": "application/json", Authorization: `Basic ${auth}` };
      try {
        const paymentRes = await axios.get(url, { headers, timeout: 15000 });
        const payment = paymentRes.data || {};
        if (payment.currency && payment.currency !== "INR") {
          return res.status(400).json({ message: "Payment currency mismatch." });
        }
        if (typeof payment.amount === "number" && payment.amount < expectedPaise) {
          return res.status(400).json({ message: "Paid amount does not match order amount." });
        }
        if (!["authorized", "captured"].includes(payment.status)) {
          return res.status(400).json({ message: `Payment not completed (status: ${payment.status || "unknown"}).` });
        }
        if (payment.status === "authorized") {
          await axios.post(`${url}/capture`, { amount: expectedPaise, currency: "INR" }, { headers, timeout: 15000 });
        }
      } catch (err) {
        const desc = err.response?.data?.error?.description || err.message;
        if (!desc || !desc.includes("already been captured")) {
          return res.status(400).json({ message: "Payment verification failed: " + desc });
        }
      }
    }

    // Step 4.6: RELIABILITY — record the coupon redemption only now, AFTER the
    // payment has been verified/captured (atomic, limit-guarded; see
    // redeemCouponUsage). validateCoupon pre-checked the limits above, so a
    // failure here only happens on a concurrent redemption race.
    if (couponToRedeem) {
      const redemption = await redeemCouponUsage(couponToRedeem, userId);
      if (!redemption.ok) {
        return res.status(400).json({ message: redemption.reason });
      }
    }

    // Read-only lookup done BEFORE the transaction (so its error path can respond).
    let defaultEnrolledStudentsCount;
    try {
      defaultEnrolledStudentsCount = await Setting.getDefaultEnrolledStudentsCount();
    } catch (err) {
      console.error("Error fetching default enrolled students count:", err);
      return res.status(500).json({ message: "Failed to fetch default enrolled students count", error: err.message });
    }

    // ATOMICITY: create the order, grant every enrollment, update course/bundle
    // counters and clear the cart inside ONE transaction, so a failure after the
    // payment was captured cannot leave the buyer charged-but-not-enrolled. On a
    // standalone mongod (no transaction support) this degrades to the previous
    // non-atomic behaviour. Side effects (push notifications) stay OUTSIDE.
    const newOrder = await runInTransaction(async (session) => {
      // Step 5: Create order
      const [order] = await Order.create([{
        orderNo: await generateOrderNumber(),
        userId,
        items,
        subTotal,
        discount,
        tax,
        gstRate: GST_RATE, // Save the applied GST rate
        grandTotal,
        payment: {
          paymentIntent: paymentId || null,
          provider: paymentProvider,
          // 'paid' only after the verification above succeeded (or for a free order).
          status: paymentProvider === "razorpay" ? "paid" : "pending",
        },
      }], { session });

    // Step 6: Create enrollments
    for (const item of items) {
      if (item.type === "course" && item.courseId) {
        // ACCESS EXPIRY: an expired-by-date 'active' enrollment must not block
        // a renewal — only an unexpired one suppresses creating a fresh one.
        const existingEnrollment = await CourseEnrollment.findOne({
          userId,
          courseId: item.courseId,
          status: "active",
          $or: [{ accessExpiry: null }, { accessExpiry: { $gt: new Date() } }],
        }).session(session);
        const course = await Course.findById(item.courseId).session(session);
        if (!course) {
          throw new Error(`Course ${item.courseId} not found`);
        }
        let accessType = course.accessType || "lifetime";
        let enrolledAt = new Date();
        let accessExpiry = null;
        if (
          (accessType === "limited" || accessType === "subscription") &&
          course.accessPeriod
        ) {
          const periodStr = course.accessPeriod.trim().toLowerCase();
          let years = 0, months = 0, days = 0;
          const yearMatch = periodStr.match(/(\d+)\s*year/);
          const monthMatch = periodStr.match(/(\d+)\s*month/);
          const dayMatch = periodStr.match(/(\d+)\s*day/);
          if (yearMatch) years = parseInt(yearMatch[1], 10);
          if (monthMatch) months = parseInt(monthMatch[1], 10);
          if (dayMatch) days = parseInt(dayMatch[1], 10);
          let expiry = new Date(enrolledAt);
          if (years > 0) expiry.setFullYear(expiry.getFullYear() + years);
          if (months > 0) expiry.setMonth(expiry.getMonth() + months);
          if (days > 0) expiry.setDate(expiry.getDate() + days);
          if (years > 0 || months > 0 || days > 0) {
            accessExpiry = expiry;
          }
        }
        if (!existingEnrollment) {
          await CourseEnrollment.create([{
            userId,
            courseId: item.courseId,
            type: "course",
            enrolledAt,
            enrollmentSource: "purchase",
            accessType,
            accessExpiry,
          }], { session });

          if (!course.enrolledStudents.includes(userId)) {
            course.enrolledStudents.push(userId);
            if (course.enrolledStudentsCount === 0) {
              course.enrolledStudentsCount = defaultEnrolledStudentsCount;
            }
            course.enrolledStudentsCount += 1;
            await course.save({ session });
          }
        }
        // Add user to course chat room
        const room = await CourseChatRoom.findOne({ courseId: item.courseId }).session(session);
        if (room && !room.participants.includes(userId)) {
          room.participants.push(userId);
          await room.save({ session });
        }
      } else if (item.type === "courseBundle" && item.courseBundleId) {
        const bundle = await CourseBundle.findById(item.courseBundleId).populate("courses").session(session);
        if (!bundle || !bundle.courses) {
          throw new Error(`Course bundle ${item.courseBundleId} or its courses not found`);
        }
        for (const course of bundle.courses) {
          if (course._id) {
            // ACCESS EXPIRY: ignore stale expired-by-date 'active' enrollments
            // so a renewal creates a fresh enrollment (see comment above).
            const existingEnrollment = await CourseEnrollment.findOne({
              userId,
              courseId: course._id,
              status: "active",
              $or: [{ accessExpiry: null }, { accessExpiry: { $gt: new Date() } }],
            }).session(session);
            let accessType = course.accessType || "lifetime";
            let enrolledAt = new Date();
            let accessExpiry = null;
            if (
              (accessType === "limited" || accessType === "subscription") &&
              course.accessPeriod
            ) {
              const periodStr = course.accessPeriod.trim().toLowerCase();
              let years = 0, months = 0, days = 0;
              const yearMatch = periodStr.match(/(\d+)\s*year/);
              const monthMatch = periodStr.match(/(\d+)\s*month/);
              const dayMatch = periodStr.match(/(\d+)\s*day/);
              if (yearMatch) years = parseInt(yearMatch[1], 10);
              if (monthMatch) months = parseInt(monthMatch[1], 10);
              if (dayMatch) days = parseInt(dayMatch[1], 10);
              let expiry = new Date(enrolledAt);
              if (years > 0) expiry.setFullYear(expiry.getFullYear() + years);
              if (months > 0) expiry.setMonth(expiry.getMonth() + months);
              if (days > 0) expiry.setDate(expiry.getDate() + days);
              if (years > 0 || months > 0 || days > 0) {
                accessExpiry = expiry;
              }
            }
            if (!existingEnrollment) {
              await CourseEnrollment.create([{
                userId,
                courseId: course._id,
                type: "groupCourse",
                enrolledAt,
                enrollmentSource: "purchase",
                accessType,
                accessExpiry,
              }], { session });
              const courseToUpdate = await Course.findById(course._id).session(session);
              if (!courseToUpdate) {
                throw new Error(`Course ${course._id} not found`);
              }
              if (!courseToUpdate.enrolledStudents.includes(userId)) {
                courseToUpdate.enrolledStudents.push(userId);
                if (courseToUpdate.enrolledStudentsCount === 0) {
                  courseToUpdate.enrolledStudentsCount = defaultEnrolledStudentsCount;
                }
                courseToUpdate.enrolledStudentsCount += 1;
                await courseToUpdate.save({ session });
              }
            }
            // Add user to course chat room for each course in bundle
            const room = await CourseChatRoom.findOne({ courseId: course._id }).session(session);
            if (room && !room.participants.includes(userId)) {
              room.participants.push(userId);
              await room.save({ session });
            }
          }
        }
        let bundleAccessType = bundle.accessType || "lifetime";
        let bundleEnrolledAt = new Date();
        let bundleAccessExpiry = null;
        if (
          (bundleAccessType === "limited" || bundleAccessType === "subscription") &&
          bundle.accessPeriod
        ) {
          const periodStr = bundle.accessPeriod.trim().toLowerCase();
          let years = 0, months = 0, days = 0;
          const yearMatch = periodStr.match(/(\d+)\s*year/);
          const monthMatch = periodStr.match(/(\d+)\s*month/);
          const dayMatch = periodStr.match(/(\d+)\s*day/);
          if (yearMatch) years = parseInt(yearMatch[1], 10);
          if (monthMatch) months = parseInt(monthMatch[1], 10);
          if (dayMatch) days = parseInt(dayMatch[1], 10);
          let expiry = new Date(bundleEnrolledAt);
          if (years > 0) expiry.setFullYear(expiry.getFullYear() + years);
          if (months > 0) expiry.setMonth(expiry.getMonth() + months);
          if (days > 0) expiry.setDate(expiry.getDate() + days);
          if (years > 0 || months > 0 || days > 0) {
            bundleAccessExpiry = expiry;
          }
        }
        await CourseEnrollment.create([{
          userId,
          courseBundleId: item.courseBundleId,
          type: "courseBundle",
          enrolledAt: bundleEnrolledAt,
          enrollmentSource: "purchase",
          accessType: bundleAccessType,
          accessExpiry: bundleAccessExpiry,
        }], { session });

        if (!bundle.enrolledStudents.includes(userId)) {
          bundle.enrolledStudents.push(userId);
          await bundle.save({ session });
        }
      }
    }

      // Step 7: Clear cart
      await Cart.deleteOne({ userId }, { session });

      return order;
    });


    //send push notification
    const fcmTokens = await fcmTokenss.findOne({ userId });

    if (fcmTokens) {
      // Send push notification
      const data = {
        title: "Order Notification",
        description: "Your order has been placed successfully.",
        order_id: newOrder._id.toString(),
        type: "new_order",
      };
      const notiresponse = await notificationService.sendPushNotification(fcmTokens.token, data);
      //console.log("Push notification response:", notiresponse);

      //save notification response
      if (notiresponse.success) {
        const notification = new Notification({
          data,
          status: 0,
          user_id: userId,
        });
        await notification.save();
      }
    }

    return res.status(201).json({
      message: "Checkout successful",
      order: {
        ...newOrder.toObject(),
        tax: newOrder.tax.toString(), // Convert Decimal128 to string
        gstRate: newOrder.gstRate.toString(), // Convert Decimal128 to string
        subTotal: newOrder.subTotal.toString(), // Convert Decimal128 to string
        discount: newOrder.discount.toString(), // Convert Decimal128 to string
        grandTotal: newOrder.grandTotal.toString(), // Convert Decimal128 to string
      },
    });
  } catch (err) {
    console.error("Checkout Error:", err);
    return res
      .status(500)
      .json({ message: "Checkout failed", error: err.message });
  }
};

//mypurchase from order model
export const getMyPurchases = async (req, res) => {
  // SECURITY (IDOR): identity comes from the authenticated token. Only admins
  // may pass an explicit ?userid to look up another user's purchases.
  const userId = (hasAdminRole(req.user) && req.query.userid) ? req.query.userid : req.user._id;

  try {
    const purchases = await Order.find({ userId }).lean();
    return res.status(200).json({ message: "My purchases fetched", data: purchases });
  } catch (err) {
    console.error("Error fetching my purchases:", err);
    return res.status(500).json({ message: "Error fetching my purchases", error: err.message });
  }
};

export const getMyEnrollments = async (req, res) => {
  // SECURITY (IDOR): identity comes from the authenticated token. Only admins
  // may pass an explicit ?userid — the admin panel uses this when issuing
  // certificates (IssueCertification.tsx).
  const userId = (hasAdminRole(req.user) && req.query.userid) ? req.query.userid : req.user._id;

  try {
    // ACCESS EXPIRY (read-time enforcement): nothing flips status once
    // accessExpiry passes — the pre('save') hook on CourseEnrollment only runs
    // on explicit save() and no sweep is scheduled — so lazily expire this
    // user's stale 'active' enrollments before reading them back. ($lt with a
    // Date only matches Date values, so null/missing accessExpiry is ignored.)
    const now = new Date();
    await CourseEnrollment.updateMany(
      { userId, status: 'active', accessExpiry: { $lt: now } },
      { $set: { status: 'expired' } }
    );

    // Fetch enrollments without populating lastVideoPlayed
    const enrollments = await CourseEnrollment.find({
      userId

    })
      .populate('orderId', 'orderNo subTotal discount gstRate grandTotal invoice_url')
      .lean();

    if (!enrollments.length) {
      return res.status(404).json({ message: 'No enrollments found.' });
    }

    // Belt-and-braces: reflect expiry in the returned status even if the
    // updateMany above raced with a concurrent write.
    for (const enrollment of enrollments) {
      if (
        enrollment.status === 'active' &&
        enrollment.accessExpiry &&
        new Date(enrollment.accessExpiry) < now
      ) {
        enrollment.status = 'expired';
      }
    }

    // -----------------------------------------------------------------------
    // PERFORMANCE: this endpoint used to fire ~7-8 queries PER enrollment
    // (VideoLesson/LessonProgress/Course/Certificate lookups plus a
    // checkCourseCompletion call that re-fetched each course with its full
    // modules→lessons tree and ran 3 countDocuments). Everything below is
    // batched: one $in fetch per collection joined in JS via Maps, and the
    // completion counts come from ONE aggregation per collection grouped by
    // courseId. The per-enrollment response shape is unchanged.
    // -----------------------------------------------------------------------
    const CoursePlan = (await import('../models/CoursePlan.js')).default;

    const videoIds = [...new Set(
      enrollments.filter((e) => e.lastVideoPlayed).map((e) => e.lastVideoPlayed.toString())
    )];
    const planIds = [...new Set(
      enrollments.filter((e) => e.type === 'coursePlan' && e.coursePlanId).map((e) => e.coursePlanId.toString())
    )];
    const bundleIds = [...new Set(
      enrollments.filter((e) => e.type === 'courseBundle' && e.courseBundleId).map((e) => e.courseBundleId.toString())
    )];

    const [videos, plans, bundles] = await Promise.all([
      videoIds.length
        ? VideoLesson.find({ _id: { $in: videoIds } }).setOptions({ virtuals: true }).lean()
        : [],
      planIds.length ? CoursePlan.find({ _id: { $in: planIds } }).lean() : [],
      bundleIds.length ? CourseBundle.find({ _id: { $in: bundleIds } }).populate('courses').lean() : [],
    ]);

    const videoMap = new Map(videos.map((v) => [v._id.toString(), v]));
    const planMap = new Map(plans.map((p) => [p._id.toString(), p]));
    const bundleMap = new Map(bundles.map((b) => [b._id.toString(), b]));

    // Courses returned in the response body: direct course enrollments plus the
    // course each plan points at (bundle courses arrive via the populate above).
    const responseCourseIds = [...new Set([
      ...enrollments.filter((e) => e.type === 'course' && e.courseId).map((e) => e.courseId.toString()),
      ...plans.filter((p) => p.courseId).map((p) => p.courseId.toString()),
    ])];

    // Every course that needs an overallProgress figure (incl. bundle courses).
    const progressCourseIds = [...new Set([
      ...responseCourseIds,
      ...bundles.flatMap((b) => (b.courses || []).map((c) => c._id.toString())),
    ])];

    const lessonIds = [...new Set(
      videos.filter((v) => v.lessonId).map((v) => v.lessonId.toString())
    )];

    // Aggregation pipelines do NOT auto-cast, so convert ids explicitly.
    const userObjectId = new mongoose.Types.ObjectId(String(userId));
    const progressCourseObjectIds = progressCourseIds.map((id) => new mongoose.Types.ObjectId(id));

    const [
      responseCourses,
      totalsCourses,
      lessonCounts,
      quizCounts,
      assignmentCounts,
      lastProgressDocs,
      certificates,
    ] = await Promise.all([
      responseCourseIds.length ? Course.find({ _id: { $in: responseCourseIds } }).lean() : [],
      // Per-course content totals — the same modules→lessons tree the old
      // per-enrollment checkCourseCompletion fetched, but once for all courses
      // and trimmed to the lesson `type` field.
      progressCourseIds.length
        ? Course.find({ _id: { $in: progressCourseIds } })
          .select('modules')
          .populate({ path: 'modules', select: 'lessons', populate: { path: 'lessons', select: 'type' } })
          .lean()
        : [],
      // Completed counts — one aggregation per collection, grouped by courseId
      // (filters identical to CourseCompletionService.checkCourseCompletion).
      progressCourseIds.length
        ? LessonProgress.aggregate([
          { $match: { userId: userObjectId, courseId: { $in: progressCourseObjectIds }, completed: true } },
          { $group: { _id: '$courseId', count: { $sum: 1 } } },
        ])
        : [],
      progressCourseIds.length
        ? QuizSubmission.aggregate([
          { $match: { user: userObjectId, courseId: { $in: progressCourseObjectIds }, is_completed: true, passed: true } },
          { $group: { _id: '$courseId', count: { $sum: 1 } } },
        ])
        : [],
      progressCourseIds.length
        ? AssignmentSubmission.aggregate([
          { $match: { submittedBy: userObjectId, courseId: { $in: progressCourseObjectIds }, is_complete: true, status: 'graded' } },
          { $group: { _id: '$courseId', count: { $sum: 1 } } },
        ])
        : [],
      lessonIds.length
        ? LessonProgress.find({ userId, lessonId: { $in: lessonIds } }).lean()
        : [],
      responseCourseIds.length
        ? Certificate.find({ user_id: userId, course_id: { $in: responseCourseIds } }).lean()
        : [],
    ]);

    const courseMap = new Map(responseCourses.map((c) => [c._id.toString(), c]));

    // Total content items per course, by lesson type (same counting rules as
    // checkCourseCompletion: only when the course doc and its modules exist).
    const totalsMap = new Map();
    for (const c of totalsCourses) {
      if (!c.modules) continue; // missing modules -> treated as 100% below
      let totalItems = 0;
      for (const module of c.modules) {
        if (!module || !module.lessons) continue;
        for (const lesson of module.lessons) {
          if (lesson.type === 'video-lesson') totalItems++;
          if (lesson.type === 'quiz') totalItems++;
          if (lesson.type === 'assignment') totalItems++;
        }
      }
      totalsMap.set(c._id.toString(), totalItems);
    }

    const countsToMap = (rows) => new Map(rows.map((r) => [String(r._id), r.count]));
    const lessonCountMap = countsToMap(lessonCounts);
    const quizCountMap = countsToMap(quizCounts);
    const assignmentCountMap = countsToMap(assignmentCounts);

    // Same math as CourseCompletionService.checkCourseCompletion, computed from
    // the batched counts. (The persisted enrollment.progressPercentage is NOT
    // used here because no cron keeps it fresh.)
    const overallProgressFor = (courseIdStr) => {
      if (!totalsMap.has(courseIdStr)) return 100; // course/modules missing
      const totalItems = totalsMap.get(courseIdStr);
      if (totalItems <= 0) return 100;
      const completedItems =
        (lessonCountMap.get(courseIdStr) || 0) +
        (quizCountMap.get(courseIdStr) || 0) +
        (assignmentCountMap.get(courseIdStr) || 0);
      const overallProgress = Math.min((completedItems / totalItems) * 100, 100);
      return Math.round(overallProgress * 100) / 100;
    };

    // First-match-wins to mirror the old per-item findOne() lookups.
    const lastProgressMap = new Map();
    for (const progress of lastProgressDocs) {
      const key = progress.lessonId && progress.lessonId.toString();
      if (key && !lastProgressMap.has(key)) lastProgressMap.set(key, progress);
    }
    const certificateMap = new Map();
    for (const cert of certificates) {
      const key = cert.course_id && cert.course_id.toString();
      if (key && !certificateMap.has(key)) certificateMap.set(key, cert);
    }

    const populatedEnrollments = enrollments.map((enrollment) => {
      // lastVideoPlayed joined from the batched VideoLesson fetch
      let lastVideoPlayed = null;
      if (enrollment.lastVideoPlayed) {
        const video = videoMap.get(enrollment.lastVideoPlayed.toString());
        if (video) {
          lastVideoPlayed = {
            ...video,
            lastProgress: (video.lessonId && lastProgressMap.get(video.lessonId.toString())) || null,
          };
        }
      }

      if (enrollment.type === 'course' && enrollment.courseId) {
        const courseDoc = courseMap.get(enrollment.courseId.toString());

        if (courseDoc && courseDoc._id) {
          const course = {
            ...courseDoc,
            overallProgress: overallProgressFor(courseDoc._id.toString()),
          };
          const certificate = certificateMap.get(courseDoc._id.toString()) || null;

          return {
            ...enrollment,
            course,
            certificate,
            order: enrollment.orderId,
            lastVideoPlayed
          };
        }
        return {
          ...enrollment,
          course: null,
          certificate: null,
          lastVideoPlayed,
          error: `Course with ID ${enrollment.courseId} not found`,
        };
      } else if (enrollment.type === 'courseBundle' && enrollment.courseBundleId) {
        const bundleDoc = bundleMap.get(enrollment.courseBundleId.toString());
        let bundle = bundleDoc || null;

        if (bundleDoc && bundleDoc.courses && bundleDoc.courses.length > 0) {
          bundle = {
            ...bundleDoc,
            courses: bundleDoc.courses.map((course) => ({
              ...course,
              overallProgress: overallProgressFor(course._id.toString()),
              // NOTE: the old per-course lookup here queried Certificate by a
              // `courseId` field that does not exist in the Certificate schema
              // (the real field is `course_id`), so under Mongoose 7+
              // (strictQuery: false) it could never match. Kept as null to
              // preserve the existing response contract exactly.
              certificate: null,
            })),
          };
        }
        return {
          ...enrollment,
          bundle,
          order: enrollment.orderId,
          lastVideoPlayed, // Manually fetched VideoLesson
        };
      } else if (enrollment.type === 'coursePlan' && enrollment.coursePlanId) {
        const plan = planMap.get(enrollment.coursePlanId.toString()) || null;
        if (plan && plan.courseId) {
          const courseDoc = courseMap.get(plan.courseId.toString());
          let course = null;
          let certificate = null;
          if (courseDoc && courseDoc._id) {
            course = {
              ...courseDoc,
              overallProgress: overallProgressFor(courseDoc._id.toString()),
            };
            certificate = certificateMap.get(courseDoc._id.toString()) || null;
          }
          return {
            ...enrollment,
            course,
            coursePlan: plan,
            certificate,
            order: enrollment.orderId,
            lastVideoPlayed
          };
        }
        return {
          ...enrollment,
          course: null,
          coursePlan: plan,
          certificate: null,
          lastVideoPlayed,
          error: `Course with ID ${plan?.courseId} not found`,
        };
      }
      return {
        ...enrollment,
        order: enrollment.orderId,
        lastVideoPlayed, // Manually fetched VideoLesson
      };
    });

    return res.status(200).json({
      success: true,
      data: populatedEnrollments,
    });
  } catch (err) {
    console.error('Get My Enrollments Error:', err);
    return res
      .status(500)
      .json({ message: 'Failed to retrieve enrollments', error: err.message });
  }
};

export const checkCoupon = async (req, res) => {
  try {
    const { couponCode, amount, email } = req.body;
    if (!couponCode || !amount) {
      return res.status(400).json({ success: false, message: "Coupon code and amount are required" });
    }

    let userId = null;
    if (email) {
      const user = await User.findOne({ email });
      if (user) userId = user._id;
    }

    const result = await validateCoupon(couponCode, amount, userId);
    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message
    });
  }
};


export const validateCoupon = async (code, orderAmount, userId) => {
  try {
    const coupon = await Coupon.findOne({
      code: code.toUpperCase(),
      isActive: true,
    });

    if (!coupon) {
      throw new Error("Invalid coupon code");
    }

    if (!coupon.isActive) {
      throw new Error("Coupon is not active");
    }

    const now = new Date();
    if (now < coupon.startDate) {
      throw new Error("Coupon is not yet valid");
    }

    if (now > coupon.endDate) {
      throw new Error("Coupon has expired");
    }

    if (orderAmount < coupon.minOrderAmount) {
      throw new Error(
        `Minimum order amount of ₹${coupon.minOrderAmount} required`
      );
    }

    if (coupon.usageLimit > 0) {
      const totalUsage = coupon.usedBy.reduce(
        (sum, user) => sum + user.usageCount,
        0
      );
      if (totalUsage >= coupon.usageLimit) {
        throw new Error("Coupon usage limit exceeded");
      }
    }

    // Per-user limit (usageLimitPerUser, schema default 1; <= 0 = unlimited).
    // Previously only checkOrder enforced any per-user rule, so direct
    // /checkout/buy-now or /checkout calls could reuse a per-user-limited
    // coupon all the way up to the global cap.
    if (userId && coupon.usageLimitPerUser > 0) {
      const userUsage = coupon.usedBy.find(
        (u) => u.userId && u.userId.toString() === userId.toString()
      );
      if (userUsage && userUsage.usageCount >= coupon.usageLimitPerUser) {
        throw new Error("Coupon usage limit per user exceeded");
      }
    }

    let discountAmount = 0;
    if (coupon.discountType === "flat") {
      discountAmount = coupon.discountAmount;
    } else if (coupon.discountType === "percentage") {
      discountAmount = (orderAmount * coupon.discountPercent) / 100;
      if (
        coupon.maxDiscountValue > 0 &&
        discountAmount > coupon.maxDiscountValue
      ) {
        discountAmount = coupon.maxDiscountValue;
      }
    }

    const finalAmount = orderAmount - discountAmount;

    return {
      coupon: {
        _id: coupon._id,
        code: coupon.code,
        description: coupon.description,
        discountType: coupon.discountType,
        discountAmount: coupon.discountAmount,
        discountPercent: coupon.discountPercent,
      },
      orderAmount,
      discountAmount,
      finalAmount,
      isValid: true,
    };
  } catch (error) {
    throw error;
  }
};

// RELIABILITY: record one coupon redemption atomically. Both the global
// usageLimit (0 = unlimited) and the per-user usageLimitPerUser (<= 0 =
// unlimited) are enforced inside the update FILTER itself, so concurrent
// redemptions cannot over-redeem the way the old read-modify-write
// (findById -> mutate array -> save) could. Callers invoke this only AFTER
// payment verification/capture succeeds, so a failed payment never burns a
// redemption. Returns { ok: true } when recorded, { ok: false, reason } when
// a limit was hit.
async function redeemCouponUsage(couponId, userId) {
  const limits = await Coupon.findById(couponId)
    .select("usageLimit usageLimitPerUser usedBy")
    .lean();
  if (!limits) {
    return { ok: false, reason: "Invalid coupon code" };
  }

  const guard = { _id: couponId };
  if (limits.usageLimit > 0) {
    // Global cap: the total usage (sum of usedBy.usageCount) must still be
    // below the limit AT WRITE TIME — evaluated server-side by MongoDB.
    guard.$expr = { $lt: [{ $sum: "$usedBy.usageCount" }, limits.usageLimit] };
  }

  const userEntryMatch = { userId: userId };
  if (limits.usageLimitPerUser > 0) {
    userEntryMatch.usageCount = { $lt: limits.usageLimitPerUser };
  }

  // Path 1: the user already has a usedBy entry below their per-user cap.
  const incremented = await Coupon.updateOne(
    { ...guard, usedBy: { $elemMatch: userEntryMatch } },
    { $inc: { "usedBy.$.usageCount": 1 } }
  );
  if (incremented.modifiedCount) return { ok: true };

  // Path 2: no usedBy entry for this user yet — add one atomically.
  const pushed = await Coupon.updateOne(
    { ...guard, "usedBy.userId": { $ne: userId } },
    { $push: { usedBy: { userId: userId, usageCount: 1 } } }
  );
  if (pushed.modifiedCount) return { ok: true };

  // Path 3: a concurrent request may have created the entry between the two
  // updates above — retry the guarded increment once.
  const retried = await Coupon.updateOne(
    { ...guard, usedBy: { $elemMatch: userEntryMatch } },
    { $inc: { "usedBy.$.usageCount": 1 } }
  );
  if (retried.modifiedCount) return { ok: true };

  const hasEntry = (limits.usedBy || []).some(
    (u) => u.userId && u.userId.toString() === userId.toString()
  );
  return {
    ok: false,
    reason:
      hasEntry && limits.usageLimitPerUser > 0
        ? "Coupon usage limit per user exceeded"
        : "Coupon usage limit exceeded",
  };
}

//checkOrder
export const checkOrder = async (req, res) => {
  try {
    const {
      courseId,
      courseBundleId,
      coursePlanId, // <-- support plan
      guestEmail,
      guestName,
      couponCode,
      is_verify
    } = req.body;

    if (!guestEmail) {
      return res.status(400).json({ message: "Guest email is required", is_valid: false });
    }

    if (!is_verify) {
      return res.status(400).json({ message: "Email not verified", is_valid: false, success: false, err: { email: "Please verify your email before proceeding" } });
    }

    if (courseId && courseBundleId) {
      return res.status(400).json({ message: "Provide either courseId or courseBundleId, not both", is_valid: false });
    }

    // Allow courseId+coursePlanId if plan belongs to course
    if (
      (courseId && courseBundleId) ||
      (coursePlanId && courseBundleId)
    ) {
      return res.status(400).json({ message: "Provide either courseId/coursePlanId or courseBundleId, not both" });
    }
    if (courseId && coursePlanId) {
      // Check if plan belongs to course
      const CoursePlan = (await import('../models/CoursePlan.js')).default;
      const plan = await CoursePlan.findById(coursePlanId);
      if (!plan) {
        return res.status(404).json({ message: "Course plan not found" });
      }
      if (plan.courseId.toString() !== courseId.toString()) {
        return res.status(400).json({ message: "Course plan does not belong to the specified course" });
      }
      // If valid, proceed and ignore courseId for item creation (use plan.courseId)
    }

    let guestUser = await User.findOne({ email: guestEmail });

    if (guestUser) {
      // Check if is_verify is explicitly true for existing users
      if (!is_verify && is_verify !== true) {
        return res.status(400).json({
          message: "Email not verified",
          is_valid: false,
          success: false,
          err: { email: "Please verify your email before proceeding" }
        });
      }

      // Check coupon already used by user
      if (couponCode) {
        const coupon = await Coupon.findOne({ code: couponCode.toUpperCase(), isActive: true });
        if (coupon) {
          const userIndex = coupon.usedBy.findIndex(
            (user) => user.userId.toString() === guestUser._id.toString()
          );
          if (userIndex !== -1) {
            return res.status(400).json({ message: "Coupon already used by this user", is_valid: false });
          }
        }
      }

      if (courseId) {
        const course = await Course.findById(courseId);
        if (!course) return res.status(404).json({ message: "Course not found", is_valid: false });
        // ACCESS EXPIRY: nothing flips status automatically once accessExpiry
        // passes (the pre('save') hook only runs on explicit save()), so a
        // stale 'active' enrollment whose access has lapsed must not block a
        // renewal purchase. Only a genuinely-unexpired enrollment counts.
        const existingEnrollment = await CourseEnrollment.findOne({
          userId: guestUser._id,
          courseId: courseId,
          status: "active",
          $or: [{ accessExpiry: null }, { accessExpiry: { $gt: new Date() } }],
        });

        if (existingEnrollment) {
          return res.status(400).json({ message: "User already enrolled in this course", is_valid: false });
        }
      }
    }

    const razorpay = await getRazorpayInstance();
    let amount = 0;

    if (coursePlanId) {
      const CoursePlan = (await import('../models/CoursePlan.js')).default;
      const plan = await CoursePlan.findById(coursePlanId);
      if (!plan) return res.status(404).json({ message: "Course plan not found", is_valid: false });
      // PRICING: CoursePlan.salePrice defaults to 0 in the schema and `0 !== undefined`,
      // so the old check priced plans without an explicit sale price at ₹0. A sale
      // price is only valid as a POSITIVE override — otherwise fall back to the
      // regular price (mirrors the course pricing below and the cart checkout).
      {
        const sale = plan.salePrice != null ? Number(plan.salePrice) : 0;
        amount = sale > 0 ? sale : Number(plan.price || 0);
        if (!Number.isFinite(amount) || amount < 0) amount = 0;
      }
    } else if (courseId) {
      const course = await Course.findById(courseId);
      if (!course) return res.status(404).json({ message: "Course not found", is_valid: false });
      amount = course.salePrice && parseFloat(course.salePrice) > 0
        ? parseFloat(course.salePrice)
        : parseFloat(course.price || 0);
    } else if (courseBundleId) {
      const bundle = await CourseBundle.findById(courseBundleId).populate("courses");
      if (!bundle) return res.status(404).json({ message: "Bundle not found", is_valid: false });
      amount = parseFloat(bundle.price || 0);
    }

    // Ensure amount is rounded to 2 decimals before further calculations
    amount = parseFloat(amount.toFixed(2));

    let discount = 0;
    if (couponCode) {
      try {
        const validationResult = await validateCoupon(couponCode, amount, guestUser ? guestUser._id : null);
        discount = validationResult.discountAmount;
      } catch (err) {
        return res.status(400).json({ message: err.message, is_valid: false });
      }
    }
    const GST_RATE = await Setting.getGstRate();
    const taxableAmount = parseFloat(amount) - parseFloat(discount);
    const tax = parseFloat((taxableAmount * GST_RATE).toFixed(2));
    amount = parseFloat((taxableAmount + tax).toFixed(2));

    if (amount > 0) {
      const currency = "INR";

      const orderOptions = {
        amount: Math.round(amount * 100), // Amount in paise
        currency,
        receipt: `receipt_${Date.now()}`,
        notes: {
          description: courseId ? "Course Purchase" : "Bundle Purchase",
          guestName: guestName || "Guest User",
          guestEmail: guestEmail,
        }
      };

      const order = await razorpay.orders.create(orderOptions);

      const razorpayKeySetting = await Setting.findOne({ key: "RAZORPAY_KEY_ID" });

      // Fix: return amount in rupees (not paise)
      return res.status(200).json({
        success: true,
        is_valid: true,
        razorpay: {
          key: razorpayKeySetting?.value,
          order: order,
          amount: amount, // amount in rupees
          currency: currency,
        },
        data: { message: "Order can be placed" },
      });
    } else {
      return res.status(200).json({
        success: true,
        is_valid: true,
        razorpay: null,
        data: { message: "Order can be placed for free course" },
      });
    }
  } catch (error) {
    console.error("Check Order Error:", error);
    return res.status(500).json({ message: "Failed to check order", error: error.message, is_valid: false });
  }
};


//importStudents
// export const importStudents = async (req, res) => {
//   try {
//     //read uploaded excel file
//     if (!req.file) {
//       return res.status(400).json({ message: "No file uploaded" });
//     }

//     if (!req.body.courseId) {
//       return res.status(400).json({ message: "Course ID  is required" });
//     }

//     const filePath = req.file.path;

//     const workbook = xlsx.readFile(filePath);
//     const sheetName = workbook.SheetNames[1];
//     if (!sheetName) {
//       return res.status(400).json({ message: "Second sheet not found in Excel file" });
//     }
//     const sheet = workbook.Sheets[sheetName];
//     const rows = xlsx.utils.sheet_to_json(sheet);
//     const courseId = req.body.courseId;
//     const courseBundleId = req.body.courseBundleId;

//     if (rows.length === 0) {
//       return res.status(400).json({ message: "Excel file is empty" });
//     }

//     const results = [];
//     // Only import CoursePlan dynamically if needed
//     let CoursePlan = null;
//     var enrolledStudentsCount = 0;
//     for (const [index, row] of rows.entries()) {
//       const rowNumber = index + 2;
//       const fullName = row["Name"] || row["Full Name"];
//       const email = row["Email"];
//       let phone = row["Phone No"] || row["Phone"];
//       if (typeof phone === "string" && phone.startsWith("+91")) {
//         phone = phone.slice(3);
//       }
//       const password = row["Password"] || "student";

//       const coursePlanId = row["Plan Id"];
//       const purchaseDate = row["Purchase Date"];
//       //Expiring On
//       let expiryDate = row["Expiring On"];

//       const is_verify = true;
//       const errors = [];
//       if (!fullName) {
//         errors.push("Full Name is required");
//       }
//       if (!email) {
//         errors.push("Email is required");
//       }
//       if (courseId && courseBundleId) {
//         errors.push("Provide either Course ID or Course Bundle ID, not both");
//       }
//       if (!courseId && !courseBundleId && !coursePlanId) {
//         errors.push("At least one of Course ID, Course Bundle ID, or Course Plan ID is required");
//       }

//       let course = null;
//       let coursePlan = null;
//       let bundle = null;
//       if (courseId) {
//         course = await Course.findById(courseId);
//         if (!course) {
//           errors.push(`Course with ID ${courseId} not found`);
//         }
//       }
//       if (coursePlanId) {
//         if (!CoursePlan) {
//           CoursePlan = (await import('../models/CoursePlan.js')).default;
//         }
//         coursePlan = await CoursePlan.findById(coursePlanId);
//         if (!coursePlan) {
//           errors.push(`Course Plan with ID ${coursePlanId} not found`);
//         }

//         if (course && coursePlan && coursePlan.courseId.toString() !== course._id.toString()) {
//           errors.push(`Course Plan ${coursePlanId} does not belong to Course ${courseId}`);
//         }

//         if (!course && coursePlan) {
//           course = await Course.findById(coursePlan.courseId);
//           if (!course) {
//             errors.push(`Course with ID ${coursePlan.courseId} (from Course Plan) not found`);
//           }
//         }
//       }

//       if (errors.length > 0) {
//         results.push({ row: rowNumber, success: false, errors });
//         continue;
//       }

//       let user = await User.findOne({ email });
//       let isNewUser = false;
//       if (!user) {
//         user = await userService.signup({
//           fullName,
//           email,
//           password,
//           role: "student",
//           is_verify,
//           phone,
//         });
//         isNewUser = true;
//       }
//       const userId = user._id;

//       if (course) {
//         const existingEnrollment = await CourseEnrollment.findOne({
//           userId,
//           courseId: course._id,
//         });
//         if (!existingEnrollment) {

//           //handle purchaseDate and expiryDate
//           let enrolledAt = new Date();
//           if (purchaseDate) {
//             const parsedDate = new Date(purchaseDate);
//             if (!isNaN(parsedDate)) {
//               enrolledAt = parsedDate;
//             }
//           }
//           if (expiryDate) {
//             const parsedExpiry = new Date(expiryDate);
//             if (!isNaN(parsedExpiry)) {
//               // If enrolledAt is after expiryDate, ignore expiryDate
//               if (enrolledAt < parsedExpiry) {
//                 course.accessType = "limited";
//                 course.accessPeriod = null; // Clear accessPeriod since we have explicit expiry
//               }
//             }
//           } else {
//             //generate plan base 
//             if (coursePlan) {
//               if (coursePlan.durationType === "lifetime") {
//                 // No expiry
//                 course.accessType = "lifetime";
//                 course.accessPeriod = null;
//               }
//               else if (coursePlan.durationType === "limited" && coursePlan.duration) {
//                 course.accessType = "limited";
//                 course.accessPeriod = coursePlan.duration; // e.g., "6 months"
//               }
//               else if (coursePlan.durationType === "Month" && coursePlan.duration) {
//                 course.accessType = "month";
//                 course.accessPeriod = coursePlan.duration + " months"; // e.g., "6 months"
//                 expiryDate = new Date(enrolledAt);
//                 expiryDate.setMonth(expiryDate.getMonth() + coursePlan.duration);
//               }
//               else if (coursePlan.durationType === "Year" && coursePlan.duration) {
//                 course.accessType = "year";
//                 course.accessPeriod = coursePlan.duration + " years";
//                 expiryDate = new Date(enrolledAt);
//                 expiryDate.setFullYear(expiryDate.getFullYear() + coursePlan.duration);
//               } else if (coursePlan.durationType === "Day" && coursePlan.duration) {
//                 course.accessType = "day";
//                 course.accessPeriod = coursePlan.duration + " days";
//                 expiryDate = new Date(enrolledAt);
//                 expiryDate.setDate(expiryDate.getDate() + coursePlan.duration);
//               } else {
//                 course.accessType = "lifetime";
//                 course.accessPeriod = null;
//               }
//             }
//           }

//           await CourseEnrollment.create({
//             userId,
//             courseId: course._id,
//             coursePlanId: coursePlan ? coursePlan._id : null,
//             type: "course",
//             enrolledAt: enrolledAt,
//             enrollmentSource: "import",
//             accessType: coursePlan ? (coursePlan.durationType || "lifetime") : (course.accessType || "lifetime"),
//             accessExpiry: expiryDate && !isNaN(new Date(expiryDate)) ? new Date(expiryDate) : null,
//           });
//           enrolledStudentsCount++; 
//           // //console.log('course?.enrolledStudents', course?.enrolledStudents);
//           if (!course?.enrolledStudents?.includes(userId)) {
//             course?.enrolledStudents?.push(userId);
//             course.enrolledStudentsCount = enrolledStudentsCount;
//             await course?.save();
//           }
//         }
//       }
//       //console.log("Import student processed:", email, "Row:", rowNumber, "New User:", isNewUser);
//       results.push({ row: rowNumber, success: true, isNewUser });
//     }
//      console?.log("Imported Students Count:", results);
//      console?.log("Total Enrolled Students Count:", enrolledStudentsCount);


//     return res.status(200).json({ message: "Import completed", results });
//   } catch (err) {
//     console.error("Import Students Error:", err);
//     return res.status(500).json({ message: "Import Students failed", error: err.message });
//   }
// };



export const importStudents = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    if (!req.body.courseId) return res.status(400).json({ message: "Course ID is required" });

    const filePath = req.file.path;
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[1];
    if (!sheetName)
      return res.status(400).json({ message: "Sheet not found in Excel file" });

    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet);
    const courseId = req.body.courseId;
    const courseBundleId = req.body.courseBundleId;

    if (rows.length === 0) return res.status(400).json({ message: "Excel file is empty" });

    // Log column names for debugging
    const columnNames = Object.keys(rows[1]);
    console.log("📋 Excel Column Names:", columnNames);

    const results = [];
    let CoursePlan = null;
    let enrolledStudentsCount = 0;

    console.log("🔹 Starting student import for course:", courseId);

    for (const [index, row] of rows.entries()) {
      const rowNumber = index + 2;
      const fullName = row["Name"] || row["Full Name"];
      const email = row["Email"];
      let phone = row["Phone No"] || row["Phone"];
      if (typeof phone === "string" && phone.startsWith("+91")) phone = phone.slice(3);
      // SECURITY: default to a per-row random password, never the shared hardcoded
      // "student" literal (which allowed takeover of every imported account).
      // Students imported without an explicit Password must use password reset.
      const password = row["Password"] || crypto.randomBytes(32).toString("hex");
      const coursePlanId = row["Plan Id"];
      const purchaseDate = row["Purchase Date"];
      let expiryDate = row["Expiring On"] || row["Expiry Date"] || row["Expiration Date"];

      // Debug: Log raw Excel data
      console.log(`\n🔍 Row ${rowNumber} Raw Data:`, {
        email,
        purchaseDate,
        expiryDate,
        purchaseDateType: typeof purchaseDate,
        expiryDateType: typeof expiryDate,
      });

      const errors = [];
      if (!fullName) errors.push("Full Name is required");
      if (!email) errors.push("Email is required");
      if (courseId && courseBundleId)
        errors.push("Provide either Course ID or Course Bundle ID, not both");
      if (!courseId && !courseBundleId && !coursePlanId)
        errors.push("At least one of Course ID, Course Bundle ID, or Course Plan ID is required");

      let course = null;
      let coursePlan = null;

      if (courseId) {
        course = await Course.findById(courseId);
        if (!course) errors.push(`Course with ID ${courseId} not found`);
      }

      if (coursePlanId) {
        if (!CoursePlan) CoursePlan = (await import("../models/CoursePlan.js")).default;
        coursePlan = await CoursePlan.findById(coursePlanId);
        if (!coursePlan) errors.push(`Course Plan with ID ${coursePlanId} not found`);
        if (course && coursePlan && coursePlan.courseId.toString() !== course._id.toString())
          errors.push(`Course Plan ${coursePlanId} does not belong to Course ${courseId}`);
        if (!course && coursePlan) {
          course = await Course.findById(coursePlan.courseId);
          if (!course) errors.push(`Course with ID ${coursePlan.courseId} not found`);
        }
      }

      if (errors.length > 0) {
        results.push({ row: rowNumber, success: false, errors });
        continue;
      }

      // Create or find user
      let user = await User.findOne({ email });
      let isNewUser = false;
      if (!user) {
        user = await userService.signup({
          fullName,
          email,
          password,
          role: "student",
          is_verify: true,
          phone,
        });
        isNewUser = true;
      }

      const userId = user._id;

      // Enrollment handling
      if (course) {
        let enrolledAt = new Date();
        if (purchaseDate) {
          console.log(`📅 Parsing purchase date for ${email}:`, purchaseDate);
          let parsedPurchaseDate;
          if (typeof purchaseDate === "number") {
            // Handle Excel numeric date
            const excelDate = xlsx.SSF.parse_date_code(purchaseDate);
            parsedPurchaseDate = new Date(excelDate.y, excelDate.m - 1, excelDate.d);
          } else {
            // Normalize date string (e.g., 2025-8-22 to 2025-08-22)
            let cleanDate = purchaseDate.toString();
            cleanDate = cleanDate.match(/(\d{4})-(\d{1,2})-(\d{1,2})(T\d{2}:\d{2}:\d{2}\.\d{3}Z)?/);
            if (cleanDate) {
              const year = cleanDate[1];
              const month = cleanDate[2].padStart(2, "0");
              const day = cleanDate[3].padStart(2, "0");
              const time = cleanDate[4] || "T00:00:00.000Z";
              parsedPurchaseDate = new Date(`${year}-${month}-${day}${time}`);
            } else {
              parsedPurchaseDate = new Date(purchaseDate);
            }
          }
          if (!isNaN(parsedPurchaseDate)) {
            enrolledAt = parsedPurchaseDate;
            console.log(`✅ Valid purchase date found: ${enrolledAt.toDateString()}`);
          } else {
            console.log("⚠️ Purchase date format invalid, using current date.");
          }
        }

        let parsedExpiryDate = null;
        if (expiryDate) {
          console.log(`📅 Parsing expiry date for ${email}:`, expiryDate);
          if (typeof expiryDate === "number") {
            // Handle Excel numeric date
            const excelDate = xlsx.SSF.parse_date_code(expiryDate);
            parsedExpiryDate = new Date(excelDate.y, excelDate.m - 1, excelDate.d);
          } else {
            // Normalize date string (e.g., 2025-8-22 to 2025-08-22)
            let cleanExpiryDate = expiryDate.toString();
            cleanExpiryDate = cleanExpiryDate.match(/(\d{4})-(\d{1,2})-(\d{1,2})(T\d{2}:\d{2}:\d{2}\.\d{3}Z)?/);
            if (cleanExpiryDate) {
              const year = cleanExpiryDate[1];
              const month = cleanExpiryDate[2].padStart(2, "0");
              const day = cleanExpiryDate[3].padStart(2, "0");
              const time = cleanExpiryDate[4] || "T00:00:00.000Z";
              parsedExpiryDate = new Date(`${year}-${month}-${day}${time}`);
            } else {
              parsedExpiryDate = new Date(expiryDate);
            }
          }
          if (!isNaN(parsedExpiryDate)) {
            expiryDate = parsedExpiryDate;
            console.log(`✅ Valid expiry date parsed: ${expiryDate.toDateString()}`);
          } else {
            console.log(`⚠️ Invalid expiry date format: ${expiryDate}, setting to null`);
            expiryDate = null;
          }
        }

        const existingEnrollment = await CourseEnrollment.findOne({
          userId,
          courseId: course._id,
        }).sort({ enrolledAt: -1 });

        // ===========================
        // 🧠 SMART RE-ENROLLMENT LOGIC
        // ===========================
        if (existingEnrollment) {
          console.log(`\n🔁 Re-enrollment detected for ${email} in ${course.title}`);

          const oldEnrollDate = new Date(existingEnrollment.enrolledAt);
          const oldExpiry = existingEnrollment.accessExpiry ? new Date(existingEnrollment.accessExpiry) : null;
          const importedEnrollDate = new Date(enrolledAt);
          const importedExpiry = expiryDate ? new Date(expiryDate) : null;

          console.log("📅 Old Enrollment:", {
            enrolledAt: oldEnrollDate,
            expiry: oldExpiry,
          });
          console.log("📅 Imported Enrollment:", {
            enrolledAt: importedEnrollDate,
            expiry: importedExpiry,
          });

          // 🧩 CASE 1: Imported enrollment is OLDER
          if (importedExpiry && oldExpiry && importedExpiry < oldExpiry) {
            console.log("⚠️ Imported enrollment is older — calculating inactive gap...");

            const inactiveGapDays = Math.floor(
              (importedExpiry - importedEnrollDate) / (1000 * 60 * 60 * 24)
            );

            console.log(`⏳ Inactive gap: ${inactiveGapDays} days`);

            if (inactiveGapDays > 0) {
              const adjustedEnrollDate = new Date(oldEnrollDate);
              adjustedEnrollDate.setDate(adjustedEnrollDate.getDate() - inactiveGapDays);

              console.log(
                `📅 Adjusted enrollment start date: ${adjustedEnrollDate.toDateString()}`
              );

              existingEnrollment.enrolledAt = adjustedEnrollDate;
              await existingEnrollment.save();

              results.push({
                row: rowNumber,
                success: true,
                updatedExisting: true,
                note: `Adjusted enrollment backward by ${inactiveGapDays} days (older import)`,
              });
            } else {
              console.log("✅ No inactive gap detected — skipping update.");
              results.push({
                row: rowNumber,
                success: true,
                skippedOlder: true,
                note: "Older import — no change",
              });
            }
          }

          // 🧩 CASE 2: Imported enrollment is NEWER (extends expiry)
          else if (importedExpiry && oldExpiry && importedExpiry > oldExpiry) {
            console.log("🆕 Imported enrollment extends expiry — processing renewal...");

            let adjustedEnrollDate = oldEnrollDate;
            if (importedEnrollDate > oldExpiry) {
              const inactiveGapDays = Math.floor(
                (importedEnrollDate - oldExpiry) / (1000 * 60 * 60 * 24)
              );

              adjustedEnrollDate = new Date(oldEnrollDate);
              adjustedEnrollDate.setDate(adjustedEnrollDate.getDate() + inactiveGapDays);

              console.log(
                `⏳ Inactive gap between old expiry and new start: ${inactiveGapDays} days`
              );
              console.log(
                `📅 Adjusted new enrollment start: ${adjustedEnrollDate.toDateString()}`
              );
            } else {
              console.log("✅ Continuous enrollment — keeping original start date.");
            }

            existingEnrollment.enrolledAt = adjustedEnrollDate;
            existingEnrollment.accessExpiry = importedExpiry;
            await existingEnrollment.save();

            results.push({
              row: rowNumber,
              success: true,
              renewed: true,
              note: "Extended expiry and adjusted start date (newer import)",
            });
          }

          // 🧩 CASE 3: Overlapping or no valid expiry date
          else {
            console.log("⚖️ Overlapping enrollment or invalid/no expiry date — no change needed.");
            results.push({
              row: rowNumber,
              success: true,
              skipped: true,
              note: "Overlapping enrollment or invalid/no expiry date — unchanged",
            });
          }
        }

        // ===========================
        // 🆕 FIRST-TIME ENROLLMENT
        // ===========================
        else {
          let finalExpiryDate = null;

          if (expiryDate) {
            console.log(`📅 Using provided expiry date for ${email}:`, expiryDate);
            finalExpiryDate = new Date(expiryDate);
          } else if (coursePlan) {
            if (coursePlan.durationType === "Month" && coursePlan.duration) {
              finalExpiryDate = new Date(enrolledAt);
              finalExpiryDate.setMonth(finalExpiryDate.getMonth() + coursePlan.duration);
            } else if (coursePlan.durationType === "Year" && coursePlan.duration) {
              finalExpiryDate = new Date(enrolledAt);
              finalExpiryDate.setFullYear(finalExpiryDate.getFullYear() + coursePlan.duration);
            } else if (coursePlan.durationType === "Day" && coursePlan.duration) {
              finalExpiryDate = new Date(enrolledAt);
              finalExpiryDate.setDate(finalExpiryDate.getDate() + coursePlan.duration);
            }
          } else {
            console.log(`⚠️ No coursePlan or expiryDate provided for ${email}, setting default expiry (1 year)`);
            finalExpiryDate = new Date(enrolledAt);
            finalExpiryDate.setFullYear(finalExpiryDate.getFullYear() + 1);
          }

          console.log(`📅 Finalized expiry date for ${email}:`, finalExpiryDate);
          console.log(
            `🕒 Setting accessExpiry for ${email}:`,
            finalExpiryDate,
            "Valid:",
            finalExpiryDate && !isNaN(finalExpiryDate)
          );

          await CourseEnrollment.create({
            userId,
            courseId: course._id,
            coursePlanId: coursePlan ? coursePlan._id : null,
            type: "course",
            enrolledAt,
            enrollmentSource: "import",
            accessType: coursePlan ? (coursePlan.durationType || "lifetime") : "limited",
            accessExpiry: finalExpiryDate && !isNaN(finalExpiryDate) ? finalExpiryDate : null,
          });

          if (!course.enrolledStudents?.includes(userId)) {
            course.enrolledStudents?.push(userId);
            await course.save();
          }

          enrolledStudentsCount++;
          results.push({ row: rowNumber, success: true, newEnrollment: true });
        }
      }

      console.log(`✅ Processed ${email} (Row ${rowNumber}) | New User: ${isNewUser}`);
    }

    console.log("📊 Import completed.");
    console.log("Total rows processed:", results.length);
    console.log("Total enrolled students:", enrolledStudentsCount);

    return res.status(200).json({ message: "Import completed", results });
  } catch (err) {
    console.error("Import Students Error:", err);
    return res.status(500).json({ message: "Import Students failed", error: err.message });
  }
};



export const buyNow = async (req, res) => {
  try {
    // Validate Content-Type
    if (!req.is('application/json')) {
      return res.status(400).json({ message: "Content-Type must be application/json" });
    }

    const {
      courseId,
      courseBundleId,
      coursePlanId, // <-- support plan
      guestEmail,
      guestName,
      paymentId,
      paymentProvider = "razorpay",
      couponCode,
      deviceId,
      fcmToken,
      company
    } = req.body;

    //paymentId
    if (paymentProvider === "razorpay" && !paymentId) {
      return res.status(400).json({ message: "Payment ID is required for Razorpay" });
    }

    // Validate required fields
    if (!courseId && !courseBundleId && !coursePlanId) {
      return res.status(400).json({ message: "Course, bundle, or plan ID is required" });
    }
    if (!guestEmail) {
      return res.status(400).json({ message: "Guest email is required" });
    }
    // Allow courseId+coursePlanId if plan belongs to course
    if (
      (courseId && courseBundleId) ||
      (coursePlanId && courseBundleId)
    ) {
      return res.status(400).json({ message: "Provide either courseId/coursePlanId or courseBundleId, not both" });
    }
    if (courseId && coursePlanId) {
      // Check if plan belongs to course
      const CoursePlan = (await import('../models/CoursePlan.js')).default;
      const plan = await CoursePlan.findById(coursePlanId);
      if (!plan) {
        return res.status(404).json({ message: "Course plan not found" });
      }
      if (plan.courseId.toString() !== courseId.toString()) {
        return res.status(400).json({ message: "Course plan does not belong to the specified course" });
      }
      // If valid, proceed and ignore courseId for item creation (use plan.courseId)
    }

    // if (!deviceId && !fcmToken) {
    //   return res.status(400).json({ message: "Device ID or FCM token is required" }); 
    // }

    //console.log("BuyNow request body:", req.body); // Debug log

    // Step 1: Find or create guest user
    let guestUser = await User.findOne({ email: guestEmail });
    let isNewUser = false; // <-- Track if user is new
    // SECURITY: guest accounts were previously created with the shared hardcoded
    // password "student", letting anyone take over any guest-checkout account via
    // POST /login. Generate a per-account cryptographically random password instead;
    // it is emailed to the new user below (same channel as before).
    let generatedPassword = null;
    if (!guestUser) {
      generatedPassword = crypto.randomBytes(32).toString("hex");
      guestUser = await userService.signup({
        fullName: guestName || "Guest User",
        email: guestEmail,
        password: generatedPassword,
        role: "student",
        is_verify: true
      });
      isNewUser = true;
    }
    const userId = guestUser._id;
    let userfcmtoken;
    userfcmtoken = await fcmTokenss.findOne({ userId });
    if (deviceId) {
      if (!userfcmtoken) {
        userfcmtoken = await fcmTokenss.findOne({ deviceId });
      }

      if (!userfcmtoken) {
        const newFcmToken = new fcmTokenss({
          userId,
          deviceId,
          token: fcmToken,
        });
        userfcmtoken = await newFcmToken.save();
      }

      //update userfcmtoken
      userfcmtoken.token = fcmToken;
      userfcmtoken.userId = userId;
      await userfcmtoken.save();

    }

    if (company && (company.name || company.gstNumber)) {
      await User.findByIdAndUpdate(userId, {
        $set: {
          "company.name": company.name || "",
          "company.gstNumber": company.gstNumber || null
        }
      });
    }

    // Step 2: Prepare items and price
    let items = [];
    let subTotal = 0;
    let courseIdsToEnroll = new Set();

    if (coursePlanId) {
      const CoursePlan = (await import('../models/CoursePlan.js')).default;
      const plan = await CoursePlan.findById(coursePlanId);
      if (!plan) return res.status(404).json({ message: "Course plan not found" });
      // PRICING: same hardened sale-vs-regular resolution as checkOrder and the
      // cart checkout — salePrice (schema default 0) only applies when it is a
      // positive override; otherwise charge the regular plan price.
      const planSale = plan.salePrice != null ? Number(plan.salePrice) : 0;
      let planPrice = planSale > 0 ? planSale : Number(plan.price || 0);
      if (!Number.isFinite(planPrice) || planPrice < 0) planPrice = 0;
      subTotal += planPrice;
      items.push({
        courseId: plan.courseId,
        coursePlanId: plan._id,
        type: "coursePlan",
        pricePaid: planPrice,
        currency: plan.currency || "INR",
      });
      courseIdsToEnroll.add(plan.courseId.toString());
    } else if (courseId) {
      const course = await Course.findById(courseId);
      if (!course) return res.status(404).json({ message: "Course not found" });
      const price = course.salePrice && parseFloat(course.salePrice) > 0
        ? parseFloat(course.salePrice)
        : parseFloat(course.price || 0);
      subTotal += price;
      items.push({
        courseId: course._id,
        type: "course",
        pricePaid: price,
        currency: course.currency || "INR",
      });
      courseIdsToEnroll.add(course._id.toString());
    } else if (courseBundleId) {
      const bundle = await CourseBundle.findById(courseBundleId).populate("courses");
      if (!bundle) return res.status(404).json({ message: "Bundle not found" });
      const price = parseFloat(bundle.price || 0);
      subTotal += price;
      items.push({
        courseBundleId: bundle._id,
        type: "courseBundle",
        pricePaid: price,
        currency: bundle.currency || "INR",
      });
      bundle.courses.forEach((course) => courseIdsToEnroll.add(course._id.toString()));
    }

    // Step 3: Apply coupon — validate and compute the discount only. The usage
    // is recorded atomically AFTER successful payment verification/capture
    // below: burning it here meant any payment-verification failure (400) still
    // consumed the redemption with no sale, blocking the user's retry with
    // single-use coupons. The old read-modify-write (findById -> mutate ->
    // save) also lost updates under concurrent redemptions.
    let discount = 0;
    let couponToRedeem = null;
    if (couponCode) {
      try {
        const validationResult = await validateCoupon(couponCode, subTotal, userId);
        discount = validationResult.discountAmount;
        couponToRedeem = validationResult.coupon._id;
      } catch (err) {
        return res.status(400).json({ message: `Coupon validation failed: ${err.message}` });
      }
    }

    // Step 4: Fetch GST rate
    let GST_RATE;
    try {
      GST_RATE = await Setting.getGstRate(); // Get GST rate (defaults to 0.18)
    } catch (err) {
      console.error("Error fetching GST rate:", err);
      return res.status(500).json({ message: "Failed to fetch GST rate", error: err.message });
    }
    const taxableAmount = subTotal - discount;
    const tax = parseFloat((taxableAmount * GST_RATE).toFixed(2)); // Calculate GST
    const grandTotal = parseFloat((taxableAmount + tax).toFixed(2)); // Add GST to grand total

    // Razorpay payment verification + capture logic.
    // SECURITY: verify against the post-coupon, post-GST grandTotal — NOT the raw
    // subTotal. Verifying against the pre-coupon subtotal did not bind the captured
    // payment to the amount the customer actually owes for this order. This now
    // mirrors the main `checkout` handler's verification (grandTotal in paise,
    // amount/currency/status checks, capture, "already captured" tolerance).
    if (paymentProvider === "razorpay" && paymentId && grandTotal > 0) {
      const keySetting = await Setting.findOne({ key: "RAZORPAY_KEY_ID" });
      const secretSetting = await Setting.findOne({ key: "RAZORPAY_KEY_SECRET" });
      const apiKey = keySetting?.value;
      const apiSecret = secretSetting?.value;
      if (!apiKey || !apiSecret) {
        return res.status(500).json({ message: "Razorpay credentials not found in settings" });
      }

      const razorpayPaymentId = paymentId;
      const amount = Math.round(grandTotal * 100); // expected charge in paise (after coupon + GST)
      if (amount <= 0) {
        return res.status(400).json({ message: "Invalid order amount for Razorpay payment capture." });
      }
      const currency = 'INR';
      const url = `https://api.razorpay.com/v1/payments/${razorpayPaymentId}`;
      const captureUrl = `${url}/capture`;
      const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`,
      };

      // Check payment status before capturing
      try {
        const paymentRes = await axios.get(url, { headers, timeout: 15000 });
        const payment = paymentRes.data || {};

        // SECURITY: verify the payment actually corresponds to this order before
        // granting access. Without these checks an attacker could pass the id of ANY
        // already-captured payment (e.g. a tiny unrelated ₹1 payment) and the
        // "already captured -> skip" branch would enrol them for free.
        if (payment.currency && payment.currency !== currency) {
          return res.status(400).json({ message: "Payment currency mismatch." });
        }
        if (typeof payment.amount === "number" && payment.amount < amount) {
          return res.status(400).json({ message: "Paid amount does not match order amount." });
        }
        if (!["authorized", "captured"].includes(payment.status)) {
          return res.status(400).json({ message: `Payment not completed (status: ${payment.status || "unknown"}).` });
        }

        if (payment.status === "captured") {
          // Already captured, skip capture
          console.log("Razorpay payment already captured, skipping capture step.");
        } else {
          // Not captured (authorized), proceed to capture
          const postData = { amount, currency };
          const razorpayRes = await axios.post(captureUrl, postData, { headers, timeout: 15000 });
          if (razorpayRes.status !== 200 && razorpayRes.status !== 201) {
            return res.status(400).json({ message: 'Failed to capture payment with Razorpay.' });
          }
        }
      } catch (err) {
        // If error is "already captured", skip, else return error
        if (err.response?.data?.error?.code === "BAD_REQUEST_ERROR" &&
          err.response?.data?.error?.description?.includes("already been captured")) {
          console.log("Razorpay payment already captured (error response), skipping capture step.");
        } else {
          return res.status(400).json({ message: 'Failed to capture payment with Razorpay: ' + (err.response?.data?.error?.description || err.message) });
        }
      }
    }

    // RELIABILITY: record the coupon redemption only now, AFTER the payment
    // (if any) has been verified/captured (atomic, limit-guarded; see
    // redeemCouponUsage). validateCoupon pre-checked the limits above, so a
    // failure here only happens on a concurrent redemption race.
    if (couponToRedeem) {
      const redemption = await redeemCouponUsage(couponToRedeem, userId);
      if (!redemption.ok) {
        return res.status(400).json({ message: `Coupon validation failed: ${redemption.reason}` });
      }
    }

    let defaultEnrolledStudentsCount;
    try {
      defaultEnrolledStudentsCount = await Setting.getDefaultEnrolledStudentsCount();
      //console.log("Default enrolled students count fetched:", defaultEnrolledStudentsCount); // Debug log
    } catch (err) {
      console.error("Error fetching default enrolled students count:", err);
      return res.status(500).json({ message: "Failed to fetch default enrolled students count", error: err.message });
    }

    // ATOMICITY: create the order and grant every enrollment inside ONE
    // transaction so a failure after the payment was captured cannot leave the
    // buyer charged-but-not-enrolled. Falls back to non-atomic execution on a
    // standalone mongod. Invoice PDF, tokens, email and push are side effects and
    // run AFTER the transaction commits.
    const newOrder = await runInTransaction(async (session) => {
      // Step 5: Create order
      const [order] = await Order.create([{
        orderNo: await generateOrderNumber(),
        userId,
        items,
        subTotal,
        discount,
        tax,
        gstRate: GST_RATE,
        grandTotal,
        payment: {
          paymentIntent: paymentId || null,
          provider: paymentProvider,
          status: paymentProvider === "razorpay" ? "paid" : "pending",
        },
        company: {
          name: company?.name || "",
          gstNumber: company?.gstNumber || null
        }
      }], { session });

      // Step 6: Enroll guest user
      for (const item of items) {
        if (item.type === "coursePlan" && item.coursePlanId) {
          const CoursePlan = (await import('../models/CoursePlan.js')).default;
          const plan = await CoursePlan.findById(item.coursePlanId).session(session);
          if (!plan) continue;
          // Only use plan's durationType/duration for accessType/expiry
          let accessType = (plan.durationType || "lifetime").toLowerCase();
          let enrolledAt = new Date();
          let accessExpiry = null;
          if (plan.duration && (accessType === "month" || accessType === "year" || accessType === "day")) {
            let expiry = new Date(enrolledAt);
            if (accessType === "month") {
              expiry.setMonth(expiry.getMonth() + Number(plan.duration));
            } else if (accessType === "year") {
              expiry.setFullYear(expiry.getFullYear() + Number(plan.duration));
            } else if (accessType === "day") {
              expiry.setDate(expiry.getDate() + Number(plan.duration));
            } else {
              expiry.setDate(expiry.getDate() + Number(plan.duration));
            }
            accessExpiry = expiry;
          }
          await CourseEnrollment.create([{
            userId,
            courseId: plan.courseId,
            type: "coursePlan",
            enrolledAt,
            enrollmentSource: "purchase",
            accessType,
            accessExpiry,
            orderId: order._id,
            coursePlanId: plan._id
          }], { session });
          // Update course enrolledStudents
          const course = await Course.findById(plan.courseId).session(session);
          if (course && !course.enrolledStudents.includes(userId)) {
            course.enrolledStudents.push(userId);
            if (course.enrolledStudentsCount == null || course.enrolledStudentsCount === 0) {
              course.enrolledStudentsCount = defaultEnrolledStudentsCount;
            }
            course.enrolledStudentsCount += 1;
            await course.save({ session });
          }
          // Add user to course chat room
          const room = await CourseChatRoom.findOne({ courseId: plan.courseId }).session(session);
          if (room && !room.participants.includes(userId)) {
            room.participants.push(userId);
            await room.save({ session });
          }
        } else if (item.type === "course" && item.courseId) {
          // ACCESS EXPIRY: an expired-by-date 'active' enrollment must not
          // block a renewal — only an unexpired one suppresses a fresh one.
          const existingEnrollment = await CourseEnrollment.findOne({
            userId,
            courseId: item.courseId,
            status: "active",
            $or: [{ accessExpiry: null }, { accessExpiry: { $gt: new Date() } }],
          }).session(session);
          const course = await Course.findById(item.courseId).session(session);
          if (!course) {
            throw new Error(`Course ${item.courseId} not found`);
          }
          let accessType = course.accessType || "lifetime";
          let enrolledAt = new Date();
          let accessExpiry = null;
          if (
            (accessType === "limited" || accessType === "subscription") &&
            course.accessPeriod
          ) {
            const periodStr = course.accessPeriod.trim().toLowerCase();
            let years = 0, months = 0, days = 0;
            const yearMatch = periodStr.match(/(\d+)\s*year/);
            const monthMatch = periodStr.match(/(\d+)\s*month/);
            const dayMatch = periodStr.match(/(\d+)\s*day/);
            if (yearMatch) years = parseInt(yearMatch[1], 10);
            if (monthMatch) months = parseInt(monthMatch[1], 10);
            if (dayMatch) days = parseInt(dayMatch[1], 10);
            let expiry = new Date(enrolledAt);
            if (years > 0) expiry.setFullYear(expiry.getFullYear() + years);
            if (months > 0) expiry.setMonth(expiry.getMonth() + months);
            if (days > 0) expiry.setDate(expiry.getDate() + days);
            if (years > 0 || months > 0 || days > 0) {
              accessExpiry = expiry;
            }
          }
          if (!existingEnrollment) {
            await CourseEnrollment.create([{
              userId,
              courseId: item.courseId,
              type: "course",
              enrolledAt,
              enrollmentSource: "purchase",
              accessType,
              accessExpiry,
            }], { session });

            if (!course.enrolledStudents.includes(userId)) {
              course.enrolledStudents.push(userId);
              if (course.enrolledStudentsCount === 0) {
                course.enrolledStudentsCount = defaultEnrolledStudentsCount;
              }
              course.enrolledStudentsCount += 1;
              await course.save({ session });
            }
          }
          // Add user to course chat room
          const room = await CourseChatRoom.findOne({ courseId: item.courseId }).session(session);
          if (room && !room.participants.includes(userId)) {
            room.participants.push(userId);
            await room.save({ session });
          }
        } else if (item.type === "courseBundle" && item.courseBundleId) {
          const bundle = await CourseBundle.findById(item.courseBundleId).populate("courses").session(session);
          if (!bundle || !bundle.courses) {
            throw new Error(`Course bundle ${item.courseBundleId} or its courses not found`);
          }
          for (const course of bundle.courses) {
            if (course._id) {
              // ACCESS EXPIRY: ignore stale expired-by-date 'active'
              // enrollments so a renewal creates a fresh enrollment.
              const existingEnrollment = await CourseEnrollment.findOne({
                userId,
                courseId: course._id,
                status: "active",
                $or: [{ accessExpiry: null }, { accessExpiry: { $gt: new Date() } }],
              }).session(session);
              let accessType = course.accessType || "lifetime";
              let enrolledAt = new Date();
              let accessExpiry = null;
              if (
                (accessType === "limited" || accessType === "subscription") &&
                course.accessPeriod
              ) {
                const periodStr = course.accessPeriod.trim().toLowerCase();
                let years = 0, months = 0, days = 0;
                const yearMatch = periodStr.match(/(\d+)\s*year/);
                const monthMatch = periodStr.match(/(\d+)\s*month/);
                const dayMatch = periodStr.match(/(\d+)\s*day/);
                if (yearMatch) years = parseInt(yearMatch[1], 10);
                if (monthMatch) months = parseInt(monthMatch[1], 10);
                if (dayMatch) days = parseInt(dayMatch[1], 10);
                let expiry = new Date(enrolledAt);
                if (years > 0) expiry.setFullYear(expiry.getFullYear() + years);
                if (months > 0) expiry.setMonth(expiry.getMonth() + months);
                if (days > 0) expiry.setDate(expiry.getDate() + days);
                if (years > 0 || months > 0 || days > 0) {
                  accessExpiry = expiry;
                }
              }
              if (!existingEnrollment) {
                await CourseEnrollment.create([{
                  userId,
                  courseId: course._id,
                  type: "groupCourse",
                  enrolledAt,
                  enrollmentSource: "purchase",
                  accessType,
                  accessExpiry,
                }], { session });
                const courseToUpdate = await Course.findById(course._id).session(session);
                if (!courseToUpdate) {
                  throw new Error(`Course ${course._id} not found`);
                }
                if (!courseToUpdate.enrolledStudents.includes(userId)) {
                  courseToUpdate.enrolledStudents.push(userId);
                  if (courseToUpdate.enrolledStudentsCount === 0) {
                    courseToUpdate.enrolledStudentsCount = defaultEnrolledStudentsCount;
                  }
                  courseToUpdate.enrolledStudentsCount += 1;
                  await courseToUpdate.save({ session });
                }
              }
              // Add user to course chat room for each course in bundle
              const room = await CourseChatRoom.findOne({ courseId: course._id }).session(session);
              if (room && !room.participants.includes(userId)) {
                room.participants.push(userId);
                await room.save({ session });
              }
            }
          }
          let bundleAccessType = bundle.accessType || "lifetime";
          let bundleEnrolledAt = new Date();
          let bundleAccessExpiry = null;
          if (
            (bundleAccessType === "limited" || bundleAccessType === "subscription") &&
            bundle.accessPeriod
          ) {
            const periodStr = bundle.accessPeriod.trim().toLowerCase();
            let years = 0, months = 0, days = 0;
            const yearMatch = periodStr.match(/(\d+)\s*year/);
            const monthMatch = periodStr.match(/(\d+)\s*month/);
            const dayMatch = periodStr.match(/(\d+)\s*day/);
            if (yearMatch) years = parseInt(yearMatch[1], 10);
            if (monthMatch) months = parseInt(monthMatch[1], 10);
            if (dayMatch) days = parseInt(dayMatch[1], 10);
            let expiry = new Date(bundleEnrolledAt);
            if (years > 0) expiry.setFullYear(expiry.getFullYear() + years);
            if (months > 0) expiry.setMonth(expiry.getMonth() + months);
            if (days > 0) expiry.setDate(expiry.getDate() + days);
            if (years > 0 || months > 0 || days > 0) {
              bundleAccessExpiry = expiry;
            }
          }
          await CourseEnrollment.create([{
            userId,
            courseBundleId: item.courseBundleId,
            type: "courseBundle",
            enrolledAt: bundleEnrolledAt,
            enrollmentSource: "purchase",
            accessType: bundleAccessType,
            accessExpiry: bundleAccessExpiry,
          }], { session });

          if (!bundle.enrolledStudents.includes(userId)) {
            bundle.enrolledStudents.push(userId);
            await bundle.save({ session });
          }
        }
      }

      return order;
    });

    // === HTML Invoice Generation with Puppeteer (side effect, after commit) ===
    const invoiceDir = path.join(process.cwd(), "uploads", "invoices");
    if (!fs.existsSync(invoiceDir)) {
      fs.mkdirSync(invoiceDir, { recursive: true });
    }
    const invoiceFileName = `invoice_${newOrder._id}.pdf`;
    const invoiceFilePath = path.join(invoiceDir, invoiceFileName);

    // Render HTML and generate PDF buffer
    try {
      const invoiceHtml = renderInvoiceHtml(newOrder, guestUser, company);
      const pdfBuffer = await htmlToPdfBuffer(invoiceHtml);
      fs.writeFileSync(invoiceFilePath, pdfBuffer);
      newOrder.invoice_url = invoiceFileName;
      await newOrder.save();
    } catch (invoiceErr) {
      console.error("❌ Invoice generation failed for order:", newOrder._id, invoiceErr);
      // Continue without failing the whole buyNow process
    }

    // Step 7: Token generation and email
    let oldAccessToken =
      req.cookies?.accessToken ||
      (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")
        ? req.headers.authorization.split(" ")[1]
        : undefined) ||
      req.headers["x-access-token"];

    // let oldAccessTokenExp = null;
    // if (oldAccessToken) {
    //   const decoded = jwt.decode(oldAccessToken);
    //   oldAccessTokenExp = decoded?.exp ? decoded.exp * 1000 : null;
    // }

    const { accessToken, refreshToken, accessTokenExp, refreshTokenExp } =
      await Token.generateTokens(guestUser);

    const redis = await initRedis();

    if (redis) {
      const accessTTL = Math.max(1, Math.floor((accessTokenExp - Date.now()) / 1000));
      const refreshTTL = Math.max(1, Math.floor((refreshTokenExp - Date.now()) / 1000));

      await redis.set(`accessToken:${accessToken}`, "valid", { EX: accessTTL });
      await redis.set(`refreshToken:${refreshToken}`, userId.toString(), { EX: refreshTTL });
    }

    Token.setTokensCookies(res, accessToken, refreshToken);

    try {
      // Only send password if user is new (per-account random password generated above)
      await emailService.sendOrderConfirmationEmail(
        guestEmail,
        guestName || 'User',
        isNewUser ? generatedPassword : undefined // <-- Only pass password if new user
      );
      //console.log("✅ Order confirmation email sent successfully");
    } catch (emailError) {
      console.error("❌ Email sending failed:", emailError);
    }

    userfcmtoken = await fcmTokenss.findOne({ userId });

    const fcmTokens = await fcmTokenss.findOne({ userId });

    if (fcmTokens) {
      // Send push notification
      const data = {
        title: "Course Purchase Notification",
        description: "Your course has been purchased successfully.",
        order_id: newOrder._id.toString(),
        type: "new_order",
      };
      const notiresponse = await notificationService.sendPushNotification(fcmTokens.token, data);
      //console.log("Push notification response:", notiresponse);

      //save notification response
      if (notiresponse.success) {
        const notification = new Notification({
          data,
          status: 0,
          user_id: userId,
        });
        await notification.save();
      }
    }

    // Verify final enrolledStudentsCount
    if (courseId) {
      const course = await Course.findById(courseId);
      //console.log("Final enrolledStudentsCount for course:", { courseId, enrolledStudentsCount: course.enrolledStudentsCount }); // Debug log
    }

    return res.status(201).json({
      success: true,
      message: "Buy Now successful",
      order: {
        ...newOrder.toObject(),
        tax: newOrder.tax.toString(),
        gstRate: newOrder.gstRate.toString(),
        subTotal: newOrder.subTotal.toString(),
        discount: newOrder.discount.toString(),
        grandTotal: newOrder.grandTotal.toString(),
        invoice_url: newOrder.invoice_url
      },
      guestUser,
      accessToken,
      refreshToken
    });
  } catch (err) {
    console.error("Buy Now Error:", err);
    return res.status(500).json({ message: "Buy Now failed", error: err.message });
  }
};


