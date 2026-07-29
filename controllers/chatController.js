import ChatRoom from "../models/ChatRoom.js";
import Message from "../models/Message.js";
import mongoose from "mongoose";
import GroupChatRoom from "../models/GroupChatRoom.js";
import GroupMessage from "../models/GroupMessage.js";
import User from "../models/user.js";
import CourseChatRoom from "../models/CourseChatRoom.js";
import CourseChatMessage from "../models/CourseChatMessage.js";
import path from "path";
import fs from "fs";
import Course from "../models/Course.js"; // Import Course model
import CourseEnrollment from "../models/CourseEnrollment.js"; // Import CourseEnrollment model
import notificationService from "../service/notificationService.js"; // Import notification service

export const createOrGetChatRoom = async (req, res) => {
  try {
    // Check if req.user is set
    if (!req.user || !req.user._id) {
      console.error(
        "createOrGetChatRoom: req.user is undefined or missing _id",
        {
          user: req.user,
          headers: req.headers,
          body: req.body,
        }
      );
      return res
        .status(401)
        .json({ message: "Authentication failed: User not authenticated" });
    }

    const { receiverId } = req.body;
    const senderId = req.user._id;

    //console.log('createOrGetChatRoom: Starting', { senderId, receiverId });

    if (!receiverId) {
      return res.status(400).json({ message: "Receiver ID required" });
    }

    if (!mongoose.Types.ObjectId.isValid(receiverId)) {
      return res.status(400).json({ message: "Invalid receiver ID" });
    }

    // Validate sender and receiver exist in User collection
    const sender = await User.findById(senderId);
    const receiver = await User.findById(receiverId);
    if (!sender) {
      return res.status(400).json({ message: "Sender user does not exist" });
    }
    if (!receiver) {
      return res.status(400).json({ message: "Receiver user does not exist" });
    }

    // Check if room exists
    let room = await ChatRoom.findOne({
      participants: { $all: [senderId, receiverId], $size: 2 },
    });

    if (!room) {
      room = await ChatRoom.create({
        participants: [senderId, receiverId],
      });
      //console.log('createOrGetChatRoom: New room created', { roomId: room._id });
    } else {
      //console.log('createOrGetChatRoom: Existing room found', { roomId: room._id });
    }

    return res.status(200).json({
      message: "Chat room retrieved/created successfully",
      roomId: room._id,
      participants: room.participants,
    });
  } catch (err) {
    console.error("Create/Get Chat Room Error:", err);
    return res
      .status(500)
      .json({ message: "Failed to create/get chat room", error: err.message });
  }
};

// PERF: batch-compute per-room unread counts and last messages for a list of
// rooms in a FIXED number of queries (2 aggregations + 1 sender lookup),
// instead of 2 queries per room on every chat-list load.
// - `unreadMatch`: extra $match conditions identifying unread messages for the
//   current user (same query-operator semantics as the old countDocuments).
// - `lastMessageMatch`: extra $match conditions for the last-message lookup
//   (e.g. course chat excludes deleted messages).
// Returns Maps keyed by room id string.
const buildRoomMessageDetails = async ({
  MessageModel,
  roomField,
  roomIds,
  unreadMatch,
  lastMessageMatch = {},
}) => {
  if (!roomIds.length) {
    return { unreadByRoom: new Map(), lastMessageByRoom: new Map() };
  }

  const [unreadCounts, lastMessages] = await Promise.all([
    MessageModel.aggregate([
      { $match: { [roomField]: { $in: roomIds }, ...unreadMatch } },
      { $group: { _id: `$${roomField}`, count: { $sum: 1 } } },
    ]),
    MessageModel.aggregate([
      { $match: { [roomField]: { $in: roomIds }, ...lastMessageMatch } },
      { $sort: { [roomField]: 1, createdAt: -1 } },
      { $group: { _id: `$${roomField}`, lastMessage: { $first: "$$ROOT" } } },
    ]),
  ]);

  // Hydrate senders with one query (replaces per-room populate("sender")).
  const senderIds = [
    ...new Set(
      lastMessages
        .map((d) => d.lastMessage?.sender)
        .filter(Boolean)
        .map((id) => id.toString())
    ),
  ];
  const senders = senderIds.length
    ? await User.find({ _id: { $in: senderIds } })
      .select("fullName email")
      .lean()
    : [];
  const senderById = new Map(senders.map((u) => [u._id.toString(), u]));

  const unreadByRoom = new Map(
    unreadCounts.map((d) => [d._id.toString(), d.count])
  );
  const lastMessageByRoom = new Map(
    lastMessages.map((d) => {
      const message = d.lastMessage;
      const sender = message.sender
        ? senderById.get(message.sender.toString()) || null
        : null;
      return [d._id.toString(), { ...message, sender }];
    })
  );

  return { unreadByRoom, lastMessageByRoom };
};

export const getAllChatRooms = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      console.error("getAllChatRooms: req.user is undefined or missing _id", {
        user: req.user,
        headers: req.headers,
      });
      return res
        .status(401)
        .json({ message: "Authentication failed: User not authenticated" });
    }

    const userId = req.user._id;

    // Fetch all chat rooms for the user
    const rooms = await ChatRoom.find({ participants: userId })
      .populate("participants", "fullName email")
      .lean();

    // Added: Calculate unread message count and last message for each room.
    // PERF: batched into 2 aggregations + 1 sender lookup (was 2 queries/room).
    const { unreadByRoom, lastMessageByRoom } = await buildRoomMessageDetails({
      MessageModel: Message,
      roomField: "chatRoomId",
      roomIds: rooms.map((room) => room._id),
      unreadMatch: { receiver: userId, isRead: false },
    });

    const roomsWithDetails = rooms.map((room) => {
      const roomKey = room._id.toString();
      const unreadCount = unreadByRoom.get(roomKey) || 0;
      const lastMessage = lastMessageByRoom.get(roomKey) || null;

      return {
        ...room,
        unreadCount,
        lastMessage: lastMessage
          ? {
            _id: lastMessage._id,
            message: lastMessage.message,
            sender: lastMessage.sender,
            createdAt: lastMessage.createdAt,
            fileUrl: lastMessage.fileUrl,
            fileType: lastMessage.fileType,
            files: lastMessage.files,
          }
          : null,
        lastMessageTime: lastMessage ? lastMessage.createdAt : room.createdAt,
      };
    });

    // Filter out rooms with no messages so it doesn't clutter the chat list
    const filteredRooms = roomsWithDetails.filter(room => room.lastMessage !== null);

    // Sort rooms by last message time (latest first) - WhatsApp style
    filteredRooms.sort((a, b) => {
      // Handle both Date objects and date strings
      const timeA = a.lastMessageTime instanceof Date
        ? a.lastMessageTime
        : new Date(a.lastMessageTime || a.createdAt);
      const timeB = b.lastMessageTime instanceof Date
        ? b.lastMessageTime
        : new Date(b.lastMessageTime || b.createdAt);

      // Descending order: newest messages first (like WhatsApp)
      return timeB.getTime() - timeA.getTime();
    });

    console.log("Chat rooms sorted by latest message first:", {
      totalRooms: filteredRooms.length,
      firstRoomLastMessage: filteredRooms[0]?.lastMessageTime,
      lastRoomLastMessage: filteredRooms[filteredRooms.length - 1]?.lastMessageTime
    });

    return res.status(200).json({
      message: "Chat rooms retrieved successfully",
      rooms: filteredRooms, // Already sorted by latest message first
    });
  } catch (err) {
    console.error("Get All Chat Rooms Error:", err);
    return res
      .status(500)
      .json({ message: "Failed to retrieve chat rooms", error: err.message });
  }
};

export const getMessages = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      console.error("getMessages: req.user is undefined or missing _id", {
        user: req.user,
        headers: req.headers,
      });
      return res
        .status(401)
        .json({ message: "Authentication failed: User not authenticated" });
    }

    const { roomId } = req.params;
    const { limit = 20, page = 1 } = req.query;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(roomId)) {
      return res.status(400).json({ message: "Invalid room ID" });
    }

    const room = await ChatRoom.findOne({ _id: roomId, participants: userId });
    if (!room) {
      return res
        .status(403)
        .json({ message: "Not authorized to view this chat room" });
    }

    // Parse pagination parameters
    const pageNum = Math.max(parseInt(page) || 1, 1);
    const limitNum = Math.max(parseInt(limit) || 20, 1);
    const skip = (pageNum - 1) * limitNum;

    // Get total count of messages
    const totalMessages = await Message.countDocuments({ chatRoomId: roomId });

    // Fetch messages with pagination
    const messages = await Message.find({ chatRoomId: roomId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate("sender receiver", "fullName email")
      .populate({
        path: "replyTo",
        select: "message sender createdAt",
        populate: { path: "sender", select: "fullName email" },
      })
      .lean();

    // Added: Count unread messages for the authenticated user in this room
    const unreadCount = await Message.countDocuments({
      chatRoomId: roomId,
      receiver: userId,
      isRead: false,
    });

    return res.status(200).json({
      message: "Messages retrieved successfully",
      messages,
      // Added: Include unread message count in the response
      unreadCount,
      // Added: Pagination metadata
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalMessages,
        totalPages: Math.ceil(totalMessages / limitNum),
        hasNext: pageNum < Math.ceil(totalMessages / limitNum),
        hasPrev: pageNum > 1,
      },
    });
  } catch (err) {
    console.error("Get Messages Error:", err);
    return res
      .status(500)
      .json({ message: "Failed to retrieve messages", error: err.message });
  }
};

export const sendMessage = async (req, res) => {
  try {
    console.log(" sendMessage called with:", {
      hasUser: !!req.user,
      userId: req.user?._id,
      body: req.body
    });

    if (!req.user || !req.user._id) {
      console.error("sendMessage: req.user is undefined or missing _id", {
        user: req.user,
        headers: req.headers,
        body: req.body,
      });
      return res
        .status(401)
        .json({ message: "Authentication failed: User not authenticated" });
    }

    const { roomId, receiverId, replyTo, mentions } = req.body;
    let { message, fileUrl, fileName, fileType, fileSize, emoji } = req.body;
    const senderId = req.user._id;

    console.log("📨 Processing message:", {
      roomId,
      receiverId,
      senderId,
      hasMessage: !!message,
      hasFiles: !!(req.files && req.files.length > 0),
      hasFileUrl: !!fileUrl
    });

    // Parse mentions if provided
    let parsedMentions = [];
    if (mentions) {
      try {
        parsedMentions = Array.isArray(mentions)
          ? mentions
          : typeof mentions === "string"
            ? JSON.parse(mentions)
            : [];
      } catch (e) {
        console.warn("Failed to parse mentions:", e);
      }
    }

    // Append emoji to message if provided (emoji can be an emoji char or shortcode that frontend resolves)
    if (emoji) {
      message = message ? `${message} ${emoji}` : emoji;
    }

    // Accept either a message text or uploaded files (req.files) or existing fileUrl
    if (
      !roomId ||
      !receiverId ||
      (!message &&
        !(Array.isArray(req.files) && req.files.length > 0) &&
        !fileUrl)
    ) {
      return res.status(400).json({
        message:
          "Missing required fields: roomId, receiverId and (message or files/fileUrl)",
      });
    }

    if (
      !mongoose.Types.ObjectId.isValid(roomId) ||
      !mongoose.Types.ObjectId.isValid(receiverId)
    ) {
      return res
        .status(400)
        .json({ message: "Invalid room ID or receiver ID" });
    }

    // Validate receiver exists
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(400).json({ message: "Receiver user does not exist" });
    }

    const room = await ChatRoom.findOne({
      _id: roomId,
      participants: { $all: [senderId, receiverId], $size: 2 },
    });
    if (!room) {
      return res
        .status(403)
        .json({ message: "Not authorized to send message in this chat room" });
    }

    // Validate replyTo message exists and belongs to this room if provided
    if (replyTo) {
      if (!mongoose.Types.ObjectId.isValid(replyTo)) {
        return res.status(400).json({ message: "Invalid replyTo message ID" });
      }
      const replyToMessage = await Message.findOne({
        _id: replyTo,
        chatRoomId: roomId,
      });
      if (!replyToMessage) {
        return res
          .status(400)
          .json({ message: "ReplyTo message not found in this room" });
      }
    }

    // Build files array if uploaded
    let filesArr = [];
    if (Array.isArray(req.files) && req.files.length > 0) {
      filesArr = req.files.map((f) => {
        const uploadedPath = f.path;
        const parts = uploadedPath.split(path.sep);
        const idx = parts.lastIndexOf("uploads");
        const relative =
          idx >= 0
            ? parts.slice(idx).join("/")
            : `uploads/${new Date().toISOString().slice(0, 10)}/${f.filename}`;
        const url = `/${relative.replace(/\\/g, "/")}`;
        const originalName = f.originalname || f.filename;
        const size = f.size;
        const ext = (originalName || "").toLowerCase().split(".").pop();
        let determinedType = "other";
        if (f.mimetype.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext))
          determinedType = "image";
        else if (f.mimetype === "application/pdf" || ["pdf", "doc", "docx", "txt", "rtf"].includes(ext))
          determinedType = "document";
        else if (f.mimetype.startsWith("audio/") || ["mp3", "wav", "m4a", "ogg", "aac", "webm", "amr"].includes(ext))
          determinedType = "voice";

        return {
          url,
          name: originalName,
          type: determinedType,
          size,
        };
      });

      // set backward-compatible single-file fields to first file
      const first = filesArr[0];
      fileUrl = fileUrl || first.url;
      fileName = fileName || first.name;
      fileType = fileType || first.type;
      fileSize = fileSize || first.size;
    }

    const payload = {
      chatRoomId: roomId,
      sender: senderId,
      receiver: receiverId,
      message: message || null,
      fileUrl: fileUrl || null,
      fileName: fileName || null,
      fileType: fileType || null,
      fileSize: fileSize || null,
      files: filesArr,
      isRead: false,
      replyTo: replyTo || null,
      mentions: parsedMentions || [],
    };

    console.log("📨 Creating message with payload:", {
      chatRoomId: payload.chatRoomId,
      sender: payload.sender,
      receiver: payload.receiver,
      hasMessage: !!payload.message,
      hasFiles: payload.files?.length > 0
    });

    const newMessage = await Message.create(payload);
    console.log("✅ Message created successfully:", newMessage._id);

    const populatedMessage = await Message.findById(newMessage._id)
      .populate("sender receiver", "fullName email")
      .populate({
        path: "replyTo",
        select: "message sender createdAt",
        populate: { path: "sender", select: "fullName email" },
      })
      .lean();

    console.log("✅ Message populated successfully");

    // Emit to receiver and sender so clients update realtime.
    try {
      const io = req?.app?.locals?.io;
      if (io) {
        io.to(receiverId.toString()).emit("newMessage", populatedMessage);
        io.to(senderId.toString()).emit("messageSent", populatedMessage);
      }
    } catch (emitErr) {
      console.error("Failed to emit newMessage from API:", emitErr);
    }

    // START: Forward to Lapaas India if message is for Support Team
    if (receiver.email === "sahil@lapaas.com") {
      try {
        console.log("Forwarding message to Lapaas India...");
        const lapaasUser = await User.findOne({
          $or: [
            { email: "info@lapaas.com" },
            { email: "lapaasindia@gmail.com" },
            { fullName: { $regex: /^Lapaas\s*India$/i } }
          ]
        });

        if (lapaasUser && lapaasUser._id.toString() !== senderId.toString()) {
          let forwardRoom = await ChatRoom.findOne({
            participants: { $all: [senderId, lapaasUser._id], $size: 2 }
          });

          if (!forwardRoom) {
            forwardRoom = await ChatRoom.create({
              participants: [senderId, lapaasUser._id]
            });
          }

          const forwardPayload = {
            chatRoomId: forwardRoom._id,
            sender: senderId,
            receiver: lapaasUser._id,
            message: message || null,
            fileUrl: fileUrl || null,
            fileName: fileName || null,
            fileType: fileType || null,
            fileSize: fileSize || null,
            files: filesArr,
            isRead: false,
            mentions: parsedMentions || [],
          };

          const forwardMessage = await Message.create(forwardPayload);

          const populatedForwardMessage = await Message.findById(forwardMessage._id)
            .populate("sender receiver", "fullName email")
            .lean();

          const io = req?.app?.locals?.io;
          if (io) {
            const lapaasIdStr = lapaasUser._id.toString();
            io.to(lapaasIdStr).emit("newMessage", populatedForwardMessage);

            // Also emit to sender so they see the forwarded chat appear/update
            io.to(senderId.toString()).emit("newMessage", populatedForwardMessage);
          }

          // Send notification to Lapaas India
          try {
            const senderForNotif = await User.findById(senderId).select("fullName email avatar").lean();
            const msgPrev = message || (filesArr.length > 0 ? `📎 ${filesArr[0].name}` : "Media");

            await notificationService.sendNotificationToUser(
              lapaasUser._id.toString(),
              {
                title: `${senderForNotif?.fullName || 'User'} (via Support)`,
                description: msgPrev,
                type: "chat_message",
                conversation_id: forwardRoom._id.toString(),
                data_id: forwardMessage._id.toString(),
                image: senderForNotif?.avatar || "",
              }
            );
          } catch (notifErr) {
            console.error("Failed to send forwarding notification:", notifErr);
          }

        } else {
          console.log("Lapaas India user not found or is sender");
        }
      } catch (fwdErr) {
        console.error("Failed to forward message to Lapaas India:", fwdErr);
      }
    }
    // END: Forward to Lapaas India

    // Send push notification to receiver
    try {
      const sender = await User.findById(senderId)
        .select("fullName email avatar")
        .lean();
      const senderName = sender?.fullName || sender?.email || "Someone";

      const messagePreview =
        message ||
        (filesArr.length > 0 ? `📎 ${filesArr[0].name || "File"}` : "Media");

      // For one-on-one chats, the group name is the sender's name (the person they're chatting with)
      // This represents the chat/conversation with that person
      const groupName = senderName;

      // Check if receiver is mentioned
      const isReceiverMentioned =
        parsedMentions &&
        parsedMentions.some(
          (m) => m.userId && m.userId.toString() === receiverId.toString()
        );

      // Format notification title and description
      let notificationTitle, notificationDescription;

      if (isReceiverMentioned) {
        // Format: "{Sender Name} mentioned you in {Group Name}"
        notificationTitle = `${senderName} mentioned you in ${groupName}`;
        notificationDescription =
          messagePreview.length > 80
            ? messagePreview.substring(0, 80) + "..."
            : messagePreview;
      } else {
        // Format: "{Sender Name} sent a message in {Group Name}"
        notificationTitle = `${senderName} sent a message in ${groupName}`;
        notificationDescription =
          messagePreview.length > 80
            ? messagePreview.substring(0, 80) + "..."
            : messagePreview;
      }

      const notificationData = {
        title: notificationTitle,
        description: notificationDescription,
        type: isReceiverMentioned ? "chat_mention" : "chat_message",
        conversation_id: roomId.toString(),
        data_id: newMessage._id.toString(),
        image: sender?.avatar || "",
      };

      await notificationService.sendNotificationToUser(
        receiverId.toString(),
        notificationData
      );
    } catch (notifErr) {
      console.error("Failed to send push notification:", notifErr);
      // Don't fail the request if notification fails
    }

    console.log("✅ Sending success response");
    return res.status(201).json({
      message: "Message sent successfully",
      newMessage: populatedMessage,
    });
  } catch (err) {
    console.error("❌ Send Message Error:", err);
    console.error("❌ Error stack:", err.stack);
    console.error("❌ Error details:", {
      message: err.message,
      name: err.name,
      code: err.code
    });
    return res
      .status(500)
      .json({ message: "Failed to send message", error: err.message });
  }
};

export const markMessagesAsRead = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      console.error(
        "markMessagesAsRead: req.user is undefined or missing _id",
        {
          user: req.user,
          headers: req.headers,
          body: req.body,
        }
      );
      return res
        .status(401)
        .json({ message: "Authentication failed: User not authenticated" });
    }

    const { roomId, senderId } = req.body;
    const receiverId = req.user._id;

    if (!roomId || !senderId) {
      return res
        .status(400)
        .json({ message: "Missing required fields: roomId, senderId" });
    }

    if (
      !mongoose.Types.ObjectId.isValid(roomId) ||
      !mongoose.Types.ObjectId.isValid(senderId)
    ) {
      return res.status(400).json({ message: "Invalid room ID or sender ID" });
    }

    // Validate sender exists
    const sender = await User.findById(senderId);
    if (!sender) {
      return res.status(400).json({ message: "Sender user does not exist" });
    }

    const room = await ChatRoom.findOne({
      _id: new mongoose.Types.ObjectId(roomId),
      participants: new mongoose.Types.ObjectId(receiverId),
    });
    if (!room) {
      return res
        .status(403)
        .json({ message: "Not authorized to mark messages in this chat room" });
    }

    //console.log('markMessagesAsRead: Marking messages as read', { roomId, senderId, receiverId });

    const updateResult = await Message.updateMany(
      {
        chatRoomId: new mongoose.Types.ObjectId(roomId),
        sender: new mongoose.Types.ObjectId(senderId),
        receiver: new mongoose.Types.ObjectId(receiverId),
        isRead: false,
      },
      { $set: { isRead: true } }
    );

    //console.log('markMessagesAsRead: Update result', {
    //   matchedCount: updateResult.matchedCount,
    //   modifiedCount: updateResult.modifiedCount
    // });

    if (updateResult.matchedCount === 0) {
      return res.status(200).json({
        message: "No unread messages found to mark as read",
      });
    }

    return res.status(200).json({
      message: "Messages marked as read successfully",
      modifiedCount: updateResult.modifiedCount,
    });
  } catch (err) {
    console.error("Mark Messages As Read Error:", err);
    return res
      .status(500)
      .json({ message: "Failed to mark messages as read", error: err.message });
  }
};

// Pin / unpin a direct chat message
export const updateMessagePin = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res
        .status(401)
        .json({ message: "Authentication failed: User not authenticated" });
    }

    const { id } = req.params;
    const { isPinned } = req.body;
    const userId = req.user._id;
    const userEmail = req.user.email;
    const userRole = req.user.role;

    // Restriction: Only admin, super_admin and specific email can pin
    if (userRole !== "admin" && userRole !== "super_admin" && userEmail !== "lapaasindia@gmail.com") {
      return res.status(403).json({
        message: "Only admins and authorized users can pin messages",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid message ID" });
    }

    const messageDoc = await Message.findById(id);
    if (!messageDoc) {
      return res.status(404).json({ message: "Message not found" });
    }

    const room = await ChatRoom.findOne({
      _id: messageDoc.chatRoomId,
      participants: userId,
    });
    if (!room) {
      return res
        .status(403)
        .json({ message: "Not authorized to pin in this chat room" });
    }

    const pinValue = !!isPinned;

    // If the message is already in the desired state, return early
    if (messageDoc.isPinned === pinValue) {
      // Message is already in the desired pin state, no need to change
      const populated = await Message.findById(messageDoc._id)
        .populate("sender receiver", "fullName email")
        .populate({
          path: "replyTo",
          select: "message sender createdAt",
          populate: { path: "sender", select: "fullName email" },
        })
        .populate("pinnedBy", "fullName email")
        .lean();

      return res.status(200).json({
        message: `Message is already ${pinValue ? "pinned" : "unpinned"}`,
        updatedMessage: populated,
      });
    }

    // If pinning, check if we already have 3 pinned messages
    if (pinValue) {
      // First, get all pinned messages to debug
      const pinnedMessages = await Message.find({
        chatRoomId: messageDoc.chatRoomId,
        isPinned: true,
        _id: { $ne: messageDoc._id }, // Exclude current message
      })
        .select("_id isPinned chatRoomId createdAt")
        .lean();

      const pinnedCount = pinnedMessages.length;

      console.log("Pinned count check (regular chat):", {
        chatRoomId: messageDoc.chatRoomId.toString(),
        pinnedCount,
        currentMessageId: messageDoc._id.toString(),
        currentMessageIsPinned: messageDoc.isPinned,
        pinnedMessageIds: pinnedMessages.map((m) => m._id.toString()),
      });

      // If already 3 pinned, return error - don't allow pinning 4th message
      if (pinnedCount >= 3) {
        return res.status(400).json({
          message:
            "Maximum 3 messages can be pinned. Please unpin a message first to pin a new one.",
          pinnedCount,
          pinnedMessageIds: pinnedMessages.map((m) => m._id.toString()),
        });
      }
    }

    messageDoc.isPinned = pinValue;
    messageDoc.pinnedBy = pinValue ? userId : null;
    messageDoc.pinnedAt = pinValue ? new Date() : null;
    await messageDoc.save();

    const populated = await Message.findById(messageDoc._id)
      .populate("sender receiver", "fullName email")
      .populate({
        path: "replyTo",
        select: "message sender createdAt",
        populate: { path: "sender", select: "fullName email" },
      })
      .lean();

    try {
      const io = req?.app?.locals?.io;
      if (io) {
        io.to(room._id.toString()).emit("messagePinUpdated", {
          messageId: messageDoc._id,
          isPinned: pinValue,
          pinnedBy: pinValue ? userId : null,
          pinnedAt: pinValue ? messageDoc.pinnedAt : null,
        });
      }
    } catch (emitErr) {
      console.error("Failed to emit messagePinUpdated:", emitErr);
    }

    return res.status(200).json({
      message: "Message pin status updated",
      data: populated,
    });
  } catch (err) {
    console.error("Update Message Pin Error:", err);
    return res
      .status(500)
      .json({ message: "Failed to update pin status", error: err.message });
  }
};

export const createOrGetGroupChatRoom = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      console.error(
        "createOrGetGroupChatRoom: req.user is undefined or missing _id",
        {
          user: req.user,
          headers: req.headers,
          body: req.body,
        }
      );
      return res
        .status(401)
        .json({ message: "Authentication failed: User not authenticated" });
    }

    const { participants } = req.body; // Array of participant IDs (excluding sender)
    const senderId = req.user._id;

    //console.log('createOrGetGroupChatRoom: Starting', { senderId, participants });

    if (!Array.isArray(participants) || participants.length < 2) {
      return res.status(400).json({
        message:
          "Participants array required with at least 2 IDs for group chat",
      });
    }

    const allIds = [senderId, ...participants];
    for (const id of allIds) {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: `Invalid ID: ${id}` });
      }
    }

    const users = await User.find({ _id: { $in: allIds } });

    //console.log('createOrGetGroupChatRoom: Fetched users', { fetchedCount: users.length, expectedCount: allIds.length });
    if (users.length !== allIds.length) {
      return res
        .status(400)
        .json({ message: "One or more users do not exist" });
    }

    let allParticipants = allIds.map((id) => new mongoose.Types.ObjectId(id));
    allParticipants.sort((a, b) => a.toString().localeCompare(b.toString()));

    let groupRoom = await GroupChatRoom.findOne({
      participants: { $all: allParticipants, $size: allParticipants.length },
    });

    if (!groupRoom) {
      groupRoom = await GroupChatRoom.create({
        participants: allParticipants,
      });
      //console.log('createOrGetGroupChatRoom: New group room created', { groupRoomId: groupRoom._id });
    } else {
      //console.log('createOrGetGroupChatRoom: Existing group room found', { groupRoomId: groupRoom._id });
    }

    return res.status(200).json({
      message: "Group chat room retrieved/created successfully",
      groupRoomId: groupRoom._id,
      participants: groupRoom.participants,
    });
  } catch (err) {
    console.error("Create/Get Group Chat Room Error:", err);
    return res.status(500).json({
      message: "Failed to create/get group chat room",
      error: err.message,
    });
  }
};

export const getAllGroupChatRooms = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      console.error(
        "getAllGroupChatRooms: req.user is undefined or missing _id",
        {
          user: req.user,
          headers: req.headers,
        }
      );
      return res
        .status(401)
        .json({ message: "Authentication failed: User not authenticated" });
    }

    const userId = req.user._id;

    const groupRooms = await GroupChatRoom.find({ participants: userId })
      .populate("participants", "fullName email")
      .lean();

    // PERF: batched into 2 aggregations + 1 sender lookup (was 2 queries/room).
    const { unreadByRoom, lastMessageByRoom } = await buildRoomMessageDetails({
      MessageModel: GroupMessage,
      roomField: "groupChatRoomId",
      roomIds: groupRooms.map((groupRoom) => groupRoom._id),
      unreadMatch: { readBy: { $ne: userId } },
    });

    const groupRoomsWithDetails = groupRooms.map((groupRoom) => {
      const roomKey = groupRoom._id.toString();
      const unreadCount = unreadByRoom.get(roomKey) || 0;
      const lastMessage = lastMessageByRoom.get(roomKey) || null;

      return {
        ...groupRoom,
        unreadCount,
        lastMessage: lastMessage
          ? {
            _id: lastMessage._id,
            message: lastMessage.message,
            sender: lastMessage.sender,
            createdAt: lastMessage.createdAt,
            fileUrl: lastMessage.fileUrl,
            fileType: lastMessage.fileType,
            files: lastMessage.files,
          }
          : null,
        lastMessageTime: lastMessage ? lastMessage.createdAt : groupRoom.createdAt,
      };
    });

    // Sort group rooms by last message time (latest first) - WhatsApp style
    groupRoomsWithDetails.sort((a, b) => {
      // Handle both Date objects and date strings
      const timeA = a.lastMessageTime instanceof Date
        ? a.lastMessageTime
        : new Date(a.lastMessageTime || a.createdAt);
      const timeB = b.lastMessageTime instanceof Date
        ? b.lastMessageTime
        : new Date(b.lastMessageTime || b.createdAt);

      // Descending order: newest messages first (like WhatsApp)
      return timeB.getTime() - timeA.getTime();
    });

    return res.status(200).json({
      message: "Group chat rooms retrieved successfully",
      groupRooms: groupRoomsWithDetails, // Already sorted by latest message first
    });
  } catch (err) {
    console.error("Get All Group Chat Rooms Error:", err);
    return res.status(500).json({
      message: "Failed to retrieve group chat rooms",
      error: err.message,
    });
  }
};

export const getGroupMessages = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      console.error("getGroupMessages: req.user is undefined or missing _id", {
        user: req.user,
        headers: req.headers,
      });
      return res
        .status(401)
        .json({ message: "Authentication failed: User not authenticated" });
    }

    const { groupRoomId } = req.params;
    const { limit = 20, page = 1 } = req.query;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(groupRoomId)) {
      return res.status(400).json({ message: "Invalid group room ID" });
    }

    const groupRoom = await GroupChatRoom.findOne({
      _id: groupRoomId,
      participants: userId,
    });
    if (!groupRoom) {
      return res
        .status(403)
        .json({ message: "Not authorized to view this group chat room" });
    }

    // Parse pagination parameters
    const pageNum = Math.max(parseInt(page) || 1, 1);
    const limitNum = Math.max(parseInt(limit) || 20, 1);
    const skip = (pageNum - 1) * limitNum;

    // Get total count of group messages
    const totalMessages = await GroupMessage.countDocuments({
      groupChatRoomId: groupRoomId,
    });

    const groupMessages = await GroupMessage.find({
      groupChatRoomId: groupRoomId,
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate("sender", "fullName email")
      .populate({
        path: "replyTo",
        select: "message sender createdAt",
        populate: { path: "sender", select: "fullName email" },
      })
      .lean();

    const unreadCount = await GroupMessage.countDocuments({
      groupChatRoomId: groupRoomId,
      readBy: { $ne: userId },
    });

    return res.status(200).json({
      message: "Group messages retrieved successfully",
      groupMessages,
      unreadCount,
      // Added: Pagination metadata
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalMessages,
        totalPages: Math.ceil(totalMessages / limitNum),
        hasNext: pageNum < Math.ceil(totalMessages / limitNum),
        hasPrev: pageNum > 1,
      },
    });
  } catch (err) {
    console.error("Get Group Messages Error:", err);
    return res.status(500).json({
      message: "Failed to retrieve group messages",
      error: err.message,
    });
  }
};

export const sendGroupMessage = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      console.error("sendGroupMessage: req.user is undefined or missing _id", {
        user: req.user,
        headers: req.headers,
        body: req.body,
      });
      return res
        .status(401)
        .json({ message: "Authentication failed: User not authenticated" });
    }

    const { groupRoomId, replyTo, mentions } = req.body;
    let { message, fileUrl, fileName, fileType, fileSize, emoji } = req.body;
    const senderId = req.user._id;

    // Parse mentions if provided
    let parsedMentions = [];
    if (mentions) {
      try {
        parsedMentions = Array.isArray(mentions)
          ? mentions
          : typeof mentions === "string"
            ? JSON.parse(mentions)
            : [];
      } catch (e) {
        console.warn("Failed to parse mentions:", e);
      }
    }

    // Append emoji to message if provided
    if (emoji) {
      message = message ? `${message} ${emoji}` : emoji;
    }

    if (
      !groupRoomId ||
      (!message &&
        !(Array.isArray(req.files) && req.files.length > 0) &&
        !fileUrl)
    ) {
      return res.status(400).json({
        message:
          "Missing required fields: groupRoomId and (message or files/fileUrl)",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(groupRoomId)) {
      return res.status(400).json({ message: "Invalid group room ID" });
    }

    const groupRoom = await GroupChatRoom.findOne({
      _id: groupRoomId,
      participants: senderId,
    });
    if (!groupRoom) {
      return res.status(403).json({
        message: "Not authorized to send message in this group chat room",
      });
    }

    // Validate replyTo message exists and belongs to this room if provided
    if (replyTo) {
      if (!mongoose.Types.ObjectId.isValid(replyTo)) {
        return res.status(400).json({ message: "Invalid replyTo message ID" });
      }
      const replyToMessage = await GroupMessage.findOne({
        _id: replyTo,
        groupChatRoomId: groupRoomId,
      });
      if (!replyToMessage) {
        return res
          .status(400)
          .json({ message: "ReplyTo message not found in this group room" });
      }
    }

    // Build files array if uploaded
    let filesArr = [];
    if (Array.isArray(req.files) && req.files.length > 0) {
      filesArr = req.files.map((f) => {
        const uploadedPath = f.path;
        const parts = uploadedPath.split(path.sep);
        const idx = parts.lastIndexOf("uploads");
        const relative =
          idx >= 0
            ? parts.slice(idx).join("/")
            : `uploads/${new Date().toISOString().slice(0, 10)}/${f.filename}`;
        const url = `/${relative.replace(/\\/g, "/")}`;
        const originalName = f.originalname || f.filename;
        const size = f.size;
        const ext = (originalName || "").toLowerCase().split(".").pop();
        let determinedType = "other";
        if (f.mimetype.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext))
          determinedType = "image";
        else if (f.mimetype === "application/pdf" || ["pdf", "doc", "docx", "txt", "rtf"].includes(ext))
          determinedType = "document";
        else if (f.mimetype.startsWith("audio/") || ["mp3", "wav", "m4a", "ogg", "aac", "webm", "amr"].includes(ext))
          determinedType = "voice";

        return {
          url,
          name: originalName,
          type: determinedType,
          size,
        };
      });

      // compatibility - first file
      const first = filesArr[0];
      fileUrl = fileUrl || first.url;
      fileName = fileName || first.name;
      fileType = fileType || first.type;
      fileSize = fileSize || first.size;
    }

    const payload = {
      groupChatRoomId,
      sender: senderId,
      message: message || null,
      fileUrl: fileUrl || null,
      fileName: fileName || null,
      fileType: fileType || null,
      fileSize: fileSize || null,
      files: filesArr,
      readBy: [senderId],
      replyTo: replyTo || null,
      mentions: parsedMentions || [],
    };

    const newGroupMessage = await GroupMessage.create(payload);
    const populatedMessage = await GroupMessage.findById(newGroupMessage._id)
      .populate("sender", "fullName")
      .lean();

    // Emit to group room so participants receive the message in realtime
    try {
      const io = req?.app?.locals?.io;
      if (io) {
        io.to(groupRoomId.toString()).emit("newGroupMessage", populatedMessage);
      }
    } catch (emitErr) {
      console.error("Failed to emit newGroupMessage from API:", emitErr);
    }

    return res.status(201).json({
      message: "Group message sent successfully",
      newMessage: populatedMessage,
    });
  } catch (err) {
    console.error("Send Group Message Error:", err);
    return res
      .status(500)
      .json({ message: "Failed to send group message", error: err.message });
  }
};

export const markGroupMessagesAsRead = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      console.error(
        "markGroupMessagesAsRead: req.user is undefined or missing _id",
        {
          user: req.user,
          headers: req.headers,
          body: req.body,
        }
      );
      return res
        .status(401)
        .json({ message: "Authentication failed: User not authenticated" });
    }

    const { groupRoomId } = req.body;
    const userId = req.user._id;

    if (!groupRoomId) {
      return res
        .status(400)
        .json({ message: "Missing required field: groupRoomId" });
    }

    if (!mongoose.Types.ObjectId.isValid(groupRoomId)) {
      return res.status(400).json({ message: "Invalid group room ID" });
    }

    const groupRoom = await GroupChatRoom.findOne({
      _id: new mongoose.Types.ObjectId(groupRoomId),
      participants: new mongoose.Types.ObjectId(userId),
    });
    if (!groupRoom) {
      return res.status(403).json({
        message: "Not authorized to mark messages in this group chat room",
      });
    }

    //console.log('markGroupMessagesAsRead: Marking group messages as read', { groupRoomId, userId });

    const updateResult = await GroupMessage.updateMany(
      {
        groupChatRoomId: new mongoose.Types.ObjectId(groupRoomId),
        readBy: { $ne: new mongoose.Types.ObjectId(userId) },
      },
      { $addToSet: { readBy: new mongoose.Types.ObjectId(userId) } }
    );

    //console.log('markGroupMessagesAsRead: Update result', {
    //   matchedCount: updateResult.matchedCount,
    //   modifiedCount: updateResult.modifiedCount
    // });

    if (updateResult.matchedCount === 0) {
      return res.status(200).json({
        message: "No unread group messages found to mark as read",
      });
    }

    return res.status(200).json({
      message: "Group messages marked as read successfully",
      modifiedCount: updateResult.modifiedCount,
    });
  } catch (err) {
    console.error("Mark Group Messages As Read Error:", err);
    return res.status(500).json({
      message: "Failed to mark group messages as read",
      error: err.message,
    });
  }
};

export const createOrGetCourseChatRoom = async (req, res) => {
  try {
    const { courseId } = req.body; // Only courseId is needed; enrolled students are fetched automatically
    const userId = req.user._id;

    if (!courseId) {
      return res.status(400).json({ message: "Course ID is required" });
    }

    // Check if course exists and populate enrolled students
    const course = await Course.findById(courseId).populate("enrolledStudents");
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    // Find existing room or create new
    let room = await CourseChatRoom.findOne({ courseId });

    if (!room) {
      // Automatically fetch all enrolled students + fixed users
      const enrolledUserIds = course.enrolledStudents.map((student) =>
        student._id.toString()
      );
      const fixedUsers = [
        "68b69334dffbe2b24ed4f059",
        "68d54d727eca4a280a63569c",
      ];
      const allParticipants = [
        ...new Set([...enrolledUserIds, ...fixedUsers, userId.toString()]),
      ]; // Include sender if not already

      room = new CourseChatRoom({
        courseId,
        participants: allParticipants,
        createdBy: userId,
      });
      await room.save();
    } else {
      // Self-healing: If user is enrolled but not in participants, add them
      if (!room.participants.some(p => p.toString() === userId.toString())) {
        const isEnrolled = await CourseEnrollment.exists({
          userId,
          courseId,
          status: "active"
        });
        if (isEnrolled) {
          room.participants.push(userId);
          console.log(`✅ Self-healed: Added enrolled user ${userId} to course chat room ${room._id} in createOrGetCourseChatRoom`);
        }
      }

      // Ensure fixed users are in the room (enrolled students are already added via enrollment logic)
      const fixedUsers = [
        "68b69334dffbe2b24ed4f059",
        "68d54d727eca4a280a63569c",
      ];
      fixedUsers.forEach((fixedUser) => {
        if (!room.participants.some(p => p.toString() === fixedUser)) {
          room.participants.push(fixedUser);
        }
      });
      await room.save();
    }

    return res.status(200).json({
      message: "Course chat room retrieved or created",
      room: {
        _id: room._id,
        participants: room.participants,
        courseId: room.courseId,
      },
    });
  } catch (error) {
    console.error("Error creating or getting course chat room:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getAllCourseChatRooms = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res
        .status(401)
        .json({ message: "Authentication failed: User not authenticated" });
    }

    const userId = req.user._id;

    const courseChatRooms = await CourseChatRoom.find({
      participants: userId,
      isActive: true,
    })
      .populate("courseId", "title description")
      .populate("participants", "fullName email")
      .lean();

    // PERF: batched into 2 aggregations + 1 sender lookup (was 2 queries/room).
    // Unread counts intentionally include deleted messages (matching the old
    // countDocuments filter); only the last-message lookup excludes them.
    const { unreadByRoom, lastMessageByRoom } = await buildRoomMessageDetails({
      MessageModel: CourseChatMessage,
      roomField: "courseChatRoomId",
      roomIds: courseChatRooms.map((room) => room._id),
      unreadMatch: { "readBy.user": { $ne: userId } },
      lastMessageMatch: { isDeleted: false },
    });

    const courseChatRoomsWithDetails = courseChatRooms.map((room) => {
      const roomKey = room._id.toString();
      const unreadCount = unreadByRoom.get(roomKey) || 0;
      const lastMessage = lastMessageByRoom.get(roomKey) || null;

      return {
        ...room,
        unreadCount,
        lastMessage: lastMessage
          ? {
            _id: lastMessage._id,
            message: lastMessage.message,
            sender: lastMessage.sender,
            createdAt: lastMessage.createdAt,
            fileUrl: lastMessage.fileUrl,
            fileType: lastMessage.fileType,
            files: lastMessage.files,
          }
          : null,
        lastMessageTime: lastMessage ? lastMessage.createdAt : room.createdAt,
      };
    });

    // Sort course chat rooms by last message time (latest first) - WhatsApp style
    courseChatRoomsWithDetails.sort((a, b) => {
      // Handle both Date objects and date strings
      const timeA = a.lastMessageTime instanceof Date
        ? a.lastMessageTime
        : new Date(a.lastMessageTime || a.createdAt);
      const timeB = b.lastMessageTime instanceof Date
        ? b.lastMessageTime
        : new Date(b.lastMessageTime || b.createdAt);

      // Descending order: newest messages first (like WhatsApp)
      return timeB.getTime() - timeA.getTime();
    });

    return res.status(200).json({
      message: "Course chat rooms retrieved successfully",
      courseChatRooms: courseChatRoomsWithDetails, // Already sorted by latest message first
    });
  } catch (err) {
    console.error("Get All Course Chat Rooms Error:", err);
    return res.status(500).json({
      message: "Failed to retrieve course chat rooms",
      error: err.message,
    });
  }
};

export const getCourseChatMessages = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res
        .status(401)
        .json({ message: "Authentication failed: User not authenticated" });
    }

    const { courseChatRoomId } = req.params;
    const { limit = 20, page = 1 } = req.query;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(courseChatRoomId)) {
      return res.status(400).json({ message: "Invalid course chat room ID" });
    }

    const courseChatRoom = await CourseChatRoom.findOne({
      _id: courseChatRoomId,
      participants: userId,
      isActive: true,
    });

    if (!courseChatRoom) {
      // Self-healing: Check if user is enrolled in the course
      const room = await CourseChatRoom.findOne({ _id: courseChatRoomId, isActive: true });
      if (room) {
        const isEnrolled = await CourseEnrollment.exists({
          userId,
          courseId: room.courseId,
          status: "active"
        });
        if (isEnrolled) {
          room.participants.push(userId);
          await room.save();
          console.log(`✅ Self-healed: Added enrolled user ${userId} to course chat room ${room._id} in getCourseChatMessages`);
          // Continue with authorized flow
        } else {
          return res
            .status(403)
            .json({ message: "Not authorized to view this course chat room" });
        }
      } else {
        return res
          .status(403)
          .json({ message: "Not authorized to view this course chat room" });
      }
    }

    // Parse pagination parameters
    const pageNum = Math.max(parseInt(page) || 1, 1);
    const limitNum = Math.max(parseInt(limit) || 20, 1);
    const skip = (pageNum - 1) * limitNum;

    // ALWAYS fetch pinned messages separately to ensure they're always included
    const pinnedMessages = await CourseChatMessage.find({
      courseChatRoomId,
      isDeleted: false,
      isPinned: true,
    })
      .sort({ pinnedAt: -1, createdAt: -1 }) // Sort by pinnedAt descending (latest pinned first)
      .populate("sender", "fullName email")
      .populate({
        path: "replyTo",
        select: "message sender createdAt",
        populate: { path: "sender", select: "fullName email" },
      })
      .populate("pinnedBy", "fullName email")
      .lean();

    // Get total count of regular (non-pinned) messages for pagination
    const totalRegularMessages = await CourseChatMessage.countDocuments({
      courseChatRoomId,
      isDeleted: false,
      isPinned: false,
    });

    // Fetch regular messages (excluding pinned ones to avoid duplicates)
    const regularMessages = await CourseChatMessage.find({
      courseChatRoomId,
      isDeleted: false,
      isPinned: false,
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate("sender", "fullName email")
      .populate({
        path: "replyTo",
        select: "message sender createdAt",
        populate: { path: "sender", select: "fullName email" },
      })
      .lean();

    // Combine pinned messages with regular messages
    // Use a Map to deduplicate by _id (in case a pinned message is also in the regular messages)
    const messagesMap = new Map();

    // First add all pinned messages
    pinnedMessages.forEach((msg) => {
      messagesMap.set(msg._id.toString(), msg);
    });

    // Then add regular messages (pinned ones will be skipped due to Map behavior)
    regularMessages.forEach((msg) => {
      if (!messagesMap.has(msg._id.toString())) {
        messagesMap.set(msg._id.toString(), msg);
      }
    });

    // Convert Map to array and sort by createdAt descending
    const allMessages = Array.from(messagesMap.values()).sort((a, b) => {
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    const unreadCount = await CourseChatMessage.countDocuments({
      courseChatRoomId,
      "readBy.user": { $ne: userId },
    });

    return res.status(200).json({
      message: "Course chat messages retrieved successfully",
      messages: allMessages, // Return newest first for frontend to display correctly
      unreadCount,
      pinnedCount: pinnedMessages.length, // Include pinned count for frontend reference
      // Added: Pagination metadata (based on regular messages only, pinned are always included)
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalRegularMessages,
        totalPages: Math.ceil(totalRegularMessages / limitNum),
        hasNext: pageNum < Math.ceil(totalRegularMessages / limitNum),
        hasPrev: pageNum > 1,
      },
    });
  } catch (err) {
    console.error("Get Course Chat Messages Error:", err);
    return res.status(500).json({
      message: "Failed to retrieve course chat messages",
      error: err.message,
    });
  }
};

export const sendCourseChatMessage = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res
        .status(401)
        .json({ message: "Authentication failed: User not authenticated" });
    }

    const { courseChatRoomId, replyTo, mentions } = req.body;
    let { message, fileUrl, fileName, fileType, fileSize, emoji } = req.body;
    const senderId = req.user._id;

    // Parse mentions if provided as JSON string
    let parsedMentions = [];
    if (mentions) {
      try {
        parsedMentions =
          typeof mentions === "string" ? JSON.parse(mentions) : mentions;
      } catch (e) {
        console.warn("Failed to parse mentions:", e);
      }
    }

    // Append emoji if present
    if (emoji) {
      message = message ? `${message} ${emoji}` : emoji;
    }

    // Handle multiple uploaded files (req.files) - build files array
    let filesArr = [];
    if (Array.isArray(req.files) && req.files.length > 0) {
      filesArr = req.files.map((f) => {
        const uploadedPath = f.path;
        const parts = uploadedPath.split(path.sep);
        const idx = parts.lastIndexOf("uploads");
        const relative =
          idx >= 0
            ? parts.slice(idx).join("/")
            : `uploads/course/${new Date().toISOString().slice(0, 10)}/${f.filename
            }`;
        const url = `/${relative.replace(/\\/g, "/")}`;
        const originalName = f.originalname || f.filename;
        const size = f.size;
        const ext = (originalName || "").toLowerCase().split(".").pop();
        let determinedType = "other";
        if (f.mimetype.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext))
          determinedType = "image";
        else if (f.mimetype === "application/pdf" || ["pdf", "doc", "docx", "txt", "rtf"].includes(ext))
          determinedType = "document";
        else if (f.mimetype.startsWith("audio/") || ["mp3", "wav", "m4a", "ogg", "aac", "webm", "amr"].includes(ext))
          determinedType = "voice";

        return {
          url,
          name: originalName,
          type: determinedType,
          size,
        };
      });

      // set backward-compatible single-file fields to first file
      const first = filesArr[0];
      fileUrl = fileUrl || first.url;
      fileName = fileName || first.name;
      fileType = fileType || first.type;
      fileSize = fileSize || first.size;
    }

    if (!courseChatRoomId || (!message && !fileUrl && filesArr.length === 0)) {
      return res.status(400).json({
        message:
          "Missing required fields: courseChatRoomId and (message or fileUrl/files)",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(courseChatRoomId)) {
      return res.status(400).json({ message: "Invalid course chat room ID" });
    }

    const courseChatRoom = await CourseChatRoom.findOne({
      _id: courseChatRoomId,
      participants: senderId,
      isActive: true,
    }).populate("courseId", "title enrolledStudents");

    if (!courseChatRoom) {
      return res.status(403).json({
        message: "Not authorized to send message in this course chat room",
      });
    }

    // Validate replyTo message exists and belongs to this room if provided
    if (replyTo) {
      if (!mongoose.Types.ObjectId.isValid(replyTo)) {
        return res.status(400).json({ message: "Invalid replyTo message ID" });
      }
      const replyToMessage = await CourseChatMessage.findOne({
        _id: replyTo,
        courseChatRoomId,
        isDeleted: false,
      });
      if (!replyToMessage) {
        return res
          .status(400)
          .json({ message: "ReplyTo message not found in this room" });
      }
    }

    const payload = {
      courseChatRoomId,
      sender: senderId,
      message: message || null,
      fileUrl: fileUrl || null,
      fileName: fileName || null,
      fileType: fileType || null,
      fileSize: fileSize || null,
      files: filesArr,
      readBy: [{ user: senderId }],
      replyTo: replyTo || null,
      mentions: parsedMentions || [],
    };

    const newMessage = await CourseChatMessage.create(payload);

    const populatedMessage = await CourseChatMessage.findById(newMessage._id)
      .populate("sender", "fullName email")
      .populate({
        path: "replyTo",
        select: "message sender createdAt",
        populate: { path: "sender", select: "fullName email" },
      })
      .lean();

    // Emit to sockets so participants receive the message in realtime.
    try {
      const io = req?.app?.locals?.io;
      if (io && courseChatRoomId) {
        io.to(`course_${courseChatRoomId.toString()}`).emit(
          "newCourseChatMessage",
          populatedMessage
        );
      }
    } catch (emitErr) {
      console.error("Failed to emit newCourseChatMessage from API:", emitErr);
    }

    // Send push notifications to all participants except sender
    try {
      // Fetch sender details dynamically - senderName will be the actual sender's name
      const sender = await User.findById(senderId)
        .select("fullName email avatar")
        .lean();
      const senderName = sender?.fullName || sender?.email || "Someone";

      const messagePreview =
        message ||
        (filesArr.length > 0 ? `📎 ${filesArr[0].name || "File"}` : "Media");
      // Get the actual course/group name from the populated course
      const roomName =
        courseChatRoom.courseId?.title ||
        courseChatRoom.courseId?.name ||
        "Course Chat";

      // Get mentioned user IDs and fetch their names
      const mentionedUserIds =
        parsedMentions && parsedMentions.length > 0
          ? parsedMentions.map((m) => m.userId || m._id).filter(Boolean)
          : [];

      // Fetch mentioned users' names
      const mentionedUsers =
        mentionedUserIds.length > 0
          ? await User.find({ _id: { $in: mentionedUserIds } })
            .select("fullName email")
            .lean()
          : [];

      const mentionedUsersMap = {};
      mentionedUsers.forEach((user) => {
        mentionedUsersMap[user._id.toString()] =
          user.fullName || user.email || "Someone";
      });

      // Get all participants except sender
      // Filter to only include users who are actually enrolled in the course or are fixed users
      const enrolledStudents = courseChatRoom.courseId?.enrolledStudents?.map(id => id.toString()) || [];
      const fixedUsers = ["68b69334dffbe2b24ed4f059", "68d54d727eca4a280a63569c"];
      const allowedParticipants = [...new Set([...enrolledStudents, ...fixedUsers])];

      const participants = courseChatRoom.participants.filter(
        (p) => p.toString() !== senderId.toString() && allowedParticipants.includes(p.toString())
      );

      console.log("Mention detection:", {
        parsedMentionsCount: parsedMentions?.length || 0,
        mentionedUserIds: mentionedUserIds.map((id) => id.toString()),
        participantsCount: participants.length,
      });

      // Send notification to each participant (filtered)
      const notificationPromises = participants.map(async (participantId) => {
        try {
          // Ensure both are strings for comparison
          const participantIdStr = participantId.toString();
          const mentionedUserIdsStr = mentionedUserIds
            .map((id) => {
              // Handle both ObjectId and string formats
              const idStr = id?.toString ? id.toString() : String(id);
              return idStr;
            })
            .filter(Boolean);

          const isMentioned = mentionedUserIdsStr.includes(participantIdStr);

          // Format notification title and description
          let notificationTitle, notificationDescription;

          if (isMentioned) {
            // If user is mentioned: "{Sender Name} mentioned you in {Group Name}"
            notificationTitle = `${senderName} mentioned you in ${roomName}`;
            notificationDescription = `${messagePreview.length > 70
              ? messagePreview.substring(0, 70) + "..."
              : messagePreview
              }`;
            console.log(
              ` MENTIONED USER: ${participantIdStr} - Title: "${notificationTitle}"`
            );
          } else {
            // If user is not mentioned: "{Sender Name} sent a message in {Group Name}"
            notificationTitle = `${senderName} sent a message in ${roomName}`;
            notificationDescription =
              messagePreview.length > 80
                ? messagePreview.substring(0, 80) + "..."
                : messagePreview;
          }

          console.log(`Notification for participant ${participantIdStr}:`, {
            isMentioned,
            mentionedUserIdsStr,
            participantIdStr,
            notificationTitle,
          });

          const notificationData = {
            title: notificationTitle,
            description: notificationDescription,
            type: isMentioned ? "course_chat_mention" : "course_chat_message",
            conversation_id: courseChatRoomId.toString(),
            data_id: newMessage._id.toString(),
            courseId: courseChatRoom.courseId?.toString() || "",
            image: sender?.avatar || "",
          };

          console.log(`📤 Sending notification to ${participantIdStr}:`, {
            title: notificationData.title,
            description: notificationData.description,
            type: notificationData.type,
            isMentioned,
          });

          await notificationService.sendNotificationToUser(
            participantId.toString(),
            notificationData
          );
        } catch (err) {
          console.error(
            `Failed to send notification to participant ${participantId}:`,
            err
          );
        }
      });

      await Promise.all(notificationPromises);
    } catch (notifErr) {
      console.error("Failed to send push notifications:", notifErr);
      // Don't fail the request if notification fails
    }

    return res.status(201).json({
      message: "Course chat message sent successfully",
      newMessage: populatedMessage,
    });
  } catch (err) {
    console.error("Send Course Chat Message Error:", err);
    return res.status(500).json({
      message: "Failed to send course chat message",
      error: err.message,
    });
  }
};

// Pin / unpin a course chat message
export const updateCourseMessagePin = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res
        .status(401)
        .json({ message: "Authentication failed: User not authenticated" });
    }

    const { id } = req.params;
    const { isPinned } = req.body;
    const userId = req.user._id;
    const userRole = req.user.role;
    const userEmail = req.user.email;

    // Restriction: Only admin, super_admin and specific email can pin
    if (userRole !== "admin" && userRole !== "super_admin" && userEmail !== "lapaasindia@gmail.com") {
      return res.status(403).json({
        message: "Only admins and authorized users can pin messages",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid message ID" });
    }

    const messageDoc = await CourseChatMessage.findById(id);
    if (!messageDoc || messageDoc.isDeleted) {
      return res.status(404).json({ message: "Message not found" });
    }

    const courseChatRoom = await CourseChatRoom.findOne({
      _id: messageDoc.courseChatRoomId,
      participants: userId,
      isActive: true,
    });

    if (!courseChatRoom) {
      return res
        .status(403)
        .json({ message: "Not authorized to pin in this course chat room" });
    }

    const pinValue = !!isPinned;

    console.log("Pin request received:", {
      messageId: messageDoc._id.toString(),
      currentIsPinned: messageDoc.isPinned,
      requestedIsPinned: pinValue,
      roomId: messageDoc.courseChatRoomId.toString(),
    });

    // If the message is already in the desired state, return early
    if (messageDoc.isPinned === pinValue) {
      console.log("Message is already in desired state, returning early");
      // Message is already in the desired pin state, no need to change
      const populated = await CourseChatMessage.findById(messageDoc._id)
        .populate("sender", "fullName email")
        .populate({
          path: "replyTo",
          select: "message sender createdAt",
          populate: { path: "sender", select: "fullName email" },
        })
        .populate("pinnedBy", "fullName email")
        .lean();

      return res.status(200).json({
        message: `Message is already ${pinValue ? "pinned" : "unpinned"}`,
        updatedMessage: populated,
      });
    }

    // If pinning, check if we already have 3 pinned messages
    if (pinValue) {
      // Ensure courseChatRoomId is an ObjectId for proper comparison
      const roomId = mongoose.Types.ObjectId.isValid(
        messageDoc.courseChatRoomId
      )
        ? new mongoose.Types.ObjectId(messageDoc.courseChatRoomId)
        : messageDoc.courseChatRoomId;

      // IMPORTANT: Exclude the current message from the count, especially if it's already pinned
      // This ensures we don't count the message we're trying to pin
      const pinnedMessages = await CourseChatMessage.find({
        courseChatRoomId: roomId,
        isPinned: true,
        isDeleted: false,
        _id: { $ne: messageDoc._id }, // Always exclude current message
      })
        .select("_id isPinned isDeleted courseChatRoomId createdAt pinnedAt")
        .lean();

      const pinnedCount = pinnedMessages.length;

      console.log("Pinned count check:", {
        courseChatRoomId: roomId.toString(),
        pinnedCount,
        currentMessageId: messageDoc._id.toString(),
        currentMessageIsPinned: messageDoc.isPinned,
        requestedPinValue: pinValue,
        pinnedMessageIds: pinnedMessages.map((m) => m._id.toString()),
        pinnedMessagesDetails: pinnedMessages.map((m) => ({
          id: m._id.toString(),
          isPinned: m.isPinned,
          isDeleted: m.isDeleted,
          roomId: m.courseChatRoomId.toString(),
          pinnedAt: m.pinnedAt,
        })),
      });

      // If already 3 pinned (excluding current message), return error - don't allow pinning 4th message
      if (pinnedCount >= 3) {
        console.log("ERROR: Cannot pin - already have 3 pinned messages");
        return res.status(400).json({
          message:
            "Maximum 3 messages can be pinned. Please unpin a message first to pin a new one.",
          pinnedCount,
          pinnedMessageIds: pinnedMessages.map((m) => m._id.toString()),
        });
      }
    }

    messageDoc.isPinned = pinValue;
    messageDoc.pinnedBy = pinValue ? userId : null;
    messageDoc.pinnedAt = pinValue ? new Date() : null;
    await messageDoc.save();

    const populated = await CourseChatMessage.findById(messageDoc._id)
      .populate("sender", "fullName email")
      .populate({
        path: "replyTo",
        select: "message sender createdAt",
        populate: { path: "sender", select: "fullName email" },
      })
      .lean();

    try {
      const io = req?.app?.locals?.io;
      if (io) {
        io.to(`course_${messageDoc.courseChatRoomId.toString()}`).emit(
          "courseMessagePinUpdated",
          {
            messageId: messageDoc._id,
            isPinned: pinValue,
            pinnedBy: pinValue ? userId : null,
            pinnedAt: pinValue ? messageDoc.pinnedAt : null,
          }
        );
      }
    } catch (emitErr) {
      console.error("Failed to emit courseMessagePinUpdated:", emitErr);
    }

    return res.status(200).json({
      message: "Course message pin status updated",
      data: populated,
    });
  } catch (err) {
    console.error("Update Course Message Pin Error:", err);
    return res
      .status(500)
      .json({ message: "Failed to update pin status", error: err.message });
  }
};

export const markCourseChatMessagesAsRead = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res
        .status(401)
        .json({ message: "Authentication failed: User not authenticated" });
    }

    const { courseChatRoomId } = req.body;
    const userId = req.user._id;

    if (!courseChatRoomId) {
      return res
        .status(400)
        .json({ message: "Missing required field: courseChatRoomId" });
    }

    if (!mongoose.Types.ObjectId.isValid(courseChatRoomId)) {
      return res.status(400).json({ message: "Invalid course chat room ID" });
    }

    const courseChatRoom = await CourseChatRoom.findOne({
      _id: courseChatRoomId,
      participants: userId,
      isActive: true,
    });

    if (!courseChatRoom) {
      return res.status(403).json({
        message: "Not authorized to mark messages in this course chat room",
      });
    }

    const updateResult = await CourseChatMessage.updateMany(
      {
        courseChatRoomId: new mongoose.Types.ObjectId(courseChatRoomId),
        "readBy.user": { $ne: new mongoose.Types.ObjectId(userId) },
      },
      { $addToSet: { readBy: { user: new mongoose.Types.ObjectId(userId) } } }
    );

    return res.status(200).json({
      message: "Course chat messages marked as read successfully",
      modifiedCount: updateResult.modifiedCount,
    });
  } catch (err) {
    console.error("Mark Course Chat Messages As Read Error:", err);
    return res.status(500).json({
      message: "Failed to mark course chat messages as read",
      error: err.message,
    });
  }
};

export const getCourseChatParticipants = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res
        .status(401)
        .json({ message: "Authentication failed: User not authenticated" });
    }

    const { courseChatRoomId } = req.params;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(courseChatRoomId)) {
      return res.status(400).json({ message: "Invalid course chat room ID" });
    }

    const courseChatRoom = await CourseChatRoom.findOne({
      _id: courseChatRoomId,
      participants: userId,
      isActive: true,
    }).populate("participants", "fullName email");

    if (!courseChatRoom) {
      return res.status(403).json({
        message: "Not authorized to view participants of this course chat room",
      });
    }

    return res.status(200).json({
      message: "Course chat participants retrieved successfully",
      participants: courseChatRoom.participants,
    });
  } catch (err) {
    console.error("Get Course Chat Participants Error:", err);
    return res.status(500).json({
      message: "Failed to retrieve course chat participants",
      error: err.message,
    });
  }
};

export const createAllCourseChatRooms = async (req, res) => {
  try {
    const userId = "68b69334dffbe2b24ed4f059"; // Assuming admin or authorized user

    // Find all courses
    const courses = await Course.find({ isDeleted: false }).populate(
      "enrolledStudents"
    );
    const fixedUsers = ["68b69334dffbe2b24ed4f059", "68d54d727eca4a280a63569c"];

    let createdCount = 0;
    let updatedCount = 0;

    for (const course of courses) {
      let room = await CourseChatRoom.findOne({ courseId: course._id });

      if (!room) {
        // Create new room with enrolled students + fixed users
        const enrolledUserIds = course.enrolledStudents.map((student) =>
          student._id.toString()
        );
        const allParticipants = [
          ...new Set([...enrolledUserIds, ...fixedUsers]),
        ];

        room = new CourseChatRoom({
          courseId: course._id,
          participants: allParticipants,
          createdBy: userId,
        });
        await room.save();
        createdCount++;
      } else {
        // Update existing room to ensure fixed users are included and add any missing enrolled students
        const enrolledUserIds = course.enrolledStudents.map((student) =>
          student._id.toString()
        );
        const allParticipants = [
          ...new Set([...enrolledUserIds, ...fixedUsers]),
        ];

        const newParticipants = allParticipants.filter(
          (p) => !room.participants.includes(p)
        );
        if (newParticipants.length > 0) {
          room.participants.push(...newParticipants);
          await room.save();
          updatedCount++;
        }
      }
    }

    return res.status(200).json({
      message: `Processed ${courses.length} courses. Created ${createdCount} rooms, updated ${updatedCount} rooms.`,
    });
  } catch (error) {
    console.error("Error creating all course chat rooms:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Delete a single message from one-on-one chat
export const deleteMessage = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res
        .status(401)
        .json({ message: "Authentication failed: User not authenticated" });
    }

    const { messageId } = req.params;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      return res.status(400).json({ message: "Invalid message ID" });
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    // Check if user is authorized (must be sender or receiver)
    const room = await ChatRoom.findOne({
      _id: message.chatRoomId,
      participants: userId,
    });

    if (!room) {
      return res
        .status(403)
        .json({ message: "Not authorized to delete this message" });
    }

    // Only sender can delete their own message
    if (message.sender.toString() !== userId.toString()) {
      return res
        .status(403)
        .json({ message: "You can only delete your own messages" });
    }

    // Delete associated files from filesystem if they exist
    if (message.files && Array.isArray(message.files)) {
      for (const file of message.files) {
        if (file.url) {
          try {
            const filePath = path.join(process.cwd(), file.url);
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
            }
          } catch (fileErr) {
            console.error("Error deleting file:", fileErr);
            // Continue even if file deletion fails
          }
        }
      }
    }

    // Also check single fileUrl for backward compatibility
    if (message.fileUrl) {
      try {
        const filePath = path.join(process.cwd(), message.fileUrl);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (fileErr) {
        console.error("Error deleting file:", fileErr);
      }
    }

    await Message.findByIdAndDelete(messageId);

    // Emit socket event to notify users
    try {
      const io = req?.app?.locals?.io;
      if (io) {
        io.to(message.receiver.toString()).emit("messageDeleted", {
          messageId: messageId,
          chatRoomId: message.chatRoomId.toString(),
        });
        io.to(userId.toString()).emit("messageDeleted", {
          messageId: messageId,
          chatRoomId: message.chatRoomId.toString(),
        });
      }
    } catch (emitErr) {
      console.error("Failed to emit messageDeleted:", emitErr);
    }

    return res.status(200).json({
      message: "Message deleted successfully",
      deletedMessageId: messageId,
    });
  } catch (err) {
    console.error("Delete Message Error:", err);
    return res
      .status(500)
      .json({ message: "Failed to delete message", error: err.message });
  }
};

// Delete all messages in a chat room (one-on-one chat)
export const deleteChatRoom = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res
        .status(401)
        .json({ message: "Authentication failed: User not authenticated" });
    }

    const { roomId } = req.params;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(roomId)) {
      return res.status(400).json({ message: "Invalid room ID" });
    }

    const room = await ChatRoom.findOne({
      _id: roomId,
      participants: userId,
    });

    if (!room) {
      return res
        .status(403)
        .json({ message: "Not authorized to delete this chat room" });
    }

    // Get all messages in the room to delete associated files
    const messages = await Message.find({ chatRoomId: roomId });

    // Delete associated files
    for (const message of messages) {
      if (message.files && Array.isArray(message.files)) {
        for (const file of message.files) {
          if (file.url) {
            try {
              const filePath = path.join(process.cwd(), file.url);
              if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
              }
            } catch (fileErr) {
              console.error("Error deleting file:", fileErr);
            }
          }
        }
      }

      if (message.fileUrl) {
        try {
          const filePath = path.join(process.cwd(), message.fileUrl);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        } catch (fileErr) {
          console.error("Error deleting file:", fileErr);
        }
      }
    }

    // Delete all messages in the room
    const deleteResult = await Message.deleteMany({ chatRoomId: roomId });

    // Optionally delete the chat room itself
    // Uncomment the following lines if you want to delete the room as well
    // await ChatRoom.findByIdAndDelete(roomId);

    // Emit socket event to notify all participants
    try {
      const io = req?.app?.locals?.io;
      if (io) {
        room.participants.forEach((participantId) => {
          io.to(participantId.toString()).emit("chatRoomDeleted", {
            roomId: roomId,
          });
        });
      }
    } catch (emitErr) {
      console.error("Failed to emit chatRoomDeleted:", emitErr);
    }

    return res.status(200).json({
      message: "Chat room messages deleted successfully",
      deletedCount: deleteResult.deletedCount,
      roomId: roomId,
    });
  } catch (err) {
    console.error("Delete Chat Room Error:", err);
    return res
      .status(500)
      .json({ message: "Failed to delete chat room", error: err.message });
  }
};

// Delete a single message from group chat
export const deleteGroupMessage = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res
        .status(401)
        .json({ message: "Authentication failed: User not authenticated" });
    }

    const { messageId } = req.params;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      return res.status(400).json({ message: "Invalid message ID" });
    }

    const message = await GroupMessage.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    // Check if user is authorized (must be participant and sender)
    const groupRoom = await GroupChatRoom.findOne({
      _id: message.groupChatRoomId,
      participants: userId,
    });

    if (!groupRoom) {
      return res
        .status(403)
        .json({ message: "Not authorized to delete this message" });
    }

    // Only sender can delete their own message
    if (message.sender.toString() !== userId.toString()) {
      return res
        .status(403)
        .json({ message: "You can only delete your own messages" });
    }

    // Delete associated files if they exist
    if (message.files && Array.isArray(message.files)) {
      for (const file of message.files) {
        if (file.url) {
          try {
            const filePath = path.join(process.cwd(), file.url);
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
            }
          } catch (fileErr) {
            console.error("Error deleting file:", fileErr);
          }
        }
      }
    }

    if (message.fileUrl) {
      try {
        const filePath = path.join(process.cwd(), message.fileUrl);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (fileErr) {
        console.error("Error deleting file:", fileErr);
      }
    }

    await GroupMessage.findByIdAndDelete(messageId);

    // Emit socket event to notify group participants
    try {
      const io = req?.app?.locals?.io;
      if (io) {
        io.to(message.groupChatRoomId.toString()).emit("groupMessageDeleted", {
          messageId: messageId,
          groupChatRoomId: message.groupChatRoomId.toString(),
        });
      }
    } catch (emitErr) {
      console.error("Failed to emit groupMessageDeleted:", emitErr);
    }

    return res.status(200).json({
      message: "Group message deleted successfully",
      deletedMessageId: messageId,
    });
  } catch (err) {
    console.error("Delete Group Message Error:", err);
    return res
      .status(500)
      .json({ message: "Failed to delete group message", error: err.message });
  }
};

// Delete all messages in a group chat room
export const deleteGroupChatRoom = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res
        .status(401)
        .json({ message: "Authentication failed: User not authenticated" });
    }

    const { groupRoomId } = req.params;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(groupRoomId)) {
      return res.status(400).json({ message: "Invalid group room ID" });
    }

    const groupRoom = await GroupChatRoom.findOne({
      _id: groupRoomId,
      participants: userId,
    });

    if (!groupRoom) {
      return res
        .status(403)
        .json({ message: "Not authorized to delete this group chat room" });
    }

    // Get all messages in the room to delete associated files
    const messages = await GroupMessage.find({ groupChatRoomId: groupRoomId });

    // Delete associated files
    for (const message of messages) {
      if (message.files && Array.isArray(message.files)) {
        for (const file of message.files) {
          if (file.url) {
            try {
              const filePath = path.join(process.cwd(), file.url);
              if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
              }
            } catch (fileErr) {
              console.error("Error deleting file:", fileErr);
            }
          }
        }
      }

      if (message.fileUrl) {
        try {
          const filePath = path.join(process.cwd(), message.fileUrl);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        } catch (fileErr) {
          console.error("Error deleting file:", fileErr);
        }
      }
    }

    // Delete all messages in the group room
    const deleteResult = await GroupMessage.deleteMany({
      groupChatRoomId: groupRoomId,
    });

    // Emit socket event to notify all participants
    try {
      const io = req?.app?.locals?.io;
      if (io) {
        groupRoom.participants.forEach((participantId) => {
          io.to(participantId.toString()).emit("groupChatRoomDeleted", {
            groupRoomId: groupRoomId,
          });
        });
      }
    } catch (emitErr) {
      console.error("Failed to emit groupChatRoomDeleted:", emitErr);
    }

    return res.status(200).json({
      message: "Group chat room messages deleted successfully",
      deletedCount: deleteResult.deletedCount,
      groupRoomId: groupRoomId,
    });
  } catch (err) {
    console.error("Delete Group Chat Room Error:", err);
    return res.status(500).json({
      message: "Failed to delete group chat room",
      error: err.message,
    });
  }
};

// Delete a single message from course chat (soft delete)
export const deleteCourseChatMessage = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res
        .status(401)
        .json({ message: "Authentication failed: User not authenticated" });
    }

    const { messageId } = req.params;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      return res.status(400).json({ message: "Invalid message ID" });
    }

    const message = await CourseChatMessage.findById(messageId);
    if (!message || message.isDeleted) {
      return res.status(404).json({ message: "Message not found" });
    }

    // Check if user is authorized (must be participant)
    const courseChatRoom = await CourseChatRoom.findOne({
      _id: message.courseChatRoomId,
      participants: userId,
      isActive: true,
    });

    if (!courseChatRoom) {
      return res
        .status(403)
        .json({ message: "Not authorized to delete this message" });
    }

    // Only sender can delete their own message
    if (message.sender.toString() !== userId.toString()) {
      return res
        .status(403)
        .json({ message: "You can only delete your own messages" });
    }

    // Soft delete: set isDeleted to true
    message.isDeleted = true;
    await message.save();

    // Emit socket event to notify course chat participants
    try {
      const io = req?.app?.locals?.io;
      if (io) {
        io.to(`course_${message.courseChatRoomId.toString()}`).emit(
          "courseChatMessageDeleted",
          {
            messageId: messageId,
            courseChatRoomId: message.courseChatRoomId.toString(),
          }
        );
      }
    } catch (emitErr) {
      console.error("Failed to emit courseChatMessageDeleted:", emitErr);
    }

    return res.status(200).json({
      message: "Course chat message deleted successfully",
      deletedMessageId: messageId,
    });
  } catch (err) {
    console.error("Delete Course Chat Message Error:", err);
    return res.status(500).json({
      message: "Failed to delete course chat message",
      error: err.message,
    });
  }
};

// Delete all messages in a course chat room (soft delete)
export const deleteCourseChatRoom = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res
        .status(401)
        .json({ message: "Authentication failed: User not authenticated" });
    }

    const { courseChatRoomId } = req.params;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(courseChatRoomId)) {
      return res.status(400).json({ message: "Invalid course chat room ID" });
    }

    const courseChatRoom = await CourseChatRoom.findOne({
      _id: courseChatRoomId,
      participants: userId,
      isActive: true,
    });

    if (!courseChatRoom) {
      return res.status(403).json({
        message: "Not authorized to delete this course chat room",
      });
    }

    // Soft delete: set isDeleted to true for all messages in the room
    const updateResult = await CourseChatMessage.updateMany(
      { courseChatRoomId: courseChatRoomId, isDeleted: false },
      { $set: { isDeleted: true } }
    );

    // Emit socket event to notify all participants
    try {
      const io = req?.app?.locals?.io;
      if (io) {
        io.to(`course_${courseChatRoomId.toString()}`).emit(
          "courseChatRoomDeleted",
          {
            courseChatRoomId: courseChatRoomId,
          }
        );
      }
    } catch (emitErr) {
      console.error("Failed to emit courseChatRoomDeleted:", emitErr);
    }

    return res.status(200).json({
      message: "Course chat room messages deleted successfully",
      modifiedCount: updateResult.modifiedCount,
      courseChatRoomId: courseChatRoomId,
    });
  } catch (err) {
    console.error("Delete Course Chat Room Error:", err);
    return res.status(500).json({
      message: "Failed to delete course chat room",
      error: err.message,
    });
  }
};

// Remove a participant from a course chat room (admin only)
export const removeCourseChatParticipant = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res
        .status(401)
        .json({ message: "Authentication failed: User not authenticated" });
    }

    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied: Only admins can remove participants",
      });
    }

    const { courseChatRoomId, participantId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(courseChatRoomId)) {
      return res.status(400).json({ message: "Invalid course chat room ID" });
    }
    if (!mongoose.Types.ObjectId.isValid(participantId)) {
      return res.status(400).json({ message: "Invalid participant ID" });
    }

    const courseChatRoom = await CourseChatRoom.findById(courseChatRoomId);
    if (!courseChatRoom || !courseChatRoom.isActive) {
      return res.status(404).json({ message: "Course chat room not found" });
    }

    const participantIndex = courseChatRoom.participants.findIndex(
      (p) => p.toString() === participantId
    );
    if (participantIndex === -1) {
      return res.status(404).json({ message: "Participant not found in this course chat room" });
    }

    // Prevent removing the admin themselves
    if (participantId === req.user._id.toString()) {
      return res.status(400).json({ message: "Admin cannot remove themselves" });
    }

    courseChatRoom.participants.splice(participantIndex, 1);
    await courseChatRoom.save();

    // Emit socket event to notify room participants
    try {
      const io = req?.app?.locals?.io;
      if (io) {
        io.to(`course_${courseChatRoomId.toString()}`).emit(
          "participantRemoved",
          {
            courseChatRoomId,
            participantId,
            removedBy: req.user._id,
          }
        );
      }
    } catch (emitErr) {
      console.error("Failed to emit participantRemoved:", emitErr);
    }

    return res.status(200).json({
      success: true,
      message: "Participant removed from course chat room successfully",
      data: {
        courseChatRoomId,
        participantId,
      },
    });
  } catch (err) {
    console.error("Remove Course Chat Participant Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to remove participant",
      error: err.message,
    });
  }
};