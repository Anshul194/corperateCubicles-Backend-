import mongoose, { Schema } from "mongoose";

const settingSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    value: { type: Schema.Types.Mixed, required: true },
    description: { type: String },
  },
  { timestamps: true }
);

// Create a default GST rate setting if it doesn't exist
settingSchema.statics.getGstRate = async function () {
  let setting = await this.findOne({ key: "gstRate" });
  if (!setting) {
    setting = await this.create({
      key: "gstRate",
      value: 0.18, // Default GST rate of 18%
      description: "Default GST rate for order calculations",
    });
  }
  return parseFloat(setting.value);
};

// CHANGE: Added method to get default enrolledStudentsCount
settingSchema.statics.getDefaultEnrolledStudentsCount = async function () {
  let setting = await this.findOne({ key: "defaultEnrolledStudentsCount" });
  if (!setting) {
    setting = await this.create({
      key: "defaultEnrolledStudentsCount",
      value: 10, // Default enrolled students count
      description: "Default enrolled students count for courses",
    });
  }
  return parseInt(setting.value);
};

// Add singleton pattern to prevent model recompilation
const Setting =
  mongoose.model.Setting || mongoose.model("Setting", settingSchema);

export default Setting;