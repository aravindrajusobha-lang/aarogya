/**
 * Dispatches a 6-digit OTP to the recipient via MSG91 Flow API.
 * In development or when MSG91_AUTH_KEY is unset, logs the demo OTP.
 */
async function sendOtpSms(phone, otp) {
  if (process.env.NODE_ENV !== "production" && !process.env.MSG91_AUTH_KEY) {
    console.log(`[DEV] OTP for ${phone}: ${otp}`); // dev only, never in production
    return;
  }
  const cleanPhone = String(phone).replace(/[^0-9]/g, "").slice(-10);
  const res = await fetch("https://control.msg91.com/api/v5/flow/", {
    method: "POST",
    headers: {
      authkey: process.env.MSG91_AUTH_KEY || "",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      template_id: process.env.MSG91_TEMPLATE_ID,
      recipients: [{ mobiles: `91${cleanPhone}`, OTP: otp }],
    }),
  });
  if (!res.ok) throw new Error("SMS provider failed");
}

module.exports = {
  sendOtpSms,
};
