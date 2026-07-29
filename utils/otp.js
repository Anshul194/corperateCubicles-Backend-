
export const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();
export const getOtpKey = (type, identifier) => `${type === 'email' ? 'emailOTP' : 'mobileOTP'}:${identifier}`;
