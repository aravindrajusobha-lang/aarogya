const mongoose = require("mongoose");

const OtpSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, index: true },
    purpose: {
      type: String,
      enum: ["REGISTER", "LOGIN", "RESET"],
      default: "REGISTER",
      index: true,
    },
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true, expires: 0 }, // MongoDB deletes it automatically
  },
  { timestamps: true }
);

const Otp = mongoose.models.Otp || mongoose.model("Otp", OtpSchema);

module.exports = Otp;
module.exports.Otp = Otp;
module.exports.default = Otp;
