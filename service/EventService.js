import Event from '../models/Event.js';
import mongoose from 'mongoose';
import crypto from 'crypto';
import { renderHtmlToPdf } from '../utils/pdfRenderer.js';
import Setting from '../models/setting.js';
import fs from 'fs';
import path from 'path';
import User from '../models/user.js';
import UserService from './userService.js';
import emailService from '../utils/emailService.js';

const userService = new UserService();


class EventService {
  async create(eventData) {
    try {
      // Convert price to Decimal128
      if (typeof eventData.price !== 'undefined') {
        eventData.price = mongoose.Types.Decimal128.fromString(
          Number(eventData.price).toFixed(2)
        );
      }

      const event = new Event(eventData);
      return await event.save();
    } catch (error) {
      throw error;
    }
  }

  async getAll(options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = 'startDate',
        sortOrder = 'asc',
        filter = {},
        search = ''
      } = options;

      const query = { isDeleted: false };

      // Add search functionality
      if (search) {
        query.$or = [
          { title: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { category: { $regex: search, $options: 'i' } }
        ];
      }

      // Add filters
      if (filter.type) query.type = filter.type;
      if (filter.category) query.category = filter.category;
      if (filter.status) query.status = filter.status;
      if (filter.startDate) query.startDate = { $gte: new Date(filter.startDate) };
      if (filter.endDate) query.endDate = { $lte: new Date(filter.endDate) };

      const sort = {};
      sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

      const events = await Event.find(query)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('organizer', 'fullName email')
        .lean();

        const GST_RATE = await Setting.getGstRate();
        events.forEach(event => {
          //add gst in  price if price > 0
          if(event.price && event.price > 0){
            event.GST_RATE = GST_RATE;
            const price = parseFloat(event.price.toString());
            const tax = parseFloat((price * GST_RATE).toFixed(2));
            const priceWithTax = parseFloat((price + tax).toFixed(2));
            event.originalPrice = price;
            event.tax = tax;
            event.price = priceWithTax;
          }

        });
        

      const total = await Event.countDocuments(query);

      return {
        data: events,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      throw error;
    }
  }

  async getById(id) {
    try {
      const event = await Event.findOne({ _id: id, isDeleted: false })
        .populate('organizer', 'fullName email')
        .populate('registeredParticipants.userId', 'fullName email');

      if (!event) throw new Error('Event not found');

      //add GST_RATE and price with tax if price > 0
      const GST_RATE = await Setting.getGstRate();
      if(event.price && event.price > 0){
        event.GST_RATE = GST_RATE;
        const price = parseFloat(event.price.toString());
        const tax = parseFloat((price * GST_RATE).toFixed(2));
        const priceWithTax = parseFloat((price + tax).toFixed(2));
        event.originalPrice = price;
        event.tax = tax;
        event.price = priceWithTax;
      }

      return event;
    } catch (error) {
      throw error;
    }
  }

  async update(id, updateData) {
    try {
      const updates = {};

      // Parse onlineLink if it's a string
      if (updateData.onlineLink) {
        try {
          updates.onlineLink = typeof updateData.onlineLink === 'string'
            ? JSON.parse(updateData.onlineLink)
            : updateData.onlineLink;
        } catch (e) {
          console.error('Failed to parse onlineLink:', e);
        }
      }

      // Handle all other fields
      Object.entries(updateData).forEach(([key, value]) => {
        if (key !== 'onlineLink' && value !== null && value !== undefined) {
          if (key === 'price') {
            updates[key] = mongoose.Types.Decimal128.fromString(
              Number(value).toFixed(2)
            );
          } else if (key === 'venue' && typeof value === 'string') {
            try {
              updates[key] = JSON.parse(value);
            } catch (e) {
              console.error('Failed to parse venue:', e);
            }
          } else {
            updates[key] = value;
          }
        }
      });

      const event = await Event.findOneAndUpdate(
        { _id: id, isDeleted: false },
        { $set: updates },
        { new: true, runValidators: true }
      ).populate('organizer', 'fullName email');

      if (!event) throw new Error('Event not found');
      return event;
    } catch (error) {
      throw error;
    }
  }

  async delete(id) {
    try {
      const event = await Event.findOneAndUpdate(
        { _id: id, isDeleted: false },
        { isDeleted: true },
        { new: true }
      );

      if (!event) throw new Error('Event not found');
      return event;
    } catch (error) {
      throw error;
    }
  }




  async registerParticipant(eventId, ticketData = {}) {
    try {
      //console.log("Registering participant with data:", ticketData);
      if (!ticketData.guestEmail) {
        return res.status(400).json({ message: "email is required" });
      }

      const guestEmail = ticketData.guestEmail;
      const guestName = ticketData.guestName || "Guest User";

      const event = await Event.findOne({ _id: eventId, isDeleted: false });
      if (!event) throw new Error('Event not found');

      //check if price > 0 then paymentId required
      if (event.price > 0 && !ticketData.paymentId) {
        throw new Error('Payment ID is required for paid events');
      }

      if (event.price == 0) {
        ticketData.paymentId = 'FREE_EVENT';
      }


      let guestUser = await User.findOne({ email: guestEmail });
      // SECURITY: guest accounts were previously created with the shared hardcoded
      // password "student" (mass account takeover via POST /login). Generate a
      // per-account cryptographically random password; it is emailed to the new
      // user with the registration confirmation below.
      let isNewUser = false;
      let generatedPassword = null;
      if (!guestUser) {
        isNewUser = true;
        generatedPassword = crypto.randomBytes(32).toString("hex");
        guestUser = await userService.signup({
          email: guestEmail,
          fullName: guestName || "Guest User",
          role: "student",
          password: generatedPassword,
          is_verify: true
        });
      }
      const userId = guestUser._id;





      // Check if already registered
      const isRegistered = event.registeredParticipants.some(
        p => p.userId.toString() === userId.toString()
      );
      if (isRegistered) throw new Error('You are already registered');

      // Check capacity
      if (event.capacity && event.registeredParticipants.length >= event.capacity) {
        throw new Error('Event is full');
      }

      // Calculate ticket price and generate ticket number
      const ticketPrice = event.price || 0;
      const ticketNo = await this.generateTicketNumber();

      // Calculate taxes and total
      const GST_RATE = await Setting.getGstRate();
      const subTotal = ticketPrice;
      const tax = parseFloat((subTotal * GST_RATE).toFixed(2));
      const total = parseFloat(subTotal) + parseFloat(tax);

      // SECURITY: verify the Razorpay payment server-side for paid events BEFORE
      // issuing a ticket / marking the invoice paid. This verification was previously
      // commented out, so any non-empty paymentId string granted a free paid ticket.
      if (event.price > 0 && ticketData.paymentId && ticketData.paymentId !== 'FREE_EVENT') {
        const keySetting = await Setting.findOne({ key: "RAZORPAY_KEY_ID" });
        const secretSetting = await Setting.findOne({ key: "RAZORPAY_KEY_SECRET" });
        const apiKey = keySetting?.value;
        const apiSecret = secretSetting?.value;
        if (!apiKey || !apiSecret) {
          throw new Error("Razorpay credentials not found in settings");
        }
        const expectedPaise = Math.round(total * 100); // verify against the GST-inclusive total
        if (expectedPaise <= 0) {
          throw new Error('Invalid order amount for Razorpay payment.');
        }
        const axios = (await import('axios')).default;
        const url = `https://api.razorpay.com/v1/payments/${ticketData.paymentId}`;
        const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
        const headers = { 'Content-Type': 'application/json', 'Authorization': `Basic ${auth}` };
        try {
          const paymentRes = await axios.get(url, { headers, timeout: 15000 });
          const payment = paymentRes.data || {};
          if (payment.currency && payment.currency !== 'INR') {
            throw new Error('Payment currency mismatch.');
          }
          if (typeof payment.amount === 'number' && payment.amount < expectedPaise) {
            throw new Error('Paid amount does not match ticket price.');
          }
          if (!['authorized', 'captured'].includes(payment.status)) {
            throw new Error(`Payment not completed (status: ${payment.status || 'unknown'}).`);
          }
          if (payment.status === 'authorized') {
            await axios.post(`${url}/capture`, { amount: expectedPaise, currency: 'INR' }, { headers, timeout: 15000 });
          }
        } catch (err) {
          const desc = err.response?.data?.error?.description || err.message;
          if (!desc || !desc.includes('already been captured')) {
            throw new Error('Payment verification failed: ' + desc);
          }
        }
      }

      // Create invoice
      const invoiceData = {
        ticketNo,
        eventId: event._id,
        userId,
        amount: ticketPrice,
        tax,
        total,
        gstRate: GST_RATE,
        paymentStatus: 'completed',
        createdAt: new Date(),
        paymentId: ticketData.paymentId,
        venue: event.venue
      };


      const invoice = await this.generateInvoice(invoiceData);

      // Register participant with ticket details
      event.registeredParticipants.push({
        userId,
        status: 'registered',
        ticketNo,
        ticketPrice,
        invoice: invoice.url,
        purchasedAt: new Date(),
        ...ticketData
      });

      await event.save();
      try {
        await emailService.sendEventRegistrationEmail(
          guestEmail,
          guestName || 'User',
          event,
          isNewUser ? generatedPassword : null // only send login details to new accounts
        );
        //console.log("✅ Order confirmation email sent successfully");
      } catch (emailError) {
        console.error("❌ Email sending failed:", emailError);
      }

      return {
        event,
        ticket: {
          ticketNo,
          price: ticketPrice,
          tax,
          total,
          invoice: invoice.url
        }
      };
    } catch (error) {
      throw error;
    }
  }

  async generateTicketNumber() {
    const prefix = 'TKT';
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${prefix}${timestamp}${random}`;
  }

  async generateInvoice(invoiceData) {
    const invoiceDir = path.join(process.cwd(), 'uploads', 'invoices');
    if (!fs.existsSync(invoiceDir)) {
      fs.mkdirSync(invoiceDir, { recursive: true });
    }

    const invoiceFileName = `invoice_${invoiceData.ticketNo}.pdf`;
    const invoiceFilePath = path.join(invoiceDir, invoiceFileName);

    // Generate invoice HTML
    const invoiceHtml = this.renderInvoiceHtml(invoiceData);

    // Generate PDF using puppeteer
    const pdfBuffer = await this.htmlToPdfBuffer(invoiceHtml);
    fs.writeFileSync(invoiceFilePath, pdfBuffer);

    return {
      url: invoiceFileName,
      path: invoiceFilePath
    };
  }

  // Uses the shared, concurrency-gated renderer (utils/pdfRenderer.js):
  // single long-lived Chromium (bundled-first, /usr/bin/google-chrome
  // fallback) instead of launching a fresh browser per invoice.
  async htmlToPdfBuffer(html) {
    return await renderHtmlToPdf(html, {
      pdfOptions: {
        format: 'A4',
        printBackground: true,
        margin: { top: '1cm', bottom: '1cm', left: '1cm', right: '1cm' }
      }
    });
  }

  renderInvoiceHtml(data) {

    //console.log("Rendering invoice HTML with data:", data);
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; }
          .invoice-box { max-width: 800px; margin: auto; padding: 20px; }
          .header { text-align: center; margin-bottom: 30px; }
          .details { margin: 20px 0; }
          .table { width: 100%; border-collapse: collapse; }
          .table th, .table td { padding: 10px; border: 1px solid #ddd; }
          .footer { margin-top: 30px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="invoice-box">
          <div class="header">
            <h1>Event Ticket Invoice</h1>
            <p>Ticket #: ${data.ticketNo}</p>
            <p>Payment ID: ${data.paymentId === 'FREE_EVENT' ? 'N/A' : data.paymentId}</p>
            <p>Date: ${new Date(data.createdAt).toLocaleDateString()}</p>
          </div>
          <div class="details">
            <table class="table">
              <tr>
                <th>Description</th>
                <th>Amount</th>
              </tr>
              <tr>
                <td>Event Ticket</td>
                <td>₹${parseFloat(data.amount.toString()).toFixed(2)}</td>
              </tr>
              <tr>
                <td>GST (${(data.gstRate * 100).toFixed(2)}%)</td>
                <td>₹${data.tax.toFixed(2)}</td>
              </tr>
              <tr>
                <td><strong>Total</strong></td>
                <td><strong>₹${Number(data.total).toFixed(2)}</strong></td>
              </tr>
            </table>
          </div>
          <div class="footer">
            <p>Thank you for your purchase!</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

export default EventService;
