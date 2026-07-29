import mongoose from 'mongoose';

const VdoCipherTokenSchema = new mongoose.Schema({
    videoId: String,
    userId: String,
    otp: String,
    playbackInfo: String,
    ttl: Number,
    createdAt: { type: Date, default: Date.now },
    expiresAt: Date,
    used: { type: Boolean, default: false }
});

const VdoCipherToken = mongoose.model('VdoCipherToken', VdoCipherTokenSchema);

export default VdoCipherToken;