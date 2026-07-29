import mongoose from 'mongoose';

const { Schema } = mongoose;

// Schema for elements without image support
const textElementSchema = new Schema({
  content: { type: String, default: '' },
  font_size: { type: Number, min: 0 },
  font_color: { type: String, match: /^#[0-9A-Fa-f]{6}$/, default: '#000000' },
  styles: { type: String, default: '' },
  font_weight_bold: { type: Boolean, default: false },
  text_center: { type: Boolean, default: false },
  text_right: { type: Boolean, default: false },
  enable: { type: Boolean, default: false },
  display_date: { type: String, enum: ['textual', 'numerical'], default: 'textual' },
  position_x: { type: Number, default: 0 },
  position_y: { type: Number, default: 0 },
  draggable: { type: Boolean, default: true },
}, { _id: false });

// Schema for elements with image support
const imageElementSchema = new Schema({
  content: { type: String, default: '' },
  font_color: { type: String, match: /^#[0-9A-Fa-f]{6}$/, default: '#000000' },
  styles: { type: String, default: '' },
  font_weight_bold: { type: Boolean, default: false },
  text_center: { type: Boolean, default: false },
  text_right: { type: Boolean, default: false },
  enable: { type: Boolean, default: false },
  image_size: { type: String, enum: ['128', '192', '256'], default: '128' },
  image: { type: String, default: '' },
  position_x: { type: Number, default: 0 },
  position_y: { type: Number, default: 0 },
  draggable: { type: Boolean, default: true },
}, { _id: false });

// Schema for qr_code (no font_size, has image_size)
const qrCodeElementSchema = new Schema({
  content: { type: String, default: '' },
  font_color: { type: String, match: /^#[0-9A-Fa-f]{6}$/, default: '#000000' },
  styles: { type: String, default: '' },
  font_weight_bold: { type: Boolean, default: false },
  text_center: { type: Boolean, default: false },
  text_right: { type: Boolean, default: false },
  enable: { type: Boolean, default: false },
  image_size: { type: String, enum: ['128', '192', '256'], default: '128' },
  position_x: { type: Number, default: 0 },
  position_y: { type: Number, default: 0 },
  draggable: { type: Boolean, default: true },
}, { _id: false });

const certificateTemplateSchema = new Schema({
  locale: { type: String, enum: ['EN', 'AR', 'ES'], required: true },
  title: { type: String, required: true },
  image: { type: String, default: '' },
  type: { type: String, enum: ['quiz', 'course', 'bundle'], required: true },
  status: { type: String, enum: ['draft', 'publish'], default: 'draft' },
  template_contents: { type: String, default: '<div class="certificate-template-container"></div>' },
  elements: {
    title: { type: textElementSchema, default: () => ({}) },
    subtitle: { type: textElementSchema, default: () => ({}) },
    body: { type: textElementSchema, default: () => ({}) },
    date: { type: textElementSchema, default: () => ({ content: '[date]', display_date: 'textual' }) },
    qr_code: { type: qrCodeElementSchema, default: () => ({ content: '[qr_code]', image_size: '192' }) },
    hint: { type: textElementSchema, default: () => ({}) },
    student_name: { type: textElementSchema, default: () => ({ content: '[student_name]' }) },
    instructor_name: { type: textElementSchema, default: () => ({ content: '' }) },
    // instructor_name: { type: textElementSchema, default: () => ({ content: '[instructor_name]' }) },
    platform_name: { type: textElementSchema, default: () => ({ content: '' }) },
    // platform_name: { type: textElementSchema, default: () => ({ content: '[platform_name]' }) },
    user_certificate_additional: { type: textElementSchema, default: () => ({ content: '[user_certificate_additional]' }) },
    platform_signature: { type: imageElementSchema, default: () => ({ content: '[platform_signature]', image_size: '128' }) },
    stamp: { type: imageElementSchema, default: () => ({ content: '[stamp]', image_size: '128' }) },
  },
  created_by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

// Validation for elements
certificateTemplateSchema.pre('validate', function (next) {
  if (this.elements) {
    const elements = this.elements;
    if (elements.date && !elements.date.display_date) {
      elements.date.display_date = 'textual';
    }
    ['qr_code', 'platform_signature', 'stamp'].forEach(key => {
      if (elements[key] && !elements[key].image_size) {
        elements[key].image_size = '128';
      }
    });
    Object.keys(elements).forEach(key => {
      if (elements[key] && elements[key].font_color && !/^#[0-9A-Fa-f]{6}$/.test(elements[key].font_color)) {
        elements[key].font_color = '#000000';
      }
    });
  }
  next();
});

const CertificateTemplate = mongoose.models.CertificateTemplate || mongoose.model('CertificateTemplate', certificateTemplateSchema);

export default CertificateTemplate;