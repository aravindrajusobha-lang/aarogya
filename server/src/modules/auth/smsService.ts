import { logger } from '../../config/logger.js';

/**
 * Dispatches a 6-digit OTP to the user's mobile number via MSG91 Flow API.
 * In development or when MSG91_AUTH_KEY is unset, logs the demo OTP without failing.
 */
export const sendOtpSms = async (phone: string, otp: string): Promise<void> => {
  if (process.env.NODE_ENV !== "production" && !process.env.MSG91_AUTH_KEY) {
    console.log(`[DEV] OTP for ${phone}: ${otp}`); // dev only, never in production
    logger.info({ phone: phone.slice(-4), simulation: true }, `[DEV] OTP generated for recipient: ${otp}`);
    return;
  }

  const cleanPhone = phone.replace(/[^0-9]/g, '').slice(-10);
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

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    logger.error({ status: res.status, errorText }, 'MSG91 SMS gateway request failed');
    throw new Error("SMS provider failed");
  }

  logger.info({ phone: cleanPhone.slice(-4) }, 'SMS OTP delivered to provider');
};

export default sendOtpSms;

