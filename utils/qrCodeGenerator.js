import QRCode from 'qrcode';

export const generateQRCode = async (data) => {
  try {
    const qrData = JSON.stringify(data);
    const qrCode = await QRCode.toDataURL(qrData);
    return qrCode;
  } catch (error) {
    throw new Error(`Error generating QR code: ${error.message}`);
  }
};