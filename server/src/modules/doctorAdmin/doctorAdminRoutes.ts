import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { z } from 'zod';
import { requireAuth } from '../../middleware/authGuard.js';
import { auditTag } from '../../middleware/auditTag.js';
import { validate } from '../../middleware/validate.js';
import { authorizeCapability } from '../auth/authorizationEngine.js';
import { User } from '../auth/userModel.js';
import { hashPassword } from '../auth/tokenService.js';
import { Hospital } from '../hospital/hospitalModel.js';
import { Specialist } from '../specialist/specialistModel.js';
import { StoredFile } from '../storage/storageModel.js';
import { savePrivateFile } from '../storage/storageService.js';
import { validateMagicBytes } from '../storage/magicBytes.js';
import multer from 'multer';
import { CONSULTATION_LANGUAGES, CONSULTATION_MODES, departmentByCode, ORAL_DEPARTMENTS, QUALIFICATIONS, REGISTRATION_COUNCILS } from './doctorReference.js';
import { DOCTOR_ROLES, nextDoctorCode } from './doctorCodeService.js';
import { runInTransaction } from '../../utils/transaction.js';

/**
 * Admin doctor management: only `admin` (own facility) and `system_admin` (all facilities)
 * can create doctor accounts, issue login credentials, and verify or reject doctors.
 */
export const doctorAdminRouter = Router();

const ADMIN_ROLES = new Set(['admin', 'system_admin']);

function requireAdminRole(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || !ADMIN_ROLES.has(req.user.role)) {
    res.status(403).envelopeError('ADMIN_REQUIRED', 'Only administrators can manage doctor accounts.', undefined, 403);
    return;
  }
  next();
}

/** Facilities this administrator may manage (Invariant 7: cross-hospital scoping). */
function facilityScope(req: Request): Record<string, unknown> {
  return req.user!.role === 'system_admin' ? {} : { hospitalId: req.user!.hospitalId || '__none__' };
}

function canManage(req: Request, hospitalId: string): boolean {
  return req.user!.role === 'system_admin' || (!!req.user!.hospitalId && req.user!.hospitalId === hospitalId);
}

function generatePassword(): string {
  // 12 chars incl. upper, lower, digit, symbol — shown to the admin once, stored only as an Argon2 hash.
  const body = crypto.randomBytes(9).toString('base64url').replace(/[-_]/g, 'x');
  return `Dr@${body.slice(0, 8)}${Math.floor(Math.random() * 90 + 10)}`;
}

function publicDoctor(doc: any, hospitalNames: Map<string, string>) {
  const v = doc.verificationDetails || {};
  return {
    userId: doc.userId,
    doctorCode: doc.doctorCode || null,
    username: doc.username,
    fullName: doc.fullName,
    phone: doc.phone || null,
    email: doc.email || null,
    hospitalId: doc.hospitalId,
    hospitalName: hospitalNames.get(doc.hospitalId) || doc.hospitalId,
    role: doc.role,
    status: doc.status,
    verificationStatus: ['verified', 'VERIFIED'].includes(doc.verificationStatus) ? 'verified' : doc.verificationStatus === 'rejected' ? 'rejected' : 'pending_verification',
    department: v.department || null,
    departmentName: v.departmentName || v.specialization || null,
    specialization: v.specialization || null,
    qualifications: v.qualifications || [],
    experienceYears: v.experienceYears ?? null,
    consultationFee: v.consultationFee ?? null,
    languages: v.languages || [],
    consultationModes: v.consultationModes || [],
    councilName: v.councilName || null,
    councilRegistrationNumber: v.councilRegistrationNumber || null,
    qualificationDocuments: (v.qualificationDocuments || []).map((d: any) => ({ documentId: d.documentId, documentType: d.documentType, sha256Hash: d.sha256Hash })),
    verifiedAt: v.verifiedAt || null,
    rejectionReason: v.rejectionReason || null,
    createdAt: doc.createdAt,
  };
}

/* ---------- Reference data + facilities in scope ---------- */
doctorAdminRouter.get('/reference', requireAuth, authorizeCapability('hospital:manage'), requireAdminRole, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const facilities = await Hospital.find(facilityScope(req)).select('hospitalId name type mandal').sort({ name: 1 }).lean();
    res.envelope({
      facilities,
      departments: ORAL_DEPARTMENTS,
      qualifications: QUALIFICATIONS,
      councils: REGISTRATION_COUNCILS,
      languages: CONSULTATION_LANGUAGES,
      consultationModes: CONSULTATION_MODES,
      source: 'Departments follow the Dental Council of India recognised MDS specialties; councils are statutory registration bodies.',
    });
  } catch (err) { next(err); }
});

/* ---------- List doctors in scope ---------- */
const ListQuery = z.object({
  status: z.enum(['all', 'pending', 'verified', 'rejected']).optional().default('all'),
  hospitalId: z.string().trim().max(100).optional(),
  q: z.string().trim().max(100).optional(),
});

doctorAdminRouter.get('/', requireAuth, authorizeCapability('hospital:manage'), requireAdminRole, validate({ query: ListQuery }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, hospitalId, q } = req.query as unknown as z.infer<typeof ListQuery>;
    const filter: Record<string, unknown> = { role: { $in: DOCTOR_ROLES }, ...facilityScope(req) };
    if (hospitalId) {
      if (!canManage(req, hospitalId)) { res.status(403).envelopeError('CROSS_HOSPITAL_FORBIDDEN', 'Access denied to a facility outside your assigned hospital.', undefined, 403); return; }
      filter.hospitalId = hospitalId;
    }
    if (status === 'verified') filter.verificationStatus = { $in: ['verified', 'VERIFIED'] };
    if (status === 'rejected') filter.verificationStatus = 'rejected';
    if (status === 'pending') filter.verificationStatus = { $nin: ['verified', 'VERIFIED', 'rejected'] };
    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ fullName: rx }, { username: rx }, { doctorCode: rx }, { 'verificationDetails.departmentName': rx }];
    }
    const doctors = await User.find(filter).select('-passwordHash -mfaSecret').sort({ createdAt: -1 }).limit(500).lean();
    const hospitals = await Hospital.find({ hospitalId: { $in: [...new Set(doctors.map((d: any) => d.hospitalId))] } }).select('hospitalId name').lean();
    const names = new Map(hospitals.map((h: any) => [h.hospitalId, h.name]));
    const all = await User.find({ role: { $in: DOCTOR_ROLES }, ...facilityScope(req) }).select('verificationStatus').lean();
    const counts = all.reduce((acc: Record<string, number>, d: any) => {
      const key = ['verified', 'VERIFIED'].includes(d.verificationStatus) ? 'verified' : d.verificationStatus === 'rejected' ? 'rejected' : 'pending';
      acc[key] = (acc[key] || 0) + 1; return acc;
    }, { verified: 0, pending: 0, rejected: 0 });
    res.envelope({ doctors: doctors.map((d) => publicDoctor(d, names)), counts: { ...counts, total: all.length } });
  } catch (err) { next(err); }
});

/* ---------- Qualification document upload (admin-only, private storage) ---------- */
const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, ['application/pdf', 'image/jpeg', 'image/png'].includes(file.mimetype)),
});

doctorAdminRouter.post('/documents', requireAuth, authorizeCapability('hospital:manage'), requireAdminRole, documentUpload.single('file'), auditTag('ADMIN_DOCTOR_DOCUMENT_UPLOAD', 'file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const hospitalId = typeof req.body?.hospitalId === 'string' ? req.body.hospitalId : '';
    if (!req.file) { res.status(400).envelopeError('FILE_REQUIRED', 'Attach a PDF, JPG or PNG document (max 8 MB).', undefined, 400); return; }
    if (!hospitalId || !canManage(req, hospitalId)) { res.status(403).envelopeError('CROSS_HOSPITAL_FORBIDDEN', 'Choose a facility you manage before uploading.', undefined, 403); return; }
    const magic = validateMagicBytes(req.file.buffer, req.file.mimetype);
    if (!magic.valid) { res.status(400).envelopeError('INVALID_FILE_SIGNATURE', magic.error || 'The file content does not match its type.', undefined, 400); return; }
    const saved = await savePrivateFile({ originalFilename: req.file.originalname, mimeType: req.file.mimetype, buffer: req.file.buffer, uploader: req.user as any, accessScopes: ['storage:read_clinical'], category: 'doctors/documents/', hospitalId });
    res.status(201).envelope({ fileId: saved.fileId, sha256Hash: saved.sha256Hash, originalFilename: saved.originalFilename });
  } catch (err) { next(err); }
});

/* ---------- Create doctor + issue credentials ---------- */
const CreateSchema = z.object({
  hospitalId: z.string().trim().min(1).max(100),
  fullName: z.string().trim().min(3).max(120),
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{3,40}$/, 'Login ID: 3–40 letters, numbers, dot, dash or underscore').optional(),
  password: z.string().min(8).max(72).optional(),
  phone: z.string().trim().regex(/^\+?[0-9 ]{10,15}$/, 'Valid phone number required'),
  email: z.string().trim().email().max(120).optional().or(z.literal('')),
  department: z.string().refine((code) => Boolean(departmentByCode(code)), 'Choose a department from the list'),
  specialization: z.string().trim().max(120).optional(),
  qualifications: z.array(z.string().trim().min(2).max(60)).min(1, 'Add at least one qualification').max(8),
  experienceYears: z.number().int().min(0).max(60),
  consultationFee: z.number().min(0).max(100000),
  languages: z.array(z.string().trim().min(2).max(40)).max(8).default([]),
  consultationModes: z.array(z.enum(CONSULTATION_MODES)).min(1, 'Choose online, in-person or both'),
  councilName: z.string().trim().min(3).max(120),
  councilRegistrationNumber: z.string().trim().min(3).max(60),
  qualificationDocumentId: z.string().trim().min(3).max(100),
});

doctorAdminRouter.post('/', requireAuth, authorizeCapability('hospital:manage'), requireAdminRole, validate({ body: CreateSchema }), auditTag('ADMIN_DOCTOR_CREATE', 'user'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body as z.infer<typeof CreateSchema>;
    if (!canManage(req, body.hospitalId)) { res.status(403).envelopeError('CROSS_HOSPITAL_FORBIDDEN', 'You can only add doctors to your own facility.', undefined, 403); return; }
    const hospital: any = await Hospital.findOne({ hospitalId: body.hospitalId }).lean();
    if (!hospital) { res.status(404).envelopeError('HOSPITAL_NOT_FOUND', 'Facility not found.', undefined, 404); return; }
    const document: any = await StoredFile.findOne({ fileId: body.qualificationDocumentId }).lean();
    if (!document) { res.status(400).envelopeError('DOCUMENT_NOT_FOUND', 'Upload the qualification document again.', undefined, 400); return; }
    const duplicateCouncil = await User.findOne({ role: { $in: DOCTOR_ROLES }, 'verificationDetails.councilRegistrationNumber': body.councilRegistrationNumber }).select('userId').lean();
    if (duplicateCouncil) { res.status(409).envelopeError('COUNCIL_NUMBER_EXISTS', 'A doctor with this council registration number already exists.', undefined, 409); return; }

    const department = departmentByCode(body.department)!;
    const temporaryPassword = body.password || generatePassword();
    const passwordHash = await hashPassword(temporaryPassword);
    let created: any;

    try {
      await runInTransaction(async (session) => {
        const doctorCode = await nextDoctorCode(session);
        const username = body.username || doctorCode.toLowerCase();
        if (await User.findOne({ username }).session(session).lean()) {
          throw Object.assign(new Error('This login ID is already taken. Choose another.'), { statusCode: 409, code: 'USERNAME_EXISTS' });
        }
        const userId = `dr_${crypto.randomUUID()}`;
        [created] = await User.create([{
          userId,
          doctorCode,
          username,
          role: 'medical_officer',
          fullName: body.fullName,
          phone: body.phone,
          email: body.email || undefined,
          hospitalId: body.hospitalId,
          passwordHash,
          mustChangePassword: true,
          verificationStatus: 'pending_verification',
          verificationDetails: {
            department: department.code,
            departmentName: department.name,
            specialization: body.specialization || department.name,
            qualifications: body.qualifications,
            experienceYears: body.experienceYears,
            consultationFee: body.consultationFee,
            languages: body.languages,
            consultationModes: body.consultationModes,
            councilName: body.councilName,
            councilRegistrationNumber: body.councilRegistrationNumber,
            qualificationDocuments: [{ documentId: document.fileId, documentType: 'qualification', fileUrl: `/api/v1/storage/files/${document.fileId}`, sha256Hash: document.sha256Hash || '' }],
          },
          status: 'active',
          simulation: true,
        }], { session });
        await Specialist.findOneAndUpdate(
          { specialistId: userId },
          { specialistId: userId, name: body.fullName, specialty: department.specialistField, hospitalId: body.hospitalId, hospitalName: hospital.name, qualifications: body.qualifications, teleconsultAvailable: body.consultationModes.includes('online'), contactPhone: body.phone, email: body.email || undefined, experienceYears: body.experienceYears, status: 'active', simulation: true },
          { upsert: true, session },
        );
      });
    } finally {
      /* session ended by runInTransaction */
    }

    res.status(201).envelope({
      doctor: publicDoctor(created.toObject(), new Map([[hospital.hospitalId, hospital.name]])),
      credentials: { doctorId: created.doctorCode, loginId: created.username, temporaryPassword },
    }, 'Doctor account created. Share the login details privately; the doctor can sign in with the Doctor ID or login ID.');
  } catch (err: any) {
    if (err?.statusCode) { res.status(err.statusCode).envelopeError(err.code, err.message, undefined, err.statusCode); return; }
    next(err);
  }
});

/* ---------- Verify / reject / reset password ---------- */
const DoctorParams = z.object({ userId: z.string().trim().min(3).max(120) });

async function scopedDoctor(req: Request, res: Response) {
  const doctor: any = await User.findOne({ userId: req.params.userId, role: { $in: DOCTOR_ROLES } });
  if (!doctor) { res.status(404).envelopeError('DOCTOR_NOT_FOUND', 'Doctor account not found.', undefined, 404); return null; }
  if (!canManage(req, doctor.hospitalId)) { res.status(403).envelopeError('CROSS_HOSPITAL_FORBIDDEN', 'This doctor belongs to another facility.', undefined, 403); return null; }
  return doctor;
}

doctorAdminRouter.post('/:userId/verify', requireAuth, authorizeCapability('hospital:manage'), requireAdminRole, validate({ params: DoctorParams }), auditTag('ADMIN_DOCTOR_VERIFY', 'user'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const doctor = await scopedDoctor(req, res); if (!doctor) return;
    const v = doctor.verificationDetails || {};
    if (!v.qualificationDocuments?.length || !v.councilRegistrationNumber) {
      res.status(400).envelopeError('DOCUMENTS_REQUIRED', 'A qualification document and council registration number are required before approval.', undefined, 400); return;
    }
    doctor.verificationStatus = 'verified';
    doctor.verificationDetails = { ...v.toObject?.() ?? v, verifiedBy: req.user!.id, verifiedAt: new Date(), rejectionReason: undefined };
    await doctor.save();
    res.envelope({ userId: doctor.userId, doctorCode: doctor.doctorCode, verificationStatus: 'verified' }, 'Doctor verified. They can now accept appointments.');
  } catch (err) { next(err); }
});

doctorAdminRouter.post('/:userId/reject', requireAuth, authorizeCapability('hospital:manage'), requireAdminRole, validate({ params: DoctorParams, body: z.object({ reason: z.string().trim().min(5).max(500) }) }), auditTag('ADMIN_DOCTOR_REJECT', 'user'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const doctor = await scopedDoctor(req, res); if (!doctor) return;
    doctor.verificationStatus = 'rejected';
    const v = doctor.verificationDetails?.toObject?.() ?? doctor.verificationDetails ?? {};
    doctor.verificationDetails = { ...v, rejectionReason: req.body.reason, rejectedBy: req.user!.id, rejectedAt: new Date() };
    await doctor.save();
    res.envelope({ userId: doctor.userId, verificationStatus: 'rejected' }, 'Doctor application rejected.');
  } catch (err) { next(err); }
});

doctorAdminRouter.post('/:userId/reset-password', requireAuth, authorizeCapability('hospital:manage'), requireAdminRole, validate({ params: DoctorParams }), auditTag('ADMIN_DOCTOR_PASSWORD_RESET', 'user'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const doctor = await scopedDoctor(req, res); if (!doctor) return;
    const temporaryPassword = generatePassword();
    doctor.passwordHash = await hashPassword(temporaryPassword);
    doctor.mustChangePassword = true;
    doctor.lockout = { failedAttempts: 0, lockedUntil: null, lastFailedAt: null };
    await doctor.save();
    res.envelope({ credentials: { doctorId: doctor.doctorCode, loginId: doctor.username, temporaryPassword } }, 'New temporary password issued.');
  } catch (err) { next(err); }
});
