const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    // Requested fields (User model)
    name: { type: String, required: true },
    employeeId: { type: String, unique: true, required: true, sparse: true },
    password: { type: String, select: false },
    roles: [{ type: String, enum: ["SUPER_ADMIN", "DISTRICT_ADMIN", "DOCTOR", "HEALTH_WORKER"] }],
    district: String,
    mandals: [String],
    permissions: [String],
    isActive: { type: Boolean, default: true },

    // Merged: Existing Aarogya-Drishti authentication & telemetry fields
    userId: { type: String, unique: true, sparse: true, index: true },
    username: { type: String, unique: true, sparse: true, lowercase: true, trim: true, index: true },
    fullName: { type: String },
    role: { type: String },
    phone: { type: String },
    patientId: { type: String, index: true },
    hospitalId: { type: String, index: true },
    passwordHash: { type: String },
    mfaEnabled: { type: Boolean, default: false },
    mfaSecret: { type: String },
    webauthnCredentials: { type: Array, default: [] },
    webauthnChallenge: { type: String },
    status: { type: String, default: 'active' },
    simulation: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Seamless sync between existing fullName/userId and new name/employeeId
userSchema.pre("validate", function (next) {
  if (!this.name && this.fullName) {
    this.name = this.fullName;
  }
  if (!this.fullName && this.name) {
    this.fullName = this.name;
  }
  if (!this.employeeId && this.userId) {
    this.employeeId = this.userId;
  }
  if (!this.userId && this.employeeId) {
    this.userId = this.employeeId;
  }
  next();
});

const User = mongoose.models.User || mongoose.model("User", userSchema);
module.exports = User;
module.exports.User = User;
module.exports.default = User;
