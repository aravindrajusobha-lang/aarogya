import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth } from '../../middleware/authGuard.js';
import { validate } from '../../middleware/validate.js';
import { auditTag } from '../../middleware/auditTag.js';
import { Prescription } from './prescriptionModel.js';
import { Patient } from '../patient/patientModel.js';
import { logger } from '../../config/logger.js';

const router = Router();

const MedicineItemSchema = z.object({
  medicineName: z.string().min(1, 'Medicine name required'),
  dosage: z.string().min(1, 'Dosage required'),
  frequency: z.string().min(1, 'Frequency required'),
  durationDays: z.number().min(1).default(5),
  instructions: z.string().optional().default(''),
});

const CreatePrescriptionSchema = z.object({
  patientId: z.string().min(1, 'Patient ID required'),
  patientName: z.string().min(1, 'Patient name required'),
  patientPhone: z.string().optional(),
  clinicalObservations: z.string().min(3, 'Clinical observations required'),
  clinicalImpression: z.string().min(3, 'Clinical impression required').optional(),
  diagnosisImpression: z.string().optional(),
  medicines: z.array(MedicineItemSchema).min(1, 'At least one medicine is required'),
  labTestsRecommended: z.array(z.string()).optional().default([]),
  dietaryLifestyleAdvice: z.array(z.string()).optional().default([]),
  followUpDate: z.string().optional(),
  consultationId: z.string().optional(),
  screeningCaseId: z.string().optional(),
});

// 1. POST /api/v1/prescriptions (Clinicians only)
router.post(
  '/',
  requireAuth,
  auditTag('PRESCRIPTION_CREATED', 'prescription'),
  validate({ body: CreatePrescriptionSchema }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const isClinician =
        user.role === 'medical_officer' ||
        user.role === 'system_admin' ||
        user.role === 'admin' ||
        user.role?.includes('doctor');

      if (!isClinician) {
        res.envelopeError('UNAUTHORIZED', 'Only authorized clinical officers can issue prescriptions', undefined, 403);
        return;
      }

      const body = req.body;
      const prescriptionId = `RX-PAD-${Date.now().toString().slice(-6)}-${Math.floor(10 + Math.random() * 90)}`;

      const prescription = await Prescription.create({
        prescriptionId,
        patientId: body.patientId,
        patientName: body.patientName,
        patientPhone: body.patientPhone,
        doctorId: user.id || user.userId || 'DR-PAD-01',
        doctorName: user.fullName || user.username || 'Medical Officer (CHC Paderu)',
        doctorSpecialty: 'Dental Surgeon / Medical Officer',
        hospitalId: user.hospitalId || 'HOSP-PAD-01',
        hospitalName: 'Community Health Centre (CHC) Paderu',
        consultationId: body.consultationId,
        screeningCaseId: body.screeningCaseId,
        clinicalObservations: body.clinicalObservations,
        diagnosisImpression: body.clinicalImpression || body.diagnosisImpression || 'Clinical observation',
        medicines: body.medicines,
        labTestsRecommended: body.labTestsRecommended,
        dietaryLifestyleAdvice: body.dietaryLifestyleAdvice,
        followUpDate: body.followUpDate ? new Date(body.followUpDate) : undefined,
        status: 'active',
        simulation: true,
      });

      logger.info({ prescriptionId, patientId: body.patientId }, 'Prescription created successfully');

      res.status(201).envelope({
        prescription,
        message: 'Prescription issued successfully',
        simulation: true,
      });
    } catch (err) {
      next(err);
    }
  }
);

// 2. GET /api/v1/prescriptions/:id
router.get(
  '/:id',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const prescriptionId = req.params.id;
      const prescription: any = await Prescription.findOne({
        $or: [{ prescriptionId }, { _id: prescriptionId.length === 24 ? prescriptionId : undefined }],
      }).lean();

      if (!prescription) {
        res.envelopeError('PRESCRIPTION_NOT_FOUND', 'Prescription record not found', undefined, 404);
        return;
      }

      // Patient scoping: patient can only view their own prescription
      if (req.user!.role === 'patient' && req.user!.patientId && prescription.patientId !== req.user!.patientId) {
        res.envelopeError('ACCESS_DENIED', 'You can only view your own prescriptions', undefined, 403);
        return;
      }

      res.envelope(prescription);
    } catch (err) {
      next(err);
    }
  }
);

// 3. GET /api/v1/prescriptions/patient/:patientId
router.get(
  '/patient/:patientId',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const patientId = req.params.patientId;

      // Scoping
      if (req.user!.role === 'patient' && req.user!.patientId && patientId !== req.user!.patientId) {
        res.envelopeError('ACCESS_DENIED', 'You can only view your own prescriptions', undefined, 403);
        return;
      }

      const prescriptions = await Prescription.find({ patientId }).sort({ createdAt: -1 }).lean();

      res.envelope({
        prescriptions,
        total: prescriptions.length,
        simulation: true,
      });
    } catch (err) {
      next(err);
    }
  }
);

export const prescriptionRouter = router;

