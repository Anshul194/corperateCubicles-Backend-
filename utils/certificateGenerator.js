import fs from 'fs';
import path from 'path';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export const generateCertificatePDF = async ({ template, certificateData }) => {
  try {
    if (!template || !certificateData) {
      throw new Error('Missing template or certificateData');
    }

    //console.log('Generating PDF with template:', JSON.stringify(template, null, 2));
    //console.log('Certificate Data:', JSON.stringify(certificateData, null, 2));

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]); // A4 size in points

    // Embed fonts
    let helveticaFont, helveticaBoldFont;
    try {
      helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    } catch (fontError) {
      throw new Error(`Failed to embed fonts: ${fontError.message}`);
    }

    // Add background image if available
    if (template.image) {
      const imagePath = path.join(process.cwd(), template.image);
      //console.log('Checking background image path:', imagePath);
      if (fs.existsSync(imagePath)) {
        try {
          const imageBytes = fs.readFileSync(imagePath);
          const image = await pdfDoc.embedJpg(imageBytes); // or embedPng based on format
          page.drawImage(image, {
            x: 0,
            y: 0,
            width: 595,
            height: 842,
          });
        } catch (imageError) {
          console.warn(`Failed to embed background image: ${imageError.message}`);
        }
      } else {
        console.warn(`Background image not found at: ${imagePath}`);
      }
    }

    // Parse hex color to RGB with validation
    const parseColor = (hex) => {
      if (!hex || typeof hex !== 'string') {
        console.warn(`Invalid hex color: ${hex}, defaulting to #000000`);
        return [0, 0, 0];
      }
      let normalizedHex = hex;
      if (hex.match(/^#[0-9A-Fa-f]{3}$/)) {
        normalizedHex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
      }
      if (!/^#[0-9A-Fa-f]{6}$/.test(normalizedHex)) {
        console.warn(`Invalid hex color: ${hex}, defaulting to #000000`);
        return [0, 0, 0];
      }
      try {
        const r = parseInt(normalizedHex.slice(1, 3), 16) / 255;
        const g = parseInt(normalizedHex.slice(3, 5), 16) / 255;
        const b = parseInt(normalizedHex.slice(5, 7), 16) / 255;
        if (isNaN(r) || isNaN(g) || isNaN(b)) {
          console.warn(`Failed to parse hex color: ${hex}, defaulting to #000000`);
          return [0, 0, 0];
        }
        return [r, g, b];
      } catch (error) {
        console.warn(`Error parsing hex color: ${hex}, defaulting to #000000`);
        return [0, 0, 0];
      }
    };

    // Helper function to draw text
    const drawText = (text, x, y, element) => {
      if (!text || typeof text !== 'string') {
        console.warn(`Skipping invalid text: ${text}`);
        return;
      }
      try {
        page.drawText(text, {
          x,
          y,
          size: element.font_size || 12,
          color: rgb(...parseColor(element.font_color || '#000000')),
          font: element.font_weight_bold ? helveticaBoldFont : helveticaFont,
        });
      } catch (textError) {
        console.warn(`Failed to draw text "${text}": ${textError.message}`);
      }
    };

    // Render template elements
    const elements = template.elements || {};
    let yPosition = 700; // Starting Y position

    //console.log('Template Elements:', JSON.stringify(elements, null, 2));

    // Draw student name
    if (elements.student_name?.enable && certificateData.student_name) {
      drawText(certificateData.student_name, 50, yPosition, elements.student_name);
      yPosition -= (elements.student_name.font_size || 12) + 20;
    }

    // Draw course name
    if (elements.title?.enable && certificateData.course_name) {
      drawText(certificateData.course_name, 50, yPosition, elements.title);
      yPosition -= (elements.title.font_size || 12) + 20;
    }

    // Draw completion date
    if (elements.date?.enable && certificateData.completion_date) {
      const dateText = elements.date.display_date === 'textual'
        ? certificateData.completion_date.toLocaleDateString('en-US', { dateStyle: 'full' })
        : certificateData.completion_date.toISOString().split('T')[0];
      drawText(dateText, 50, yPosition, elements.date);
      yPosition -= (elements.date.font_size || 12) + 20;
    }

    // Draw instructor name
    if (elements.instructor_name?.enable && certificateData.instructor_name) {
      drawText(certificateData.instructor_name, 50, yPosition, elements.instructor_name);
      yPosition -= (elements.instructor_name.font_size || 12) + 20;
    }

    // Draw platform name
    if (elements.platform_name?.enable && certificateData.platform_name) {
      drawText(certificateData.platform_name, 50, yPosition, elements.platform_name);
      yPosition -= (elements.platform_name.font_size || 12) + 20;
    }

    // Add QR code if available
    if (certificateData.qr_code) {
      const qrImagePath = path.join(process.cwd(), certificateData.qr_code);
      //console.log('Checking QR code path:', qrImagePath);
      if (fs.existsSync(qrImagePath)) {
        try {
          const qrImageBytes = fs.readFileSync(qrImagePath);
          const qrImage = await pdfDoc.embedPng(qrImageBytes);
          page.drawImage(qrImage, {
            x: 450,
            y: 50,
            width: parseInt(elements.qr_code?.image_size || '128'),
            height: parseInt(elements.qr_code?.image_size || '128'),
          });
        } catch (qrError) {
          console.warn(`Failed to embed QR code: ${qrError.message}`);
        }
      } else {
        console.warn(`QR code image not found at: ${qrImagePath}`);
      }
    }

    // Add platform signature
    if (elements.platform_signature?.enable && elements.platform_signature.image) {
      const signaturePath = path.join(process.cwd(), elements.platform_signature.image);
      //console.log('Checking signature path:', signaturePath);
      if (fs.existsSync(signaturePath)) {
        try {
          const signatureBytes = fs.readFileSync(signaturePath);
          const signatureImage = await pdfDoc.embedPng(signatureBytes);
          page.drawImage(signatureImage, {
            x: 50,
            y: 50,
            width: parseInt(elements.platform_signature.image_size || '128'),
            height: parseInt(elements.platform_signature.image_size || '128'),
          });
        } catch (signatureError) {
          console.warn(`Failed to embed signature: ${signatureError.message}`);
        }
      } else {
        console.warn(`Signature image not found at: ${signaturePath}`);
      }
    }

    // Add stamp
    if (elements.stamp?.enable && elements.stamp.image) {
      const stampPath = path.join(process.cwd(), elements.stamp.image);
      //console.log('Checking stamp path:', stampPath);
      if (fs.existsSync(stampPath)) {
        try {
          const stampBytes = fs.readFileSync(stampPath);
          const stampImage = await pdfDoc.embedPng(stampBytes);
          page.drawImage(stampImage, {
            x: 400,
            y: 50,
            width: parseInt(elements.stamp.image_size || '128'),
            height: parseInt(elements.stamp.image_size || '128'),
          });
        } catch (stampError) {
          console.warn(`Failed to embed stamp: ${stampError.message}`);
        }
      } else {
        console.warn(`Stamp image not found at: ${stampPath}`);
      }
    }

    // Save PDF
    const pdfBytes = await pdfDoc.save();
    const fileName = `certificate-${Date.now()}.pdf`;
    const filePath = path.join('uploads', fileName).replace(/\\/g, '/');
    //console.log('Saving PDF to:', filePath);

    // Ensure uploads directory exists
    if (!fs.existsSync(path.join(process.cwd(), 'uploads'))) {
      fs.mkdirSync(path.join(process.cwd(), 'uploads'), { recursive: true });
    }

    fs.writeFileSync(path.join(process.cwd(), filePath), pdfBytes);

    return filePath;
  } catch (error) {
    console.error('Detailed PDF Generation Error:', error);
    throw new Error(`Error generating certificate PDF: ${error.message || 'Unknown error'}`);
  }
};