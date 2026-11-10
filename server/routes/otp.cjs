const router = require("express").Router();
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const rateLimit = require("express-rate-limit");
const Otp = require("../models/Otp");
const { sendOtpSms } = require("../services/sms");

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });
const validPhone = (p) => /^[6-9]\d{9}$/.test(p);

// In-memory fallback store
const inMemoryOtpStore = new Map();

router.post("/send", limiter, async (req, res) => {
  const { phone, purpose = "REGISTER" } = req.body || {};
  if (!validPhone(phone)) return res.status(400).json({ message: "Invalid phone number" });

  const key = `${phone}:${purpose}`;
  let lastCreatedAt = null;

  if (mongoose.connection && mongoose.connection.readyState === 1) {
    const last = await Otp.findOne({ phone, purpose }).sort({ createdAt: -1 }).catch(() => null);
    if (last && last.createdAt) {
      lastCreatedAt = new Date(last.createdAt).getTime();
    }
  } else {
    const lastMem = inMemoryOtpStore.get(key);
    if (lastMem) {
      lastCreatedAt = lastMem.createdAt.getTime();
    }
  }

  if (lastCreatedAt && Date.now() - lastCreatedAt < 30 * 1000)
    return res.status(429).json({ message: "Wait 30 seconds before requesting again" });

  const isLiveSms = Boolean(process.env.MSG91_AUTH_KEY && process.env.NODE_ENV === "production");
  const otp = isLiveSms ? String(crypto.randomInt(100000, 1000000)) : "123456";
  const codeHash = await bcrypt.hash(otp, 8);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  const now = new Date();

  if (mongoose.connection && mongoose.connection.readyState === 1) {
    await Otp.deleteMany({ phone, purpose }).catch(() => null);
    await Otp.create({
      phone,
      purpose,
      codeHash,
      expiresAt,
    }).catch(() => null);
  }

  inMemoryOtpStore.set(key, {
    phone,
    purpose,
    codeHash,
    attempts: 0,
    expiresAt,
    createdAt: now,
  });

  try {
    await sendOtpSms(phone, otp);
  } catch {
    return res.status(502).json({ message: "Could not send OTP, try again" });
  }
  res.json({ message: "OTP sent", demoOtp: !isLiveSms ? "123456" : undefined });
});

router.post("/verify", limiter, async (req, res) => {
  const { phone, otp, purpose = "REGISTER" } = req.body || {};
  const key = `${phone}:${purpose}`;

  const isLiveSms = Boolean(process.env.MSG91_AUTH_KEY && process.env.NODE_ENV === "production");
  const isDemoCode = !isLiveSms && String(otp || "").trim() === "123456";

  let rec = null;
  const isMongoActive = Boolean(mongoose.connection && mongoose.connection.readyState === 1);

  if (isMongoActive) {
    rec = await Otp.findOne({ phone, purpose }).catch(() => null);
  }
  if (!rec) {
    rec = inMemoryOtpStore.get(key);
  }

  if (!rec && !isDemoCode) {
    return res.status(400).json({ message: "OTP expired or not requested" });
  }

  if (rec && rec.attempts >= 5 && !isDemoCode) {
    inMemoryOtpStore.delete(key);
    if (isMongoActive && typeof rec.deleteOne === "function") {
      await rec.deleteOne().catch(() => null);
    }
    return res.status(429).json({ message: "Too many attempts" });
  }

  const match = isDemoCode || (rec && (await bcrypt.compare(String(otp || ""), rec.codeHash)));
  if (!match) {
    if (rec) {
      rec.attempts += 1;
      if (isMongoActive && typeof rec.save === "function") {
        await rec.save().catch(() => null);
      }
      inMemoryOtpStore.set(key, rec);
    }
    return res.status(400).json({ message: "Wrong OTP" });
  }

  inMemoryOtpStore.delete(key);
  if (isMongoActive && rec && typeof rec.deleteOne === "function") {
    await rec.deleteOne().catch(() => null);
  }

  const secret = process.env.JWT_SECRET || "aarogya-drishti-jwt-secret-default";
  const phoneToken = jwt.sign({ phone, purpose }, secret, { expiresIn: "10m" });
  res.json({ phoneToken, demoVerified: isDemoCode });
});

module.exports = router;
