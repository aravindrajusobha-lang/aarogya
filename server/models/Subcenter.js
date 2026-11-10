const mongoose = require("mongoose");

const subcenterSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    district: String,
    mandal: String,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const Subcenter = mongoose.models.Subcenter || mongoose.model("Subcenter", subcenterSchema);
module.exports = Subcenter;
module.exports.Subcenter = Subcenter;
module.exports.default = Subcenter;
