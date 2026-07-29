import EventService from '../service/EventService.js';
import getRazorpayInstance from '../config/razorpay.js';
import Setting from '../models/setting.js';
import User from '../models/user.js';
import Event from '../models/Event.js';

const eventService = new EventService();

export const createEvent = async (req, res) => {
  try {
    // Parse venue data if it's sent as a string
    let venueData = req.body.venue;
    let tags = req.body.tags;
    let price = req.body.price;

    // Handle price parsing
    try {
      price = typeof price === 'string' ? parseFloat(price) : price;
      if (isNaN(price)) price = 0;
    } catch (e) {
      console.error('Failed to parse price:', e);
      price = 0;
    }

    // Handle venue parsing
    try {
      venueData = typeof venueData === 'string' ? JSON.parse(venueData) : venueData;
    } catch (e) {
      console.error('Failed to parse venue data:', e);
      venueData = null;
    }

    // Handle tags parsing
    try {
      if (typeof tags === 'string') {
        // First try to parse the string
        tags = JSON.parse(tags);
        // If it's already an array in string form, parse it again
        if (typeof tags === 'string') {
          tags = JSON.parse(tags);
        }
        // Ensure it's a flat array
        tags = tags.flat().map(tag => tag.replace(/[\[\]"]/g, ''));
      }
    } catch (e) {
      console.error('Failed to parse tags:', e);
      tags = [];
    }

    const eventData = {
      ...req.body,
      organizer: req.user._id,
      venue: venueData,
      tags: Array.isArray(tags) ? tags : [tags].filter(Boolean),
      price: price
    };

    // Handle file uploads
    if (req.files?.thumbnail) {
      eventData.thumbnail = req.files.thumbnail[0].path.replace(/\\/g, '/');
    }
    if (req.files?.attachments) {
      eventData.attachments = req.files.attachments.map(file => ({
        name: file.originalname,
        url: file.path.replace(/\\/g, '/'),
        type: file.mimetype
      }));
    }

    const event = await eventService.create(eventData);
    //console.log('Created event:', event); // Add logging to verify data

    return res.status(201).json({
      success: true,
      message: 'Event created successfully',
      data: event
    });
  } catch (error) {
    console.error('Event creation error:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getAllEvents = async (req, res) => {
  try {
    const {
      page,
      limit,
      sortBy,
      sortOrder,
      search,
      type,
      category,
      status,
      startDate,
      endDate
    } = req.query;

    const filter = {};
    if (type) filter.type = type;
    if (category) filter.category = category;
    if (status) filter.status = status;
    if (startDate) filter.startDate = startDate;
    if (endDate) filter.endDate = endDate;

    const options = {
      page,
      limit,
      sortBy,
      sortOrder,
      filter,
      search
    };

    const events = await eventService.getAll(options);
    return res.status(200).json({
      success: true,
      message: 'Events retrieved successfully',
      data: events
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getEventById = async (req, res) => {
  try {
    const { id } = req.params;
    const event = await eventService.getById(id);
    return res.status(200).json({
      success: true,
      message: 'Event retrieved successfully',
      data: event
    });
  } catch (error) {
    return res.status(error.message === 'Event not found' ? 404 : 500).json({
      success: false,
      message: error.message
    });
  }
};

export const updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    // Handle nested objects
    try {
      // Parse onlineLink
      if (updateData['onlineLink.url']) {
        updateData.onlineLink = {
          platform: updateData['onlineLink.platform'] || 'other',
          url: updateData['onlineLink.url'],
          meetingId: updateData['onlineLink.meetingId'] || '',
          password: updateData['onlineLink.password'] || ''
        };
        // Remove individual fields
        delete updateData['onlineLink.url'];
        delete updateData['onlineLink.platform'];
        delete updateData['onlineLink.meetingId'];
        delete updateData['onlineLink.password'];
      }

      // Parse venue
      if (typeof updateData.venue === 'string') {
        updateData.venue = JSON.parse(updateData.venue);
      }

      // Handle price
      if (updateData.price) {
        updateData.price = typeof updateData.price === 'string' ?
          parseFloat(updateData.price) : updateData.price;
      }
    } catch (e) {
      console.error('Failed to parse nested objects:', e);
    }

    // Handle file uploads
    if (req.files?.thumbnail) {
      updateData.thumbnail = req.files.thumbnail[0].path.replace(/\\/g, '/');
    }
    if (req.files?.attachments) {
      updateData.attachments = req.files.attachments.map(file => ({
        name: file.originalname,
        url: file.path.replace(/\\/g, '/'),
        type: file.mimetype
      }));
    }

    const event = await eventService.update(id, updateData);
    return res.status(200).json({
      success: true,
      message: 'Event updated successfully',
      data: event
    });
  } catch (error) {
    return res.status(error.message === 'Event not found' ? 404 : 500).json({
      success: false,
      message: error.message
    });
  }
};

export const deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;
    await eventService.delete(id);
    return res.status(200).json({
      success: true,
      message: 'Event deleted successfully'
    });
  } catch (error) {
    return res.status(error.message === 'Event not found' ? 404 : 500).json({
      success: false,
      message: error.message
    });
  }
};

//checkRegisterForEvent
export const checkRegisterForEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const { guestEmail, guestName, is_verify } = req.body; // Added is_verify to destructured request body

    if (!guestEmail) {
      return res.status(400).json({
        success: false,
        message: 'Email is required',
        is_valid: false
      });
    }

    if (!is_verify){
      return res.status(400).json({
        success: false,
        message: 'Email not verified',
        is_valid: false,
        err: { email: 'Please verify your email before proceeding' }
      });
    }

    const event = await Event.findOne({ _id: id, isDeleted: false });
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found',
        is_valid: false
      });
    }

    // Check if event already started
    if (new Date(event.startDate) < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Event has already started',
        is_valid: false
      });
    }

    // Check if event is ended
    if (new Date(event.endDate) < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Event has already ended',
        is_valid: false
      });
    }

    // Check registration status
    let guestUser = await User.findOne({ email: guestEmail });
    if (guestUser) {
      // Check if is_verify is explicitly true for existing users
      if (is_verify !== true) {
        return res.status(400).json({
          success: false,
          message: 'Email not verified',
          is_valid: false,
          err: { email: 'Please verify your email before proceeding' }
        });
      }

      const userId = guestUser._id;
      const isRegistered = event.registeredParticipants.some(
        p => p.userId.toString() === userId.toString()
      );
      if (isRegistered) {
        return res.status(200).json({
          success: true,
          message: 'User already registered for the event',
          is_valid: false
        });
      }
    }

    const razorpay = await getRazorpayInstance();
    let amount = 0;

    if (event.price && event.price > 0) {
      amount = parseFloat(event.price.toString());
    }

    const GST_RATE = await Setting.getGstRate();
    const subTotal = amount;
    const tax = parseFloat((subTotal * GST_RATE).toFixed(2));
    const total = parseFloat(subTotal) + parseFloat(tax);

    if (amount > 0) {
      const currency = "INR";
      const razorpayAmt = total * 100; // Convert to paise

      const orderOptions = {
        amount: Math.round(razorpayAmt),
        currency,
        receipt: `receipt_${Date.now()}`,
        notes: {
          description: `Registration for event: ${event.title}`,
          guestName: guestName || "Guest User",
          guestEmail: guestEmail,
        }
      };
      const order = await razorpay.orders.create(orderOptions);

      //console.log("Razorpay Order Created:", order);
      const razorpayKeySetting = await Setting.findOne({ key: "RAZORPAY_KEY_ID" });

      return res.status(200).json({
        success: true,
        is_valid: true,
        razorpay: {
          key: razorpayKeySetting?.value,
          order: order,
          amount: total,
          currency: currency,
        },
        data: { message: 'User can register for the event' }
      });
    } else {
      return res.status(200).json({
        success: true,
        message: 'User can register for the event',
        is_valid: true
      });
    }
  } catch (error) {
    return res.status(error.message.includes('not found') ? 404 : 500).json({
      success: false,
      message: error.message,
      is_valid: false
    });
  }
};

export const registerForEvent = async (req, res) => {
  try {
    const { id } = req.params;

    //console.log("Request body for event registration:", req.body);




    // //console.log("Registering for event:", id, "with data:", data);
    const event = await eventService.registerParticipant(id, req.body);
    return res.status(200).json({
      success: true,
      message: 'Successfully registered for event',
      data: event
    });
  } catch (error) {
    return res.status(error.message.includes('not found') ? 404 : 500).json({
      success: false,
      message: error.message
    });
  }
};

export const updateParticipantStatus = async (req, res) => {
  try {
    const { id, userId } = req.params;
    const { status } = req.body;

    if (!['registered', 'attended', 'cancelled', 'waitlisted'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status value'
      });
    }

    const event = await eventService.updateParticipantStatus(id, userId, status);
    return res.status(200).json({
      success: true,
      message: 'Participant status updated successfully',
      data: event
    });
  } catch (error) {
    return res.status(error.message.includes('not found') ? 404 : 500).json({
      success: false,
      message: error.message
    });
  }
};