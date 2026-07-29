import mongoose from 'mongoose';
const { Schema } = mongoose;

const certificateAssignSchema = new Schema({
  student: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  course: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
  template: { type: Schema.Types.ObjectId, ref: 'CertificateTemplate', required: true },
  status: { type: String, enum: ['issued', 'revoked'], default: 'issued' },
  issued_date: { type: Date, default: Date.now },
  certificate_data: {
    completion_date: { type: Date, required: true },
    platform_name: { type: String, required: true },
  },
  certificate_url: { type: String, required: true },
  created_by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  updated_by: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

const CertificateAssign = mongoose.models.CertificateAssign || mongoose.model('CertificateAssign', certificateAssignSchema);

export default CertificateAssign;