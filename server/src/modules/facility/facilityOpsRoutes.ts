import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { requireAuth } from '../../middleware/authGuard.js';
import { auditTag } from '../../middleware/auditTag.js';
import { validate } from '../../middleware/validate.js';
import { authorizeCapability } from '../auth/authorizationEngine.js';
import { User } from '../auth/userModel.js';
import { hashPassword } from '../auth/tokenService.js';
import { Hospital } from '../hospital/hospitalModel.js';
import { DOCTOR_ROLES } from '../doctorAdmin/doctorCodeService.js';
import { runInTransaction } from '../../utils/transaction.js';
import {
  EQUIPMENT_CATEGORIES, FacilityEquipment, FacilityMedicine, FacilityStockMovement, FacilityWard,
  MEDICINE_FORMS, STOCK_REASONS, WARD_TYPES,
} from './facilityOpsModels.js';

/**
 * Facility operations (Invariant 7: facility-scoped).
 * - system_admin: every facility; the only role that creates facility admins.
 * - admin (facility admin): only their own hospitalId.
 */
export const facilityOpsRouter = Router();

const ADMIN_ROLES = new Set(['admin', 'system_admin']);
const guard = [requireAuth, authorizeCapability('hospital:manage')];
const HospitalParam = z.object({ hospitalId: z.string().trim().min(1).max(100) });

function scoped(req: Request, res: Response): string | null {
  const hospitalId = req.params.hospitalId;
  if (!req.user || !ADMIN_ROLES.has(req.user.role)) { res.status(403).envelopeError('ADMIN_REQUIRED', 'Only administrators can manage facilities.', undefined, 403); return null; }
  if (req.user.role !== 'system_admin' && req.user.hospitalId !== hospitalId) {
    res.status(403).envelopeError('CROSS_HOSPITAL_FORBIDDEN', 'You can only manage your own facility.', undefined, 403); return null;
  }
  return hospitalId;
}

async function existingHospital(res: Response, hospitalId: string) {
  const hospital: any = await Hospital.findOne({ hospitalId }).lean();
  if (!hospital) { res.status(404).envelopeError('HOSPITAL_NOT_FOUND', 'Facility not found.', undefined, 404); return null; }
  return hospital;
}

const generatePassword = () => `Fa@${crypto.randomBytes(9).toString('base64url').replace(/[-_]/g, 'x').slice(0, 8)}${Math.floor(Math.random() * 90 + 10)}`;
const strip = (doc: any) => { const { _id, __v, ...rest } = doc; return rest; };
const fail = (res: Response, err: any, next: NextFunction) => {
  if (err?.code === 11000) { res.status(409).envelopeError('DUPLICATE', 'An entry with this name already exists at this facility.', undefined, 409); return; }
  if (err?.statusCode) { res.status(err.statusCode).envelopeError(err.code, err.message, undefined, err.statusCode); return; }
  next(err);
};

/* ======================= Overview ======================= */
facilityOpsRouter.get('/:hospitalId/overview', ...guard, validate({ params: HospitalParam }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const hospitalId = scoped(req, res); if (!hospitalId) return;
    const hospital = await existingHospital(res, hospitalId); if (!hospital) return;
    const [wards, medicines, equipment, doctors, admins] = await Promise.all([
      FacilityWard.find({ hospitalId }).lean(),
      FacilityMedicine.find({ hospitalId }).lean(),
      FacilityEquipment.find({ hospitalId }).lean(),
      User.find({ hospitalId, role: { $in: DOCTOR_ROLES } }).select('verificationStatus status').lean(),
      User.countDocuments({ hospitalId, role: 'admin' }),
    ]);
    const now = Date.now();
    const soon = now + 60 * 86400000;
    res.envelope({
      hospital: { hospitalId: hospital.hospitalId, name: hospital.name, type: hospital.type, mandal: hospital.mandal, district: hospital.district, address: hospital.address || null, contactNumber: hospital.contactNumber || null, status: hospital.status || 'active' },
      beds: {
        total: (wards as any[]).reduce((sum, w) => sum + w.totalBeds, 0),
        occupied: (wards as any[]).reduce((sum, w) => sum + w.occupiedBeds, 0),
        wards: wards.length,
      },
      medicines: {
        items: medicines.length,
        lowStock: (medicines as any[]).filter((m) => m.stock <= m.reorderLevel).length,
        outOfStock: (medicines as any[]).filter((m) => m.stock === 0).length,
        expiringSoon: (medicines as any[]).filter((m) => m.expiryDate && new Date(m.expiryDate).getTime() <= soon).length,
      },
      equipment: {
        items: equipment.length,
        units: (equipment as any[]).reduce((sum, e) => sum + e.quantity, 0),
        needsRepair: (equipment as any[]).reduce((sum, e) => sum + Math.max(0, e.quantity - e.functionalCount), 0),
      },
      staff: {
        doctorsVerified: (doctors as any[]).filter((d) => ['verified', 'VERIFIED'].includes(d.verificationStatus)).length,
        doctorsPending: (doctors as any[]).filter((d) => !['verified', 'VERIFIED', 'rejected'].includes(d.verificationStatus)).length,
        facilityAdmins: admins,
      },
    });
  } catch (err) { fail(res, err, next); }
});

/* ======================= Facility admins ======================= */
const AdminCreate = z.object({
  fullName: z.string().trim().min(3).max(120),
  phone: z.string().trim().regex(/^\+?[0-9 ]{10,15}$/, 'Valid phone number required'),
  email: z.string().trim().email().max(120).optional().or(z.literal('')),
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{3,40}$/, 'Login ID: 3–40 letters, numbers, dot, dash or underscore').optional(),
  password: z.string().min(8).max(72).optional(),
});

facilityOpsRouter.get('/:hospitalId/admins', ...guard, validate({ params: HospitalParam }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const hospitalId = scoped(req, res); if (!hospitalId) return;
    const admins = await User.find({ hospitalId, role: 'admin' }).select('userId username fullName phone email status createdAt').sort({ createdAt: -1 }).lean();
    res.envelope({ admins: admins.map(strip) });
  } catch (err) { fail(res, err, next); }
});

facilityOpsRouter.post('/:hospitalId/admins', ...guard, validate({ params: HospitalParam, body: AdminCreate }), auditTag('FACILITY_ADMIN_CREATE', 'user'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const hospitalId = scoped(req, res); if (!hospitalId) return;
    if (req.user!.role !== 'system_admin') { res.status(403).envelopeError('SYSTEM_ADMIN_REQUIRED', 'Only the system administrator can create facility admins.', undefined, 403); return; }
    const hospital = await existingHospital(res, hospitalId); if (!hospital) return;
    const username = req.body.username || `fa.${hospitalId.replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 20)}.${crypto.randomBytes(2).toString('hex')}`;
    if (await User.exists({ username })) { res.status(409).envelopeError('USERNAME_EXISTS', 'This login ID is already taken. Choose another.', undefined, 409); return; }
    const temporaryPassword = req.body.password || generatePassword();
    const userId = `usr_fadmin_${crypto.randomUUID()}`;
    await runInTransaction(async (session) => {
      await User.create([{
        userId, username, role: 'admin', fullName: req.body.fullName, phone: req.body.phone, email: req.body.email || undefined,
        hospitalId, passwordHash: await hashPassword(temporaryPassword), mustChangePassword: true, verificationStatus: 'verified', status: 'active', simulation: true,
      }], { session });
      await Hospital.updateOne({ hospitalId }, { $addToSet: { adminUserIds: userId } }, { session: session ?? undefined });
    });
    res.status(201).envelope({
      admin: { userId, username, fullName: req.body.fullName, hospitalId, hospitalName: hospital.name },
      credentials: { loginId: username, temporaryPassword },
    }, 'Facility admin created. Share the login details privately.');
  } catch (err) { fail(res, err, next); }
});

facilityOpsRouter.post('/:hospitalId/admins/:userId/reset-password', ...guard, validate({ params: HospitalParam.extend({ userId: z.string().trim().min(3).max(120) }) }), auditTag('FACILITY_ADMIN_PASSWORD_RESET', 'user'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const hospitalId = scoped(req, res); if (!hospitalId) return;
    if (req.user!.role !== 'system_admin') { res.status(403).envelopeError('SYSTEM_ADMIN_REQUIRED', 'Only the system administrator can reset facility admin passwords.', undefined, 403); return; }
    const admin: any = await User.findOne({ userId: req.params.userId, hospitalId, role: 'admin' });
    if (!admin) { res.status(404).envelopeError('ADMIN_NOT_FOUND', 'Facility admin not found.', undefined, 404); return; }
    const temporaryPassword = generatePassword();
    admin.passwordHash = await hashPassword(temporaryPassword);
    admin.mustChangePassword = true;
    admin.lockout = { failedAttempts: 0, lockedUntil: null, lastFailedAt: null };
    await admin.save();
    res.envelope({ credentials: { loginId: admin.username, temporaryPassword } }, 'New password issued.');
  } catch (err) { fail(res, err, next); }
});

/* ======================= Wards & beds ======================= */
const WardBody = z.object({
  name: z.string().trim().min(2).max(120),
  wardType: z.enum(WARD_TYPES).default('general'),
  totalBeds: z.number().int().min(0).max(5000),
  occupiedBeds: z.number().int().min(0).max(5000).default(0),
  notes: z.string().trim().max(500).optional(),
}).refine((v) => v.occupiedBeds <= v.totalBeds, { message: 'Occupied beds cannot exceed total beds.', path: ['occupiedBeds'] });
const WardPatch = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  wardType: z.enum(WARD_TYPES).optional(),
  totalBeds: z.number().int().min(0).max(5000).optional(),
  occupiedBeds: z.number().int().min(0).max(5000).optional(),
  notes: z.string().trim().max(500).optional(),
});
const WardParams = HospitalParam.extend({ wardId: z.string().trim().min(3).max(80) });

facilityOpsRouter.get('/:hospitalId/wards', ...guard, validate({ params: HospitalParam }), async (req: Request, res: Response, next: NextFunction) => {
  try { const hospitalId = scoped(req, res); if (!hospitalId) return; res.envelope({ wards: (await FacilityWard.find({ hospitalId }).sort({ name: 1 }).lean()).map(strip) }); }
  catch (err) { fail(res, err, next); }
});
facilityOpsRouter.post('/:hospitalId/wards', ...guard, validate({ params: HospitalParam, body: WardBody }), auditTag('FACILITY_WARD_CREATE', 'facility'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const hospitalId = scoped(req, res); if (!hospitalId) return;
    if (!(await existingHospital(res, hospitalId))) return;
    const ward = await FacilityWard.create({ ...req.body, wardId: `WARD-${crypto.randomUUID()}`, hospitalId, updatedBy: req.user!.id });
    res.status(201).envelope({ ward: strip(ward.toObject()) });
  } catch (err) { fail(res, err, next); }
});
facilityOpsRouter.patch('/:hospitalId/wards/:wardId', ...guard, validate({ params: WardParams, body: WardPatch }), auditTag('FACILITY_WARD_UPDATE', 'facility'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const hospitalId = scoped(req, res); if (!hospitalId) return;
    const ward: any = await FacilityWard.findOne({ wardId: req.params.wardId, hospitalId });
    if (!ward) { res.status(404).envelopeError('WARD_NOT_FOUND', 'Ward not found.', undefined, 404); return; }
    Object.assign(ward, req.body, { updatedBy: req.user!.id });
    if (ward.occupiedBeds > ward.totalBeds) { res.status(400).envelopeError('INVALID_BEDS', 'Occupied beds cannot exceed total beds.', undefined, 400); return; }
    await ward.save();
    res.envelope({ ward: strip(ward.toObject()) });
  } catch (err) { fail(res, err, next); }
});
facilityOpsRouter.delete('/:hospitalId/wards/:wardId', ...guard, validate({ params: WardParams }), auditTag('FACILITY_WARD_DELETE', 'facility'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const hospitalId = scoped(req, res); if (!hospitalId) return;
    const result = await FacilityWard.deleteOne({ wardId: req.params.wardId, hospitalId });
    if (!result.deletedCount) { res.status(404).envelopeError('WARD_NOT_FOUND', 'Ward not found.', undefined, 404); return; }
    res.envelope({ deleted: true });
  } catch (err) { fail(res, err, next); }
});

/* ======================= Medicines & stock ======================= */
const MedicineBody = z.object({
  name: z.string().trim().min(2).max(160),
  form: z.enum(MEDICINE_FORMS).default('tablet'),
  strength: z.string().trim().max(60).optional().default(''),
  unit: z.string().trim().max(30).optional().default('units'),
  stock: z.number().int().min(0).max(10_000_000).default(0),
  reorderLevel: z.number().int().min(0).max(10_000_000).default(0),
  batchNo: z.string().trim().max(60).optional(),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
const MedicinePatch = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  form: z.enum(MEDICINE_FORMS).optional(),
  strength: z.string().trim().max(60).optional(),
  unit: z.string().trim().max(30).optional(),
  reorderLevel: z.number().int().min(0).max(10_000_000).optional(),
  batchNo: z.string().trim().max(60).optional(),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
});
const StockBody = z.object({
  quantity: z.number().int().min(1).max(10_000_000),
  reason: z.enum(STOCK_REASONS),
  direction: z.enum(['in', 'out']),
  note: z.string().trim().max(300).optional(),
});
const ItemParams = HospitalParam.extend({ itemId: z.string().trim().min(3).max(80) });

facilityOpsRouter.get('/:hospitalId/medicines', ...guard, validate({ params: HospitalParam }), async (req: Request, res: Response, next: NextFunction) => {
  try { const hospitalId = scoped(req, res); if (!hospitalId) return; res.envelope({ medicines: (await FacilityMedicine.find({ hospitalId }).sort({ name: 1 }).lean()).map(strip) }); }
  catch (err) { fail(res, err, next); }
});
facilityOpsRouter.post('/:hospitalId/medicines', ...guard, validate({ params: HospitalParam, body: MedicineBody }), auditTag('FACILITY_MEDICINE_CREATE', 'facility'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const hospitalId = scoped(req, res); if (!hospitalId) return;
    if (!(await existingHospital(res, hospitalId))) return;
    const by = req.user!.id;
    const itemId = `MED-${crypto.randomUUID()}`;
    const medicine = await runInTransaction(async (session) => {
      const [created] = await FacilityMedicine.create([{ ...req.body, expiryDate: req.body.expiryDate ? new Date(req.body.expiryDate) : undefined, itemId, hospitalId, updatedBy: by }], { session });
      if (req.body.stock > 0) await FacilityStockMovement.create([{ movementId: `MOV-${crypto.randomUUID()}`, itemId, hospitalId, change: req.body.stock, reason: 'received', note: 'Opening stock', balanceAfter: req.body.stock, by }], { session });
      return created;
    });
    res.status(201).envelope({ medicine: strip(medicine.toObject()) });
  } catch (err) { fail(res, err, next); }
});
facilityOpsRouter.patch('/:hospitalId/medicines/:itemId', ...guard, validate({ params: ItemParams, body: MedicinePatch }), auditTag('FACILITY_MEDICINE_UPDATE', 'facility'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const hospitalId = scoped(req, res); if (!hospitalId) return;
    const { expiryDate, ...rest } = req.body;
    const update: Record<string, unknown> = { ...rest, updatedBy: req.user!.id };
    const unset: Record<string, ''> = {};
    if (expiryDate === '') unset.expiryDate = ''; else if (expiryDate) update.expiryDate = new Date(expiryDate);
    const medicine: any = await FacilityMedicine.findOneAndUpdate({ itemId: req.params.itemId, hospitalId }, { $set: update, ...(Object.keys(unset).length ? { $unset: unset } : {}) }, { new: true }).lean();
    if (!medicine) { res.status(404).envelopeError('ITEM_NOT_FOUND', 'Medicine not found.', undefined, 404); return; }
    res.envelope({ medicine: strip(medicine) });
  } catch (err) { fail(res, err, next); }
});
/** Receive or issue stock. Atomic: never lets stock go below zero; every change is logged. */
facilityOpsRouter.post('/:hospitalId/medicines/:itemId/stock', ...guard, validate({ params: ItemParams, body: StockBody }), auditTag('FACILITY_STOCK_MOVEMENT', 'facility'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const hospitalId = scoped(req, res); if (!hospitalId) return;
    const { quantity, reason, direction, note } = req.body;
    if (direction === 'in' && !['received', 'adjustment'].includes(reason)) { res.status(400).envelopeError('INVALID_REASON', 'Stock coming in must be "received" or "adjustment".', undefined, 400); return; }
    if (direction === 'out' && reason === 'received') { res.status(400).envelopeError('INVALID_REASON', 'Stock going out cannot be "received".', undefined, 400); return; }
    const change = direction === 'in' ? quantity : -quantity;
    const byUser: any = await User.findOne({ userId: req.user!.id }).select('fullName').lean();
    const medicine: any = await runInTransaction(async (session) => {
      const updated: any = await FacilityMedicine.findOneAndUpdate(
        { itemId: req.params.itemId, hospitalId, ...(change < 0 ? { stock: { $gte: -change } } : {}) },
        { $inc: { stock: change }, $set: { updatedBy: req.user!.id } },
        { new: true, session },
      ).lean();
      if (!updated) {
        const exists = await FacilityMedicine.exists({ itemId: req.params.itemId, hospitalId });
        throw Object.assign(new Error(exists ? 'Not enough stock for this change.' : 'Medicine not found.'), { statusCode: exists ? 409 : 404, code: exists ? 'INSUFFICIENT_STOCK' : 'ITEM_NOT_FOUND' });
      }
      await FacilityStockMovement.create([{ movementId: `MOV-${crypto.randomUUID()}`, itemId: req.params.itemId, hospitalId, change, reason, note, balanceAfter: updated.stock, by: req.user!.id, byName: byUser?.fullName }], { session });
      return updated;
    });
    res.envelope({ medicine: strip(medicine) }, direction === 'in' ? 'Stock added.' : 'Stock issued.');
  } catch (err) { fail(res, err, next); }
});
facilityOpsRouter.get('/:hospitalId/medicines/:itemId/movements', ...guard, validate({ params: ItemParams }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const hospitalId = scoped(req, res); if (!hospitalId) return;
    const movements = await FacilityStockMovement.find({ itemId: req.params.itemId, hospitalId }).sort({ createdAt: -1 }).limit(50).lean();
    res.envelope({ movements: movements.map(strip) });
  } catch (err) { fail(res, err, next); }
});
facilityOpsRouter.delete('/:hospitalId/medicines/:itemId', ...guard, validate({ params: ItemParams }), auditTag('FACILITY_MEDICINE_DELETE', 'facility'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const hospitalId = scoped(req, res); if (!hospitalId) return;
    // Stock history is kept for audit even when the item is removed from the register.
    const result = await FacilityMedicine.deleteOne({ itemId: req.params.itemId, hospitalId });
    if (!result.deletedCount) { res.status(404).envelopeError('ITEM_NOT_FOUND', 'Medicine not found.', undefined, 404); return; }
    res.envelope({ deleted: true });
  } catch (err) { fail(res, err, next); }
});

/* ======================= Equipment ======================= */
const EquipmentBody = z.object({
  name: z.string().trim().min(2).max(160),
  category: z.enum(EQUIPMENT_CATEGORIES).default('other'),
  quantity: z.number().int().min(0).max(10000),
  functionalCount: z.number().int().min(0).max(10000),
  lastServicedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().trim().max(500).optional(),
}).refine((v) => v.functionalCount <= v.quantity, { message: 'Working units cannot exceed total units.', path: ['functionalCount'] });
const EquipmentPatch = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  category: z.enum(EQUIPMENT_CATEGORIES).optional(),
  quantity: z.number().int().min(0).max(10000).optional(),
  functionalCount: z.number().int().min(0).max(10000).optional(),
  lastServicedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().trim().max(500).optional(),
});
const EquipParams = HospitalParam.extend({ equipmentId: z.string().trim().min(3).max(80) });

facilityOpsRouter.get('/:hospitalId/equipment', ...guard, validate({ params: HospitalParam }), async (req: Request, res: Response, next: NextFunction) => {
  try { const hospitalId = scoped(req, res); if (!hospitalId) return; res.envelope({ equipment: (await FacilityEquipment.find({ hospitalId }).sort({ name: 1 }).lean()).map(strip) }); }
  catch (err) { fail(res, err, next); }
});
facilityOpsRouter.post('/:hospitalId/equipment', ...guard, validate({ params: HospitalParam, body: EquipmentBody }), auditTag('FACILITY_EQUIPMENT_CREATE', 'facility'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const hospitalId = scoped(req, res); if (!hospitalId) return;
    if (!(await existingHospital(res, hospitalId))) return;
    const item = await FacilityEquipment.create({ ...req.body, lastServicedAt: req.body.lastServicedAt ? new Date(req.body.lastServicedAt) : undefined, equipmentId: `EQP-${crypto.randomUUID()}`, hospitalId, updatedBy: req.user!.id });
    res.status(201).envelope({ equipment: strip(item.toObject()) });
  } catch (err) { fail(res, err, next); }
});
facilityOpsRouter.patch('/:hospitalId/equipment/:equipmentId', ...guard, validate({ params: EquipParams, body: EquipmentPatch }), auditTag('FACILITY_EQUIPMENT_UPDATE', 'facility'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const hospitalId = scoped(req, res); if (!hospitalId) return;
    const item: any = await FacilityEquipment.findOne({ equipmentId: req.params.equipmentId, hospitalId });
    if (!item) { res.status(404).envelopeError('EQUIPMENT_NOT_FOUND', 'Equipment not found.', undefined, 404); return; }
    const { lastServicedAt, ...rest } = req.body;
    Object.assign(item, rest, { updatedBy: req.user!.id });
    if (lastServicedAt) item.lastServicedAt = new Date(lastServicedAt);
    if (item.functionalCount > item.quantity) { res.status(400).envelopeError('INVALID_COUNT', 'Working units cannot exceed total units.', undefined, 400); return; }
    await item.save();
    res.envelope({ equipment: strip(item.toObject()) });
  } catch (err) { fail(res, err, next); }
});
facilityOpsRouter.delete('/:hospitalId/equipment/:equipmentId', ...guard, validate({ params: EquipParams }), auditTag('FACILITY_EQUIPMENT_DELETE', 'facility'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const hospitalId = scoped(req, res); if (!hospitalId) return;
    const result = await FacilityEquipment.deleteOne({ equipmentId: req.params.equipmentId, hospitalId });
    if (!result.deletedCount) { res.status(404).envelopeError('EQUIPMENT_NOT_FOUND', 'Equipment not found.', undefined, 404); return; }
    res.envelope({ deleted: true });
  } catch (err) { fail(res, err, next); }
});
