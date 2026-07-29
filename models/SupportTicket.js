// models/SupportTicket.js
import mongoose from 'mongoose';

const ticketSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  subject: { type: String, required: true },
  category: { type: String, enum: ['technical', 'billing', 'course', 'general'], required: true },
  description: { type: String, required: true },
  status: { type: String, enum: ['open', 'in_progress', 'resolved', 'closed'], default: 'open' },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  // assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  messages: [
    {
      sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      message: { type: String, default: '' },
      attachments: [String],
      timestamp: { type: Date, default: Date.now }
    }
  ],
  attachments: [String],
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

export default mongoose.model('SupportTicket', ticketSchema);
