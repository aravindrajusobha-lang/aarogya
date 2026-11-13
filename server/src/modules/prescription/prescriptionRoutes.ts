import crypto from 'node:crypto';
import { User } from '../auth/userModel.js';
import { Hospital } from '../hospital/hospitalModel.js';
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth } from '../../middleware/authGuard.js';
import { validate } from '../../middleware/validate.js';
import { auditTag } from '../../middleware/auditTag.js';
import { Prescription } from './prescriptionModel.js';
import { Patient } from '../patient/patientModel.js';
import { canTreatPatient, patientIdentity } from '../consultation/patientCareService.js';
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
  mutationId: z.string().uuid().optional(),
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

async function canReadPrescription(user: any, patientId: string, hospitalId?: string) {
  const account: any = await User.findOne({ userId: user.id || user.userId }).lean();
  if (!account) return false;
  if (account.role === 'patient') return account.patientId === patientId;
  if (account.role === 'system_admin') return true;
  if (!['medical_officer', 'specialist_doctor'].includes(account.role) || !account.hospitalId) return false;
  const patient: any = await patientIdentity(patientId);
  if (!patient) return false;
  const careAccess = await canTreatPatient(account.userId, patientId);
  return Boolean((patient.hospitalId === account.hospitalId || careAccess) && (!hospitalId || hospitalId === account.hospitalId || careAccess));
}

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
      const doctor: any = await User.findOne({ userId: user.id || user.userId }).lean();
      const patient: any = await patientIdentity(body.patientId);
      if (!doctor || !patient || !(await canTreatPatient(doctor.userId, body.patientId))) {
        res.envelopeError('ACCESS_DENIED', 'Approval from the current treating doctor is required.', undefined, 403); return;
      }
      if (body.mutationId) { const existing = await Prescription.findOne({ mutationId: body.mutationId, doctorId: doctor.userId, patientId: patient.patientId }); if (existing) { res.envelope({ prescription: existing }); return; } }
      const hospital: any = await Hospital.findOne({ hospitalId: doctor.hospitalId }).lean();
      const prescriptionId = `RX-${crypto.randomUUID()}`;

      const prescription = await Prescription.create({
        prescriptionId,
        mutationId: body.mutationId,
        sha256: crypto.createHash('sha256').update(JSON.stringify({ ...body, doctorId: doctor.userId, patientId: patient.patientId })).digest('hex'),
        patientId: body.patientId,
        patientName: patient.fullName,
        patientPhone: body.patientPhone,
        doctorId: doctor.userId,
        doctorName: doctor.fullName,
        doctorSpecialty: 'Dental Surgeon / Medical Officer',
        hospitalId: doctor.hospitalId,
        hospitalName: hospital?.name || doctor.hospitalId,
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
router.get('/doctor/mine', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!['medical_officer', 'specialist_doctor'].includes(req.user!.role)) { res.status(403).envelopeError('DOCTOR_REQUIRED', 'Doctor access is required.', undefined, 403); return; }
    const items = await Prescription.find({ doctorId: req.user!.id }).sort({ createdAt: -1 }).limit(200).lean();
    res.setHeader('Cache-Control', 'private, no-store'); res.envelope({ prescriptions: items });
  } catch (err) { next(err); }
});

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
      if (!(await canReadPrescription(req.user!, prescription.patientId, prescription.hospitalId))) {
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
      if (!(await canReadPrescription(req.user!, String(patientId)))) {
        res.envelopeError('ACCESS_DENIED', 'You can only view your own prescriptions', undefined, 403);
        return;
      }

      const doctor: any = await User.findOne({ userId: req.user!.id || (req.user as any).userId }).lean();
      const careAccess = req.user!.role !== 'patient' && req.user!.role !== 'system_admin' && doctor ? await canTreatPatient(doctor.userId, patientId) : false;
      const prescriptions = await Prescription.find({ patientId, ...(req.user!.role === 'patient' || req.user!.role === 'system_admin' || careAccess ? {} : { hospitalId: req.user!.hospitalId }) }).sort({ createdAt: -1 }).lean();

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

