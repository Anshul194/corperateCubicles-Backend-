import TicketService from '../service/TicketService.js';
import { initRedis } from '../config/redisClient.js';

const ticketService = new TicketService();

export const createTicket = async (req, res) => {
  try {
    //console.log('📩 Request Body createTicket:', req.body);
    //console.log('📎 Uploaded Files:', req.files);

    // const attachments = req.files?.attachments?.map(file => file.path) || [];
    const attachments = req.files?.map(file => file.path) || [];

    

    const ticketData = {
      ...req.body,
      userId: req.user._id,
      attachments,
      messages: [
        {
          sender: req.user._id,
          message: req.body.description,
        },
      ]
    };

    const ticket = await ticketService.create(ticketData);

    // Cache to Redis (same as before)
    const redis = await initRedis();
    const ticketId = ticket._id.toString();
    const ticketCacheData = {
      ...ticket.toObject()
    };

    await redis.setEx(`ticket:${ticketId}`, 3600, JSON.stringify(ticketCacheData));
    //console.log('🗂️ Redis cache updated for ticket:', ticketId);

    return res.status(201).json({
      success: true,
      message: '✅ Support ticket created successfully',
      data: { ticket },
      err: {},
    });
  } catch (err) {
    console.error('❌ Create Ticket Error:', err);
    const isBadRequest = ['required', 'Invalid', 'enum'].some(msg => err.message.includes(msg));
    return res.status(isBadRequest ? 400 : 500).json({
      success: false,
      message: err.message,
      data: {},
      err: { message: err.message },
    });
  }
};


export const getTicketById = async (req, res) => {
  try {
    //console.log('📩 Request Params getTicketById:', req.params);

    const { id } = req.params;
    const userId = req.user._id;
    const isUserAdmin = req.user.role === 'admin';

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Ticket ID is required',
        data: {},
        err: { message: 'Missing ticket ID parameter' },
      });
    }

    const redis = await initRedis();
    const cachedTicket = await redis.get(`ticket:${id}`);
    // if (cachedTicket) {
    //   //console.log('🚀 Ticket data retrieved from Redis cache');
    //   const ticketData = JSON.parse(cachedTicket);
      
    //   // Check access permissions
    //   if (!isUserAdmin && ticketData.userId.toString() !== userId.toString()) {
    //     return res.status(403).json({
    //       success: false,
    //       message: 'Access denied. You can only view your own tickets.',
    //       data: {},
    //       err: { message: 'Unauthorized access' },
    //     });
    //   }

    //   return res.status(200).json({
    //     success: true,
    //     message: '✅ Ticket retrieved successfully',
    //     data: { ticket: ticketData },
    //     err: {},
    //   });
    // }

    const ticket = await ticketService.getById(id, userId, isUserAdmin);
    const ticketCacheData = {
      _id: ticket._id,
      userId: ticket.userId,
      subject: ticket.subject,
      category: ticket.category,
      description: ticket.description,
      status: ticket.status,
      priority: ticket.priority,
      messages: ticket.messages,
      attachments: ticket.attachments,
      isDeleted: ticket.isDeleted,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
    };

    await redis.setEx(`ticket:${id}`, 3600, JSON.stringify(ticketCacheData));
    //console.log('🗂️ Ticket data cached in Redis:', id);

    return res.status(200).json({
      success: true,
      message: '✅ Ticket retrieved successfully',
      data: { ticket },
      err: {},
    });
  } catch (err) {
    console.error('❌ Get Ticket By ID Error:', err);
    if (err.message === 'Ticket not found') {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found',
        data: {},
        err: { message: err.message },
      });
    }
    if (err.message.includes('Access denied')) {
      return res.status(403).json({
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

export const getAllTickets = async (req, res) => {
  try {
    const { result: tickets, total, page, limit, totalPages } = await ticketService.getAll(req.query);
    return res.status(200).json({
      success: true,
      message: '✅ Tickets retrieved successfully',
      data: { tickets, total, page, limit, totalPages },
      err: {},
    });
  } catch (err) {
    console.error('❌ Get All Tickets Error:', err);
    return res.status(500).json({
      success: false,
      message: err.message,
      data: {},
      err: err.message,
    });
  }
};

export const getMyTickets = async (req, res) => {
  try {
    const userId = req.user._id;
    const queryWithUserId = { ...req.query, userId: userId.toString() };
    
    const { result: tickets, total, page, limit, totalPages } = await ticketService.getUserTickets(queryWithUserId);
    return res.status(200).json({
      success: true,
      message: '✅ Your tickets retrieved successfully',
      data: { tickets, total, page, limit, totalPages },
      err: {},
    });
  } catch (err) {
    console.error('❌ Get My Tickets Error:', err);
    return res.status(500).json({
      success: false,
      message: err.message,
      data: {},
      err: err.message,
    });
  }
};

export const updateTicket = async (req, res) => {
  try {
    //console.log('📩 Request Body updateTicket:', req.body);

    const { id } = req.params;
    const userId = req.user._id;
    const isUserAdmin = req.user.role === 'admin';

   
    //console.log('📩 Request User updateTicket:', req.user)
    //console.log('📎 Uploaded Files:', req.files
    // );
    //console.log('📩 Request Params updateTicket:', isUserAdmin);
    


    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Ticket ID is required',
        data: {},
        err: { message: 'Missing ticket ID parameter' },
      });
    }

    const updatedTicket = await ticketService.updateById(id, req.body, userId, isUserAdmin);

    const redis = await initRedis();
    const ticketId = updatedTicket._id.toString();
    const ticketCacheData = {
      _id: updatedTicket._id,
      userId: updatedTicket.userId,
      subject: updatedTicket.subject,
      category: updatedTicket.category,
      description: updatedTicket.description,
      status: updatedTicket.status,
      priority: updatedTicket.priority,
      messages: updatedTicket.messages,
      attachments: updatedTicket.attachments,
      isDeleted: updatedTicket.isDeleted,
      createdAt: updatedTicket.createdAt,
      updatedAt: updatedTicket.updatedAt,
    };

    await redis.setEx(`ticket:${ticketId}`, 3600, JSON.stringify(ticketCacheData));
    //console.log('🗂️ Redis cache updated for ticket:', ticketId);

    return res.status(200).json({
      success: true,
      message: '✅ Ticket updated successfully',
      data: { ticket: updatedTicket },
      err: {},
    });
  } catch (err) {
    console.error('❌ Update Ticket Error:', err);
    if (
      err.message === 'Ticket not found' ||
      err.message === 'No valid fields to update' ||
      err.message.includes('Access denied') ||
      err.message.includes('Invalid') ||
      err.message.includes('enum')
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

export const updateTicketStatus = async (req, res) => {
  try {
    //console.log('📩 Request Body updateTicketStatus:', req.body);

    const { id } = req.params;
    const { status } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Ticket ID is required',
        data: {},
        err: { message: 'Missing ticket ID parameter' },
      });
    }

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required',
        data: {},
        err: { message: 'Missing status parameter' },
      });
    }

    const updatedTicket = await ticketService.updateStatus(id, status);

    const redis = await initRedis();
    await redis.del(`ticket:${id}`);
    //console.log('🗑️ Ticket cache cleared for status update:', id);

    return res.status(200).json({
      success: true,
      message: '✅ Ticket status updated successfully',
      data: { ticket: updatedTicket },
      err: {},
    });
  } catch (err) {
    console.error('❌ Update Ticket Status Error:', err);
    if (
      err.message === 'Ticket not found' ||
      err.message.includes('Invalid') ||
      err.message.includes('enum')
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

export const addMessage = async (req, res) => {
  try {
    //console.log('📩 Request Body addMessage:', req.body);
    //console.log('📎 Uploaded Files:', req.files);

    const { id } = req.params;
    const { message } = req.body;
    const attachments = req.files?.map(file => file.path) || [];
    
    const userId = req.user._id;
    const isUserAdmin = req.user.role === 'admin';

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Ticket ID is required',
        data: {},
        err: { message: 'Missing ticket ID parameter' },
      });
    }

    let messageData = {};

if(message && message != ''){ 
    messageData = {
      message,
      attachments
    };
  } else {
    messageData = {
      attachments
    };
  }

    const updatedTicket = await ticketService.addMessage(id, messageData, userId, isUserAdmin);

    const redis = await initRedis();
    await redis.del(`ticket:${id}`);
    //console.log('🗑️ Ticket cache cleared for message addition:', id);

    return res.status(200).json({
      success: true,
      message: '✅ Message added successfully',
      data: { ticket: updatedTicket },
      err: {},
    });
  } catch (err) {
    console.error('❌ Add Message Error:', err);
    if (
      err.message === 'Ticket not found' ||
      err.message.includes('Access denied') ||
      err.message.includes('required')
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

export const deleteMessage = async (req, res) => {
  try {
    const { id, messageId } = req.params;
    const userId = req.user._id;
    const isUserAdmin = req.user.role === 'admin';

    if (!id || !messageId) {
      return res.status(400).json({
        success: false,
        message: 'Ticket ID and message ID are required',
        data: {},
        err: { message: 'Missing ticket ID or message ID parameter' },
      });
    }

    const updatedTicket = await ticketService.deleteMessage(
      id,
      messageId,
      userId,
      isUserAdmin
    );

    const redis = await initRedis();
    await redis.del(`ticket:${id}`);

    return res.status(200).json({
      success: true,
      message: '✅ Message deleted successfully',
      data: { ticket: updatedTicket },
      err: {},
    });
  } catch (err) {
    console.error('❌ Delete Message Error:', err);
    if (
      err.message === 'Ticket not found' ||
      err.message === 'Message not found' ||
      err.message.includes('Access denied')
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

export const deleteTicket = async (req, res) => {
  try {
    //console.log('📩 Request Params deleteTicket:', req.params);

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Ticket ID is required',
        data: {},
        err: { message: 'Missing ticket ID parameter' },
      });
    }

    const deletedTicket = await ticketService.softDeleteById(id);

    const redis = await initRedis();
    await redis.del(`ticket:${id}`);
    //console.log('🗑️ Ticket cache cleared:', id);

    return res.status(200).json({
      success: true,
      message: '✅ Ticket deleted successfully',
      data: { ticket: deletedTicket },
      err: {},
    });
  } catch (err) {
    console.error('❌ Delete Ticket Error:', err);
    if (err.message === 'Ticket not found') {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found',
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

export const getMyResolvedTickets = async (req, res) => {
  try {
    const userId = req.user._id;
    const queryWithUserId = { ...req.query, userId: userId.toString() };
    
    const { result: tickets, total, page, limit, totalPages } = await ticketService.getUserResolvedTickets(queryWithUserId);
    
    return res.status(200).json({
      success: true,
      message: '✅ Your resolved tickets retrieved successfully',
      data: { tickets, total, page, limit, totalPages },
      err: {},
    });
  } catch (err) {
    console.error('❌ Get My Resolved Tickets Error:', err);
    return res.status(500).json({
      success: false,
      message: err.message,
      data: {},
      err: err.message,
    });
  }
};