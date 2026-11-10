import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/authGuard.js';
import { auditTag } from '../../middleware/auditTag.js';
import { authorizeCapability } from '../auth/authorizationEngine.js';
import { validate } from '../../middleware/validate.js';
import { Hospital } from './hospitalModel.js';
import { User } from '../auth/userModel.js';
import { hashPassword } from '../auth/tokenService.js';
import { Patient } from '../patient/patientModel.js';
import { Referral } from '../referral/referralModel.js';
import { ScreeningCase } from '../screening/screeningCaseModel.js';
import { Specialist } from '../specialist/specialistModel.js';

const router = Router();

const CreateHospitalSchema = z.object({
  hospitalId: z.string().min(2, 'Hospital ID required'),
  name: z.string().min(3, 'Hospital name required'),
  type: z.enum([
    'district_hospital',
    'area_hospital',
    'community_health_centre',
    'primary_health_centre',
    'sub_centre',
  ]),
  district: z.string().default('Alluri Sitharama Raju'),
  mandal: z.string().min(2, 'Mandal required'),
  village: z.string().optional(),
  state: z.string().default('Andhra Pradesh'),
  address: z.string().optional(),
  contactNumber: z.string().optional(),
  services: z.array(z.string()).default([]),
  specialties: z.array(z.string()).default([]),
  managerEmail: z.string().optional(),
  managerPhone: z.string().optional(),
  jurisdictionVillages: z.array(z.string()).default([]),
  adminUserIds: z.array(z.string()).default([]),
});

const UpdateHospitalSchema = z.object({
  name: z.string().min(3).optional(),
  district: z.string().optional(),
  mandal: z.string().optional(),
  village: z.string().optional(),
  state: z.string().optional(),
  address: z.string().optional(),
  contactNumber: z.string().optional(),
  services: z.array(z.string()).optional(),
  specialties: z.array(z.string()).optional(),
  managerEmail: z.string().optional(),
  managerPhone: z.string().optional(),
  jurisdictionVillages: z.array(z.string()).optional(),
  adminUserIds: z.array(z.string()).optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

const HospitalParamsSchema = z.object({
  hospitalId: z.string().min(1, 'Hospital ID required'),
});

// POST /api/v1/hospitals
router.post(
  '/',
  requireAuth,
  authorizeCapability('hospital:manage'),
  validate({ body: CreateHospitalSchema }),
  auditTag('HOSPITAL_CREATE', 'hospital'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const existing = await Hospital.findOne({ hospitalId: req.body.hospitalId });
      if (existing) {
        res.envelopeError('HOSPITAL_EXISTS', 'Hospital with this ID already exists', undefined, 400);
        return;
      }

      const hospital = await Hospital.create({
        ...req.body,
        simulation: true,
      });

      res.status(201).envelope({
        hospital,
        simulation: true,
      });
    } catch (err) {
      next(err);
    }
  }
);


const CreateDoctorSchema = z.object({
  fullName: z.string().min(2, 'Doctor full name required'),
  username: z.string().min(3, 'Username required (min 3 chars)'),
  phone: z.string().min(8, 'Contact phone number required'),
  email: z.string().email('Valid email address required'),
  password: z.string().min(6).optional(),
  specialization: z.string().min(2, 'Specialization required'),
  qualifications: z.array(z.string()).default(['BDS']),
  councilRegistrationNumber: z.string().min(3, 'Council registration number required'),
  experienceYears: z.number().min(0).default(1),
  qualificationDocuments: z.array(z.object({
    documentId: z.string(),
    documentType: z.string(),
    fileUrl: z.string(),
    sha256Hash: z.string().optional().default(''),
  })).default([]),
});

/**
 * POST /api/v1/hospitals/:hospitalId/doctors
 * Hospital Manager creates doctor account, records credentials, qualification documents
 * Initial status: pending_verification, requires initial password change
 */
router.post(
  '/:hospitalId/doctors',
  requireAuth,
  authorizeCapability('hospital:manage'),
  validate({ params: HospitalParamsSchema, body: CreateDoctorSchema }),
  auditTag('HOSPITAL_DOCTOR_CREATE', 'hospital'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const hospitalId = req.params.hospitalId as string;
      const hospital = await Hospital.findOne({ hospitalId });
      if (!hospital) {
        res.envelopeError('HOSPITAL_NOT_FOUND', 'Hospital not found', undefined, 404);
        return;
      }

      // Cross-Hospital check
      if (req.user!.role !== 'system_admin' && req.user!.hospitalId && req.user!.hospitalId !== hospitalId) {
        res.envelopeError('CROSS_HOSPITAL_FORBIDDEN', 'Access denied to manage doctors of another hospital', undefined, 403);
        return;
      }

      const existingUser = await User.findOne({ username: req.body.username.toLowerCase().trim() });
      if (existingUser) {
        res.envelopeError('USERNAME_EXISTS', 'A user with this username already exists', undefined, 400);
        return;
      }

      const rawPassword = req.body.password || `Doc@${Math.random().toString(36).slice(-6)}`;
      const passwordHash = await hashPassword(rawPassword);
      const doctorUserId = `dr_${hospitalId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

      const newDoctor = await User.create({
        userId: doctorUserId,
        username: req.body.username.toLowerCase().trim(),
        role: 'medical_officer',
        fullName: req.body.fullName,
        phone: req.body.phone,
        hospitalId,
        passwordHash,
        mustChangePassword: true,
        verificationStatus: 'pending_verification',
        verificationDetails: {
          councilRegistrationNumber: req.body.councilRegistrationNumber,
          specialization: req.body.specialization,
          experienceYears: req.body.experienceYears,
          qualificationDocuments: req.body.qualificationDocuments,
        },
        status: 'active',
        simulation: true,
      });

      // Also register into Specialist registry so discoverable in nearby searches
      await Specialist.findOneAndUpdate(
        { specialistId: doctorUserId },
        {
          specialistId: doctorUserId,
          name: req.body.fullName,
          specialty: 'general_dental',
          hospitalId,
          hospitalName: hospital.name,
          qualifications: req.body.qualifications,
          teleconsultAvailable: true,
          contactPhone: req.body.phone,
          email: req.body.email,
          experienceYears: req.body.experienceYears,
          status: 'active',
          simulation: true,
        },
        { upsert: true }
      );

      res.status(201).envelope({
        doctor: {
          userId: newDoctor.userId,
          username: newDoctor.username,
          fullName: newDoctor.fullName,
          role: newDoctor.role,
          hospitalId: newDoctor.hospitalId,
          verificationStatus: newDoctor.verificationStatus,
          mustChangePassword: true,
          councilRegistrationNumber: req.body.councilRegistrationNumber,
          specialization: req.body.specialization,
        },
        temporaryPassword: rawPassword,
        message: 'Doctor account created with initial password change requirement and pending verification.',
        simulation: true,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/hospitals/:hospitalId/doctors
 * Lists all doctor accounts registered at this facility
 */
router.get(
  '/:hospitalId/doctors',
  requireAuth,
  authorizeCapability('hospital:read'),
  validate({ params: HospitalParamsSchema }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const hospitalId = req.params.hospitalId as string;
      const doctors = await User.find({
        hospitalId,
        role: 'medical_officer',
      }).select('userId username fullName phone hospitalId verificationStatus verificationDetails mustChangePassword createdAt').lean();

      res.envelope({
        doctors,
        total: doctors.length,
        simulation: true,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/hospitals/:hospitalId/doctors/:doctorId/verify
 * Hospital Manager verifies qualification documents and approves doctor activation
 */
router.post(
  '/:hospitalId/doctors/:doctorId/verify',
  requireAuth,
  authorizeCapability('hospital:manage'),
  auditTag('HOSPITAL_DOCTOR_VERIFY', 'hospital'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { hospitalId, doctorId } = req.params;
      const doctor = await User.findOne({ userId: doctorId, hospitalId, role: 'medical_officer' });
      if (!doctor) {
        res.envelopeError('DOCTOR_NOT_FOUND', 'Doctor account not found in this facility', undefined, 404);
        return;
      }

      doctor.verificationStatus = 'verified';
      if (!doctor.verificationDetails) {
        doctor.verificationDetails = {};
      }
      doctor.verificationDetails.verifiedBy = req.user!.id;
      doctor.verificationDetails.verifiedAt = new Date();
      await doctor.save();

      res.envelope({
        doctorId: doctor.userId,
        verificationStatus: doctor.verificationStatus,
        verifiedBy: req.user!.id,
        verifiedAt: doctor.verificationDetails.verifiedAt,
        message: 'Doctor qualifications verified and account fully authorized.',
        simulation: true,
      });
    } catch (err) {
      next(err);
    }
  }
);

export const hospitalRouter = router;
