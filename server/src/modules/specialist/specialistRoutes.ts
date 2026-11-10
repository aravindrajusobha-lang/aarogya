import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth } from '../../middleware/authGuard.js';
import { auditTag } from '../../middleware/auditTag.js';
import { authorizeCapability } from '../auth/authorizationEngine.js';
import { validate } from '../../middleware/validate.js';
import { Specialist } from './specialistModel.js';

const router = Router();

const SpecialistQuerySchema = z.object({
  specialty: z
    .enum([
      'oral_oncology',
      'maxillofacial_surgery',
      'ent_head_neck',
      'pathology',
      'general_dental',
      'radiation_oncology',
    ])
    .optional(),
  teleconsultAvailable: z.coerce.boolean().optional(),
  hospitalId: z.string().optional(),
});

const CreateSpecialistSchema = z.object({
  name: z.string().min(2, 'Name required'),
  specialty: z.enum([
    'oral_oncology',
    'maxillofacial_surgery',
    'ent_head_neck',
    'pathology',
    'general_dental',
    'radiation_oncology',
  ]),
  hospitalId: z.string().min(1, 'Hospital ID required'),
  hospitalName: z.string().min(2, 'Hospital Name required'),
  qualifications: z.array(z.string()).default([]),
  teleconsultAvailable: z.boolean().default(true),
  contactPhone: z.string().min(8, 'Phone number required'),
  email: z.string().email('Valid email required'),
  languages: z.array(z.string()).default(['te', 'en']),
  consultationTimings: z
    .object({
      days: z.array(z.string()).default([]),
      hours: z.string().default('09:00 AM - 04:00 PM'),
    })
    .optional(),
  experienceYears: z.number().min(0).optional(),
});

const UpdateSpecialistSchema = z.object({
  name: z.string().min(2).optional(),
  specialty: z
    .enum([
      'oral_oncology',
      'maxillofacial_surgery',
      'ent_head_neck',
      'pathology',
      'general_dental',
      'radiation_oncology',
    ])
    .optional(),
  qualifications: z.array(z.string()).optional(),
  teleconsultAvailable: z.boolean().optional(),
  contactPhone: z.string().optional(),
  email: z.string().email().optional(),
  languages: z.array(z.string()).optional(),
  consultationTimings: z
    .object({
      days: z.array(z.string()),
      hours: z.string(),
    })
    .optional(),
  experienceYears: z.number().min(0).optional(),
  status: z.enum(['active', 'inactive', 'on_leave']).optional(),
});

// GET /api/v1/specialists
router.get(
  '/',
  requireAuth,
  authorizeCapability('specialist:read'),
  validate({ query: SpecialistQuerySchema }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { specialty, teleconsultAvailable, hospitalId } = req.query as any;

      const filter: Record<string, unknown> = { status: 'active' };
      if (specialty) filter.specialty = specialty;
      if (typeof teleconsultAvailable === 'boolean') filter.teleconsultAvailable = teleconsultAvailable;
      if (hospitalId) filter.hospitalId = hospitalId;

      const specialists = await Specialist.find(filter).sort({ name: 1 }).lean();

      res.envelope({
        specialists,
        total: specialists.length,
        simulation: true,
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/specialists
router.post(
  '/',
  requireAuth,
  authorizeCapability('specialist:manage'),
  validate({ body: CreateSpecialistSchema }),
  auditTag('SPECIALIST_REGISTER', 'specialist'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const specialist = await Specialist.create({
        specialistId: `spec_${uuidv4()}`,
        ...req.body,
        status: 'active',
        simulation: true,
      });

      res.status(201).envelope({
        specialist,
        simulation: true,
      });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/v1/specialists/:id
router.put(
  '/:id',
  requireAuth,
  authorizeCapability('specialist:manage'),
  validate({ body: UpdateSpecialistSchema }),
  auditTag('SPECIALIST_UPDATE', 'specialist'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const specialist = await Specialist.findOne({ specialistId: req.params.id });
      if (!specialist) {
        res.envelopeError('SPECIALIST_NOT_FOUND', 'Specialist not found', undefined, 404);
        return;
      }

      // Cross-Hospital check
      if (req.user!.role !== 'system_admin' && req.user!.hospitalId && specialist.hospitalId !== req.user!.hospitalId) {
        res.envelopeError('CROSS_HOSPITAL_FORBIDDEN', 'Cannot edit doctor from another hospital', undefined, 403);
        return;
      }

      Object.assign(specialist, req.body);
      await specialist.save();

      res.envelope({
        specialist,
        message: 'Doctor profile updated successfully',
        simulation: true,
      });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/v1/specialists/:id/status
router.patch(
  '/:id/status',
  requireAuth,
  authorizeCapability('specialist:manage'),
  validate({ body: z.object({ status: z.enum(['active', 'inactive', 'on_leave']) }) }),
  auditTag('SPECIALIST_STATUS_TOGGLE', 'specialist'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const specialist = await Specialist.findOne({ specialistId: req.params.id });
      if (!specialist) {
        res.envelopeError('SPECIALIST_NOT_FOUND', 'Specialist not found', undefined, 404);
        return;
      }

      if (req.user!.role !== 'system_admin' && req.user!.hospitalId && specialist.hospitalId !== req.user!.hospitalId) {
        res.envelopeError('CROSS_HOSPITAL_FORBIDDEN', 'Cannot modify doctor status from another hospital', undefined, 403);
        return;
      }

      specialist.status = req.body.status;
      await specialist.save();

      res.envelope({
        specialist,
        message: `Doctor status updated to ${req.body.status}`,
        simulation: true,
      });
    } catch (err) {
      next(err);
    }
  }
);

export const specialistRouter = router;
