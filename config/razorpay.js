// config/razorpayConfig.js
import Razorpay from "razorpay";
import Setting from "../models/setting.js";

let razorpayInstance = null; // cache

const getRazorpayInstance = async () => {
    if (razorpayInstance) return razorpayInstance;

    // Fetch from DB
    const settings = await Setting.find({
        key: { $in: ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"] }
    }).select("key value");


    console?.log("Fetched Razorpay setting keys:", settings.map(s => s.key));

    const config = {};
    settings.forEach(s => {
        config[s.key] = s.value;
    });

    if (!config.RAZORPAY_KEY_ID || !config.RAZORPAY_KEY_SECRET) {
        throw new Error("Razorpay keys are missing in settings table");
    }

    razorpayInstance = new Razorpay({
        key_id: config.RAZORPAY_KEY_ID,
        key_secret: config.RAZORPAY_KEY_SECRET,
    });

    return razorpayInstance;
};

export default getRazorpayInstance;
