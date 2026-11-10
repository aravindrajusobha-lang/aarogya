const mongoose = require("mongoose");

const hospitalSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    district: String,
    mandal: String,
    isActive: { type: Boolean, default: true },

    // Merged: Existing Aarogya-Drishti hospital directory fields
    hospitalId: { type: String, unique: true, sparse: true, index: true },
    type: { type: String },
    state: { type: String, default: 'Andhra Pradesh' },
    address: { type: String },
    contactNumber: { type: String },
    services: { type: [String], default: [] },
    specialties: { type: [String], default: [] },
    jurisdictionVillages: { type: [String], default: [] },
    status: { type: String, default: 'active' },
    simulation: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const Hospital = mongoose.models.Hospital || mongoose.model("Hospital", hospitalSchema);
module.exports = Hospital;
module.exports.Hospital = Hospital;
module.exports.default = Hospital;
