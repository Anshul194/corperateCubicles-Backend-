// service/TicketService.js
import TicketRepository from "../repository/TicketRepository.js";
import AppError from "../utils/app-error.js";
import { StatusCodes } from "http-status-codes";
import fcmService from "../utils/notificationService.js";
import Notification from "../models/Notifications.js";
import FcmToken from "../models/fcmTokens.js";
import User from "../models/user.js";
import mongoose from "mongoose";

class TicketService {
  constructor() {
    this.repository = new TicketRepository();
  }

  async create(ticketData) {
    try {
      const {
        subject,
        category,
        description,
        userId,
        priority = "medium",
      } = ticketData;

      // Validate required fields
      if (!subject || !category || !description || !userId) {
        throw new Error(
          "Subject, category, description, and user ID are required"
        );
      }

      // Validate category
      const validCategories = ["technical", "billing", "course", "general"];
      if (!validCategories.includes(category)) {
        throw new Error(
          "Invalid category. Must be one of: technical, billing, course, general"
        );
      }

      // Validate priority

      // Add initial message from the ticket description
      const ticketDataWithMessage = {
        ...ticketData,
        messages: [
          {
            sender: userId,
            message: description,
            timestamp: new Date(),
          },
        ],
      };

      const ticket = await this.repository.create(ticketDataWithMessage);
      return ticket;
    } catch (error) {
      throw error;
    }
  }

  async getById(id, userId, isAdmin) {
    try {
      const ticket = await this.repository.findById(id);
      if (!ticket) {
        throw new Error("Ticket not found");
      }

      //console.log("Ticket userId:", ticket.userId);
      //console.log("Requesting userId:", userId);
      //console.log("Is Admin:", isAdmin);

      // Check access permissions - only owner or admin can view
      const ticketOwnerId =
        ticket.userId._id?.toString() || ticket.userId.toString();
      if (!isAdmin && ticketOwnerId !== userId.toString()) {
        throw new Error("Access denied. You can only view your own tickets.");
      }

      return ticket;
    } catch (error) {
      throw error;
    }
  }

  async getAll(query) {
    try {
      const {
        page = 1,
        limit = 10,
        filters = "{}",
        searchFields = "{}",
        sort = "{}",
      } = query;
      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.max(1, parseInt(limit));
      const skip = Math.max(0, (pageNum - 1) * limitNum);

      // Parse JSON strings from query parameters to objects
      const parsedFilters = JSON.parse(filters);
      const parsedSearchFields = JSON.parse(searchFields);
      const parsedSort = JSON.parse(sort);

      // Build query conditions
      const queryConditions = { isDeleted: false };

      // Add filters
      for (const [key, value] of Object.entries(parsedFilters)) {
        if (key === "status" || key === "category" || key === "priority") {
          queryConditions[key] = value;
        } else if (key === "userId") {
          queryConditions[key] = value;
        }
      }

      // Add search conditions
      const searchConditions = [];
      for (const [field, term] of Object.entries(parsedSearchFields)) {
        if (field === "subject" || field === "description") {
          searchConditions.push({ [field]: { $regex: term, $options: "i" } });
        }
      }
      if (searchConditions.length > 0) {
        queryConditions.$or = searchConditions;
      }

      // Build sort conditions
      const sortConditions = {};
      if (Object.keys(parsedSort).length > 0) {
        for (const [field, direction] of Object.entries(parsedSort)) {
          sortConditions[field] = direction === "asc" ? 1 : -1;
        }
      } else {
        sortConditions.createdAt = -1; // Default sort by creation date desc
      }

      const { tickets, total } = await this.repository.findAllWithPagination(
        queryConditions,
        sortConditions,
        skip,
        limitNum
      );

      return {
        result: tickets,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      };
    } catch (error) {
      console.error("Error fetching tickets:", error.message);
      throw new AppError(
        "Cannot fetch data of all tickets",
        StatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  }

  async getUserResolvedTickets(query) {
    try {
      const {
        userId,
        page = 1,
        limit = 10,
        searchFields = "{}",
        sort = "{}",
      } = query;
      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.max(1, parseInt(limit));
      const skip = Math.max(0, (pageNum - 1) * limitNum);

      // Parse JSON strings from query parameters to objects
      const parsedSearchFields = JSON.parse(searchFields);
      const parsedSort = JSON.parse(sort);

      // Build query conditions with user filter and resolved status
      const queryConditions = {
        userId: userId,
        status: "resolved",
        isDeleted: false,
      };

      // Add search conditions
      const searchConditions = [];
      for (const [field, term] of Object.entries(parsedSearchFields)) {
        if (field === "subject" || field === "description") {
          searchConditions.push({ [field]: { $regex: term, $options: "i" } });
        }
      }
      if (searchConditions.length > 0) {
        queryConditions.$or = searchConditions;
      }

      // Build sort conditions
      const sortConditions = {};
      if (Object.keys(parsedSort).length > 0) {
        for (const [field, direction] of Object.entries(parsedSort)) {
          sortConditions[field] = direction === "asc" ? 1 : -1;
        }
      } else {
        sortConditions.updatedAt = -1; // Default sort by last updated desc for resolved tickets
      }

      const { tickets, total } = await this.repository.findAllWithPagination(
        queryConditions,
        sortConditions,
        skip,
        limitNum
      );

      return {
        result: tickets,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      };
    } catch (error) {
      console.error("Error fetching user resolved tickets:", error.message);
      throw new AppError(
        "Cannot fetch user resolved tickets",
        StatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  }

  async getUserTickets(query) {
    try {
      const {
        userId,
        page = 1,
        limit = 10,
        filters = "{}",
        searchFields = "{}",
        sort = "{}",
      } = query;
      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.max(1, parseInt(limit));
      const skip = Math.max(0, (pageNum - 1) * limitNum);

      // Parse JSON strings from query parameters to objects
      const parsedFilters = JSON.parse(filters);
      const parsedSearchFields = JSON.parse(searchFields);
      const parsedSort = JSON.parse(sort);

      // Build query conditions with user filter
      const queryConditions = {
        userId: userId,
        isDeleted: false,
      };

      // Add filters
      for (const [key, value] of Object.entries(parsedFilters)) {
        if (key === "status" || key === "category" || key === "priority") {
          queryConditions[key] = value;
        }
      }

      // Add search conditions
      const searchConditions = [];
      for (const [field, term] of Object.entries(parsedSearchFields)) {
        if (field === "subject" || field === "description") {
          searchConditions.push({ [field]: { $regex: term, $options: "i" } });
        }
      }
      if (searchConditions.length > 0) {
        queryConditions.$or = searchConditions;
      }

      // Build sort conditions
      const sortConditions = {};
      if (Object.keys(parsedSort).length > 0) {
        for (const [field, direction] of Object.entries(parsedSort)) {
          sortConditions[field] = direction === "asc" ? 1 : -1;
        }
      } else {
        sortConditions.createdAt = -1; // Default sort by creation date desc
      }

      const { tickets, total } = await this.repository.findAllWithPagination(
        queryConditions,
        sortConditions,
        skip,
        limitNum
      );

      return {
        result: tickets,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      };
    } catch (error) {
      console.error("Error fetching user tickets:", error.message);
      throw new AppError(
        "Cannot fetch user tickets",
        StatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  }

  async updateById(id, updateData, userId, isAdmin) {
    try {
      const updateFields = {};
      const allowedFields = [
        "subject",
        "category",
        "description",
        "priority",
        "attachments",
      ];
      const adminOnlyFields = ["status"];

      // Get existing ticket to check ownership
      const existingTicket = await this.repository.findById(id);
      if (!existingTicket) {
        throw new Error("Ticket not found");
      }

      // ✅ FIX: Safe comparison even if userId is populated
      const ticketOwnerId =
        existingTicket.userId._id?.toString() ||
        existingTicket.userId.toString();
      if (!isAdmin && ticketOwnerId !== userId.toString()) {
        throw new Error("Access denied. You can only update your own tickets.");
      }

      // Filter allowed user fields
      for (const field of allowedFields) {
        if (updateData[field] !== undefined) {
          updateFields[field] = updateData[field];
        }
      }

      // Admin-only fields
      if (isAdmin) {
        for (const field of adminOnlyFields) {
          if (updateData[field] !== undefined) {
            updateFields[field] = updateData[field];
          }
        }
      }

      if (Object.keys(updateFields).length === 0) {
        throw new Error("No valid fields to update");
      }

      // Validation
      const validCategories = ["technical", "billing", "course", "general"];
      if (
        updateFields.category &&
        !validCategories.includes(updateFields.category)
      ) {
        throw new Error(
          "Invalid category. Must be one of: technical, billing, course, general"
        );
      }

      const validPriorities = ["low", "medium", "high"];
      if (
        updateFields.priority &&
        !validPriorities.includes(updateFields.priority)
      ) {
        throw new Error("Invalid priority. Must be one of: low, medium, high");
      }

      const validStatuses = ["open", "in_progress", "resolved", "closed"];
      if (updateFields.status && !validStatuses.includes(updateFields.status)) {
        throw new Error(
          "Invalid status. Must be one of: open, in_progress, resolved, closed"
        );
      }

      // ✅ Update in DB
      const updatedTicket = await this.repository.updateById(id, updateFields);
      return updatedTicket;
    } catch (error) {
      throw error;
    }
  }

  async updateStatus(id, status) {
    try {
      // Validate status
      const validStatuses = ["open", "in_progress", "resolved", "closed"];
      if (!validStatuses.includes(status)) {
        throw new Error(
          "Invalid status. Must be one of: open, in_progress, resolved, closed"
        );
      }

      const updatedTicket = await this.repository.updateById(id, { status });
      if (!updatedTicket) {
        throw new Error("Ticket not found");
      }
      return updatedTicket;
    } catch (error) {
      throw error;
    }
  }

  async addMessage(ticketId, messageData, userId, isAdmin) {
    try {
      const ticket = await this.repository.findById(ticketId);
      if (!ticket) {
        throw new Error("Ticket not found");
      }

      //console.log('Ticket found:', messageData);

      const ticketOwnerId =
        ticket.userId._id?.toString() || ticket.userId.toString();
      if (!isAdmin && ticketOwnerId !== userId.toString()) {
        throw new Error(
          "Access denied. You can only add messages to your own tickets."
        );
      }

      if (ticket.status === "closed") {
        throw new Error("Cannot add messages to a closed ticket");
      }

      //console.log("Adding message:", messageData);

      const newMessage = {
        sender: userId,
        message: messageData?.message?.trim(),
        attachments: messageData?.attachments || [],
        timestamp: new Date(),
      };

      const updatedTicket = await this.repository.addMessage(
        ticketId,
        newMessage
      );

      // Send notifications after successfully adding message
      try {
        await this.sendTicketReplyNotification(updatedTicket, userId, isAdmin);
      } catch (notifError) {
        console.error("⚠️ Failed to send ticket reply notification:", notifError);
        // Don't throw - notification failure shouldn't break the main flow
      }

      return updatedTicket;
    } catch (error) {
      throw error;
    }
  }

  async deleteMessage(ticketId, messageId, userId, isAdmin) {
    try {
      const ticket = await this.repository.findById(ticketId);
      if (!ticket) {
        throw new Error("Ticket not found");
      }

      const ticketOwnerId =
        ticket.userId._id?.toString() || ticket.userId.toString();
      if (!isAdmin && ticketOwnerId !== userId.toString()) {
        throw new Error(
          "Access denied. You can only delete messages from your own tickets."
        );
      }

      const message = ticket.messages.id(messageId);
      if (!message) {
        throw new Error("Message not found");
      }

      const messageSenderId =
        message.sender?._id?.toString() || message.sender?.toString();
      if (!isAdmin && messageSenderId !== userId.toString()) {
        throw new Error("Access denied. You can only delete your own messages.");
      }

      const updatedTicket = await this.repository.deleteMessage(ticketId, messageId);
      return updatedTicket;
    } catch (error) {
      throw error;
    }
  }

  async sendTicketReplyNotification(ticket, senderId, isAdminSender) {
    try {
      const ticketId = ticket._id.toString();
      const ticketOwnerId = ticket.userId._id?.toString() || ticket.userId.toString();
      
      if (isAdminSender) {
        // Admin replied - notify the ticket owner (user)
        const notificationData = {
          title: "Support Ticket Reply",
          description: `Admin replied to your ticket: ${ticket.subject}`,
          type: "ticket_reply",
          data_id: ticketId,
          referenceId: ticketId,
          category: ticket.category || "support",
        };

        // Get user's FCM token
        const userFcmToken = await FcmToken.findOne({ userId: ticketOwnerId });
        
        if (userFcmToken && userFcmToken.token) {
          // Send FCM push notification
          await fcmService.sendPushNotification([userFcmToken.token], notificationData);
          console.log(`✅ FCM notification sent to ticket owner: ${ticketOwnerId}`);
        }

        // Save in-app notification
        const notification = new Notification({
          user_id: ticketOwnerId,
          device_id: userFcmToken?.deviceId || null,
          data: notificationData,
          status: 1, // unread
        });
        await notification.save();
        console.log(`✅ In-app notification saved for ticket owner: ${ticketOwnerId}`);
        
      } else {
        // User replied - notify all admins
        const notificationData = {
          title: "New Ticket Reply",
          description: `User replied to ticket: ${ticket.subject}`,
          type: "ticket_reply",
          data_id: ticketId,
          referenceId: ticketId,
          category: ticket.category || "support",
        };

        // Get all admin users
        const adminUsers = await User.find({ role: "admin", isActive: true }).select("_id");
        
        if (adminUsers && adminUsers.length > 0) {
          const adminIds = adminUsers.map(admin => admin._id);
          
          // Get FCM tokens for all admins
          const adminFcmTokens = await FcmToken.find({ 
            userId: { $in: adminIds } 
          });

          // Send FCM notifications to all admins
          if (adminFcmTokens && adminFcmTokens.length > 0) {
            const tokens = adminFcmTokens.map(t => t.token).filter(t => t);
            if (tokens.length > 0) {
              await fcmService.sendPushNotification(tokens, notificationData);
              console.log(`✅ FCM notifications sent to ${tokens.length} admins`);
            }
          }

          // Save in-app notifications for all admins
          const adminNotifications = adminFcmTokens.map(fcmToken => ({
            user_id: fcmToken.userId,
            device_id: fcmToken.deviceId || null,
            data: notificationData,
            status: 1, // unread
          }));

          if (adminNotifications.length > 0) {
            await Notification.insertMany(adminNotifications);
            console.log(`✅ In-app notifications saved for ${adminNotifications.length} admins`);
          }
        }
      }
    } catch (error) {
      console.error("❌ Error in sendTicketReplyNotification:", error);
      throw error;
    }
  }

  async softDeleteById(id) {
    try {
      const deletedTicket = await this.repository.softDeleteById(id);
      if (!deletedTicket) {
        throw new Error("Ticket not found");
      }
      return deletedTicket;
    } catch (error) {
      throw error;
    }
  }

  // Get ticket statistics
  async getTicketStats() {
    try {
      const stats = await this.repository.getTicketStats();
      return stats;
    } catch (error) {
      throw error;
    }
  }

  // Get tickets by status
  async getTicketsByStatus(status) {
    try {
      const validStatuses = ["open", "in_progress", "resolved", "closed"];
      if (!validStatuses.includes(status)) {
        throw new Error("Invalid status");
      }

      const tickets = await this.repository.findByStatus(status);
      return tickets;
    } catch (error) {
      throw error;
    }
  }

  // Get tickets by category
  async getTicketsByCategory(category) {
    try {
      const validCategories = ["technical", "billing", "course", "general"];
      if (!validCategories.includes(category)) {
        throw new Error("Invalid category");
      }

      const tickets = await this.repository.findByCategory(category);
      return tickets;
    } catch (error) {
      throw error;
    }
  }
}

export default TicketService;
