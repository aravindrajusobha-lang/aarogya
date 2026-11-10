import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { VideoSignalingService } from '../src/modules/teleconsultation/videoSignaling.js';
import { PatientOtpService } from '../src/modules/auth/patientOtpService.js';

describe('Phase 21 Healthcare Platform Workflows', () => {
  const app = createApp();

  describe('Module 8: Patient Mobile OTP Authentication', () => {
    it('generates an OTP for a valid 10-digit mobile number with cooldown and expiry', async () => {
      const res = await PatientOtpService.requestOtp('9876543210');
      expect(res.success).toBe(true);
      expect(res.expiresInSeconds).toBe(300);
      expect(res.cooldownSeconds).toBe(60);
      expect(res.demoOtpHint).toBe('123456');
    });

    it('enforces 60-second cooldown between successive OTP requests for same number', async () => {
      await expect(PatientOtpService.requestOtp('9876543210')).rejects.toThrow(/cooldown|wait/i);
    });

    it('rejects invalid mobile numbers with less than 10 digits', async () => {
      await expect(PatientOtpService.requestOtp('12345')).rejects.toThrow(/10-digit/i);
    });
  });

  describe('Module 4: WebRTC Video Consultation Signaling', () => {
    const consultationId = `test_cons_${Date.now()}`;

    it('allows doctor and patient to join a video consultation room and retrieve STUN ICE servers', () => {
      const patientJoin = VideoSignalingService.joinRoom(consultationId, 'patient_01', 'patient');
      expect(patientJoin.consultationId).toBe(consultationId);
      expect(patientJoin.iceServers.length).toBeGreaterThan(0);
      expect(patientJoin.iceServers[0].urls).toContain('stun.l.google.com');

      const doctorJoin = VideoSignalingService.joinRoom(consultationId, 'doctor_01', 'medical_officer');
      expect(doctorJoin.activeParticipants.length).toBe(2);
    });

    it('relays WebRTC offer signal from caller to callee', () => {
      const signalResult = VideoSignalingService.postSignal(
        consultationId,
        'patient_01',
        'patient',
        'offer',
        { sdp: 'v=0\r\no=patient 12345 2 IN IP4 127.0.0.1' }
      );
      expect(signalResult.success).toBe(true);

      const doctorPoll = VideoSignalingService.getSignals(consultationId, 'doctor_01', 0);
      expect(doctorPoll.signals.length).toBe(1);
      expect(doctorPoll.signals[0].type).toBe('offer');
      expect(doctorPoll.signals[0].senderId).toBe('patient_01');
    });

    it('relays WebRTC answer signal back to caller', () => {
      const signalResult = VideoSignalingService.postSignal(
        consultationId,
        'doctor_01',
        'medical_officer',
        'answer',
        { sdp: 'v=0\r\no=doctor 67890 2 IN IP4 127.0.0.1' }
      );
      expect(signalResult.success).toBe(true);

      const patientPoll = VideoSignalingService.getSignals(consultationId, 'patient_01', 0);
      expect(patientPoll.signals.some((s) => s.type === 'answer')).toBe(true);
    });

    it('gracefully leaves and tears down the room', () => {
      const leave = VideoSignalingService.leaveRoom(consultationId, 'patient_01');
      expect(leave.success).toBe(true);
    });
  });

  describe('Module 3: Nearest Doctor and Hospital Discovery', () => {
    it('returns ranked healthcare facilities in Alluri Sitharama Raju District with distances and active doctors', async () => {
      // Test via simulated route request handler
      const req: any = {
        query: {
          lat: '18.0833',
          lng: '82.6667',
          mandal: 'Paderu',
        },
      };

      let capturedData: any = null;
      let capturedStatus = 200;

      const res: any = {
        status(code: number) {
          capturedStatus = code;
          return this;
        },
        envelope(payload: any) {
          capturedData = payload;
          return this;
        },
        envelopeError(code: string, message: string, details: any, statusCode: number) {
          capturedStatus = statusCode;
          capturedData = { code, message, details };
          return this;
        },
      };

      // Find the handler for /nearby on hospital router
      const { hospitalRouter } = await import('../src/modules/hospital/hospitalRoutes.js');
      const nearbyRoute = hospitalRouter.stack.find(
        (layer: any) => layer.route && layer.route.path === '/nearby' && layer.route.methods.get
      );

      expect(nearbyRoute).toBeDefined();
      const handler = nearbyRoute.route.stack[0].handle;
      await handler(req, res, () => {});

      expect(capturedStatus).toBe(200);
      expect(capturedData).toBeDefined();
      expect(capturedData.facilities.length).toBeGreaterThan(0);

      const primary = capturedData.facilities[0];
      expect(primary.name).toContain('Paderu');
      expect(primary.activeDoctors.length).toBeGreaterThan(0);
      expect(primary.activeDoctors[0].specialization).toBeDefined();
      expect(capturedData.emergency108).toContain('108');
    });
  });
});
