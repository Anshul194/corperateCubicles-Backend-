import AISettings from '../models/AISettings.js';

export const getAISettings = async (req, res) => {
    try {
        let settings = await AISettings.findOne();
        if (!settings) {
            settings = await AISettings.create({});
        }
        return res.status(200).json({ success: true, settings });
    } catch (error) {
        console.error('Error fetching AI settings:', error);
        return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

export const updateAISettings = async (req, res) => {
    try {
        let settings = await AISettings.findOne();
        if (!settings) {
            settings = new AISettings(req.body);
        } else {
            Object.assign(settings, req.body);
        }

        await settings.save();
        return res.status(200).json({ success: true, message: 'Settings updated successfully', settings });
    } catch (error) {
        console.error('Error updating AI settings:', error);
        return res.status(500).json({ success: false, message: 'Internal Server Error', error: error.message });
    }
};
