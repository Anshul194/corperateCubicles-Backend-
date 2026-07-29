import mongoose from "mongoose";
const { Schema } = mongoose;

const certificateSchema = new Schema(
  {
    user_id: { type: Schema.Types.ObjectId, ref: "User", required: true },
    course_id: { type: Schema.Types.ObjectId, ref: "Course", default: null },
    quiz_submission_id: { type: Schema.Types.ObjectId, ref: "QuizSubmission", default: null },
    bundle_id: { type: Schema.Types.ObjectId, ref: "CourseBundle", default: null },
    type: { type: String, enum: ["course", "quiz", "bundle"], required: true },
    status: { type: String, enum: ["issued", "revoked"], default: "issued" },
    issued_at: { type: Date, default: Date.now },
    certificate_url: { type: String, default: "" },
    certification_template: { type: Schema.Types.ObjectId, ref: "CertificateTemplate", default: null },
    serial_number: { type: String, unique: true },
    instructor_id: { type: Schema.Types.ObjectId, ref: "User"},
    instructor_name: { type: String},
    instructor_signature: { type: String, default: "" },
    remarks: { type: String, default: "" },
    grade: { type: String, default: "" },
    score: { type: Number, default: null },
    max_score: { type: Number, default: null },
    completion_date: { type: Date, default: null },
    total_duration: { type: String, default: "" },
    user_time_spent: { type: String, default: "" },
    final_grade: { type: String, default: "" },
  },
  {
    timestamps: true,
  }
);

// Add index for user_id
certificateSchema.index({ user_id: 1 });

// Prevent model redefinition
const Certificate = mongoose.models.Certificate || mongoose.model("Certificate", certificateSchema);

export default Certificate;