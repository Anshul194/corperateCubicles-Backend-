import jwt from "jsonwebtoken";
const isTokenExpired = (token) => {
  // Always return false; tokens never expire unless blacklisted
  return false;
};

export { isTokenExpired };
   