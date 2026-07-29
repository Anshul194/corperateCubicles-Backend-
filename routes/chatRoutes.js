import express from "express";
import {
  createOrGetChatRoom,
  getAllChatRooms,
  getMessages,
  sendMessage,
  markMessagesAsRead,
  updateMessagePin,
  deleteMessage,
  deleteChatRoom,
  createOrGetGroupChatRoom,
  getAllGroupChatRooms,
  getGroupMessages,
  sendGroupMessage,
  markGroupMessagesAsRead,
  deleteGroupMessage,
  deleteGroupChatRoom,
  createOrGetCourseChatRoom,
  getAllCourseChatRooms,
  getCourseChatMessages,
  sendCourseChatMessage,
  updateCourseMessagePin,
  markCourseChatMessagesAsRead,
  getCourseChatParticipants,
  createAllCourseChatRooms,
  deleteCourseChatMessage,
  deleteCourseChatRoom,
  removeCourseChatParticipant,
} from "../controllers/chatController.js";
import accessTokenAutoRefresh from "../middlewares/accessTokenAutoRefresh.js";
import passport from "passport";
import upload from "../middlewares/upload.js"; // added middleware import

const router = express.Router();

// Debug middleware to log requests
router.use((req, res, next) => {
  if (req.path === '/message' && req.method === 'POST') {
    console.log(' POST /chat/message request received:', {
      path: req.path,
      method: req.method,
      hasUser: !!req.user,
      userId: req.user?._id,
      body: req.body,
      hasFiles: !!(req.files && req.files.length > 0)
    });
  }
  next();
});

// Apply JWT authentication
router.use(accessTokenAutoRefresh);
router.use(passport.authenticate("jwt", { session: false }));

// Chat API endpoints
router.post("/room", createOrGetChatRoom); // POST /chat/room
router.get("/rooms", getAllChatRooms); // GET /chat/rooms
router.get("/messages/:roomId", getMessages); // GET /chat/messages/:roomId
router.post("/message", upload.array("files", 8), sendMessage); // POST /chat/message (supports files via field 'files')
router.patch("/message/read", markMessagesAsRead); // PATCH /chat/message/read
router.patch("/message/:id/pin", updateMessagePin); // PATCH /chat/message/:id/pin
router.delete("/message/:messageId", deleteMessage); // DELETE /chat/message/:messageId - delete single message
router.delete("/room/:roomId", deleteChatRoom); // DELETE /chat/room/:roomId - delete all messages in chat room

// Group Chat API endpoints (new)
router.post("/group/room", createOrGetGroupChatRoom); // POST /chat/group/room - body: { participants: [userId1, userId2, ...] } (excluding sender, min 2 for group)
router.get("/group/rooms", getAllGroupChatRooms); // GET /chat/group/rooms
router.get("/group/messages/:groupRoomId", getGroupMessages); // GET /chat/group/messages/:groupRoomId
router.post("/group/message", upload.array("files", 8), sendGroupMessage); // POST /chat/group/message - supports files via field 'files' and optional emoji
router.patch("/group/message/read", markGroupMessagesAsRead); // PATCH /chat/group/message/read - body: { groupRoomId }
router.delete("/group/message/:messageId", deleteGroupMessage); // DELETE /chat/group/message/:messageId - delete single group message
router.delete("/group/room/:groupRoomId", deleteGroupChatRoom); // DELETE /chat/group/room/:groupRoomId - delete all messages in group chat room

// Course Chat API endpoints (new)
router.post("/course/room", createOrGetCourseChatRoom); // POST /chat/course/room - body: { courseId } (participants added automatically from enrolled students + fixed users)
router.post("/course/create-all-rooms", createAllCourseChatRooms); // POST /chat/course/create-all-rooms - creates rooms for all existing courses with enrolled students + fixed users
router.get("/course/rooms", getAllCourseChatRooms); // GET /chat/course/rooms
router.get("/course/messages/:courseChatRoomId", getCourseChatMessages); // GET /chat/course/messages/:courseChatRoomId
// Allow optional multiple file upload in field 'files' (multipart/form-data) or JSON body with fileUrl
router.post("/course/message", upload.array("files", 8), sendCourseChatMessage); // POST /chat/course/message - body or multipart: { courseChatRoomId, message, ... }
router.patch("/course/message/:id/pin", updateCourseMessagePin); // PATCH /chat/course/message/:id/pin
router.patch("/course/message/read", markCourseChatMessagesAsRead); // PATCH /chat/course/message/read - body: { courseChatRoomId }
router.get("/course/participants/:courseChatRoomId", getCourseChatParticipants); // GET /chat/course/participants/:courseChatRoomId
router.delete("/course/message/:messageId", deleteCourseChatMessage); // DELETE /chat/course/message/:messageId - delete single course chat message (soft delete)
router.delete("/course/room/:courseChatRoomId", deleteCourseChatRoom); // DELETE /chat/course/room/:courseChatRoomId - delete all messages in course chat room (soft delete)
router.delete("/course/participant/:courseChatRoomId/:participantId", removeCourseChatParticipant); // DELETE /chat/course/participant/:courseChatRoomId/:participantId - remove participant from course chat (admin only)

export default router;
