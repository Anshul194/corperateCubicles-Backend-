import mongoose from 'mongoose';
import { ServerConfig } from '../config/server.config.js';

export const connectToDatabase = async () => {
  try {
    await mongoose.connect(ServerConfig.mongoURI);
    console.log('✅ Connected to MongoDB');
  } catch (err) {
    console.error('❌ Failed to connect to MongoDB:', err.message);
    process.exit(1);
    
  }
};
