import VdoCipherToken from '../models/VdoCipherToken.js';

class VdoCipherTokenRepository {
    async create(tokenData) {
        const token = new VdoCipherToken(tokenData);
        return await token.save();
    }

    async findByVideoAndUser(videoId, userId) {
        return await VdoCipherToken.findOne({ videoId, userId });
    }

    async markAsUsed(tokenId) {
        return await VdoCipherToken.findByIdAndUpdate(
            tokenId, 
            { used: true, updatedAt: new Date() }
        );
    }
}

export default new VdoCipherTokenRepository();