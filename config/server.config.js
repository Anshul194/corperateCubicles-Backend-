import dotenv from 'dotenv';
dotenv.config();

export const ServerConfig = {
  port:5000,
  mongoURI: process.env.MONGO_URI,
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_TOKEN_SECRET_KEY,
};
