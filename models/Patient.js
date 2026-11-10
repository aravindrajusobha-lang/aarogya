const mongoose = require("mongoose");

const patientSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    age: Number,
    gender: String,
    phone: String,
    district: String,
    mandal: String,
    subcenter: { type: mongoose.Schema.Types.ObjectId, ref: "Subcenter" },
    registeredBy: { type: mongoose.Schema.Types.Mixed, ref: "User" },

    // Merged: Existing Aarogya-Drishti clinical screening fields
    patientId: { type: String, unique: true, sparse: true, index: true },
    fullName: { type: String },
    ageEstimated: { type: Number },
    originalAddressText: { type: String },
    hospitalId: { type: String },
    villageId: { type: String },
    villageName: { type: String },
    guardianName: { type: String },
    emergencyContact: { type: String },
    caregiverDetails: { type: String },
    maskedAadhaar: { type: String },
    registrationMethod: { type: String, default: 'manual' },
    consentObtained: { type: Boolean, default: true },
    history: { type: Array, default: [] },
    simulation: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Seamless sync between existing fullName/ageEstimated and new name/age
patientSchema.pre("validate", function (next) {
  if (!this.name && this.fullName) {
    this.name = this.fullName;
  }
  if (!this.fullName && this.name) {
    this.fullName = this.name;
  }
  if (!this.age && this.ageEstimated) {
    this.age = this.ageEstimated;
  }
  if (!this.ageEstimated && this.age) {
    this.ageEstimated = this.age;
  }
  next();
});

const Patient = mongoose.models.Patient || mongoose.model("Patient", patientSchema);
module.exports = Patient;
module.exports.Patient = Patient;
module.exports.default = Patient;

