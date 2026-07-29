import http from 'http';
import { Server } from 'socket.io';
import app from './app.js';
import dotenv from 'dotenv';
import { connectToDatabase } from './db/connect.js';
import { ServerConfig } from './config/server.config.js';
// import { initRedis } from './config/redisClient.js';
import videoSocketHandler from './sockets/videoSocketHandler.js';
import { consumeRateLimit, validateStringFields, MAX_FIELD_CHARS } from './sockets/socketGuards.js';
import jwt from 'jsonwebtoken';
import Message from './models/Message.js';
import GroupMessage from './models/GroupMessage.js';
import GroupChatRoom from './models/GroupChatRoom.js';
import CourseChatRoom from './models/CourseChatRoom.js';
import CourseChatMessage from './models/CourseChatMessage.js';
import ChatRoom from './models/ChatRoom.js';
import mongoose from 'mongoose';
import path from 'path';

dotenv.config();

// Process-level safety nets. Without these, an unhandled promise rejection or a
// thrown async error elsewhere can leave the process in an undefined state (or, on
// newer Node, terminate it abruptly). Log and keep serving; let the orchestrator
// restart on a fatal uncaught exception.
process.on('unhandledRejection', (reason) => {
  console.error('⚠️  Unhandled Promise Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  // After an uncaught exception the process is in an undefined state. Log it and
  // exit so a process manager (pm2/systemd/Docker) restarts a clean instance —
  // continuing risks serving from corrupt state. (This restores Node's default
  // crash-on-uncaught semantics, but with logging.)
  console.error('💥 Uncaught Exception — exiting:', err);
  process.exit(1);
});

import './cron/wordPressNewsCron.js';

// NOTE: the /uploads static mount (with security headers) is registered in app.js.
// A second, unsecured mount used to live here and has been removed.

// Create the HTTP server for Express and Socket.io
const server = http.createServer(app);

// Configure Socket.io with CORS
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:5173",
      "https://edrilla.com",
      "https://edrila.nexprism.in",
      "http://edrila.nexprism.in",
      "https://lapaas.com",
      "https://www.lapaas.com",
      "http://localhost:5174",
      "http://localhost:5175"
    ],
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  // DoS hardening: cap a single socket.io event payload at 100KB (default is
  // 1MB). Chat messages are limited to 10k chars by the handlers; files are
  // uploaded over HTTP and only their URLs travel through the socket.
  maxHttpBufferSize: 1e5
});

// make io available to controllers via req.app.locals.io
app.locals.io = io;

// Socket.io Authentication Middleware
const onlineUsers = new Map(); // Map userId to socketId

// Read the access token from the socket handshake. Web clients authenticate via
// the httpOnly `accessToken` cookie (sent in the handshake headers when the client
// connects with withCredentials); mobile/app clients pass it in handshake.auth.token.
const getSocketToken = (socket) => {
  const authToken = socket.handshake.auth?.token;
  if (authToken && authToken !== "null" && authToken !== "undefined") return authToken;
  const cookieHeader = socket.handshake.headers?.cookie;
  if (cookieHeader) {
    for (const part of cookieHeader.split(";")) {
      const [k, ...v] = part.trim().split("=");
      if (k === "accessToken") return decodeURIComponent(v.join("="));
    }
  }
  return null;
};

io.use((socket, next) => {
  try {
    const token = getSocketToken(socket);
    const secret =
      process.env.JWT_ACCESS_TOKEN_SECRET_KEY || process.env.JWT_ACCESS_SECRET;
    const decoded = jwt.verify(token, secret, { algorithms: ["HS256"] });
    socket.user = decoded;
    socket.emit("authenticated", { userId: decoded._id });
    next();
  } catch (err) {
    socket.emit("auth_error", "Invalid token");
    next(new Error("Authentication error: Invalid token"));
  }
});

// Handle socket connections
io.on('connection', (socket) => {
  //console.log(`✅ Socket connected: ${socket.id}, User: ${socket.user._id}`);

  onlineUsers.set(socket.user?._id?.toString(), socket.id);

  socket.join(socket.user?._id?.toString());

  // Join all group chat rooms the user is part of
  (async () => {
    try {
      const userGroupRooms = await GroupChatRoom.find({ participants: socket.user._id }).select('_id');
      userGroupRooms.forEach((groupRoom) => {
        socket.join(groupRoom._id.toString());
        //console.log(`User ${socket.user._id} joined group room ${groupRoom._id}`);
      });

      // Join all course chat rooms the user is part of
      const userCourseRooms = await CourseChatRoom.find({ participants: socket.user._id }).select('_id');
      userCourseRooms.forEach((courseRoom) => {
        socket.join(`course_${courseRoom._id.toString()}`);
      });
    } catch (err) {
      console.error('Error joining rooms for user:', socket.user._id, err);
    }
  })();

  io.emit('userOnline', { userId: socket.user._id });

  videoSocketHandler(socket);

  // One-on-one message events (unchanged)
  socket.on('sendMessage', async (data) => {
    if (!consumeRateLimit(socket)) return;
    try {
      const { roomId, receiverId, message: msg, emoji, replyTo } = data;
      // Reject oversized / non-string content before any DB work.
      if (!validateStringFields(socket, [['message', msg], ['emoji', emoji, 100]])) return;
      // Merge emoji into message for sockets
      const message = emoji ? (msg ? `${msg} ${emoji}` : emoji) : msg;
      if (!roomId || !receiverId || !message) {
        return socket.emit('error', { message: 'Missing required fields: roomId, receiverId, message' });
      }

      if (!mongoose.Types.ObjectId.isValid(roomId) || !mongoose.Types.ObjectId.isValid(receiverId)) {
        return socket.emit('error', { message: 'Invalid roomId or receiverId' });
      }

      // SECURITY: verify the sender belongs to this room (and the receiver too)
      // before persisting/broadcasting. Previously any authenticated socket could
      // inject a message into ANY room and to ANY user (the group/course handlers
      // already enforced this — the 1:1 handler did not).
      const room = await ChatRoom.findOne({ _id: roomId, participants: socket.user._id });
      if (!room) {
        return socket.emit('error', { message: 'Not authorized for this chat room' });
      }
      const participantIds = room.participants.map((p) => p.toString());
      if (!participantIds.includes(receiverId.toString())) {
        return socket.emit('error', { message: 'Receiver is not a participant of this room' });
      }

      // Validate replyTo message exists and belongs to this room if provided
      if (replyTo) {
        const replyToMessage = await Message.findOne({ _id: replyTo, chatRoomId: roomId });
        if (!replyToMessage) {
          return socket.emit('error', { message: 'ReplyTo message not found in this room' });
        }
      }

      const newMessage = await Message.create({
        chatRoomId: roomId,
        sender: socket.user._id,
        receiver: receiverId,
        message,
        replyTo: replyTo || null
      });

      // Populate replyTo if it exists
      if (newMessage.replyTo) {
        await newMessage.populate({
          path: 'replyTo',
          select: 'message sender createdAt',
          populate: { path: 'sender', select: 'fullName email' }
        });
      }

      // Populate sender and receiver for response
      await newMessage.populate('sender receiver', 'fullName email');

      const receiverSocketId = onlineUsers.get(receiverId.toString());
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('newMessage', newMessage);
      }

      socket.emit('messageSent', newMessage);
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  socket.on('messageRead', async (data) => {
    if (!consumeRateLimit(socket)) return;
    try {
      const { roomId, messageId } = data;
      if (!roomId || !messageId) {
        return socket.emit('error', { message: 'Missing required fields: roomId, messageId' });
      }

      const message = await Message.findOneAndUpdate(
        { _id: messageId, chatRoomId: roomId, receiver: socket.user._id },
        { isRead: true },
        { new: true }
      );

      if (!message) {
        return socket.emit('error', { message: 'Message not found or not authorized' });
      }

      const senderSocketId = onlineUsers.get(message.sender.toString());
      if (senderSocketId) {
        io.to(senderSocketId).emit('messageRead', { messageId });
      }
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  // Group message events (new)
  socket.on('sendGroupMessage', async (data) => {
    if (!consumeRateLimit(socket)) return;
    try {
      const { groupRoomId, message: msg, emoji } = data;
      // Reject oversized / non-string content before any DB work.
      if (!validateStringFields(socket, [['message', msg], ['emoji', emoji, 100]])) return;
      const message = emoji ? (msg ? `${msg} ${emoji}` : emoji) : msg;
      if (!groupRoomId || !message) {
        return socket.emit('error', { message: 'Missing required fields: groupRoomId, message' });
      }

      const groupRoom = await GroupChatRoom.findOne({
        _id: groupRoomId,
        participants: socket.user._id
      });

      if (!groupRoom) {
        return socket.emit('error', { message: 'Not authorized to send message in this group chat room' });
      }

      const newGroupMessage = await GroupMessage.create({
        groupChatRoomId: groupRoomId,
        sender: socket.user._id,
        message,
        readBy: [socket.user._id]
      });


      //console.log('sendGroupMessage: New message created', { messageId: newGroupMessage._id, groupRoomId, sender: socket.user._id });

      io.to(groupRoomId.toString()).emit('newGroupMessage', newGroupMessage);
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  socket.on('markGroupMessagesRead', async (data) => {
    if (!consumeRateLimit(socket)) return;
    try {
      const { groupRoomId } = data;
      if (!groupRoomId) {
        return socket.emit('error', { message: 'Missing required field: groupRoomId' });
      }

      const groupRoom = await GroupChatRoom.findOne({
        _id: groupRoomId,
        participants: socket.user._id
      });

      if (!groupRoom) {
        return socket.emit('error', { message: 'Not authorized to mark messages in this group chat room' });
      }

      const updateResult = await GroupMessage.updateMany(
        {
          groupChatRoomId: groupRoomId,
          readBy: { $ne: socket.user._id }
        },
        { $addToSet: { readBy: socket.user._id } }
      );

      io.to(groupRoomId.toString()).emit('groupMessagesRead', {
        userId: socket.user._id,
        modifiedCount: updateResult.modifiedCount
      });
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  // Course chat message events
  socket.on('sendCourseChatMessage', async (data) => {
    if (!consumeRateLimit(socket)) return;
    try {
      const { courseChatRoomId, message: msg, fileUrl, fileName, fileType, fileSize, emoji, replyTo } = data;
      // Reject oversized / non-string content before any DB work.
      if (!validateStringFields(socket, [
        ['message', msg],
        ['emoji', emoji, 100],
        ['fileUrl', fileUrl, MAX_FIELD_CHARS],
        ['fileName', fileName, 512],
        ['fileType', fileType, 64]
      ])) return;
      if (fileSize !== undefined && fileSize !== null && typeof fileSize !== 'number') {
        return socket.emit('error', { message: 'fileSize must be a number' });
      }
      const message = emoji ? (msg ? `${msg} ${emoji}` : emoji) : msg;

      if (!courseChatRoomId || (!message && !fileUrl)) {
        return socket.emit('error', { message: 'Missing required fields: courseChatRoomId and (message or fileUrl)' });
      }

      // Validate courseChatRoomId
      if (!mongoose.Types.ObjectId.isValid(courseChatRoomId)) {
        return socket.emit('error', { message: 'Invalid course chat room ID' });
      }

      const courseChatRoom = await CourseChatRoom.findOne({
        _id: courseChatRoomId,
        participants: socket.user._id,
        isActive: true
      });

      if (!courseChatRoom) {
        return socket.emit('error', { message: 'Not authorized to send message in this course chat room' });
      }

      // Check for duplicate message within last 5 seconds to prevent spam
      const fiveSecondsAgo = new Date(Date.now() - 5000);
      const duplicateMessage = await CourseChatMessage.findOne({
        courseChatRoomId,
        sender: socket.user._id,
        message: message || null,
        fileUrl: fileUrl || null,
        createdAt: { $gte: fiveSecondsAgo },
        isDeleted: false
      });

      if (duplicateMessage) {
        console.log('Duplicate message detected, skipping:', {
          userId: socket.user._id,
          courseChatRoomId,
          message: message?.substring(0, 50)
        });
        return socket.emit('courseChatMessageSent', {
          messageId: duplicateMessage._id,
          duplicate: true
        });
      }

      // Determine file type automatically if not provided
      let determinedFileType = fileType;
      if (fileUrl && !fileType && fileName) {
        const ext = fileName.toLowerCase().split('.').pop();
        if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) {
          determinedFileType = 'image';
        } else if (['pdf', 'doc', 'docx', 'txt', 'rtf'].includes(ext)) {
          determinedFileType = 'document';
        } else if (['mp3', 'wav', 'm4a', 'ogg', 'aac', 'webm'].includes(ext)) {
          determinedFileType = 'voice';
        } else {
          determinedFileType = 'other';
        }
      }

      // Create message with unique constraint
      const newCourseChatMessage = await CourseChatMessage.create({
        courseChatRoomId,
        sender: socket.user._id,
        message: message || null,
        fileUrl: fileUrl || null,
        fileName: fileName || null,
        fileType: determinedFileType || null,
        fileSize: fileSize || null,
        readBy: [{ user: socket.user._id }],
        replyTo: replyTo || null
      });

      // Populate sender and replyTo info
      const populatedMessage = await CourseChatMessage.findById(newCourseChatMessage._id)
        .populate('sender', 'fullName email')
        .populate({
          path: 'replyTo',
          select: 'message sender createdAt',
          populate: { path: 'sender', select: 'fullName email' }
        })
        .lean();

      console.log('Course message created successfully:', {
        messageId: populatedMessage._id,
        courseChatRoomId,
        sender: populatedMessage.sender.fullName,
        hasFile: !!populatedMessage.fileUrl
      });

      // Send to course room participants only once
      io.to(`course_${courseChatRoomId.toString()}`).emit('newCourseChatMessage', populatedMessage);

      // Send confirmation to sender
      socket.emit('courseChatMessageSent', {
        messageId: newCourseChatMessage._id,
        success: true,
        timestamp: populatedMessage.createdAt
      });

    } catch (err) {
      console.error('Course chat message error:', err);

      // Handle duplicate key error from MongoDB
      if (err.code === 11000) {
        return socket.emit('courseChatMessageSent', {
          duplicate: true,
          message: 'Message already exists'
        });
      }

      socket.emit('error', { message: err.message });
    }
  });

  socket.on('markCourseChatMessagesRead', async (data) => {
    if (!consumeRateLimit(socket)) return;
    try {
      const { courseChatRoomId } = data;
      if (!courseChatRoomId) {
        return socket.emit('error', { message: 'Missing required field: courseChatRoomId' });
      }

      if (!mongoose.Types.ObjectId.isValid(courseChatRoomId)) {
        return socket.emit('error', { message: 'Invalid course chat room ID' });
      }

      const courseChatRoom = await CourseChatRoom.findOne({
        _id: courseChatRoomId,
        participants: socket.user._id,
        isActive: true
      });

      if (!courseChatRoom) {
        return socket.emit('error', { message: 'Not authorized to mark messages in this course chat room' });
      }

      const updateResult = await CourseChatMessage.updateMany(
        {
          courseChatRoomId: courseChatRoomId,
          'readBy.user': { $ne: socket.user._id }
        },
        { $addToSet: { readBy: { user: socket.user._id } } }
      );

      // Notify course room about read status
      io.to(`course_${courseChatRoomId.toString()}`).emit('courseChatMessagesRead', {
        userId: socket.user._id,
        courseChatRoomId,
        modifiedCount: updateResult.modifiedCount
      });

    } catch (err) {
      console.error('Mark course chat messages read error:', err);
      socket.emit('error', { message: err.message });
    }
  });

  socket.on('disconnect', () => {
    //console.log(`❌ Socket disconnected: ${socket.id}, User: ${socket.user?._id}`);
    onlineUsers.delete(socket.user?._id?.toString());
    io.emit('userOffline', { userId: socket.user?._id });
  });
});

// Start server and initialize DB + Redis
const PORT = process.env.PORT || ServerConfig.port || 4000;

server.listen(PORT, async () => {
  try {
    await connectToDatabase();
    // await initRedis();
    //console.log(`🚀 Server + WebSocket running on port ${PORT}`);
  } catch (error) {
    console.error('❌ Error starting server:', error);
    process.exit(1);
  }
});
