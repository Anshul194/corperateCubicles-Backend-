import AIChatRoom from '../models/AIChatRoom.js';
import AIMessage from '../models/AIMessage.js';
import aiService from '../service/aiService.js';
import mongoose from 'mongoose';

export const startOrContinueChat = async (req, res) => {
    try {
        if (!req.user || !req.user._id) {
            return res.status(401).json({ message: "Authentication failed" });
        }

        const userId = req.user._id;
        const { message, roomId } = req.body;

        if (!message) {
            return res.status(400).json({ message: "Message content is required" });
        }

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');

        let chatRoom;

        if (roomId) {
            if (!mongoose.Types.ObjectId.isValid(roomId)) {
                res.write(`event: error\ndata: ${JSON.stringify({ message: "Invalid Room ID" })}\n\n`);
                return res.end();
            }
            chatRoom = await AIChatRoom.findOne({ _id: roomId, user: userId });
            if (!chatRoom) {
                res.write(`event: error\ndata: ${JSON.stringify({ message: "Chat room not found" })}\n\n`);
                return res.end();
            }
        } else {
            const title = message.substring(0, 30) + (message.length > 30 ? "..." : "");
            chatRoom = await AIChatRoom.create({
                user: userId,
                title: title
            });
        }

        const userMsg = await AIMessage.create({
            chatRoomId: chatRoom._id,
            role: 'user',
            content: message
        });

        chatRoom.lastMessageAt = new Date();
        await chatRoom.save();

        const metaData = {
            chatRoomId: chatRoom._id,
            userMessage: userMsg
        };
        res.write(`event: meta\ndata: ${JSON.stringify(metaData)}\n\n`);

        let aiFullContent = "";

        try {
            for await (const chunk of aiService.streamResponse(userId, chatRoom._id, message)) {
                aiFullContent += chunk.content;
                res.write(`data: ${JSON.stringify({ content: chunk.content })}\n\n`);
            }
        } catch (streamErr) {
            console.error("Streaming error:", streamErr);
            res.write(`event: error\ndata: ${JSON.stringify({ message: "Error generating response" })}\n\n`);
        }

        if (aiFullContent) {
            const aiMsg = await AIMessage.create({
                chatRoomId: chatRoom._id,
                role: 'assistant',
                content: aiFullContent,
                model: 'gpt-4o-mini'
            });

            res.write(`event: done\ndata: ${JSON.stringify({ aiMessageId: aiMsg._id })}\n\n`);
        }

        res.end();

    } catch (err) {
        console.error("AI Chat Controller Error:", err);
        if (!res.headersSent) {
            return res.status(500).json({ message: "Internal Server Error", error: err.message });
        } else {
            res.write(`event: error\ndata: ${JSON.stringify({ message: "Internal Server Error" })}\n\n`);
            res.end();
        }
    }
};

export const getChatHistory = async (req, res) => {
    try {
        if (!req.user || !req.user._id) return res.status(401).json({ message: "Auth failed" });

        const history = await AIChatRoom.find({ user: req.user._id })
            .sort({ lastMessageAt: -1 })
            .limit(50);

        return res.status(200).json({ history });
    } catch (err) {
        return res.status(500).json({ message: "Failed to fetch history", error: err.message });
    }
};

export const getMessages = async (req, res) => {
    try {
        if (!req.user || !req.user._id) return res.status(401).json({ message: "Auth failed" });
        const { roomId } = req.params;

        const room = await AIChatRoom.findOne({ _id: roomId, user: req.user._id });
        if (!room) return res.status(404).json({ message: "Room not found" });

        const messages = await AIMessage.find({ chatRoomId: roomId })
            .sort({ createdAt: 1 });

        return res.status(200).json({ room, messages });
    } catch (err) {
        return res.status(500).json({ message: "Failed to fetch messages", error: err.message });
    }
};
