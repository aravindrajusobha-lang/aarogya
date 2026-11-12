import express, { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { envelopeMiddleware, notFoundHandler, errorHandler } from './middleware/envelope.js';
import { requestLogger } from './middleware/requestLogger.js';
import { healthRouter } from './modules/health/healthRoutes.js';
import { storageRouter } from './modules/storage/storageRoutes.js';
import { authRouter } from './modules/auth/authRoutes.js';
import { otpRouter } from './modules/auth/otpRoutes.js';
import { patientAuthRouter } from './modules/patient/patientAuthRoutes.js';
import { auditRouter } from './modules/audit/auditRoutes.js';
import { consentRouter } from './modules/consent/consentRoutes.js';
import { hospitalRouter } from './modules/hospital/hospitalRoutes.js';
import { invitationRouter } from './modules/invitation/invitationRoutes.js';
import { specialistRouter } from './modules/specialist/specialistRoutes.js';
import { assignmentRouter } from './modules/assignment/assignmentRoutes.js';
import { referenceRouter } from './modules/reference/referenceRoutes.js';
import { patientRouter } from './modules/patient/patientRoutes.js';
import { notificationRouter } from './modules/notification/notificationRoutes.js';
import { recoveryRouter } from './modules/recovery/recoveryRoutes.js';
import { villageGroupRouter } from './modules/villageGroup/villageGroupRoutes.js';
import { screeningRouter } from './modules/screening/screeningRoutes.js';
import { campRouter } from './modules/camp/campRoutes.js';
import { appointmentRouter } from './modules/appointment/appointmentRoutes.js';
import { biopsyRouter } from './modules/biopsy/biopsyRoutes.js';
import { referralRouter } from './modules/referral/referralRoutes.js';
import { teleconsultationRouter } from './modules/teleconsultation/teleconsultationRoutes.js';
import { consultationRouter } from './modules/consultation/consultationRoutes.js';
import { mapRouter } from './modules/map/mapRoutes.js';
import { reportRouter } from './modules/report/reportRoutes.js';
import { aadhaarMockRouter } from './modules/aadhaar/aadhaarMockRoutes.js';
import { syncRouter } from './modules/sync/syncRoutes.js';
import { assistantRouter } from './modules/assistant/assistantRoutes.js';
import { aiRouter } from './modules/ai/aiRoutes.js';
import { prescriptionRouter } from './modules/prescription/prescriptionRoutes.js';
import { patientReportChatRouter } from './modules/patient/patientReportChatRoutes.js';
import { patientSupportRouter } from './modules/patient/patientSupportRoutes.js';
import { patientTreatmentRouter } from './modules/treatment/patientTreatmentRoutes.js';
import { patientProfileRouter } from './modules/patient/patientProfileRoutes.js';



import { apiGlobalRateLimiter } from './middleware/rateLimiter.js';

export function createApp(): Express {
  const app = express();

  // Security headers
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
        },
      },
      crossOriginResourcePolicy: { policy: 'same-site' },
    })
  );

  // Allow camera access for this same-origin application while keeping other origins blocked.
  app.use((_req, res, next) => {
    res.setHeader('Permissions-Policy', 'camera=(self "https://*.daily.co")');
    next();
  });

  // CORS
  app.use(
    cors({
      origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'Accept-Language'],
    })
  );

  // Body parsers
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Standard response envelope & request ID
  app.use(envelopeMiddleware);

  // Request logger (Pino with strict redaction)
  app.use(requestLogger);

  // Privacy Header Guard: Prevent proxy and browser caching of sensitive clinical APIs
  app.use('/api/v1', (_req, res, next) => {
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  });

  // Global Sliding-Window Rate Limiter
  app.use('/api/v1', apiGlobalRateLimiter);
  app.use('/api/patient', apiGlobalRateLimiter);
  app.use('/api/patient', (_req, res, next) => {
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  });

  // Mount API Routes
  app.use('/api/health', healthRouter);
  app.use('/api/v1/health', healthRouter);
  app.use('/api/v1/storage', storageRouter);
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/patient/auth', patientAuthRouter);
  app.use('/api/patient', patientReportChatRouter);
  app.use('/api/patient', patientSupportRouter);
  app.use('/api/patient', patientTreatmentRouter);
  app.use('/api/patient', patientProfileRouter);
  app.use('/api/v1/audit', auditRouter);
  app.use('/api/v1/consent', consentRouter);

  // Phase 3 Administration Routes
  app.use('/api/v1/hospitals', hospitalRouter);
  app.use('/api/v1/invitations', invitationRouter);
  app.use('/api/v1/specialists', specialistRouter);
  app.use('/api/v1/assignments', assignmentRouter);
  app.use('/api/v1/reference', referenceRouter);

  // Phase 4 Patients and Sync Routes
  app.use('/api/v1/patients', patientRouter);

  // Phase 5 Notification Core Routes
  app.use('/api/v1/notifications', notificationRouter);

  // Phase 6 Account Recovery Routes
  app.use('/api/v1/recovery', recoveryRouter);

  // Phase 7 Village Groups Routes
  app.use('/api/v1/village-groups', villageGroupRouter);

  // Phase 8 Screening, Demo AI, and MO Case Queue
  app.use('/api/v1/screening', screeningRouter);

  // Phase 9 Screening Camps Management
  app.use('/api/v1/camps', campRouter);

  // Phase 10 Patient Appointments Scheduling
  app.use('/api/v1/appointments', appointmentRouter);

  // Phase 11 Biopsy & Specimen Workflow
  app.use('/api/v1/biopsy', biopsyRouter);

  // Phase 12 Referrals and Follow-up
  app.use('/api/v1/referrals', referralRouter);

  // Digital Prescriptions Workflow
  app.use('/api/v1/prescriptions', prescriptionRouter);

  // Phase 13 Teleconsultation Workflow
  app.use('/api/v1/teleconsultation', teleconsultationRouter);
  app.use('/api/v1/consultations', consultationRouter);

  // Phase 14 Village Data Map
  app.use('/api/v1/map', mapRouter);

  // Phase 15 Reports and Dashboards
  app.use('/api/v1/reports', reportRouter);

  // Phase 16 Aadhaar Verification Mock Service
  app.use('/api/v1/mock/aadhaar', aadhaarMockRouter);

  // Phase 17 Offline and PWA Hardening
  app.use('/api/v1/sync', syncRouter);

  // Animated Multilingual AI Voice Assistant
  app.use('/api/v1/assistant', assistantRouter);

  // AI Oral Lesion Screening Routes (Online & Offline Sync)
  app.use('/api/ai', aiRouter);
  app.use('/api/v1/ai', aiRouter);

  // Dedicated Patient OTP Authentication Routes (Send & Verify with MSG91 & bcrypt)
  app.use('/api/otp', otpRouter);
  app.use('/api/v1/otp', otpRouter);

  // 404 Handler (returns standard envelope)


  app.use(notFoundHandler);

  // Global Error Handler (returns standard envelope)
  app.use(errorHandler);

  return app;
}
