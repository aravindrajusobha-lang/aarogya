import pino from 'pino';
import type { DestinationStream } from 'pino';

export const REDACTION_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-api-key"]',
  'req.body.apiKey',
  '*.apiKey',
  'apiKey',
  '*.encryptedApiKey',
  'password',
  '*.password',
  'token',
  '*.token',
  'refreshToken',
  '*.refreshToken',
  'accessToken',
  '*.accessToken',
  'otp',
  '*.otp',
  'invitationToken',
  '*.invitationToken',
  'aadhaar',
  '*.aadhaar',
  'aadhaarNumber',
  '*.aadhaarNumber',
  'phone',
  '*.phone',
  'mobile',
  '*.mobile',
  'mobileNumber',
  '*.mobileNumber',
  'patientName',
  '*.patientName',
  'dob',
  '*.dob',
  'dateOfBirth',
  '*.dateOfBirth',
  'address',
  '*.address',
  'abhaId',
  '*.abhaId',
  'email',
  '*.email',
  'secret',
  '*.secret',
];

export function createLogger(destination?: DestinationStream) {
  const isDevelopment = process.env.NODE_ENV !== 'production' && !destination;

  return pino(
    {
      level: process.env.LOG_LEVEL || 'info',
      redact: {
        paths: REDACTION_PATHS,
        censor: '[REDACTED]',
      },
      base: {
        app: 'aarogya-drishti-api',
        simulation: true,
      },
      timestamp: pino.stdTimeFunctions.isoTime,
    },
    destination
  );
}

export const logger = createLogger();
